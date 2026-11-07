"""HTTP JSON API for the planner console; a thin layer over the domain modules."""

from contextlib import closing
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
from pathlib import Path
import re
import sqlite3
import threading
from typing import Callable
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen
from uuid import uuid4

from . import queries
from .agent.mock_recommendation import mock_recommendation
from .agent.playbooks import PLAYBOOKS
from .chatbot import (ChatUnavailable, LANGUAGES, chat_events, draft_customer_message, run_chat, valid_chat_id,
                      validate_messages)
from .ollama import Transport
from .labels import ACTION_TITLES, DECISION_WORDS, FEATURE_WORDS, ROLE_WORDS, STAGE_WORDS, STOCK_WORDS
from .decisions import DECISIONS, DISMISS_REASONS, ROLES, record_decision
from .agent.recommendations import OLLAMA_ENDPOINT, QWEN_MODEL
from .db import connect
from .features import _parse_utc, _utc_text
from .alerts.notifications import acknowledge_alert
from .replacements import approve_replacement, refresh_replacement_tasks
from .scheduler import scheduler_once
from .worklist import freeze_shift

LOG = logging.getLogger("backend.api")

SCHEDULER_MODES = ("off", "offline", "live")
RUN_MODES = ("mock", "offline", "live")
SCHEDULER_INTERVAL_SECONDS = 15
OLLAMA_PROBE_TIMEOUT_SECONDS = 2
MAX_BODY_BYTES = 64 * 1024
FUTURE_TOLERANCE = timedelta(minutes=1)


class Stream:
    """A handler result that is sent as server-sent events while it is still being produced."""

    def __init__(self, events):
        self.events = events


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


@dataclass
class ApiContext:
    db_path: Path
    clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc).replace(microsecond=0)
    ollama_endpoint: str = OLLAMA_ENDPOINT
    llm_transport: Transport | None = None  # tests inject a fake; None talks to Ollama
    scheduler_mode: str = "off"
    scheduler_status: dict = field(default_factory=lambda: {
        "last_tick_utc": None, "last_runs": 0, "last_error": None})
    _scheduler_lock: threading.Lock = field(default_factory=threading.Lock)
    _order_locks: dict[int, threading.Lock] = field(default_factory=dict)
    _registry_lock: threading.Lock = field(default_factory=threading.Lock)

    def order_lock(self, order_id: int) -> threading.Lock:
        with self._registry_lock:
            return self._order_locks.setdefault(order_id, threading.Lock())


Handler = Callable[[ApiContext, dict, dict, dict], object]
ROUTES: list[tuple[str, re.Pattern, Handler]] = []


def route(method: str, pattern: str):
    def register(function: Handler) -> Handler:
        ROUTES.append((method, re.compile(f"^{pattern}$"), function))
        return function
    return register


def _instant(value: object, field_name: str) -> datetime:
    if not isinstance(value, str):
        raise ApiError(400, f"{field_name} must be an ISO 8601 timestamp with a timezone")
    try:
        return _parse_utc(value)
    except ValueError as exc:
        raise ApiError(400, f"{field_name} must be an ISO 8601 timestamp with a timezone") from exc


def _text(body: dict, key: str, *, required: bool = True, limit: int = 500) -> str | None:
    value = body.get(key)
    if value is None or value == "":
        if required:
            raise ApiError(400, f"{key} is required")
        return None
    if not isinstance(value, str) or len(value) > limit:
        raise ApiError(400, f"{key} must be text up to {limit} characters")
    return value.strip()


def _read(ctx: ApiContext):
    return closing(connect(ctx.db_path, readonly=True))


def _write(ctx: ApiContext):
    return closing(connect(ctx.db_path))


def _require_order(db: sqlite3.Connection, order_id: int) -> None:
    if db.execute("SELECT 1 FROM customer_order WHERE order_id = ?", (order_id,)).fetchone() is None:
        raise ApiError(404, f"order {order_id} does not exist")


def _ollama_status(ctx: ApiContext) -> dict:
    base = ctx.ollama_endpoint.rsplit("/api/", 1)[0]
    try:
        with urlopen(f"{base}/api/tags", timeout=OLLAMA_PROBE_TIMEOUT_SECONDS) as response:
            names = [m.get("name") for m in json.load(response).get("models", [])]
        return {"reachable": True, "model": QWEN_MODEL, "model_present": QWEN_MODEL in names,
                "error": None}
    except (OSError, ValueError) as exc:
        return {"reachable": False, "model": QWEN_MODEL, "model_present": False,
                "error": str(exc)[:200]}


@route("GET", "/api/health")
def health(ctx, params, query, body):
    with _read(ctx) as db:
        return {"status": "ok", "schema_version": db.execute("PRAGMA user_version").fetchone()[0]}


@route("GET", "/api/system")
def system(ctx, params, query, body):
    return {**health(ctx, params, query, body), "server_time_utc": _utc_text(ctx.clock()),
            "ollama": _ollama_status(ctx), "scheduler": _scheduler_view(ctx)}


@route("GET", "/api/meta")
def meta(ctx, params, query, body):
    return {"playbooks": PLAYBOOKS, "roles": list(ROLES), "decisions": list(DECISIONS),
            "dismiss_reasons": DISMISS_REASONS, "languages": LANGUAGES,
            "labels": {"features": FEATURE_WORDS, "stock": STOCK_WORDS, "stages": STAGE_WORDS,
                       "actions": ACTION_TITLES, "decisions": DECISION_WORDS, "roles": ROLE_WORDS},
            "stale_after_minutes": int(queries.STALE_AFTER.total_seconds() // 60)}


@route("GET", "/api/kpis")
def kpis(ctx, params, query, body):
    with _read(ctx) as db:
        return queries.kpis(db, ctx.clock())


@route("GET", "/api/overview")
def overview(ctx, params, query, body):
    with _read(ctx) as db:
        return queries.overview(db, ctx.clock())


@route("GET", "/api/worklist")
def worklist(ctx, params, query, body):
    with _read(ctx) as db:
        return {"now": _utc_text(ctx.clock()), "items": queries.worklist(db, ctx.clock())}


@route("GET", "/api/orders")
def orders(ctx, params, query, body):
    with _read(ctx) as db:
        return {"now": _utc_text(ctx.clock()), "items": queries.list_orders(db, ctx.clock())}


@route("GET", r"/api/orders/(?P<order_id>\d+)")
def order_detail(ctx, params, query, body):
    with _read(ctx) as db:
        detail = queries.order_detail(db, int(params["order_id"]), ctx.clock())
    if detail is None:
        raise ApiError(404, f"order {params['order_id']} does not exist")
    return {"now": _utc_text(ctx.clock()), **detail}


@route("POST", r"/api/orders/(?P<order_id>\d+)/run")
def run_order(ctx, params, query, body):
    """Run the LangGraph agent once. mock = offline evidence + deterministic recommendation."""
    from .agent.graph import run_agent

    order_id = int(params["order_id"])
    mode = body.get("mode", "mock")
    if mode not in RUN_MODES:
        raise ApiError(400, f"mode must be one of {', '.join(RUN_MODES)}")
    now = ctx.clock()
    as_of = _instant(body["as_of"], "as_of") if body.get("as_of") else now
    if as_of > now + FUTURE_TOLERANCE:
        raise ApiError(400, "as_of cannot be in the future")
    with _read(ctx) as db:
        _require_order(db, order_id)
    lock = ctx.order_lock(order_id)
    if not lock.acquire(blocking=False):
        raise ApiError(409, f"a run for order {order_id} is already in progress")
    try:
        state = run_agent(
            ctx.db_path, order_id, as_of, trigger_id=f"ui:{order_id}:{uuid4()}",
            offline=mode != "live",
            recommendation_client=mock_recommendation if mode == "mock" else None)
    except ValueError as exc:
        raise ApiError(400, str(exc)) from exc
    except RuntimeError as exc:
        raise ApiError(409, str(exc)) from exc
    finally:
        lock.release()
    score = state.get("score", {})
    return {
        "mode": mode, "run_id": state.get("run_id"), "decision_time": state.get("decision_time"),
        "eligibility_reason": state.get("eligibility_reason"), "p_late": score.get("p_late"),
        "risk_band": score.get("risk_band"), "promised_to_utc": score.get("promised_to_utc"),
        "next_due_at_utc": state.get("next_due_at_utc"),
        "recommendation": state.get("recommendation"),
        "recommendation_error": state.get("recommendation_error"),
        "notification_id": state.get("notification_id"),
    }


@route("POST", r"/api/alerts/(?P<notification_id>[\w-]+)/ack")
def ack_alert(ctx, params, query, body):
    try:
        with _write(ctx) as db:
            at = acknowledge_alert(db, params["notification_id"], ctx.clock())
    except LookupError as exc:
        raise ApiError(404, str(exc)) from exc
    return {"notification_id": params["notification_id"], "acknowledged_at_utc": at}


@route("POST", r"/api/recommendations/(?P<recommendation_id>[\w-]+)/decision")
def decide(ctx, params, query, body):
    """Approve, edit or dismiss. Only a role is stored, never a name."""
    try:
        with _write(ctx) as db:
            decision_id = record_decision(
                db, params["recommendation_id"], str(body.get("decision")), role=str(body.get("role")),
                at=ctx.clock(), action_id=_text(body, "action_id", required=False, limit=64),
                reason=_text(body, "reason", required=False, limit=64),
                notes=_text(body, "notes", required=False, limit=1000))
    except LookupError as exc:
        raise ApiError(404, str(exc)) from exc
    except ValueError as exc:
        raise ApiError(400, str(exc)) from exc
    return {"decision_id": decision_id}


def _chat_arguments(ctx, body):
    order_id = body.get("order_id")
    if order_id is not None and not isinstance(order_id, int):
        raise ApiError(400, "order_id must be an integer")
    chat_id = body.get("chat_id")
    if chat_id is not None and not valid_chat_id(chat_id):
        raise ApiError(400, "chat_id must be 1 to 64 letters, digits, dashes or underscores")
    try:
        validate_messages(body.get("messages"))
    except ValueError as exc:
        raise ApiError(400, str(exc)) from exc
    return dict(now=ctx.clock(), order_id=order_id, chat_id=chat_id, transport=ctx.llm_transport,
                endpoint=ctx.ollama_endpoint)


@route("POST", "/api/chat")
def chat(ctx, params, query, body):
    return run_chat(ctx.db_path, body.get("messages"), **_chat_arguments(ctx, body))


@route("POST", "/api/chat/stream")
def chat_stream(ctx, params, query, body):
    return Stream(chat_events(ctx.db_path, body.get("messages"), **_chat_arguments(ctx, body)))


@route("POST", r"/api/orders/(?P<order_id>\d+)/customer-message")
def customer_message(ctx, params, query, body):
    try:
        return draft_customer_message(ctx.db_path, int(params["order_id"]), str(body.get("language", "en")),
                                      now=ctx.clock(), transport=ctx.llm_transport,
                                      endpoint=ctx.ollama_endpoint)
    except LookupError as exc:
        raise ApiError(404, str(exc)) from exc
    except ValueError as exc:
        raise ApiError(400, str(exc)) from exc
    except ChatUnavailable as exc:
        raise ApiError(503, f"The assistant is unavailable: {exc}") from exc


@route("POST", r"/api/orders/(?P<order_id>\d+)/replacement")
def authorize_replacement(ctx, params, query, body):
    lines = body.get("lines")
    if not isinstance(lines, list) or not lines:
        raise ApiError(400, "lines must list at least one claim line with a quantity")
    quantities: dict[int, float] = {}
    for line in lines:
        try:
            claim_line_id, quantity = int(line["claim_line_id"]), float(line["quantity"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ApiError(400, "each line needs claim_line_id and quantity") from exc
        if claim_line_id in quantities:
            raise ApiError(400, "duplicate claim line")
        quantities[claim_line_id] = quantity
    inspection_id = _text(body, "inspection_id", required=False, limit=64) or str(uuid4())
    try:
        with _write(ctx) as db:
            claim = db.execute("SELECT order_id FROM claim WHERE claim_id = ?",
                               (_text(body, "claim_id", limit=64),)).fetchone()
            if claim is None or claim["order_id"] != int(params["order_id"]):
                raise ApiError(404, "claim does not belong to this order")
            ids = approve_replacement(
                db, inspection_id, body["claim_id"], _text(body, "representative_id", limit=80),
                _text(body, "finding", limit=1000), ctx.clock(), quantities)
    except ValueError as exc:
        raise ApiError(400, str(exc)) from exc
    return {"inspection_id": inspection_id, "authorization_line_ids": ids}


@route("POST", r"/api/orders/(?P<order_id>\d+)/replacement/refresh")
def refresh_replacement(ctx, params, query, body):
    with _write(ctx) as db:
        _require_order(db, int(params["order_id"]))
        done = refresh_replacement_tasks(db, int(params["order_id"]), ctx.clock())
    return {"order_id": int(params["order_id"]), "tasks_completed": done}


@route("GET", "/api/regions")
def regions(ctx, params, query, body):
    with _read(ctx) as db:
        return queries.list_regions(db)


@route("GET", "/api/shifts")
def shifts(ctx, params, query, body):
    with _read(ctx) as db:
        return queries.list_shifts(db)


@route("GET", r"/api/shifts/(?P<shift_id>[\w.:-]+)")
def shift(ctx, params, query, body):
    with _read(ctx) as db:
        detail = queries.shift_detail(db, params["shift_id"])
    if detail is None:
        raise ApiError(404, "shift does not exist")
    return detail


@route("POST", "/api/shifts")
def create_shift(ctx, params, query, body):
    shift_id = _text(body, "shift_id", limit=64)
    if not re.fullmatch(r"[\w.:-]+", shift_id):
        raise ApiError(400, "shift_id may only use letters, digits and . : _ -")
    try:
        region_id, capacity = int(body["region_id"]), int(body["capacity"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ApiError(400, "region_id and capacity must be integers") from exc
    started = _instant(body["started_at"], "started_at") if body.get("started_at") else ctx.clock()
    try:
        with _write(ctx) as db:
            candidates = freeze_shift(db, shift_id, region_id, started, capacity)
    except LookupError as exc:
        raise ApiError(404, str(exc)) from exc
    except ValueError as exc:
        raise ApiError(400, str(exc)) from exc
    return {"shift_id": shift_id, "candidates": len(candidates)}


def _scheduler_view(ctx: ApiContext) -> dict:
    return {"mode": ctx.scheduler_mode, **ctx.scheduler_status,
            "interval_seconds": SCHEDULER_INTERVAL_SECONDS}


def scheduler_tick(ctx: ApiContext, mode: str | None = None) -> int:
    """Process due orders once; offline never calls providers or Ollama."""
    mode = mode or ctx.scheduler_mode
    with ctx._scheduler_lock:
        try:
            runs = scheduler_once(ctx.db_path, now=ctx.clock(), offline=mode != "live")
            ctx.scheduler_status.update(last_tick_utc=_utc_text(ctx.clock()),
                                        last_runs=len(runs), last_error=None)
            return len(runs)
        except Exception as exc:  # keep the loop alive; surface the reason in the UI
            LOG.exception("scheduler tick failed")
            ctx.scheduler_status.update(last_tick_utc=_utc_text(ctx.clock()),
                                        last_runs=0, last_error=str(exc)[:300])
            raise


@route("GET", "/api/scheduler")
def scheduler_state(ctx, params, query, body):
    with _read(ctx) as db:
        due = queries.schedule_overview(db, ctx.clock())
    return {**_scheduler_view(ctx), "orders": due}


@route("POST", "/api/scheduler")
def set_scheduler(ctx, params, query, body):
    mode = body.get("mode")
    if mode not in SCHEDULER_MODES:
        raise ApiError(400, f"mode must be one of {', '.join(SCHEDULER_MODES)}")
    ctx.scheduler_mode = mode
    return _scheduler_view(ctx)


@route("POST", "/api/scheduler/run-once")
def scheduler_run_once(ctx, params, query, body):
    mode = body.get("mode", "offline")
    if mode not in ("offline", "live"):
        raise ApiError(400, "mode must be offline or live")
    try:
        processed = scheduler_tick(ctx, mode)
    except Exception as exc:
        raise ApiError(500, f"scheduler run failed: {exc}") from exc
    return {"processed": processed, **_scheduler_view(ctx)}


def _scheduler_loop(ctx: ApiContext, stop: threading.Event) -> None:
    while not stop.wait(SCHEDULER_INTERVAL_SECONDS):
        if ctx.scheduler_mode != "off":
            try:
                scheduler_tick(ctx)
            except Exception:
                pass  # already logged and recorded in scheduler_status


def _make_handler(ctx: ApiContext) -> type[BaseHTTPRequestHandler]:
    class RequestHandler(BaseHTTPRequestHandler):
        def _send(self, status: int, payload: object) -> None:
            data = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _stream(self, stream: Stream) -> None:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()
            events = stream.events
            try:
                for event in events:
                    self.wfile.write(f"data: {json.dumps(event, ensure_ascii=False)}\n\n".encode("utf-8"))
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                events.close()  # the reader left; stop working on their behalf
            except Exception:
                LOG.exception("stream failed")
                self.wfile.write(b'data: {"type": "error"}\n\n')

        def _body(self) -> dict:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY_BYTES:
                raise ApiError(413, "request body too large")
            if length == 0:
                return {}
            try:
                body = json.loads(self.rfile.read(length))
            except ValueError as exc:
                raise ApiError(400, "request body must be JSON") from exc
            if not isinstance(body, dict):
                raise ApiError(400, "request body must be a JSON object")
            return body

        def _dispatch(self, method: str) -> None:
            parsed = urlparse(self.path)
            allowed = False
            try:
                for route_method, pattern, handler in ROUTES:
                    match = pattern.match(parsed.path)
                    if not match:
                        continue
                    allowed = True
                    if route_method == method:
                        body = self._body() if method == "POST" else {}
                        result = handler(ctx, match.groupdict(), parse_qs(parsed.query), body)
                        if isinstance(result, Stream):
                            self._stream(result)
                        else:
                            self._send(200, result)
                        return
                raise ApiError(405 if allowed else 404,
                               "method not allowed" if allowed else "not found")
            except ApiError as exc:
                self._send(exc.status, {"error": exc.message})
            except sqlite3.OperationalError as exc:
                LOG.warning("database busy or unavailable: %s", exc)
                self._send(503, {"error": "database is busy, retry shortly"})
            except Exception:
                LOG.exception("unhandled error for %s %s", method, self.path)
                self._send(500, {"error": "internal error"})

        def do_GET(self):
            self._dispatch("GET")

        def do_POST(self):
            self._dispatch("POST")

        def log_message(self, format, *args):
            LOG.info("%s %s", self.address_string(), format % args)

    return RequestHandler


def make_server(ctx: ApiContext, host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), _make_handler(ctx))
    server.daemon_threads = True
    return server


def serve(db_path: Path, *, host: str, port: int, scheduler_mode: str) -> None:
    """Block serving the API; the scheduler thread idles while its mode is 'off'."""
    if scheduler_mode not in SCHEDULER_MODES:
        raise ValueError(f"scheduler mode must be one of {', '.join(SCHEDULER_MODES)}")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ctx = ApiContext(db_path=Path(db_path), scheduler_mode=scheduler_mode)
    stop = threading.Event()
    threading.Thread(target=_scheduler_loop, args=(ctx, stop), daemon=True,
                     name="scheduler").start()
    server = make_server(ctx, host, port)
    LOG.info("API listening on %s:%s (db=%s, scheduler=%s)", host, port, db_path, scheduler_mode)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()
