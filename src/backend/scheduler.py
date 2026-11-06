"""Deterministic, clock-injectable demo scheduling rules."""

from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
import time


def next_due_time(now: datetime, promise_end: datetime) -> datetime:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    if promise_end.tzinfo is None or promise_end.utcoffset() is None:
        raise ValueError("promise_end must be timezone-aware")
    now = now.astimezone(timezone.utc)
    end = promise_end.astimezone(timezone.utc)
    remaining = end - now
    if remaining > timedelta(hours=24):
        interval = timedelta(hours=2)
        crossing = end - timedelta(hours=24)
    elif remaining > timedelta(hours=6):
        interval = timedelta(hours=1)
        crossing = end - timedelta(hours=6)
    elif remaining > timedelta(0):
        interval = timedelta(minutes=15)
        crossing = end
    else:
        interval = timedelta(minutes=30)
        crossing = None
    due = now + interval
    return min(due, crossing) if crossing is not None else due


def scheduler_once(db_path: Path, *, now: datetime | None = None,
                   offline: bool = True, model=None,
                   model_version: str | None = None) -> list[dict]:
    """Claim due orders once, with an injectable clock for deterministic tests."""
    from .agent.graph import run_agent
    from .db import connect
    from .features import _parse_utc, _utc_text

    now = now or datetime.now(timezone.utc)
    at = _utc_text(now)
    with closing(connect(db_path, readonly=True)) as db:
        candidates = [row[0] for row in db.execute("""
            SELECT o.order_id FROM customer_order o
            LEFT JOIN schedule_state s ON s.order_id = o.order_id
            WHERE s.order_id IS NULL OR (s.next_due_at_utc IS NOT NULL AND s.next_due_at_utc <= ?)
            ORDER BY o.order_id
        """, (at,))]
    results = []
    for order_id in candidates:
        with closing(connect(db_path)) as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                schedule = db.execute("SELECT next_due_at_utc FROM schedule_state WHERE order_id = ?",
                                      (order_id,)).fetchone()
                if schedule is not None and (schedule["next_due_at_utc"] is None
                                             or schedule["next_due_at_utc"] > at):
                    db.commit()
                    continue
                due_key = schedule["next_due_at_utc"] if schedule else "initial"
                trigger_id = f"scheduler:{order_id}:{due_key}"
                claim = db.execute("""
                    SELECT available_at_utc, lease_until_utc, processed_run_id
                    FROM source_trigger WHERE trigger_id = ?
                """, (trigger_id,)).fetchone()
                if claim and (claim["processed_run_id"] is not None
                              or (claim["lease_until_utc"] and claim["lease_until_utc"] > at)):
                    db.commit()
                    continue
                if claim:
                    decision_time = _parse_utc(claim["available_at_utc"])
                    db.execute("UPDATE source_trigger SET lease_until_utc = ? WHERE trigger_id = ?",
                               (_utc_text(now + timedelta(minutes=5)), trigger_id))
                else:
                    decision_time = now
                    db.execute("""
                        INSERT INTO source_trigger
                        (trigger_id, order_id, kind, available_at_utc, lease_until_utc)
                        VALUES (?, ?, 'scheduled', ?, ?)
                    """, (trigger_id, order_id, at, _utc_text(now + timedelta(minutes=5))))
                db.commit()
            except Exception:
                db.rollback()
                raise
        result = run_agent(db_path, order_id, decision_time, trigger_id=trigger_id,
                           offline=offline, model=model, model_version=model_version)
        with closing(connect(db_path)) as db:
            db.execute("""
                UPDATE source_trigger SET processed_run_id = ?, lease_until_utc = NULL
                WHERE trigger_id = ?
            """, (result["run_id"], trigger_id))
            db.commit()
        results.append(result)
    return results


def scheduler_loop(db_path: Path, *, offline: bool = False) -> None:
    """Run until interrupted; due times survive process restarts in SQLite."""
    while True:
        scheduler_once(db_path, offline=offline)
        time.sleep(15)
