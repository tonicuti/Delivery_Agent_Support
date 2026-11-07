"""High-risk episodes and the live worklist: open, update and close monitoring for an order."""

from datetime import datetime
from sqlite3 import Connection
from uuid import uuid4

from ..eligibility import check_eligibility
from ..features import _utc_text
from ..scoring import ScoreResult


def write_high_risk(db: Connection, score: ScoreResult,
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
        episode_id, previous = write_high_risk(db, score, decision_time)
        db.commit()
        return episode_id, previous
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
