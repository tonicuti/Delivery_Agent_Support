"""Read-only views of orders, risk, alerts and shifts for the planner console."""

from datetime import datetime, timedelta
import json
from sqlite3 import Connection, Row
from statistics import median

from .decisions import DISMISS_REASONS, parse_decision
from .eligibility import check_eligibility
from .labels import ACTION_TITLES, DECISION_WORDS, ROLE_WORDS, STAGE_WORDS, STOCK_WORDS
from .features import FEATURE_NAMES, _STAGES as PIPELINE_STAGES, _parse_utc, _utc_text
from .predictor import risk_band
from .reasons import observed_signals

RUN_HISTORY_LIMIT = 10
TIMELINE_LIMIT = 60
STALE_AFTER = timedelta(minutes=90)  # the proposal's DATA_STALE threshold


def _loads(text: str | None, default):
    return json.loads(text) if text else default


def _hours_remaining(promised_to_utc: str | None, now: datetime) -> float | None:
    if promised_to_utc is None:
        return None
    return round((_parse_utc(promised_to_utc) - now).total_seconds() / 3600, 2)


def _age_minutes(as_of_utc: str, now: datetime) -> int:
    return max(0, round((now - _parse_utc(as_of_utc)).total_seconds() / 60))


def _latest_score(db: Connection, order_id: int) -> Row | None:
    return db.execute("""
        SELECT s.score_id, s.p_late, s.model_version, s.scored_at_utc,
               sn.snapshot_id, sn.as_of_utc, sn.promised_to_utc, sn.promise_version_no
        FROM risk_score s JOIN order_snapshot sn ON sn.snapshot_id = s.snapshot_id
        WHERE sn.order_id = ? ORDER BY sn.as_of_utc DESC, s.score_id DESC LIMIT 1
    """, (order_id,)).fetchone()


def _latest_recommendation(db: Connection, order_id: int) -> dict | None:
    row = db.execute("""
        SELECT r.recommendation_id, r.run_id, r.score_id, r.action_id, r.output_json,
               r.validation_status, r.created_at_utc
        FROM agent_recommendation r JOIN agent_run ar ON ar.run_id = r.run_id
        WHERE ar.order_id = ? ORDER BY r.created_at_utc DESC, r.rowid DESC LIMIT 1
    """, (order_id,)).fetchone()
    if row is None:
        return None
    result = dict(row)
    result["output"] = _loads(result.pop("output_json"), None)
    result["decision"] = _latest_decision(db, row["recommendation_id"], row["action_id"])
    return result


def _decision_row(row: Row, recommended_action_id: str | None) -> dict:
    return {"feedback_id": row["feedback_id"], "recommendation_id": row["recommendation_id"],
            "chosen_action_id": row["chosen_action_id"], "role": row["recorded_by"],
            "recorded_at_utc": row["recorded_at_utc"],
            **parse_decision(row["chosen_action_id"], row["notes"], recommended_action_id)}


def _latest_decision(db: Connection, recommendation_id: str, recommended_action_id: str | None) -> dict | None:
    row = db.execute("""
        SELECT * FROM planner_feedback WHERE recommendation_id = ?
        ORDER BY recorded_at_utc DESC, rowid DESC LIMIT 1
    """, (recommendation_id,)).fetchone()
    return _decision_row(row, recommended_action_id) if row else None


def _notifications(db: Connection, order_id: int) -> list[dict]:
    rows = db.execute("""
        SELECT n.notification_id, n.episode_id, n.recommendation_id, n.kind, n.payload_json,
               n.created_at_utc, n.acknowledged_at_utc
        FROM simulated_notification n JOIN risk_episode e ON e.episode_id = n.episode_id
        WHERE e.order_id = ? ORDER BY n.created_at_utc DESC, n.rowid DESC
    """, (order_id,)).fetchall()
    return [{**dict(row), "payload": _loads(row["payload_json"], {})} for row in rows]


def _order_row(db: Connection, base: Row, now: datetime) -> dict:
    order_id = base["order_id"]
    score = _latest_score(db, order_id)
    schedule = db.execute("SELECT next_due_at_utc FROM schedule_state WHERE order_id = ?",
                          (order_id,)).fetchone()
    worklist = db.execute("SELECT status FROM worklist_item WHERE order_id = ?",
                          (order_id,)).fetchone()
    return {
        **dict(base),
        "eligibility": check_eligibility(db, order_id, now).reason,
        "p_late": score["p_late"] if score else None,
        "risk_band": risk_band(score["p_late"]) if score else None,
        "scored_at_utc": score["as_of_utc"] if score else None,
        "age_minutes": _age_minutes(score["as_of_utc"], now) if score else None,
        "stale": bool(score and now - _parse_utc(score["as_of_utc"]) > STALE_AFTER),
        "promised_to_utc": score["promised_to_utc"] if score else None,
        "hours_remaining": _hours_remaining(score["promised_to_utc"], now) if score else None,
        "next_due_at_utc": schedule["next_due_at_utc"] if schedule else None,
        "on_worklist": bool(worklist and worklist["status"] == "active"),
    }


_ORDER_BASE = """
    SELECT o.order_id, o.external_order_id, c.customer_type, r.name AS region,
           t.name AS team, o.created_at_utc, o.cancelled_at_utc
    FROM customer_order o
    JOIN customer c ON c.customer_id = o.customer_id
    JOIN delivery_site s ON s.site_id = o.site_id
    JOIN planning_region r ON r.region_id = s.region_id
    JOIN management_team t ON t.team_id = o.management_team_id
"""


def list_orders(db: Connection, now: datetime) -> list[dict]:
    return [_order_row(db, row, now)
            for row in db.execute(_ORDER_BASE + " ORDER BY o.order_id").fetchall()]


def worklist(db: Connection, now: datetime) -> list[dict]:
    """Live high-risk queue, highest probability first."""
    rows = db.execute(_ORDER_BASE + """
        JOIN worklist_item w ON w.order_id = o.order_id AND w.status = 'active'
        JOIN risk_score s2 ON s2.score_id = w.latest_score_id
        ORDER BY s2.p_late DESC, o.order_id
    """).fetchall()
    items = []
    for base in rows:
        item = _order_row(db, base, now)
        recommendation = _latest_recommendation(db, base["order_id"])
        notifications = _notifications(db, base["order_id"])
        item["recommendation"] = recommendation
        item["alert"] = notifications[0] if notifications else None
        score = _latest_score(db, base["order_id"])
        snapshot = _snapshot_detail(db, score["snapshot_id"]) if score else None
        item["signals"] = observed_signals(snapshot["features_by_name"]) if snapshot else []
        episode = db.execute("""
            SELECT opened_at_utc FROM risk_episode WHERE order_id = ? AND closed_at_utc IS NULL
        """, (base["order_id"],)).fetchone()
        item["episode_opened_at_utc"] = episode["opened_at_utc"] if episode else None
        items.append(item)
    return items


def overview(db: Connection, now: datetime) -> dict:
    orders = list_orders(db, now)
    at = _utc_text(now)
    bands = {"Low": 0, "Medium": 0, "High": 0, "Unscored": 0}
    for order in orders:
        bands[order["risk_band"] or "Unscored"] += 1
    unacknowledged = db.execute("""
        SELECT COUNT(*) FROM simulated_notification n
        JOIN risk_episode e ON e.episode_id = n.episode_id
        WHERE n.acknowledged_at_utc IS NULL AND e.closed_at_utc IS NULL
    """).fetchone()[0]
    due = db.execute("""
        SELECT COUNT(*) FROM customer_order o
        LEFT JOIN schedule_state s ON s.order_id = o.order_id
        WHERE s.order_id IS NULL OR (s.next_due_at_utc IS NOT NULL AND s.next_due_at_utc <= ?)
    """, (at,)).fetchone()[0]
    return {
        "now": at, "orders": len(orders), "bands": bands,
        "active_high_risk": sum(1 for o in orders if o["on_worklist"]),
        "unacknowledged_alerts": unacknowledged, "due_now": due,
        "eligible": sum(1 for o in orders if o["eligibility"] == "eligible"),
    }


def _snapshot_detail(db: Connection, snapshot_id: str) -> dict | None:
    row = db.execute("""
        SELECT feature_values_json, missing_json, source_refs_json, limitations_json
        FROM model_input_snapshot WHERE snapshot_id = ?
    """, (snapshot_id,)).fetchone()
    if row is None:
        return None
    values = _loads(row["feature_values_json"], {})
    sources = _loads(row["source_refs_json"], {})
    return {
        "features_by_name": values,
        "features": [{"name": name, "value": values.get(name), "sources": sources.get(name, [])}
                     for name in FEATURE_NAMES],
        "missing": _loads(row["missing_json"], []),
        "limitations": _loads(row["limitations_json"], []),
    }


def _claims(db: Connection, order_id: int) -> list[dict]:
    claims = []
    for claim in db.execute("""
        SELECT claim_id, opened_at_utc, opened_by, status FROM claim
        WHERE order_id = ? ORDER BY opened_at_utc
    """, (order_id,)).fetchall():
        lines = db.execute("""
            SELECT cl.claim_line_id, cl.reason, cl.disputed_qty, al.approved_qty,
                   rt.status AS task_status
            FROM claim_line cl
            LEFT JOIN authorization_line al ON al.claim_line_id = cl.claim_line_id
            LEFT JOIN redelivery_task rt ON rt.authorization_line_id = al.authorization_line_id
            WHERE cl.claim_id = ? ORDER BY cl.claim_line_id
        """, (claim["claim_id"],)).fetchall()
        claims.append({**dict(claim), "lines": [dict(line) for line in lines]})
    return claims


def _shipments(db: Connection, order_id: int) -> list[dict]:
    rows = db.execute("""
        SELECT DISTINCT sh.shipment_id, sh.shipment_type, sh.status,
               w.name AS warehouse, c.name AS carrier,
               sh.planned_departure_at_utc, sh.planned_arrival_at_utc,
               (SELECT stage FROM warehouse_event we WHERE we.shipment_id = sh.shipment_id
                ORDER BY we.recorded_at_utc DESC LIMIT 1) AS stage,
               (SELECT eu.current_eta_at_utc FROM eta_update eu
                JOIN shipment_stop st ON st.stop_id = eu.stop_id
                WHERE st.shipment_id = sh.shipment_id
                ORDER BY eu.recorded_at_utc DESC LIMIT 1) AS current_eta_at_utc
        FROM shipment_item si
        JOIN shipment sh ON sh.shipment_id = si.shipment_id
        JOIN warehouse w ON w.warehouse_id = sh.warehouse_id
        JOIN carrier c ON c.carrier_id = sh.carrier_id
        WHERE si.order_id = ? ORDER BY sh.shipment_id
    """, (order_id,)).fetchall()
    shipments = [dict(row) for row in rows]
    for shipment in shipments:
        stage = shipment["stage"]
        shipment["stage_index"] = PIPELINE_STAGES.index(stage) if stage in PIPELINE_STAGES else -1
    return shipments


def _lines(db: Connection, order_id: int) -> list[dict]:
    rows = db.execute("""
        SELECT ol.line_no, p.name AS product, p.unit, ol.ordered_qty,
               (SELECT stock_status FROM stock_event se
                WHERE se.order_id = ol.order_id AND se.line_no = ol.line_no
                ORDER BY se.recorded_at_utc DESC LIMIT 1) AS stock_status
        FROM order_line ol JOIN product p ON p.product_id = ol.product_id
        WHERE ol.order_id = ? ORDER BY ol.line_no
    """, (order_id,)).fetchall()
    return [dict(row) for row in rows]


def order_detail(db: Connection, order_id: int, now: datetime) -> dict | None:
    base = db.execute(_ORDER_BASE + " WHERE o.order_id = ?", (order_id,)).fetchone()
    if base is None:
        return None
    detail = _order_row(db, base, now)
    score = _latest_score(db, order_id)
    detail["model_version"] = score["model_version"] if score else None
    detail["promise_version"] = score["promise_version_no"] if score else None
    detail["inputs"] = _snapshot_detail(db, score["snapshot_id"]) if score else None
    detail["score_history"] = [
        {"score_id": row["score_id"], "as_of_utc": row["as_of_utc"], "p_late": row["p_late"],
         "risk_band": risk_band(row["p_late"])}
        for row in db.execute("""
            SELECT s.score_id, sn.as_of_utc, s.p_late FROM risk_score s
            JOIN order_snapshot sn ON sn.snapshot_id = s.snapshot_id
            WHERE sn.order_id = ? ORDER BY sn.as_of_utc, s.score_id
        """, (order_id,)).fetchall()]
    detail["promises"] = [dict(row) for row in db.execute("""
        SELECT version_no, window_start_utc, window_end_utc, effective_at_utc, site_time_zone
        FROM promise_version WHERE order_id = ? ORDER BY version_no
    """, (order_id,)).fetchall()]
    detail["recommendation"] = _latest_recommendation(db, order_id)
    detail["notifications"] = _notifications(db, order_id)
    detail["decisions"] = [
        _decision_row(row, row["recommended_action_id"]) for row in db.execute("""
            SELECT f.*, r.action_id AS recommended_action_id
            FROM planner_feedback f JOIN agent_recommendation r
              ON r.recommendation_id = f.recommendation_id
            JOIN agent_run ar ON ar.run_id = r.run_id
            WHERE ar.order_id = ? ORDER BY f.recorded_at_utc DESC, f.rowid DESC
        """, (order_id,)).fetchall()]
    detail["signals"] = observed_signals(detail["inputs"]["features_by_name"]) if detail["inputs"] else []
    detail["timeline"] = timeline(db, order_id)
    detail["lines"] = _lines(db, order_id)
    detail["shipments"] = _shipments(db, order_id)
    detail["claims"] = _claims(db, order_id)
    detail["runs"] = [dict(row) for row in db.execute("""
        SELECT run_id, trigger_id, decision_time_utc, status, eligibility_reason,
               next_due_at_utc, error_message
        FROM agent_run WHERE order_id = ? ORDER BY created_at_utc DESC, rowid DESC LIMIT ?
    """, (order_id, RUN_HISTORY_LIMIT)).fetchall()]
    return detail


def list_regions(db: Connection) -> list[dict]:
    return [dict(row) for row in db.execute(
        "SELECT region_id, name FROM planning_region ORDER BY region_id")]


def list_shifts(db: Connection) -> list[dict]:
    return [dict(row) for row in db.execute("""
        SELECT l.shift_id, l.region_id, r.name AS region, l.started_at_utc, l.review_capacity,
               (SELECT COUNT(*) FROM shift_candidate c WHERE c.shift_id = l.shift_id) AS candidates
        FROM shift_list l JOIN planning_region r ON r.region_id = l.region_id
        ORDER BY l.started_at_utc DESC, l.shift_id
    """)]


def shift_detail(db: Connection, shift_id: str) -> dict | None:
    shift = db.execute("""
        SELECT l.shift_id, l.region_id, r.name AS region, l.started_at_utc, l.review_capacity
        FROM shift_list l JOIN planning_region r ON r.region_id = l.region_id
        WHERE l.shift_id = ?
    """, (shift_id,)).fetchone()
    if shift is None:
        return None
    candidates = db.execute("""
        SELECT c.order_id, o.external_order_id, c.rank_at_start, c.selected_for_review,
               c.score_id, s.p_late
        FROM shift_candidate c JOIN risk_score s ON s.score_id = c.score_id
        JOIN customer_order o ON o.order_id = c.order_id
        WHERE c.shift_id = ? ORDER BY c.rank_at_start
    """, (shift_id,)).fetchall()
    return {**dict(shift), "candidates": [
        {**dict(row), "risk_band": risk_band(row["p_late"]),
         "selected_for_review": bool(row["selected_for_review"])} for row in candidates]}


def schedule_overview(db: Connection, now: datetime) -> list[dict]:
    """Every order with its persisted due time; a missing schedule means 'never run'."""
    at = _utc_text(now)
    rows = db.execute("""
        SELECT o.order_id, o.external_order_id, s.next_due_at_utc, s.last_trigger_id
        FROM customer_order o LEFT JOIN schedule_state s ON s.order_id = o.order_id
        ORDER BY (s.next_due_at_utc IS NULL), s.next_due_at_utc, o.order_id
    """).fetchall()
    result = []
    for row in rows:
        never_run = row["next_due_at_utc"] is None and row["last_trigger_id"] is None
        due = never_run or (row["next_due_at_utc"] is not None and row["next_due_at_utc"] <= at)
        result.append({**dict(row), "never_run": never_run, "due": due})
    return result


def timeline(db: Connection, order_id: int) -> list[dict]:
    """Everything the system learned about an order, newest first, by when it became visible."""
    events: list[dict] = []

    def add(at: str | None, kind: str, title: str, detail: str | None = None) -> None:
        if at:
            events.append({"at_utc": at, "kind": kind, "title": title, "detail": detail})

    shipments = "SELECT shipment_id FROM shipment_item WHERE order_id = ?"
    created = db.execute("SELECT created_at_utc FROM customer_order WHERE order_id = ?",
                         (order_id,)).fetchone()
    add(created["created_at_utc"] if created else None, "order", "Order placed")
    for row in db.execute("""
        SELECT version_no, window_start_utc, window_end_utc, recorded_at_utc
        FROM promise_version WHERE order_id = ?""", (order_id,)):
        add(row["recorded_at_utc"], "promise", "Delivery time promised",
            f"{row['window_start_utc']} to {row['window_end_utc']}")
    for row in db.execute("""
        SELECT line_no, stock_status, recorded_at_utc FROM stock_event WHERE order_id = ?""",
                          (order_id,)):
        add(row["recorded_at_utc"], "stock", f"Line {row['line_no']}: {STOCK_WORDS.get(row['stock_status'], row['stock_status'])}")
    for row in db.execute(f"""
        SELECT shipment_id, stage, recorded_at_utc FROM warehouse_event
        WHERE shipment_id IN ({shipments})""", (order_id,)):
        add(row["recorded_at_utc"], "warehouse", f"Shipment {row['shipment_id']}: {STAGE_WORDS.get(row['stage'], row['stage'])}")
    for row in db.execute(f"""
        SELECT st.shipment_id, e.current_eta_at_utc, e.recorded_at_utc
        FROM eta_update e JOIN shipment_stop st ON st.stop_id = e.stop_id
        WHERE st.shipment_id IN ({shipments})""", (order_id,)):
        add(row["recorded_at_utc"], "transport", f"Shipment {row['shipment_id']}: arrival estimate changed",
            f"Now expected {row['current_eta_at_utc']}")
    for row in db.execute("""
        SELECT s.p_late, s.scored_at_utc FROM risk_score s
        JOIN order_snapshot sn ON sn.snapshot_id = s.snapshot_id WHERE sn.order_id = ?""", (order_id,)):
        add(row["scored_at_utc"], "score", f"Risk checked: {round(row['p_late'] * 100)}% chance of being late ({risk_band(row['p_late'])})")
    for row in db.execute("""
        SELECT n.kind, n.created_at_utc, n.acknowledged_at_utc
        FROM simulated_notification n JOIN risk_episode e ON e.episode_id = n.episode_id
        WHERE e.order_id = ?""", (order_id,)):
        add(row["created_at_utc"], "alert", "Alert sent to the team" if row["kind"] == "initial" else "Reminder sent to the team")
        add(row["acknowledged_at_utc"], "alert", "Alert read")
    for row in db.execute("""
        SELECT f.*, r.action_id AS recommended_action_id FROM planner_feedback f
        JOIN agent_recommendation r ON r.recommendation_id = f.recommendation_id
        JOIN agent_run ar ON ar.run_id = r.run_id WHERE ar.order_id = ?""", (order_id,)):
        decision = _decision_row(row, row["recommended_action_id"])
        add(row["recorded_at_utc"], "decision",
            f"{DECISION_WORDS[decision['decision']]} · {ROLE_WORDS.get(decision['role'], decision['role'])}",
            ACTION_TITLES.get(decision["chosen_action_id"]) if decision["chosen_action_id"] else None)
    for row in db.execute("""
        SELECT claim_id, opened_by, recorded_at_utc FROM claim WHERE order_id = ?""", (order_id,)):
        add(row["recorded_at_utc"], "claim", "Claim opened", f"by {row['opened_by']}")
    events.sort(key=lambda e: e["at_utc"], reverse=True)
    return events[:TIMELINE_LIMIT]


def warehouse_load(db: Connection) -> list[dict]:
    """Original shipments per warehouse by latest stage; there is no 'normal for this hour' baseline yet."""
    rows = db.execute("""
        SELECT w.name AS warehouse,
               COALESCE((SELECT stage FROM warehouse_event we WHERE we.shipment_id = sh.shipment_id
                         ORDER BY we.recorded_at_utc DESC LIMIT 1), 'waiting') AS stage,
               COUNT(*) AS shipments
        FROM shipment sh JOIN warehouse w ON w.warehouse_id = sh.warehouse_id
        WHERE sh.shipment_type = 'original' GROUP BY w.name, stage ORDER BY w.name, stage
    """).fetchall()
    return [dict(row) for row in rows]


def kpis(db: Connection, now: datetime) -> dict:
    """Manager view: flagged, acknowledged, decided, and outcome-based metrics when outcomes exist."""
    summary = overview(db, now)
    episodes = db.execute("SELECT COUNT(*) FROM risk_episode").fetchone()[0]
    minutes = []
    for row in db.execute("""
        SELECT created_at_utc, acknowledged_at_utc FROM simulated_notification
        WHERE acknowledged_at_utc IS NOT NULL"""):
        minutes.append((_parse_utc(row["acknowledged_at_utc"]) - _parse_utc(row["created_at_utc"])).total_seconds() / 60)
    notifications = db.execute("SELECT COUNT(*) FROM simulated_notification").fetchone()[0]
    decisions = {name: 0 for name in ("approved", "edited", "dismissed")}
    reasons = {key: 0 for key in DISMISS_REASONS}
    for row in db.execute("""
        SELECT f.*, r.action_id AS recommended_action_id FROM planner_feedback f
        JOIN agent_recommendation r ON r.recommendation_id = f.recommendation_id"""):
        parsed = parse_decision(row["chosen_action_id"], row["notes"], row["recommended_action_id"])
        decisions[parsed["decision"]] += 1
        if parsed["decision"] == "dismissed" and parsed["reason"] in reasons:
            reasons[parsed["reason"]] += 1
    recommendations = dict(db.execute("""
        SELECT validation_status, COUNT(*) FROM agent_recommendation GROUP BY validation_status""").fetchall())
    known = db.execute("""
        SELECT original_late FROM original_delivery_outcome WHERE label_status = 'known'""").fetchall()
    on_time = (1 - sum(row[0] for row in known) / len(known)) if known else None
    flagged_late = db.execute("""
        SELECT COUNT(*) FROM shift_candidate c JOIN original_delivery_outcome o ON o.order_id = c.order_id
        WHERE c.selected_for_review = 1 AND o.label_status = 'known' AND o.original_late = 1""").fetchone()[0]
    reviewed_known = db.execute("""
        SELECT COUNT(*) FROM shift_candidate c JOIN original_delivery_outcome o ON o.order_id = c.order_id
        WHERE c.selected_for_review = 1 AND o.label_status = 'known'""").fetchone()[0]
    return {
        "now": summary["now"], "bands": summary["bands"], "orders": summary["orders"],
        "active_high_risk": summary["active_high_risk"], "episodes_opened": episodes,
        "alerts": {"sent": notifications, "acknowledged": len(minutes),
                   "median_minutes_to_acknowledge": round(median(minutes), 1) if minutes else None},
        "decisions": decisions, "dismiss_reasons": reasons,
        "recommendations": {"valid": recommendations.get("valid", 0),
                            "unavailable": recommendations.get("unavailable", 0)
                            + recommendations.get("invalid", 0)},
        "outcomes": {"known_orders": len(known), "on_time_rate": on_time,
                     "precision_at_k": flagged_late / reviewed_known if reviewed_known else None,
                     "reviewed_with_outcome": reviewed_known},
    }
