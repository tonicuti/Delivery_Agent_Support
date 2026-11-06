"""High-risk episodes, recommendations, and simulated notification intent."""

from datetime import datetime
import json
from sqlite3 import Connection
from uuid import uuid4

from ..eligibility import check_eligibility
from ..features import _parse_utc, _utc_text
from ..scoring import ScoreResult


def _write_high_risk(db: Connection, score: ScoreResult,
                     decision_time: datetime, candidate_id: str | None = None) -> tuple[str, float | None]:
    if score.risk_band != "High" or score.score_id is None:
        raise ValueError("worklist requires a High risk score")
    if not check_eligibility(db, score.order_id, decision_time).eligible:
        raise ValueError("order became ineligible before worklist update")
    existing = db.execute("""
        SELECT e.episode_id, s.p_late AS previous_probability
        FROM risk_episode e JOIN risk_score s ON s.score_id = e.latest_score_id
        WHERE e.order_id = ? AND e.closed_at_utc IS NULL
    """, (score.order_id,)).fetchone()
    if existing:
        episode_id = existing["episode_id"]
        previous = existing["previous_probability"]
        db.execute("UPDATE risk_episode SET latest_score_id = ? WHERE episode_id = ?",
                   (score.score_id, episode_id))
    else:
        episode_id = candidate_id or str(uuid4())
        previous = None
        db.execute("""
            INSERT INTO risk_episode
            (episode_id, order_id, opened_at_utc, opening_score_id, latest_score_id)
            VALUES (?, ?, ?, ?, ?)
        """, (episode_id, score.order_id, _utc_text(decision_time),
              score.score_id, score.score_id))
    db.execute("""
        INSERT INTO worklist_item(order_id, episode_id, latest_score_id, status, updated_at_utc)
        VALUES (?, ?, ?, 'active', ?)
        ON CONFLICT(order_id) DO UPDATE SET episode_id = excluded.episode_id,
            latest_score_id = excluded.latest_score_id, status = 'active',
            updated_at_utc = excluded.updated_at_utc
    """, (score.order_id, episode_id, score.score_id, _utc_text(decision_time)))
    return episode_id, previous


def preview_high_risk(db: Connection, score: ScoreResult) -> tuple[str, float | None]:
    if score.risk_band != "High" or score.score_id is None:
        raise ValueError("worklist requires a High risk score")
    existing = db.execute("""
        SELECT e.episode_id, s.p_late AS previous_probability
        FROM risk_episode e JOIN risk_score s ON s.score_id = e.latest_score_id
        WHERE e.order_id = ? AND e.closed_at_utc IS NULL
    """, (score.order_id,)).fetchone()
    return ((existing["episode_id"], existing["previous_probability"])
            if existing else (str(uuid4()), None))


def ensure_high_risk(db: Connection, score: ScoreResult,
                     decision_time: datetime) -> tuple[str, float | None]:
    if db.in_transaction:
        raise ValueError("worklist requires a connection outside a transaction")
    db.execute("BEGIN IMMEDIATE")
    try:
        episode_id, previous = _write_high_risk(db, score, decision_time)
        db.commit()
        return episode_id, previous
    except Exception:
        db.rollback()
        raise


def persist_recommendation_and_alert(
    db: Connection, score: ScoreResult, episode_id: str, *,
    recommendation: dict | None, error: str | None,
    previous_probability: float | None, decision_time: datetime,
) -> str | None:
    """Persist recommendation before an alert; unavailable Qwen still alerts."""
    if db.in_transaction:
        raise ValueError("alert persistence requires a connection outside a transaction")
    db.execute("BEGIN IMMEDIATE")
    try:
        episode_id, previous_probability = _write_high_risk(db, score, decision_time, episode_id)
        existing = db.execute("""
            SELECT recommendation_id FROM agent_recommendation WHERE run_id = ?
        """, (score.run_id,)).fetchone()
        if existing:
            sent = db.execute("""
                SELECT notification_id FROM simulated_notification
                WHERE recommendation_id = ? ORDER BY created_at_utc DESC LIMIT 1
            """, (existing["recommendation_id"],)).fetchone()
            db.commit()
            return sent["notification_id"] if sent else None
        previous_action = db.execute("""
            SELECT r.action_id FROM agent_recommendation r
            JOIN agent_run ar ON ar.run_id = r.run_id
            WHERE ar.order_id = ? AND r.validation_status = 'valid'
            ORDER BY r.created_at_utc DESC LIMIT 1
        """, (score.order_id,)).fetchone()
        rec_id = str(uuid4())
        status = "valid" if recommendation else "unavailable"
        output = recommendation if recommendation else {"error": (error or "unavailable")[:500]}
        db.execute("""
            INSERT INTO agent_recommendation
            (recommendation_id, run_id, score_id, action_id, output_json,
             validation_status, created_at_utc)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (rec_id, score.run_id, score.score_id,
              recommendation["action_id"] if recommendation else None,
              json.dumps(output), status, _utc_text(decision_time)))
        initial = db.execute("""
            SELECT 1 FROM simulated_notification WHERE episode_id = ? AND kind = 'initial'
        """, (episode_id,)).fetchone()
        changed_action = (recommendation is not None and previous_action is not None
                          and previous_action["action_id"] != recommendation["action_id"])
        worsened = (previous_probability is not None and score.p_late is not None
                    and score.p_late - previous_probability >= 0.10)
        kind = "initial" if not initial else "follow_up" if changed_action or worsened else None
        notification_id = None
        if kind:
            notification_id = str(uuid4())
            payload = {
                "order_id": score.order_id, "score_id": score.score_id,
                "p_late": score.p_late, "promise_version": score.promise_version,
                "promised_to_utc": score.promised_to_utc,
                "hours_remaining": (_parse_utc(score.promised_to_utc) - decision_time).total_seconds() / 3600,
                "action_id": recommendation["action_id"] if recommendation else None,
                "recommendation_status": status,
            }
            db.execute("""
                INSERT INTO simulated_notification
                (notification_id, episode_id, recommendation_id, kind,
                 payload_json, created_at_utc)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (notification_id, episode_id, rec_id, kind,
                  json.dumps(payload), _utc_text(decision_time)))
        db.commit()
        return notification_id
    except Exception:
        db.rollback()
        raise


def close_monitoring(db: Connection, order_id: int, decision_time: datetime) -> None:
    at = _utc_text(decision_time)
    db.execute("BEGIN IMMEDIATE")
    try:
        db.execute("""
            UPDATE risk_episode SET closed_at_utc = ?
            WHERE order_id = ? AND closed_at_utc IS NULL
        """, (at, order_id))
        db.execute("""
            UPDATE worklist_item SET status = 'closed', updated_at_utc = ?
            WHERE order_id = ? AND status = 'active'
        """, (at, order_id))
        db.commit()
    except Exception:
        db.rollback()
        raise
