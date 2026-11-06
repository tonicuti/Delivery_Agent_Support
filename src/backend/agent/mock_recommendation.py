"""Deterministic, schema-valid stand-in for Qwen used by demos and UI testing."""

from datetime import datetime, timedelta


def mock_recommendation(evidence: dict, allowed_actions: dict[str, str],
                        decision_time: str) -> dict:
    """Deterministic offline proposal for the seeded ETA-delay demonstration."""
    features = evidence["features"]
    if (features.get("eta_delay_minutes") or 0) > 0 and "confirm_route" in allowed_actions:
        action = "confirm_route"
        prefix = "eta_update:"
        summary = (f"Ask transport to confirm the route and the new arrival time; "
                   f"the arrival is already {features['eta_delay_minutes']:.0f} minutes later than planned.")
        missing = ["carrier confirmation of the revised ETA"]
    elif features.get("stock_status") in {"short", "backorder"} and "check_stock" in allowed_actions:
        action = "check_stock"
        prefix = "stock_event:"
        summary = "Ask the warehouse to check stock before the order is dispatched."
        missing = ["current available quantity and replenishment time"]
    else:
        action = "review_conflicting_evidence"
        prefix = ""
        summary = "Ask a planner to review the order details."
        missing = list(evidence.get("missing", []))[:8]
    refs = [ref for ref in evidence["evidence_ids"] if not prefix or ref.startswith(prefix)]
    if not refs:
        refs = list(evidence["evidence_ids"][:1])
    if not refs:
        raise ValueError("mock recommendation requires at least one evidence reference")
    deadline = datetime.fromisoformat(decision_time.replace("Z", "+00:00")) + timedelta(minutes=30)
    return {
        "action_id": action,
        "summary": summary,
        "supporting_evidence_ids": refs[:3],
        "suggested_owner": evidence["owner_team"],
        "suggested_response_deadline": deadline.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "missing_information": missing,
        "requires_human_review": True,
    }
