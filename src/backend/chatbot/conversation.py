"""Chat turn entry points: validate the conversation, run the tool-calling graph, stream its events."""

from contextlib import closing
from datetime import datetime
import logging
from pathlib import Path
import sqlite3
import time
from typing import Callable, Iterator

from ..db import connect
from ..features import _utc_text
from ..ollama import OLLAMA_ENDPOINT, Transport, ollama_transport
from .graph import build_chat_graph
from .history import record_turn
from .prompts import (HISTORY_TURNS, MAX_MESSAGE_CHARS, MAX_MESSAGES, build_system_prompt, detect_answer_language,
                      injection_refusal)
from .tools import tool_guide

LOG = logging.getLogger("backend.chatbot")

GRAPH_STEP_LIMIT = 40  # LangGraph's own loop guard, well above MAX_ROUNDS worth of nodes


def validate_messages(messages: object) -> list[dict]:
    if not isinstance(messages, list) or not messages or len(messages) > MAX_MESSAGES:
        raise ValueError(f"messages must be a list of 1 to {MAX_MESSAGES} items")
    clean = []
    for message in messages:
        if (not isinstance(message, dict) or message.get("role") not in ("user", "assistant")
                or not isinstance(message.get("content"), str)
                or not message["content"].strip() or len(message["content"]) > MAX_MESSAGE_CHARS):
            raise ValueError(f"each message needs a user/assistant role and 1 to {MAX_MESSAGE_CHARS} characters")
        clean.append({"role": message["role"], "content": message["content"].strip()})
    if clean[-1]["role"] != "user":
        raise ValueError("the last message must come from the user")
    return clean


def _order_reference(db_path: Path, order_id: int | None) -> str | None:
    if order_id is None:
        return None
    with closing(connect(db_path, readonly=True)) as db:
        row = db.execute("SELECT external_order_id FROM customer_order WHERE order_id = ?", (order_id,)).fetchone()
    return row["external_order_id"] if row else None


def _earlier_questions(history: list[dict]) -> list[str]:
    """Only what the person asked before. A small model copies its own earlier answers instead of looking again."""
    return [m["content"] for m in history[-(HISTORY_TURNS + 1):-1] if m["role"] == "user"]


def _initial_messages(history: list[dict], system: str) -> list[dict]:
    question = history[-1]["content"]
    return [{"role": "system", "content": system},
            {"role": "user", "content": question
             + f"\n\n(Answer in {detect_answer_language(question)}.)"}]


def _remember(db_path: Path, chat_id: str, question: str, done: dict, now: datetime) -> None:
    """Save a finished turn for the shared history; a failure here must never break the answer."""
    if done["fallback"]:  # a fallback reply is a pile of facts, not something anyone said
        return
    try:
        record_turn(db_path, chat_id, question, done["reply"], order_id=done["order_id"], now=now)
    except sqlite3.Error:
        LOG.warning("could not save the chat turn", exc_info=True)


def chat_events(db_path: Path, messages: object, *, now: datetime, order_id: int | None = None,
                chat_id: str | None = None, transport: Transport | None = None,
                endpoint: str = OLLAMA_ENDPOINT, monotonic: Callable[[], float] = time.monotonic) -> Iterator[dict]:
    """Yield status updates while tools run, then the answer word by word, then one final summary.
    With a chat_id the finished turn is saved after the answer, so a search never finds the question being asked."""
    history = validate_messages(messages)
    if refusal := injection_refusal(history[-1]["content"]):
        done = {"type": "done", "reply": refusal, "incomplete": False, "fallback": False, "steps": [],
                "as_of": _utc_text(now), "order_id": None, "order_ref": None}
        yield {"type": "token", "text": refusal}
        yield done
        return
    started = monotonic()
    system = build_system_prompt(tool_guide(), now, _order_reference(db_path, order_id), _earlier_questions(history),
                                 detect_answer_language(history[-1]["content"]))
    graph = build_chat_graph(db_path, history=history, scope_order=order_id, now=now,
                             send=transport or ollama_transport(endpoint), monotonic=monotonic, started=started)
    for event in graph.stream({"messages": _initial_messages(history, system)}, stream_mode="custom",
                              config={"recursion_limit": GRAPH_STEP_LIMIT}):
        if event["type"] == "done" and chat_id:
            _remember(db_path, chat_id, history[-1]["content"], event, now)
        yield event


def run_chat(db_path: Path, messages: object, **kwargs) -> dict:
    """Same as chat_events, but wait for the whole answer."""
    final = {}
    for event in chat_events(db_path, messages, **kwargs):
        if event["type"] == "done":
            final = event
    return {key: value for key, value in final.items() if key != "type"}
