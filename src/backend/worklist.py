"""Immutable planner review queues captured at the beginning of a shift."""

from datetime import datetime
from sqlite3 import Connection

from .eligibility import check_eligibility
from .features import _utc_text


def freeze_shift(db: Connection, shift_id: str, region_id: int,
                 started_at: datetime, review_capacity: int) -> list[dict]:
    """Rank each region's latest visible eligible score once for the shift."""
    if not shift_id or review_capacity <= 0:
        raise ValueError("shift_id and positive review_capacity are required")
    if db.in_transaction:
        raise ValueError("freeze_shift requires a connection outside a transaction")
    at = _utc_text(started_at)
    db.execute("BEGIN IMMEDIATE")
    try:
        existing = db.execute("SELECT * FROM shift_list WHERE shift_id = ?", (shift_id,)).fetchone()
        if existing:
            if (existing["region_id"] != region_id or existing["started_at_utc"] != at
                    or existing["review_capacity"] != review_capacity):
                raise ValueError("shift_id already used with different parameters")
        else:
            region = db.execute("SELECT 1 FROM planning_region WHERE region_id = ?", (region_id,)).fetchone()
            if region is None:
                raise LookupError(f"region {region_id} does not exist")
            db.execute("""
                INSERT INTO shift_list(shift_id, region_id, started_at_utc, review_capacity)
                VALUES (?, ?, ?, ?)
            """, (shift_id, region_id, at, review_capacity))
            scores = db.execute("""
                SELECT o.order_id, s.score_id, s.p_late
                FROM customer_order o
                JOIN delivery_site site ON site.site_id = o.site_id
                JOIN order_snapshot snap ON snap.order_id = o.order_id
                JOIN risk_score s ON s.snapshot_id = snap.snapshot_id
                WHERE site.region_id = ? AND snap.as_of_utc <= ? AND s.scored_at_utc <= ?
                ORDER BY o.order_id, snap.as_of_utc DESC, s.score_id DESC
            """, (region_id, at, at)).fetchall()
            latest = {}
            for score in scores:
                latest.setdefault(score["order_id"], score)
            ranked = [row for row in latest.values()
                      if check_eligibility(db, row["order_id"], started_at).eligible]
            ranked.sort(key=lambda row: (-row["p_late"], row["order_id"]))
            for rank, row in enumerate(ranked, 1):
                db.execute("""
                    INSERT INTO shift_candidate
                    (shift_id, order_id, score_id, rank_at_start, selected_for_review)
                    VALUES (?, ?, ?, ?, ?)
                """, (shift_id, row["order_id"], row["score_id"], rank,
                      int(rank <= review_capacity)))
        result = [dict(row) for row in db.execute("""
            SELECT c.order_id, c.score_id, s.p_late, c.rank_at_start,
                   c.selected_for_review
            FROM shift_candidate c JOIN risk_score s ON s.score_id = c.score_id
            WHERE c.shift_id = ? ORDER BY c.rank_at_start
        """, (shift_id,)).fetchall()]
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
