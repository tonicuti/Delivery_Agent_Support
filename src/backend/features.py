"""Build one model row from evidence visible at an explicit decision time.

The current pilot schema has no history for product attributes, shipment
assignment, or planned shipment times. Historical replay therefore requires
fixtures that establish those values were already valid at the decision time.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from sqlite3 import Connection
from typing import Any
from zoneinfo import ZoneInfo

from .external.weather import WEATHER_MAPPING_VERSION, classify_weather


FEATURE_NAMES = (
    "hours_to_deadline", "item_count", "item_quantity", "weight_kg",
    "volume_m3", "special_handling", "actual_departure_delay_minutes",
    "eta_delay_minutes", "travel_hours", "weather_severity", "holiday_flag",
    "customer_type", "stock_status", "warehouse_stage", "region",
    "warehouse", "carrier",
)
_STAGES = ("waiting", "pick_started", "packed", "loaded", "departed")
_STOCK_PRIORITY = {"in_stock": 0, "short": 1, "backorder": 2}


@dataclass(frozen=True)
class FeatureRow:
    order_id: int
    decision_time: str
    promise_version: int
    promised_to_utc: str
    values: dict[str, Any]
    sources: dict[str, list[str]]
    missing: list[str]
    limitations: list[str]


def _utc_text(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("decision_time must be timezone-aware")
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError(f"database timestamp lacks timezone: {value}")
    return parsed.astimezone(timezone.utc)


def build_features(db: Connection, order_id: int, decision_time: datetime) -> FeatureRow:
    """Return exact model inputs and source identifiers, without modifying DB.

    Caller must enable SQLite foreign keys and supply fixtures with valid
    historical product and shipment-assignment attributes for replay.
    """
    at = _utc_text(decision_time)
    order = db.execute("""
        SELECT o.created_at_utc, c.customer_type, r.name AS region,
               r.region_id, s.site_id, s.time_zone
        FROM customer_order o
        JOIN customer c ON c.customer_id = o.customer_id
        JOIN delivery_site s ON s.site_id = o.site_id
        JOIN planning_region r ON r.region_id = s.region_id
        WHERE o.order_id = ?
    """, (order_id,)).fetchone()
    if order is None:
        raise LookupError(f"order {order_id} does not exist")
    if _parse_utc(order["created_at_utc"]) > decision_time.astimezone(timezone.utc):
        raise ValueError("order did not exist at decision_time")

    promise = db.execute("""
        SELECT version_no, window_end_utc FROM promise_version
        WHERE order_id = ? AND recorded_at_utc <= ? AND effective_at_utc <= ?
        ORDER BY version_no DESC LIMIT 1
    """, (order_id, at, at)).fetchone()
    if promise is None:
        raise ValueError("no promise version visible at decision_time")

    lines = db.execute("""
        SELECT l.line_no, l.ordered_qty, p.unit_weight_kg,
               p.unit_volume_m3, p.special_handling
        FROM order_line l JOIN product p ON p.product_id = l.product_id
        WHERE l.order_id = ? ORDER BY l.line_no
    """, (order_id,)).fetchall()
    if not lines:
        raise ValueError("order has no lines")

    quantity = sum(line["ordered_qty"] for line in lines)
    weight = (sum(line["ordered_qty"] * line["unit_weight_kg"] for line in lines)
              if all(line["unit_weight_kg"] is not None for line in lines) else None)
    volume = (sum(line["ordered_qty"] * line["unit_volume_m3"] for line in lines)
              if all(line["unit_volume_m3"] is not None for line in lines) else None)
    line_sources = [f"order_line:{order_id}:{line['line_no']}" for line in lines]
    sources: dict[str, list[str]] = {
        "hours_to_deadline": [f"promise_version:{order_id}:{promise['version_no']}"],
        "customer_type": [f"customer_order:{order_id}"],
        "region": [f"customer_order:{order_id}"],
    }
    for name in ("item_count", "item_quantity", "weight_kg", "volume_m3", "special_handling"):
        sources[name] = line_sources

    stocks = []
    for line in lines:
        row = db.execute("""
            SELECT event_id, stock_status FROM stock_event
            WHERE order_id = ? AND line_no = ? AND recorded_at_utc <= ?
              AND occurred_at_utc <= ?
            ORDER BY recorded_at_utc DESC, event_id DESC LIMIT 1
        """, (order_id, line["line_no"], at, at)).fetchone()
        stocks.append(row)
    stock_status = (max((row["stock_status"] for row in stocks), key=_STOCK_PRIORITY.get)
                    if all(row is not None for row in stocks) else None)
    sources["stock_status"] = [f"stock_event:{row['event_id']}" for row in stocks if row]

    # Shipment facts are kept separate from line totals. Replacement movements
    # never contribute to original-delivery features.
    all_movements = db.execute("""
        SELECT DISTINCT sh.shipment_id, sh.planned_departure_at_utc,
               st.planned_eta_at_utc, st.stop_id, w.name AS warehouse,
               c.name AS carrier
        FROM shipment_item si
        JOIN shipment sh ON sh.shipment_id = si.shipment_id
        JOIN shipment_stop st ON st.shipment_id = sh.shipment_id AND st.site_id = si.site_id
        JOIN warehouse w ON w.warehouse_id = sh.warehouse_id
        LEFT JOIN carrier c ON c.carrier_id = sh.carrier_id
        WHERE si.order_id = ? AND sh.shipment_type = 'original'
        ORDER BY sh.shipment_id
    """, (order_id,)).fetchall()
    movements = []
    for movement in all_movements:
        allocated = db.execute("""
            SELECT COALESCE(SUM(allocated_qty), 0) FROM shipment_item
            WHERE shipment_id = ? AND order_id = ?
        """, (movement["shipment_id"], order_id)).fetchone()[0]
        accepted = db.execute("""
            SELECT COALESCE(SUM(hl.accepted_qty), 0)
            FROM handover_line hl JOIN handover h ON h.handover_id = hl.handover_id
            WHERE hl.shipment_id = ? AND hl.order_id = ?
              AND h.recorded_at_utc <= ? AND h.occurred_at_utc <= ?
        """, (movement["shipment_id"], order_id, at, at)).fetchone()[0]
        if accepted < allocated:
            movements.append(movement)
    stages = []
    departures = []
    etas = []
    for movement in movements:
        shipment_id = movement["shipment_id"]
        stage = db.execute("""
            SELECT event_id, stage, occurred_at_utc FROM warehouse_event
            WHERE shipment_id = ? AND recorded_at_utc <= ? AND occurred_at_utc <= ?
            ORDER BY recorded_at_utc DESC, event_id DESC LIMIT 1
        """, (shipment_id, at, at)).fetchone()
        stages.append(stage)
        if stage:
            sources.setdefault("warehouse_stage", []).append(f"warehouse_event:{stage['event_id']}")
        if stage and stage["stage"] == "departed" and movement["planned_departure_at_utc"]:
            departures.append((_parse_utc(stage["occurred_at_utc"]) -
                               _parse_utc(movement["planned_departure_at_utc"])).total_seconds() / 60)
            sources.setdefault("actual_departure_delay_minutes", []).append(
                f"warehouse_event:{stage['event_id']}")
        eta = db.execute("""
            SELECT update_id, current_eta_at_utc FROM eta_update
            WHERE stop_id = ? AND recorded_at_utc <= ? AND occurred_at_utc <= ?
            ORDER BY recorded_at_utc DESC, update_id DESC LIMIT 1
        """, (movement["stop_id"], at, at)).fetchone()
        if eta:
            sources.setdefault("eta_delay_minutes", []).append(f"eta_update:{eta['update_id']}")
        etas.append((movement["planned_eta_at_utc"], eta["current_eta_at_utc"] if eta else None))

    stage_value = (min((row["stage"] for row in stages), key=_STAGES.index)
                   if stages and all(row is not None for row in stages) else None)
    # The last expected original installment determines the order-level ETA.
    # An unchanged stop uses its planned ETA; without any update the feature
    # stays missing, matching the training snapshots' blank ETA convention.
    eta_delay = None
    if etas and any(current for _, current in etas) and all(planned for planned, _ in etas):
        latest_plan = max(_parse_utc(planned) for planned, _ in etas)
        latest_current = max(_parse_utc(current or planned) for planned, current in etas)
        eta_delay = (latest_current - latest_plan).total_seconds() / 60

    warehouses = {m["warehouse"] for m in movements}
    carriers = {m["carrier"] for m in movements}
    sources["warehouse"] = [f"shipment:{m['shipment_id']}" for m in movements]
    sources["carrier"] = sources["warehouse"]
    deadline = _parse_utc(promise["window_end_utc"])
    travel_hours = None
    if movements and all(m["planned_eta_at_utc"] for m in movements):
        final_stop = max(movements, key=lambda m: _parse_utc(m["planned_eta_at_utc"]))
        travel = db.execute("""
            SELECT observation_id, travel_seconds FROM travel_observation
            WHERE stop_id = ? AND fetched_at_utc <= ?
            ORDER BY fetched_at_utc DESC, observation_id DESC LIMIT 1
        """, (final_stop["stop_id"], at)).fetchone()
        if travel:
            travel_hours = travel["travel_seconds"] / 3600
            sources["travel_hours"] = [f"travel_observation:{travel['observation_id']}"]
    weather_hour = _utc_text(deadline.replace(minute=0, second=0, microsecond=0))
    weather = db.execute("""
        SELECT observation_id, precipitation_mm, wind_gust_m_s, fetched_at_utc
        FROM weather_observation
        WHERE site_id = ? AND valid_at_utc = ? AND fetched_at_utc <= ?
        ORDER BY fetched_at_utc DESC, observation_id DESC LIMIT 1
    """, (order["site_id"], weather_hour, at)).fetchone()
    weather_severity = None
    if weather and decision_time.astimezone(timezone.utc) - _parse_utc(weather["fetched_at_utc"]) <= timedelta(minutes=30):
        try:
            weather_severity = classify_weather(weather["precipitation_mm"],
                                                weather["wind_gust_m_s"])
        except ValueError:
            pass
        else:
            sources["weather_severity"] = [f"weather_observation:{weather['observation_id']}"]

    local_date = deadline.astimezone(ZoneInfo(order["time_zone"])).date().isoformat()
    holiday = db.execute("""
        SELECT observation_id, is_holiday, fetched_at_utc FROM holiday_observation
        WHERE region_id = ? AND local_date = ? AND fetched_at_utc <= ?
        ORDER BY fetched_at_utc DESC, observation_id DESC LIMIT 1
    """, (order["region_id"], local_date, at)).fetchone()
    holiday_flag = None
    if holiday and decision_time.astimezone(timezone.utc) - _parse_utc(holiday["fetched_at_utc"]) <= timedelta(days=7):
        holiday_flag = holiday["is_holiday"]
        sources["holiday_flag"] = [f"holiday_observation:{holiday['observation_id']}"]
    values = {
        "hours_to_deadline": (deadline - decision_time.astimezone(timezone.utc)).total_seconds() / 3600,
        "item_count": len(lines),
        "item_quantity": quantity,
        "weight_kg": weight,
        "volume_m3": volume,
        "special_handling": int(any(line["special_handling"] for line in lines)),
        "actual_departure_delay_minutes": max(departures) if movements and len(departures) == len(movements) else None,
        "eta_delay_minutes": eta_delay,
        "travel_hours": travel_hours,
        "weather_severity": weather_severity,
        "holiday_flag": holiday_flag,
        "customer_type": order["customer_type"],
        "stock_status": stock_status,
        "warehouse_stage": stage_value,
        "region": order["region"],
        "warehouse": next(iter(warehouses)) if len(warehouses) == 1 else None,
        "carrier": next(iter(carriers)) if len(carriers) == 1 else None,
    }
    assert tuple(values) == FEATURE_NAMES
    return FeatureRow(
        order_id=order_id, decision_time=at, promise_version=promise["version_no"],
        promised_to_utc=promise["window_end_utc"], values=values,
        sources=sources, missing=[name for name, value in values.items() if value is None],
        limitations=["product and shipment assignment history is not recorded in the current schema",
                     f"weather_severity uses {WEATHER_MAPPING_VERSION} demo thresholds; training categories were synthetic",
                     "training holiday_flag was synthetic rather than calendar-derived"],
    )
