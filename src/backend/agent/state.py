"""Compact LangGraph state; raw external responses stay in SQLite."""

from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    run_id: str
    trigger_id: str
    order_id: int
    decision_time: str
    offline: bool
    eligibility_reason: str
    owner_team: str
    external_status: dict[str, Any]
    feature_values: dict[str, Any]
    feature_sources: dict[str, list[str]]
    missing: list[str]
    promise_version: int
    promised_to_utc: str
    score: dict[str, Any]
    snapshot_id: str
    score_id: int
    p_late: float
    risk_band: str
    evidence_differences: list[str]
    allowed_actions: dict[str, str]
    recommendation: dict[str, Any] | None
    recommendation_error: str | None
    episode_id: str
    previous_probability: float | None
    notification_id: str | None
    next_due_at_utc: str | None
