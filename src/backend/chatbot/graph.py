"""LangGraph loop for one chat turn: the model picks tools, the server runs them, the model answers.

think -> act -> think ... -> finish. LangGraph only routes; every lookup is a plain function in tools.py.
Two safety nets keep a small model from being worse than the data: if it answers an order question
without calling any tool, `guard` runs the deterministic planner's lookups and lets it answer again;
if it is down or its answer is unusable, the plain facts are shown.
"""

from contextlib import closing
from datetime import datetime
import json
import logging
from pathlib import Path
import re
from typing import Any, Callable, TypedDict

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from ..db import connect
from ..features import _utc_text
from ..ollama import QWEN_MODEL, Transport
from .planner import is_overview_question, plan, region_in_question, unresolved_order_number
from .prompts import (BUDGET_SECONDS, INCOMPLETE_NOTE, MAX_CALLS_PER_ROUND, MAX_REPLY_TOKENS, MAX_ROUNDS,
                      answer_language_reminder,
                      MAX_TOOL_CALLS)
from .tools import TOOLS, ToolError, run_tool, tool_schemas

LOG = logging.getLogger("backend.chatbot")
# Snake_case words in a reply mean the model leaked a field or tool name; the plain facts are shown instead.
LEAK = re.compile(r"\b[a-z]+(?:_[a-z0-9]+)+\b")
THINK_BLOCK = re.compile(r"<think>.*?</think>", re.S)
# What the deterministic planner's lookups are called as tools.
def _call(name: str, **arguments) -> dict:
    return {"function": {"name": name, "arguments": arguments}}


PLANNED_TOOL = {"worklist": ("get_high_risk_orders", {}), "kpis": ("get_decision_stats", {}),
                "warehouse": ("get_warehouse_load", {}), "safest": ("list_orders", {"sort": "safest", "limit": 1})}


class ChatState(TypedDict, total=False):
    messages: list[dict]  # the conversation the model sees, tool results included
    blocks: list[str]  # plain-sentence results, shown as the answer if the model cannot phrase them
    steps: list[str]
    seen: list[str]  # tool calls already made, so repeats are not read twice
    called: list[str]  # names of the tools that ran
    order_id: int | None
    order_ref: str | None
    pending: list[dict[str, Any]]
    rounds: int
    reply: str
    incomplete: bool
    model_failed: bool
    guarded: bool
    fallback: bool


def build_chat_graph(db_path: Path, *, history: list[dict], scope_order: int | None, now: datetime,
                     send: Transport, monotonic: Callable[[], float], started: float):
    schemas = tool_schemas()

    def remaining() -> float:
        return max(1.0, BUDGET_SECONDS - (monotonic() - started))

    def execute(state: ChatState, calls: list[dict]) -> ChatState:
        write = get_stream_writer()
        messages, blocks, steps, seen, called = (list(state.get(k, []))
                                                 for k in ("messages", "blocks", "steps", "seen", "called"))
        order_id, order_ref = state.get("order_id"), state.get("order_ref")
        reminder = answer_language_reminder(history[-1]["content"])
        messages.append({"role": "assistant", "content": "", "tool_calls": calls})
        for call in calls:
            function = call.get("function") or {}
            name, raw_args = function.get("name"), function.get("arguments")
            key = json.dumps([name, raw_args], sort_keys=True, default=str)
            if key in seen:
                content = "You already read this; use the earlier result."
            elif len(seen) >= MAX_TOOL_CALLS:
                content = "No more lookups are allowed; answer with what you have."
            else:
                seen.append(key)
                if name in TOOLS:
                    write({"type": "status", "text": TOOLS[name].status})
                try:
                    result = run_tool(db_path, now, name, raw_args)
                except ToolError as exc:
                    content = f"The lookup could not be done: {exc}."
                else:
                    content = result.facts
                    called.append(name)
                    blocks.append(result.facts)
                    steps.append(result.step)
                    if result.order_id is not None:
                        order_id, order_ref = result.order_id, result.order_ref
                LOG.info("assistant called %s", name)
            messages.append({"role": "tool", "tool_name": name, "content": content + reminder})
        return {"messages": messages, "blocks": blocks, "steps": steps, "seen": seen, "called": called,
                "order_id": order_id, "order_ref": order_ref}

    def planned_calls() -> list[dict]:
        question = history[-1]["content"]
        with closing(connect(db_path, readonly=True)) as db:
            names, order = plan(db, question, history, scope_order)
            typo = unresolved_order_number(db, question) if names else None
        if typo:  # the person named an order that does not exist: say so instead of reading some other order
            return [_call("get_order_details", order=typo)]
        region = region_in_question(question) if names else None
        calls = []
        for name in names:
            if name == "order":
                calls.append(_call("get_order_details", order=str(order)))
            elif region and name in ("worklist", "safest"):  # 'orders in Stockholm' is a search, not the risk queue
                calls.append(_call("list_orders", region=region, **({"sort": "safest"} if name == "safest" else {})))
            else:
                tool, arguments = PLANNED_TOOL[name]
                calls.append(_call(tool, **arguments))
        return calls

    def think(state: ChatState) -> ChatState:
        write = get_stream_writer()
        rounds = state.get("rounds", 0)
        payload = {"model": QWEN_MODEL, "messages": state["messages"], "stream": True, "think": False,
                   "options": {"temperature": 0.1, "num_predict": MAX_REPLY_TOKENS}}
        if rounds < MAX_ROUNDS - 1:
            payload["tools"] = schemas
        # A data question answered without a lookup will be sent back by `guard`, so hold its words
        # instead of streaming an answer that is about to be thrown away. Small talk streams at once.
        hold = not state.get("blocks") and not state.get("guarded") and bool(planned_calls())
        reply, calls, incomplete = "", [], False
        try:
            response = send("chat", payload, remaining())
            for chunk in ([response] if isinstance(response, dict) else response):
                message = chunk.get("message") or {}
                calls += message.get("tool_calls") or []
                if piece := message.get("content") or "":
                    reply += piece
                    if not hold:
                        write({"type": "token", "text": piece})
                if monotonic() - started > BUDGET_SECONDS:
                    incomplete = True
                    break
        except (OSError, ValueError, KeyError):
            return {"model_failed": True, "pending": [], "reply": ""}
        if hold and incomplete and reply:
            write({"type": "token", "text": reply})  # out of time: no second chance, show what there is
        if calls and reply and not hold:
            write({"type": "replace", "text": ""})  # words said before a lookup are not the answer
            reply = ""
        return {"reply": reply, "pending": [] if incomplete else calls[:MAX_CALLS_PER_ROUND],
                "incomplete": incomplete, "rounds": rounds + 1}

    def after_think(state: ChatState) -> str:
        if state.get("model_failed"):
            return "fallback"
        if state["pending"]:
            return "act"
        if not state.get("guarded") and not state.get("incomplete") and missing_calls(state):
            return "guard"
        return "finish"

    def missing_calls(state: ChatState) -> list[dict]:
        """Lookups the planner expects for this question that the model never made."""
        called = state.get("called", [])
        return [c for c in planned_calls() if c["function"]["name"] not in called]

    def correct_calls(calls: list[dict]) -> list[dict]:
        """The model looked up the wrong kind of thing (usually the order on screen for a question about all
        orders, or the risk queue for a region search): read what the question asks for instead."""
        names = [(c.get("function") or {}).get("name") for c in calls]
        question = history[-1]["content"]
        with closing(connect(db_path, readonly=True)) as db:
            overview = (all(n in ("get_order_details", "get_order_timeline") for n in names)
                        and is_overview_question(db, question))
        region_search = region_in_question(question) is not None and "list_orders" not in names
        return (planned_calls() or calls) if overview or region_search else calls

    def act(state: ChatState) -> ChatState:
        return execute(state, correct_calls(state["pending"]))

    def guard(state: ChatState) -> ChatState:
        """The model skipped a lookup the question needs: read it, then let the model answer again."""
        get_stream_writer()({"type": "replace", "text": ""})  # whatever it said without the data is dropped
        return {**execute(state, missing_calls(state)), "guarded": True}

    def fallback(state: ChatState) -> ChatState:
        """The model is unreachable: read what the planner picks so the person still sees the data."""
        update = execute(state, planned_calls()) if not state.get("blocks") and planned_calls() else {}
        return {**update, "fallback": True}

    def finish(state: ChatState) -> ChatState:
        write = get_stream_writer()
        facts = "\n\n".join(state.get("blocks", []))
        reply = THINK_BLOCK.sub("", state.get("reply", "")).strip()
        incomplete, fell_back = state.get("incomplete", False), state.get("fallback", False)
        if fell_back or not reply or LEAK.search(reply):
            fell_back = True
            reply = ("The assistant could not put this into words just now. Here is what the data says:\n\n" + facts
                     if facts else "The assistant is not available right now. Please try again in a moment.")
            write({"type": "replace", "text": reply})
        elif incomplete:
            reply += f"\n\n{INCOMPLETE_NOTE}"
            write({"type": "token", "text": f"\n\n{INCOMPLETE_NOTE}"})
        write({"type": "done", "reply": reply, "incomplete": incomplete, "fallback": fell_back,
               "steps": state.get("steps", []), "as_of": _utc_text(now),
               "order_id": state.get("order_id"), "order_ref": state.get("order_ref")})
        return {}

    graph = StateGraph(ChatState)
    for name, node in (("think", think), ("act", act), ("guard", guard), ("fallback", fallback), ("finish", finish)):
        graph.add_node(name, node)
    graph.add_edge(START, "think")
    graph.add_conditional_edges("think", after_think, ["act", "guard", "fallback", "finish"])
    graph.add_edge("act", "think")
    graph.add_edge("guard", "think")
    graph.add_edge("fallback", "finish")
    graph.add_edge("finish", END)
    return graph.compile()
