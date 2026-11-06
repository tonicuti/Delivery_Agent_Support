"""Allowed staff actions selected from observed facts."""


PLAYBOOKS = {
    "check_stock": "Ask the warehouse to verify stock availability.",
    "prioritize_picking": "Ask the warehouse to prioritize picking or packing.",
    "confirm_route": "Ask transport to confirm the route and ETA.",
    "review_conflicting_evidence": "Ask the planner to review missing or conflicting evidence.",
}


def applicable_actions(features: dict) -> dict[str, str]:
    actions = {"review_conflicting_evidence": PLAYBOOKS["review_conflicting_evidence"]}
    if features.get("stock_status") in {"short", "backorder"}:
        actions["check_stock"] = PLAYBOOKS["check_stock"]
    if features.get("warehouse_stage") in {"waiting", "pick_started", "packed"}:
        actions["prioritize_picking"] = PLAYBOOKS["prioritize_picking"]
    if (features.get("eta_delay_minutes") or 0) > 0:
        actions["confirm_route"] = PLAYBOOKS["confirm_route"]
    return actions
