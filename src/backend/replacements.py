"""Representative controlled replacement authorization and completion."""

from datetime import datetime
import math
from sqlite3 import Connection
from uuid import uuid4

from .features import _utc_text


def approve_replacement(db: Connection, inspection_id: str, claim_id: str,
                        representative_id: str, finding: str, decided_at: datetime,
                        approved_quantities: dict[int, float]) -> list[str]:
    """Authorize inspected claim quantities and create urgent tasks atomically."""
    if not all((inspection_id, claim_id, representative_id, finding)) or not approved_quantities:
        raise ValueError("inspection, claim, representative, finding and quantities are required")
    if db.in_transaction:
        raise ValueError("authorization requires a connection outside a transaction")
    at = _utc_text(decided_at)
    db.execute("BEGIN IMMEDIATE")
    try:
        existing = db.execute("SELECT * FROM inspection WHERE inspection_id = ?", (inspection_id,)).fetchone()
        if existing:
            if (existing["claim_id"] != claim_id or existing["representative_id"] != representative_id
                    or existing["finding"] != finding or existing["decision"] != "approved"
                    or existing["decided_at_utc"] != at):
                raise ValueError("inspection_id already used for another decision")
            saved = db.execute("""
                SELECT authorization_line_id, claim_line_id, approved_qty
                FROM authorization_line WHERE inspection_id = ? ORDER BY claim_line_id
            """, (inspection_id,)).fetchall()
            if {row["claim_line_id"]: row["approved_qty"] for row in saved} != approved_quantities:
                raise ValueError("inspection_id already used for other quantities")
            result = [row["authorization_line_id"] for row in saved]
            db.commit()
            return result
        claim = db.execute("""
            SELECT c.order_id, c.status, o.management_team_id
            FROM claim c JOIN customer_order o ON o.order_id = c.order_id
            WHERE c.claim_id = ? AND c.recorded_at_utc <= ?
        """, (claim_id, at)).fetchone()
        if claim is None or claim["status"] not in ("open", "approved"):
            raise ValueError("claim is unavailable for authorization")
        lines = db.execute("SELECT claim_line_id, disputed_qty FROM claim_line WHERE claim_id = ?",
                           (claim_id,)).fetchall()
        allowed = {row["claim_line_id"]: row["disputed_qty"] for row in lines}
        for line_id, quantity in approved_quantities.items():
            if (line_id not in allowed or not isinstance(quantity, (int, float))
                    or not math.isfinite(quantity)
                    or not 0 < quantity <= allowed[line_id]):
                raise ValueError("approved quantity exceeds a claim line or is invalid")
            if db.execute("SELECT 1 FROM authorization_line WHERE claim_line_id = ?", (line_id,)).fetchone():
                raise ValueError("claim line has already been authorized")
        db.execute("""
            INSERT INTO inspection
            (inspection_id, claim_id, representative_id, finding, decision,
             decided_at_utc, recorded_at_utc)
            VALUES (?, ?, ?, ?, 'approved', ?, ?)
        """, (inspection_id, claim_id, representative_id, finding, at, at))
        result = []
        for line_id, quantity in sorted(approved_quantities.items()):
            auth_id = str(uuid4())
            db.execute("""
                INSERT INTO authorization_line
                (authorization_line_id, inspection_id, claim_id, claim_line_id, approved_qty)
                VALUES (?, ?, ?, ?, ?)
            """, (auth_id, inspection_id, claim_id, line_id, quantity))
            db.execute("""
                INSERT INTO redelivery_task
                (authorization_line_id, management_team_id, created_at_utc, status)
                VALUES (?, ?, ?, 'urgent')
            """, (auth_id, claim["management_team_id"], at))
            result.append(auth_id)
        db.execute("UPDATE claim SET status = 'approved' WHERE claim_id = ?", (claim_id,))
        db.execute("UPDATE risk_episode SET closed_at_utc = ? WHERE order_id = ? AND closed_at_utc IS NULL",
                   (at, claim["order_id"]))
        db.execute("""
            UPDATE worklist_item SET status = 'closed', updated_at_utc = ?
            WHERE order_id = ? AND status = 'active'
        """, (at, claim["order_id"]))
        db.execute("""
            UPDATE schedule_state SET next_due_at_utc = NULL, updated_at_utc = ?
            WHERE order_id = ?
        """, (at, claim["order_id"]))
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


def refresh_replacement_tasks(db: Connection, order_id: int, as_of: datetime) -> int:
    """Complete tasks only after all authorized replacement units are accepted."""
    if db.in_transaction:
        raise ValueError("task refresh requires a connection outside a transaction")
    at = _utc_text(as_of)
    db.execute("BEGIN IMMEDIATE")
    try:
        rows = db.execute("""
            SELECT al.authorization_line_id, al.approved_qty,
                   COALESCE(SUM(CASE WHEN h.recorded_at_utc <= ? AND h.occurred_at_utc <= ?
                                     THEN hl.accepted_qty ELSE 0 END), 0) AS accepted_qty
            FROM authorization_line al
            JOIN inspection i ON i.inspection_id = al.inspection_id
            JOIN claim c ON c.claim_id = i.claim_id
            JOIN redelivery_task task ON task.authorization_line_id = al.authorization_line_id
            LEFT JOIN shipment_item si ON si.authorization_line_id = al.authorization_line_id
            LEFT JOIN shipment sh ON sh.shipment_id = si.shipment_id AND sh.shipment_type = 'replacement'
            LEFT JOIN handover_line hl ON hl.shipment_id = sh.shipment_id
                AND hl.order_id = si.order_id AND hl.line_no = si.line_no
            LEFT JOIN handover h ON h.handover_id = hl.handover_id
            WHERE c.order_id = ? AND task.status != 'done'
            GROUP BY al.authorization_line_id
        """, (at, at, order_id)).fetchall()
        done = 0
        for row in rows:
            if row["accepted_qty"] >= row["approved_qty"]:
                db.execute("UPDATE redelivery_task SET status = 'done' WHERE authorization_line_id = ?",
                           (row["authorization_line_id"],))
                done += 1
        db.commit()
        return done
    except Exception:
        db.rollback()
        raise
