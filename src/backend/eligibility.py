"""Rule-based predictive-scoring eligibility; no LLM decision involved."""

from dataclasses import dataclass
from datetime import datetime
from sqlite3 import Connection

from .features import _parse_utc, _utc_text


@dataclass(frozen=True)
class EligibilityResult:
    order_id: int
    reason: str

    @property
    def eligible(self) -> bool:
        return self.reason == "eligible"


def check_eligibility(db: Connection, order_id: int, decision_time: datetime) -> EligibilityResult:
    at = _utc_text(decision_time)
    row = db.execute("""
        SELECT created_at_utc, cancelled_at_utc FROM customer_order WHERE order_id = ?
    """, (order_id,)).fetchone()
    if row is None:
        return EligibilityResult(order_id, "order_not_found")
    if _parse_utc(row["created_at_utc"]) > decision_time:
        return EligibilityResult(order_id, "not_created_yet")
    # The current schema has no recorded_at for cancellation. Historical
    # cancellation replay is constrained to fixtures with known validity.
    if row["cancelled_at_utc"] and _parse_utc(row["cancelled_at_utc"]) <= decision_time:
        return EligibilityResult(order_id, "cancelled")
    approved = db.execute("""
        SELECT 1 FROM authorization_line al
        JOIN inspection i ON i.inspection_id = al.inspection_id
        JOIN claim c ON c.claim_id = i.claim_id
        WHERE c.order_id = ? AND i.recorded_at_utc <= ?
        LIMIT 1
    """, (order_id, at)).fetchone()
    if approved:
        return EligibilityResult(order_id, "replacement_authorized")

    lines = db.execute("""
        SELECT line_no, ordered_qty FROM order_line WHERE order_id = ?
    """, (order_id,)).fetchall()
    if not lines:
        return EligibilityResult(order_id, "no_order_lines")
    all_accepted = True
    for line in lines:
        accepted = db.execute("""
            SELECT COALESCE(SUM(hl.accepted_qty), 0)
            FROM handover_line hl
            JOIN handover h ON h.handover_id = hl.handover_id
            JOIN shipment_item si ON si.shipment_id = hl.shipment_id
                AND si.order_id = hl.order_id AND si.line_no = hl.line_no
            JOIN shipment sh ON sh.shipment_id = si.shipment_id
            WHERE hl.order_id = ? AND hl.line_no = ?
              AND sh.shipment_type = 'original'
              AND h.recorded_at_utc <= ? AND h.occurred_at_utc <= ?
        """, (order_id, line["line_no"], at, at)).fetchone()[0]
        if accepted < line["ordered_qty"]:
            all_accepted = False
            break
    if all_accepted:
        return EligibilityResult(order_id, "delivered")
    promise = db.execute("""
        SELECT 1 FROM promise_version
        WHERE order_id = ? AND recorded_at_utc <= ? AND effective_at_utc <= ?
        LIMIT 1
    """, (order_id, at, at)).fetchone()
    return EligibilityResult(order_id, "eligible" if promise else "no_visible_promise")
