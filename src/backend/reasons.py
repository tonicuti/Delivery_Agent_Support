"""Observed signals from deterministic rules over saved model inputs; not model attribution."""

from .labels import STOCK_WORDS, duration

TIGHT_WINDOW_HOURS = 3  # less than this to the promise is called out as a signal


def observed_signals(features: dict) -> list[dict]:
    """Rules first: facts a dispatcher can verify, in everyday words. Never claims they caused p_late."""
    signals: list[dict] = []

    def add(code: str, label: str, detail: str) -> None:
        signals.append({"code": code, "label": label, "detail": detail})

    stock = features.get("stock_status")
    if stock in ("short", "backorder"):
        add("STOCK_SHORT" if stock == "short" else "STOCK_BACKORDER",
            "Stock is short" if stock == "short" else "Item on backorder",
            f"At least one item is {STOCK_WORDS[stock]}.")
    stage = features.get("warehouse_stage")
    if stage in ("waiting", "pick_started"):
        add("PICK_INCOMPLETE", "Not fully picked",
            "The warehouse has not finished picking." if stage == "pick_started" else "The warehouse has not started picking.")
    elif stage == "packed":
        add("NOT_LOADED", "Not loaded yet", "The order is packed but not on the truck yet.")
    departure = features.get("actual_departure_delay_minutes")
    if departure is not None and departure > 0:
        add("DEPARTURE_DELAYED", "Left late", f"The truck left {duration(departure)} later than planned.")
    eta = features.get("eta_delay_minutes")
    if eta is not None and eta > 0:
        add("ETA_DELAYED", "Arrival running late", f"The expected arrival is {duration(eta)} later than planned.")
    hours = features.get("hours_to_deadline")
    if hours is not None and hours < 0:
        add("PROMISE_PASSED", "Promise missed", "The promised delivery time has passed.")
    elif hours is not None and hours < TIGHT_WINDOW_HOURS:
        add("TIME_TIGHT", "Little time left", f"Only {duration(hours * 60)} left in the promised window.")
    if features.get("holiday_flag") == 1:
        add("HOLIDAY", "Public holiday", "The delivery day is a public holiday.")
    if features.get("special_handling") == 1:
        add("SPECIAL_HANDLING", "Special handling", "A crane or long-goods handling is needed.")
    return signals
