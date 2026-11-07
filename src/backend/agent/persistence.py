"""One transaction that records the episode, the recommendation and, when due, the alert."""

from datetime import datetime
from sqlite3 import Connection

from ..alerts.dispatch import choose_alert_kind, create_alert, latest_alert_id
from ..scoring import ScoreResult
from .recommendation_store import previous_valid_action, recommendation_for_run, save_recommendation
from .worklist import write_high_risk


def persist_recommendation_and_alert(
    db: Connection, score: ScoreResult, episode_id: str, *,
    recommendation: dict | None, error: str | None,
    previous_probability: float | None, decision_time: datetime,
) -> str | None:
    """Persist recommendation before an alert; unavailable Qwen still alerts. Returns the alert id, if any."""
    if db.in_transaction:
        raise ValueError("alert persistence requires a connection outside a transaction")
    db.execute("BEGIN IMMEDIATE")
    try:
        episode_id, previous_probability = write_high_risk(db, score, decision_time, episode_id)
        existing = recommendation_for_run(db, score.run_id)
        if existing:  # retry of the same run: never record twice
            alert_id = latest_alert_id(db, existing)
            db.commit()
            return alert_id
        previous_action = previous_valid_action(db, score.order_id)
        recommendation_id, status = save_recommendation(db, score, recommendation=recommendation,
                                                        error=error, decision_time=decision_time)
        action_id = recommendation["action_id"] if recommendation else None
        kind = choose_alert_kind(db, episode_id, action_changed=(
                                     action_id is not None and previous_action is not None and previous_action != action_id),
                                 previous_probability=previous_probability, p_late=score.p_late)
        alert_id = create_alert(db, score, episode_id=episode_id, recommendation_id=recommendation_id, kind=kind,
                                action_id=action_id, recommendation_status=status,
                                decision_time=decision_time) if kind else None
        db.commit()
        return alert_id
    except Exception:
        db.rollback()
        raise
