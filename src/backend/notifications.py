"""Planner acknowledgment and feedback for simulated alerts."""

from datetime import datetime
from sqlite3 import Connection

from .features import _utc_text


def acknowledge_alert(db: Connection, notification_id: str, at: datetime) -> str:
    timestamp = _utc_text(at)
    if db.in_transaction:
        raise ValueError("acknowledgment requires a connection outside a transaction")
    db.execute("BEGIN IMMEDIATE")
    try:
        row = db.execute("""
            SELECT acknowledged_at_utc FROM simulated_notification WHERE notification_id = ?
        """, (notification_id,)).fetchone()
        if row is None:
            raise LookupError("notification does not exist")
        if row["acknowledged_at_utc"] is None:
            db.execute("""
                UPDATE simulated_notification SET acknowledged_at_utc = ? WHERE notification_id = ?
            """, (timestamp, notification_id))
        db.commit()
        return row["acknowledged_at_utc"] or timestamp
    except Exception:
        db.rollback()
        raise


def record_feedback(db: Connection, feedback_id: str, recommendation_id: str,
                    chosen_action_id: str | None, recorded_by: str, at: datetime,
                    notes: str | None = None) -> str:
    if not feedback_id or not recorded_by:
        raise ValueError("feedback_id and recorded_by are required")
    if db.in_transaction:
        raise ValueError("feedback requires a connection outside a transaction")
    timestamp = _utc_text(at)
    db.execute("BEGIN IMMEDIATE")
    try:
        existing = db.execute("SELECT * FROM planner_feedback WHERE feedback_id = ?", (feedback_id,)).fetchone()
        if existing:
            if (existing["recommendation_id"] != recommendation_id
                    or existing["chosen_action_id"] != chosen_action_id
                    or existing["recorded_by"] != recorded_by
                    or existing["recorded_at_utc"] != timestamp
                    or existing["notes"] != notes):
                raise ValueError("feedback_id already used for different feedback")
        else:
            if db.execute("SELECT 1 FROM agent_recommendation WHERE recommendation_id = ?",
                          (recommendation_id,)).fetchone() is None:
                raise LookupError("recommendation does not exist")
            db.execute("""
                INSERT INTO planner_feedback
                (feedback_id, recommendation_id, chosen_action_id, notes, recorded_by, recorded_at_utc)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (feedback_id, recommendation_id, chosen_action_id, notes, recorded_by, timestamp))
        db.commit()
        return feedback_id
    except Exception:
        db.rollback()
        raise
