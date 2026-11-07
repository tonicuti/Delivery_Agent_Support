"""Allow-listed, read-only tools the chatbot model may call; every result is plain-sentence facts.

The model only picks a tool name and arguments. Names and arguments are validated here, SQL lives in
`queries.py`, and nothing in this module can write to the database.
"""

from contextlib import closing
from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path
from typing import Callable

from sqlite3 import Connection

from ..db import connect
from . import facts, history
from .planner import find_order
from .prompts import DEFAULT_LIST_ROWS, HISTORY_SEARCH_ROWS, MAX_FACT_CHARS, MAX_LIST_ROWS

RISK_BANDS = ["Low", "Medium", "High"]


class ToolError(ValueError):
    """The model asked for an unknown tool or passed arguments that do not fit it."""


@dataclass(frozen=True)
class ToolResult:
    facts: str
    step: str
    order_id: int | None = None
    order_ref: str | None = None


@dataclass(frozen=True)
class Tool:
    name: str
    use_when: str  # shown to the model both as the tool description and in the prompt's tool guide
    status: str  # progress line shown to the person while the tool runs
    run: Callable[[Connection, datetime, dict], ToolResult]
    parameters: dict[str, dict]
    required: tuple[str, ...] = ()

    def schema(self) -> dict:
        return {"type": "function", "function": {
            "name": self.name, "description": self.use_when,
            "parameters": {"type": "object", "properties": self.parameters, "required": list(self.required)}}}


def _order_reference(db: Connection, args: dict) -> tuple[int | None, str | None]:
    order_id = find_order(db, str(args["order"]))
    if order_id is None:
        return None, None
    row = db.execute("SELECT external_order_id FROM customer_order WHERE order_id = ?", (order_id,)).fetchone()
    return order_id, row["external_order_id"]


def _order_details(db: Connection, now: datetime, args: dict) -> ToolResult:
    order_id, ref = _order_reference(db, args)
    if order_id is None:
        return ToolResult(f"There is no order {args['order']}.", "Looked for an order that does not exist")
    return ToolResult(facts.order_facts(db, now, order_id), f"Read the details of {ref}", order_id, ref)


def _order_timeline(db: Connection, now: datetime, args: dict) -> ToolResult:
    order_id, ref = _order_reference(db, args)
    if order_id is None:
        return ToolResult(f"There is no order {args['order']}.", "Looked for an order that does not exist")
    return ToolResult(facts.timeline_facts(db, now, order_id), f"Read the history of {ref}", order_id, ref)


def _list_orders(db: Connection, now: datetime, args: dict) -> ToolResult:
    text = facts.orders_facts(db, now, region=args.get("region"), risk_band=args.get("risk_band"),
                              sort=args.get("sort", "riskiest"), limit=args.get("limit", DEFAULT_LIST_ROWS))
    return ToolResult(text, "Searched the orders")


def _chat_history(db: Connection, now: datetime, args: dict) -> ToolResult:
    order_id = None
    if "order" in args:
        order_id, _ = _order_reference(db, args)
        if order_id is None:
            return ToolResult(f"There is no order {args['order']}.", "Looked for an order that does not exist")
    text = history.history_facts(db, now, keyword=args.get("keyword"), order_id=order_id,
                                 limit=args.get("limit", HISTORY_SEARCH_ROWS))
    return ToolResult(text, "Looked through earlier chats")


def _simple(reader: Callable[[Connection, datetime], str], step: str) -> Callable[[Connection, datetime, dict], ToolResult]:
    return lambda db, now, args: ToolResult(reader(db, now), step)


ORDER_PARAM = {"order": {"type": "string", "description": "Order number, for example 1002 or ORDER-1002"}}

TOOLS: dict[str, Tool] = {tool.name: tool for tool in (
    Tool("get_high_risk_orders",
         "Orders most at risk of arriving late right now, riskiest first, with reasons, suggested action and "
         "decision status. Use for: what needs attention, priorities, the shift briefing, which orders are risky.",
         "Checking which orders are most at risk…",
         _simple(facts.worklist_facts, "Checked which orders are most at risk"), {}),
    Tool("get_order_details",
         "Full picture of ONE order: chance of being late, why, promised time, items and stock, shipments, "
         "suggested action and decision. Use for: any question about a specific order, why it is flagged, "
         "what to do about it, where its shipment is.",
         "Reading the order details…", _order_details, ORDER_PARAM, ("order",)),
    Tool("get_order_timeline",
         "What happened to ONE order over time (promise, stock, shipment, checks, alerts, decisions), newest "
         "first. Use for: history, what changed, when something happened.",
         "Reading what happened with the order…", _order_timeline, ORDER_PARAM, ("order",)),
    Tool("list_orders",
         "Search ALL orders, optionally by region and/or risk level, sorted riskiest first or safest first. Use for: "
         "which order has the LOWEST risk or is safest (sort=safest, limit=1), the order with the highest risk, orders in "
         "one region, all medium-risk orders. Never use get_order_details to compare orders.",
         "Searching the orders…", _list_orders,
         {"region": {"type": "string", "description": "Region name, for example Stockholm"},
          "risk_band": {"type": "string", "enum": RISK_BANDS, "description": "Risk level"},
          "sort": {"type": "string", "enum": ["riskiest", "safest"], "description": "riskiest = highest risk first (default), safest = lowest risk first"},
          "limit": {"type": "integer", "description": f"How many to show, at most {MAX_LIST_ROWS}"}}),
    Tool("search_chat_history",
         "Search what was asked and answered in earlier chats by the team, newest first, optionally by a word "
         "and/or an order. Use for: what we discussed before, what someone asked yesterday, earlier advice about "
         "an order. Quote it as past conversation; the order's current facts still come from the other tools.",
         "Looking through earlier chats…", _chat_history,
         {"keyword": {"type": "string", "description": "A word or short phrase to look for"},
          **ORDER_PARAM,
          "limit": {"type": "integer", "description": f"How many messages, at most {MAX_LIST_ROWS}"}}),
    Tool("get_warehouse_load",
         "Shipments in each warehouse by progress. Use for: warehouse workload, picking backlog, how busy a "
         "warehouse is.",
         "Checking the warehouses…", _simple(facts.warehouse_facts, "Checked the warehouses"), {}),
    Tool("get_decision_stats",
         "How the team is doing: orders flagged, alerts read, accepted / changed / dismissed suggestions. Use "
         "for: progress, statistics, how decisions are going.",
         "Looking at how things are going…", _simple(facts.kpi_facts, "Looked at how things are going"), {}),
)}


def tool_schemas() -> list[dict]:
    return [tool.schema() for tool in TOOLS.values()]


def tool_guide() -> str:
    """One line per tool for the system prompt, so the model knows which question needs which lookup."""
    return "\n".join(f"- {tool.name}: {tool.use_when}" for tool in TOOLS.values())


def _coerce(name: str, spec: dict, value: object) -> object:
    kind = spec["type"]
    if kind == "integer":
        try:
            number = int(value)
        except (TypeError, ValueError) as exc:
            raise ToolError(f"{name} must be a whole number") from exc
        return max(1, min(number, MAX_LIST_ROWS))
    text = str(value).strip()
    if not text or len(text) > 60:
        raise ToolError(f"{name} must be 1 to 60 characters")
    if "enum" in spec:
        match = next((option for option in spec["enum"] if option.lower() == text.lower()), None)
        if match is None:
            raise ToolError(f"{name} must be one of {', '.join(spec['enum'])}")
        return match
    return text


def validate_arguments(tool: Tool, raw: object) -> dict:
    """Keep only declared arguments, require the mandatory ones and fix their types; never trust the model."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "{}")
        except ValueError as exc:
            raise ToolError("arguments must be a JSON object") from exc
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ToolError("arguments must be an object")
    args = {key: _coerce(key, tool.parameters[key], value) for key, value in raw.items()
            if key in tool.parameters and value not in (None, "")}
    missing = [key for key in tool.required if key not in args]
    if missing:
        raise ToolError(f"{tool.name} needs {', '.join(missing)}")
    return args


def run_tool(db_path: Path, now: datetime, name: object, raw_args: object) -> ToolResult:
    tool = TOOLS.get(name) if isinstance(name, str) else None
    if tool is None:
        raise ToolError(f"there is no tool called {name}; the tools are {', '.join(TOOLS)}")
    args = validate_arguments(tool, raw_args)
    with closing(connect(db_path, readonly=True)) as db:
        result = tool.run(db, now, args)
    if len(result.facts) > MAX_FACT_CHARS:
        text = result.facts[:MAX_FACT_CHARS].rsplit("\n", 1)[0] + "\n(The rest was left out to keep this short.)"
        return ToolResult(text, result.step, result.order_id, result.order_ref)
    return result
