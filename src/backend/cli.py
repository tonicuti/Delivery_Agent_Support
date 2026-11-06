"""Terminal entry point for inspecting and scoring delivery evidence."""

import argparse
from contextlib import closing
from dataclasses import asdict
from datetime import datetime
import json
import os
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory

from .agent.mock_recommendation import mock_recommendation
from .db import DEFAULT_DB, connect
from .features import FEATURE_NAMES, build_features
from .migrations import migrate
from .scoring import score_order


def _as_of(raw: str) -> datetime:
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("--as-of requires an ISO 8601 timestamp") from exc
    if value.tzinfo is None or value.utcoffset() is None:
        raise argparse.ArgumentTypeError("--as-of requires a timezone offset or Z")
    return value


def _approved_line(raw: str) -> tuple[int, float]:
    try:
        line, quantity = raw.split(":", 1)
        return int(line), float(quantity)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("--line requires CLAIM_LINE_ID:QUANTITY") from exc


def _inspect(db_path: Path) -> dict:
    with closing(connect(db_path, readonly=True)) as db:
        tables = [row[0] for row in db.execute("""
            SELECT name FROM sqlite_master WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%' ORDER BY name
        """)]
        counts = {}
        for name in tables:
            quoted = '"' + name.replace('"', '""') + '"'
            counts[name] = db.execute(f"SELECT COUNT(*) FROM {quoted}").fetchone()[0]
        return {"database": str(db_path.resolve()), "integrity": db.execute("PRAGMA integrity_check").fetchone()[0],
                "foreign_key_errors": len(db.execute("PRAGMA foreign_key_check").fetchall()), "tables": counts}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="backend")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="SQLite database path")
    subcommands = parser.add_subparsers(dest="command", required=True)
    inspect = subcommands.add_parser("inspect-db", help="show database integrity and table counts")
    inspect.add_argument("--json", action="store_true")
    features = subcommands.add_parser("features", help="show 17 model inputs and provenance")
    features.add_argument("--order-id", type=int, required=True)
    features.add_argument("--as-of", type=_as_of, required=True)
    features.add_argument("--json", action="store_true")
    migration = subcommands.add_parser("migrate", help="validate, back up, and apply schema migration")
    migration.add_argument("--json", action="store_true")
    score = subcommands.add_parser("score", help="save an offline score and immutable model inputs")
    score.add_argument("--order-id", type=int, required=True)
    score.add_argument("--as-of", type=_as_of, required=True)
    score.add_argument("--trigger-id")
    score.add_argument("--offline", action="store_true", required=True)
    score.add_argument("--json", action="store_true")
    agent = subcommands.add_parser("run-agent", help="run the LangGraph offline workflow")
    agent.add_argument("--order-id", type=int, required=True)
    agent.add_argument("--as-of", type=_as_of, required=True)
    agent.add_argument("--trigger-id")
    agent_mode = agent.add_mutually_exclusive_group(required=True)
    agent_mode.add_argument("--offline", action="store_true")
    agent_mode.add_argument("--live", action="store_true")
    agent.add_argument("--json", action="store_true")
    replay = subcommands.add_parser("replay", help="run a seeded scenario in a temporary database")
    replay.add_argument("--scenario", choices=["eta-delay"], required=True)
    replay.add_argument("--mock-recommendation", action="store_true",
                        help="return a deterministic validated action without calling Ollama")
    replay.add_argument("--json", action="store_true")
    scheduler = subcommands.add_parser("scheduler", help="process due orders")
    scheduler.add_argument("--once", action="store_true")
    scheduler.add_argument("--as-of", type=_as_of)
    scheduler.add_argument("--offline", action="store_true")
    scheduler.add_argument("--json", action="store_true")
    server = subcommands.add_parser("serve", help="run the HTTP API for the planner console")
    server.add_argument("--host", default="127.0.0.1")
    server.add_argument("--port", type=int, default=8000)
    server.add_argument("--scheduler-mode", choices=["off", "offline", "live"],
                        default=os.environ.get("SCHEDULER_MODE", "off"),
                        help="background scheduler: off, offline (no providers/Ollama) or live")
    shift = subcommands.add_parser("freeze-shift", help="freeze a region's review ranking")
    shift.add_argument("--shift-id", required=True)
    shift.add_argument("--region-id", type=int, required=True)
    shift.add_argument("--started-at", type=_as_of, required=True)
    shift.add_argument("--capacity", type=int, required=True)
    shift.add_argument("--json", action="store_true")
    replacement = subcommands.add_parser("authorize-replacement", help="record representative approval and urgent tasks")
    replacement.add_argument("--inspection-id", required=True)
    replacement.add_argument("--claim-id", required=True)
    replacement.add_argument("--representative-id", required=True)
    replacement.add_argument("--finding", required=True)
    replacement.add_argument("--decided-at", type=_as_of, required=True)
    replacement.add_argument("--line", type=_approved_line, action="append", required=True)
    replacement.add_argument("--json", action="store_true")
    refresh = subcommands.add_parser("refresh-replacements", help="complete tasks after accepted replacement handovers")
    refresh.add_argument("--order-id", type=int, required=True)
    refresh.add_argument("--as-of", type=_as_of, required=True)
    refresh.add_argument("--json", action="store_true")
    ack = subcommands.add_parser("ack-alert", help="acknowledge a simulated notification")
    ack.add_argument("--notification-id", required=True)
    ack.add_argument("--at", type=_as_of, required=True)
    ack.add_argument("--json", action="store_true")
    feedback = subcommands.add_parser("feedback", help="record a planner's chosen action")
    feedback.add_argument("--feedback-id", required=True)
    feedback.add_argument("--recommendation-id", required=True)
    feedback.add_argument("--chosen-action-id")
    feedback.add_argument("--recorded-by", required=True)
    feedback.add_argument("--at", type=_as_of, required=True)
    feedback.add_argument("--notes")
    feedback.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.command == "inspect-db":
            result = _inspect(args.db)
        elif args.command == "features":
            with closing(connect(args.db, readonly=True)) as db:
                result = asdict(build_features(db, args.order_id, args.as_of))
        elif args.command == "migrate":
            result = {"database": str(args.db.resolve()), "schema_version": migrate(args.db)}
        elif args.command == "score":
            with closing(connect(args.db)) as db:
                if db.execute("PRAGMA user_version").fetchone()[0] != 1:
                    raise ValueError("run 'backend migrate' on this database before scoring")
                result = asdict(score_order(db, args.order_id, args.as_of, trigger_id=args.trigger_id))
        elif args.command == "run-agent":
            from .agent.graph import run_agent

            with closing(connect(args.db, readonly=True)) as db:
                if db.execute("PRAGMA user_version").fetchone()[0] != 1:
                    raise ValueError("run 'backend migrate' on this database before running the agent")
            result = run_agent(args.db, args.order_id, args.as_of,
                               trigger_id=args.trigger_id, offline=args.offline)
        elif args.command == "replay":
            from .agent.graph import run_agent

            root = Path(__file__).resolve().parents[2]
            mock_client = mock_recommendation if args.mock_recommendation else None
            with TemporaryDirectory() as folder:
                path = Path(folder) / "replay.db"
                with closing(sqlite3.connect(path)) as db:
                    db.execute("PRAGMA foreign_keys = ON")
                    db.executescript((root / "schema_fresh.sql").read_text(encoding="utf-8"))
                    db.executescript((root / "inference_seed.sql").read_text(encoding="utf-8"))
                migrate(path, backup_path=Path(folder) / "replay.backup.db")
                earlier = run_agent(path, 1002, _as_of("2026-11-06T11:40:00Z"),
                                    trigger_id="replay:eta-delay:before", offline=True,
                                    recommendation_client=mock_client)
                later = run_agent(path, 1002, _as_of("2026-11-06T12:00:00Z"),
                                  trigger_id="replay:eta-delay:after", offline=True,
                                  recommendation_client=mock_client)
                result = {"scenario": args.scenario, "before": earlier, "after": later}
        elif args.command == "scheduler":
            from .scheduler import scheduler_loop, scheduler_once

            with closing(connect(args.db, readonly=True)) as db:
                if db.execute("PRAGMA user_version").fetchone()[0] != 1:
                    raise ValueError("run 'backend migrate' on this database before scheduler")
            if args.once:
                result = {"runs": scheduler_once(args.db, now=args.as_of, offline=args.offline)}
            else:
                scheduler_loop(args.db, offline=args.offline)
                return 0
        elif args.command == "serve":
            from .api import serve

            with closing(connect(args.db, readonly=True)) as db:
                if db.execute("PRAGMA user_version").fetchone()[0] != 1:
                    raise ValueError("run 'backend migrate' on this database before serve")
            serve(args.db, host=args.host, port=args.port, scheduler_mode=args.scheduler_mode)
            return 0
        elif args.command == "freeze-shift":
            from .worklist import freeze_shift
            with closing(connect(args.db)) as db:
                result = {"shift_id": args.shift_id,
                          "candidates": freeze_shift(db, args.shift_id, args.region_id,
                                                     args.started_at, args.capacity)}
        elif args.command == "authorize-replacement":
            from .replacements import approve_replacement
            quantities = dict(args.line)
            if len(quantities) != len(args.line):
                raise ValueError("duplicate claim line in --line arguments")
            with closing(connect(args.db)) as db:
                ids = approve_replacement(db, args.inspection_id, args.claim_id,
                                          args.representative_id, args.finding,
                                          args.decided_at, quantities)
            result = {"inspection_id": args.inspection_id, "authorization_line_ids": ids}
        elif args.command == "refresh-replacements":
            from .replacements import refresh_replacement_tasks
            with closing(connect(args.db)) as db:
                done = refresh_replacement_tasks(db, args.order_id, args.as_of)
            result = {"order_id": args.order_id, "tasks_completed": done}
        elif args.command == "ack-alert":
            from .notifications import acknowledge_alert
            with closing(connect(args.db)) as db:
                acknowledged = acknowledge_alert(db, args.notification_id, args.at)
            result = {"notification_id": args.notification_id, "acknowledged_at_utc": acknowledged}
        elif args.command == "feedback":
            from .notifications import record_feedback
            with closing(connect(args.db)) as db:
                feedback_id = record_feedback(db, args.feedback_id, args.recommendation_id,
                                              args.chosen_action_id, args.recorded_by,
                                              args.at, args.notes)
            result = {"feedback_id": feedback_id}
    except (OSError, ValueError, LookupError, RuntimeError) as exc:
        parser.error(str(exc))
    if args.json:
        print(json.dumps(result, indent=2))
    elif args.command == "inspect-db":
        print(f"Database: {result['database']} | integrity: {result['integrity']} | foreign key errors: {result['foreign_key_errors']}")
        for name, count in result["tables"].items():
            print(f"{name}: {count}")
    elif args.command == "features":
        print(f"Order {result['order_id']} | as of {result['decision_time']} | promise v{result['promise_version']} to {result['promised_to_utc']}")
        for name in FEATURE_NAMES:
            print(f"{name}: {result['values'][name]!r} | {', '.join(result['sources'].get(name, [])) or 'missing'}")
        print("Missing:", ", ".join(result["missing"]) or "none")
        for limitation in result["limitations"]:
            print("Limitation:", limitation)
    elif args.command == "migrate":
        print(f"Database {result['database']} migrated to schema v{result['schema_version']}")
    elif args.command == "score":
        print(f"Order {result['order_id']} | {result['eligibility_reason']} | score {result['p_late']} | {result['risk_band']}")
        print(f"Promise v{result['promise_version']} to {result['promised_to_utc']} | next due {result['next_due_at_utc']}")
    elif args.command == "run-agent":
        print(f"Order {result['order_id']} | {result['eligibility_reason']} | score {result.get('p_late')} | {result.get('risk_band')}")
        print(f"Promise v{result.get('promise_version')} to {result.get('promised_to_utc')} | next due {result.get('next_due_at_utc')}")
        print(f"Recommendation: {result.get('recommendation') or result.get('recommendation_error')}")
        print(f"Simulated notification: {result.get('notification_id') or 'none'}")
    elif args.command == "replay":
        for name in ("before", "after"):
            row = result[name]
            recommendation = row.get("recommendation")
            action = recommendation["action_id"] if recommendation else row.get("recommendation_error")
            print(f"{name}: p_late={row.get('p_late'):.3f} band={row.get('risk_band')} "
                  f"eta_delay_minutes={row.get('feature_values', {}).get('eta_delay_minutes')} "
                  f"action={action} alert={row.get('notification_id') or 'no new alert'}")
            if recommendation:
                print(f"  recommendation: {recommendation['summary']}")
                print(f"  owner: {recommendation['suggested_owner']} | "
                      f"respond by: {recommendation['suggested_response_deadline']} | "
                      f"evidence: {', '.join(recommendation['supporting_evidence_ids'])}")
    elif args.command == "scheduler":
        print(f"Processed {len(result['runs'])} due orders")
    else:
        print(json.dumps(result, indent=2))
    return 0
