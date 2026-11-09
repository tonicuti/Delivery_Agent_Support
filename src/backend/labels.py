"""Plain-language wording shared by the console and the assistant; users never see codes."""

FEATURE_WORDS = {
    "hours_to_deadline": "time left before the promise",
    "item_count": "number of different items",
    "item_quantity": "total quantity",
    "weight_kg": "total weight",
    "volume_m3": "total volume",
    "special_handling": "special handling",
    "actual_departure_delay_minutes": "how late the truck left",
    "eta_delay_minutes": "arrival-time update",
    "travel_hours": "travel time",
    "weather_severity": "weather on the day",
    "holiday_flag": "public holiday",
    "customer_type": "customer type",
    "stock_status": "stock",
    "warehouse_stage": "warehouse progress",
    "region": "region",
    "warehouse": "warehouse",
    "carrier": "carrier",
}
STOCK_WORDS = {"in_stock": "in stock", "short": "short on stock", "backorder": "on backorder"}
STAGE_WORDS = {
    "waiting": "waiting to be picked",
    "pick_started": "being picked",
    "packed": "packed",
    "loaded": "loaded on the truck",
    "departed": "on the road",
}
ACTION_TITLES = {
    "check_stock": "Check stock with the warehouse",
    "prioritize_picking": "Ask the warehouse to pick it first",
    "confirm_route": "Confirm the route and arrival time",
    "review_conflicting_evidence": "Review the order details",
}
DECISION_WORDS = {"approved": "Accepted the suggestion", "edited": "Chose another action", "dismissed": "Dismissed"}
ROLE_WORDS = {"dispatcher": "Dispatcher", "dispatch_lead": "Dispatch lead", "manager": "Manager"}


def duration(minutes: float) -> str:
    """'35 minutes', '2 h 5 min' or '3 days'; always a positive, spoken-style length."""
    total = round(abs(minutes))
    if total < 60:
        return f"{total} minute{'s' if total != 1 else ''}"
    if total < 48 * 60:
        hours, rest = divmod(total, 60)
        return f"{hours} h {rest} min" if rest else f"{hours} h"
    return f"{total // 1440} days"


def time_left(hours: float | None) -> str:
    if hours is None:
        return "no promise time yet"
    return f"{duration(hours * 60)} overdue" if hours < 0 else f"{duration(hours * 60)} left"
