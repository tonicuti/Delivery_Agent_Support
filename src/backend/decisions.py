"""Dispatcher decision log: approve, edit or dismiss a recommendation. A role is stored, never a name."""

from datetime import datetime
import json
from sqlite3 import Connection
from uuid import uuid4

from .agent.playbooks import PLAYBOOKS
from .notifications import record_feedback

DECISIONS = ("approved", "edited", "dismissed")
ROLES = ("dispatcher", "dispatch_lead", "manager")
DISMISS_REASONS = {
    "false_alarm": "False alarm",
    "already_handled": "Already handled",
    "no_capacity": "No capacity to act",
    "data_wrong": "Data is wrong or stale",
    "other": "Other",
}


def record_decision(db: Connection, recommendation_id: str, decision: str, *, role: str,
                    at: datetime, action_id: str | None = None, reason: str | None = None,
                    notes: str | None = None) -> str:
    """Append one decision (latest wins). Built on planner_feedback so history is never rewritten."""
    if decision not in DECISIONS:
        raise ValueError(f"decision must be one of {', '.join(DECISIONS)}")
    if role not in ROLES:
        raise ValueError(f"role must be one of {', '.join(ROLES)}")
    recommendation = db.execute("""
        SELECT action_id, validation_status FROM agent_recommendation WHERE recommendation_id = ?
    """, (recommendation_id,)).fetchone()
    if recommendation is None:
        raise LookupError("recommendation does not exist")
    if decision == "approved":
        if recommendation["validation_status"] != "valid" or not recommendation["action_id"]:
            raise ValueError("there is no validated recommendation to approve")
        chosen = recommendation["action_id"]
    elif decision == "edited":
        if action_id not in PLAYBOOKS:
            raise ValueError("edit requires an allowed playbook action")
        if action_id == recommendation["action_id"]:
            raise ValueError("choose a different action, or approve the recommendation")
        chosen = action_id
    else:
        if reason not in DISMISS_REASONS:
            raise ValueError("dismiss requires a reason")
        chosen = None
    payload = json.dumps({"decision": decision, "reason": reason, "text": notes or None})
    return record_feedback(db, str(uuid4()), recommendation_id, chosen, role, at, payload)


def parse_decision(chosen_action_id: str | None, notes: str | None,
                   recommended_action_id: str | None) -> dict:
    """Decode a planner_feedback row; rows written before decisions existed are inferred."""
    try:
        payload = json.loads(notes) if notes else None
    except ValueError:
        payload = None
    if isinstance(payload, dict) and payload.get("decision") in DECISIONS:
        return {"decision": payload["decision"], "reason": payload.get("reason"),
                "text": payload.get("text")}
    decision = ("dismissed" if chosen_action_id is None
                else "approved" if chosen_action_id == recommended_action_id else "edited")
    return {"decision": decision, "reason": None, "text": notes}
