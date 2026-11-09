"""Read and write stored agent recommendations (valid, or unavailable when the model could not help)."""

from datetime import datetime
import json
from sqlite3 import Connection
from uuid import uuid4

from ..features import _utc_text
from ..scoring import ScoreResult


def recommendation_for_run(db: Connection, run_id: str) -> str | None:
    row = db.execute("SELECT recommendation_id FROM agent_recommendation WHERE run_id = ?", (run_id,)).fetchone()
    return row["recommendation_id"] if row else None


def previous_valid_action(db: Connection, order_id: int) -> str | None:
    row = db.execute("""
        SELECT r.action_id FROM agent_recommendation r
        JOIN agent_run ar ON ar.run_id = r.run_id
        WHERE ar.order_id = ? AND r.validation_status = 'valid'
        ORDER BY r.created_at_utc DESC LIMIT 1
    """, (order_id,)).fetchone()
    return row["action_id"] if row else None


def save_recommendation(db: Connection, score: ScoreResult, *, recommendation: dict | None,
                        error: str | None, decision_time: datetime) -> tuple[str, str]:
    """Insert the recommendation; returns (recommendation_id, 'valid' | 'unavailable')."""
    recommendation_id = str(uuid4())
    status = "valid" if recommendation else "unavailable"
    output = recommendation if recommendation else {"error": (error or "unavailable")[:500]}
    db.execute("""
        INSERT INTO agent_recommendation
        (recommendation_id, run_id, score_id, action_id, output_json, validation_status, created_at_utc)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (recommendation_id, score.run_id, score.score_id,
          recommendation["action_id"] if recommendation else None,
          json.dumps(output), status, _utc_text(decision_time)))
    return recommendation_id, status
