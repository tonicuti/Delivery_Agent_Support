"""Decide when a high-risk order raises an alert for staff, and record it (simulated delivery for now)."""

from datetime import datetime
import json
from sqlite3 import Connection
from uuid import uuid4

from ..features import _parse_utc, _utc_text
from ..scoring import ScoreResult

# A follow-up alert is sent when the risk rose at least this much since the last score.
FOLLOW_UP_PROBABILITY_JUMP = 0.10


def latest_alert_id(db: Connection, recommendation_id: str) -> str | None:
    row = db.execute("""
        SELECT notification_id FROM simulated_notification
        WHERE recommendation_id = ? ORDER BY created_at_utc DESC LIMIT 1
    """, (recommendation_id,)).fetchone()
    return row["notification_id"] if row else None


def choose_alert_kind(db: Connection, episode_id: str, *, action_changed: bool,
                      previous_probability: float | None, p_late: float | None) -> str | None:
    """'initial' for the first alert of an episode, 'follow_up' if things changed, else no alert."""
    initial_sent = db.execute("""
        SELECT 1 FROM simulated_notification WHERE episode_id = ? AND kind = 'initial'
    """, (episode_id,)).fetchone()
    if not initial_sent:
        return "initial"
    worsened = (previous_probability is not None and p_late is not None
                and p_late - previous_probability >= FOLLOW_UP_PROBABILITY_JUMP)
    return "follow_up" if action_changed or worsened else None


def create_alert(db: Connection, score: ScoreResult, *, episode_id: str, recommendation_id: str, kind: str,
                 action_id: str | None, recommendation_status: str, decision_time: datetime) -> str:
    notification_id = str(uuid4())
    payload = {
        "order_id": score.order_id, "score_id": score.score_id,
        "p_late": score.p_late, "promise_version": score.promise_version,
        "promised_to_utc": score.promised_to_utc,
        "hours_remaining": (_parse_utc(score.promised_to_utc) - decision_time).total_seconds() / 3600,
        "action_id": action_id,
        "recommendation_status": recommendation_status,
    }
    db.execute("""
        INSERT INTO simulated_notification
        (notification_id, episode_id, recommendation_id, kind, payload_json, created_at_utc)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (notification_id, episode_id, recommendation_id, kind, json.dumps(payload), _utc_text(decision_time)))
    return notification_id
