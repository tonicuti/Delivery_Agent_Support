"""Decision-time feature tests against the actual pilot schema."""

import sqlite3
import sys
import unittest
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from backend.features import build_features


ROOT = Path(__file__).resolve().parents[1]
AT = datetime(2026, 11, 6, 9, 30, tzinfo=timezone.utc)


@contextmanager
def fixture() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript((ROOT / "schema_fresh.sql").read_text(encoding="utf-8"))
    db.executescript("""
        INSERT INTO planning_region VALUES (1, 'Stockholm');
        INSERT INTO management_team VALUES (1, 'Planning');
        INSERT INTO customer VALUES (1, 'demo', 'C1', 'B2B');
        INSERT INTO delivery_site VALUES (1, 1, '11111', 59.3, 18.0, 'Europe/Stockholm');
        INSERT INTO commodity_category VALUES (1, 'Boards');
        INSERT INTO product VALUES (1, 1, 'demo', 'P1', 'Pine', 'piece', 2, 0.1, 0);
        INSERT INTO product VALUES (2, 1, 'demo', 'P2', 'Oak', 'piece', 3, 0.2, 1);
        INSERT INTO warehouse VALUES (1, 'North', NULL, NULL);
        INSERT INTO carrier VALUES (1, 'Carrier A', 0);
        INSERT INTO carrier VALUES (2, 'Carrier B', 0);
        INSERT INTO customer_order VALUES
            (1002, 'demo', 'O1002', 1, 1, 1, 1, '2026-11-01T00:00:00Z', NULL);
        INSERT INTO promise_version VALUES
            (1002, 1, '2026-11-06T07:00:00Z', '2026-11-06T15:00:00Z',
             'Europe/Stockholm', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z'),
            (1002, 2, '2026-11-06T07:00:00Z', '2026-11-06T16:00:00Z',
             'Europe/Stockholm', '2026-11-06T09:00:00Z', '2026-11-06T10:00:00Z');
        INSERT INTO order_line VALUES (1002, 1, 1, 1, 3), (1002, 2, 1, 2, 4);
        INSERT INTO shipment VALUES
            ('S1', 'original', 1, 1, '2026-11-06T08:00:00Z', '2026-11-06T12:00:00Z', NULL, NULL, 'planned'),
            ('S2', 'original', 1, 2, '2026-11-06T08:00:00Z', '2026-11-06T13:00:00Z', NULL, NULL, 'planned'),
            ('R1', 'replacement', 1, 1, NULL, NULL, NULL, NULL, 'planned');
        INSERT INTO shipment_stop VALUES
            (1, 'S1', 1, 1, '2026-11-06T12:00:00Z'),
            (2, 'S2', 1, 1, '2026-11-06T13:00:00Z'),
            (3, 'R1', 1, 1, NULL);
        INSERT INTO shipment_item VALUES
            ('S1', 1002, 1, 1, 3, NULL),
            ('S2', 1002, 2, 1, 4, NULL),
            ('R1', 1002, 2, 1, 1, NULL);
        INSERT INTO stock_event VALUES
            ('stock-1', 1002, 1, 'in_stock', '2026-11-06T08:00:00Z', '2026-11-06T08:01:00Z', 'staff'),
            ('stock-2', 1002, 2, 'short', '2026-11-06T08:00:00Z', '2026-11-06T08:01:00Z', 'staff');
        INSERT INTO warehouse_event VALUES
            ('wh-1', 'S1', 'packed', '2026-11-06T08:00:00Z', '2026-11-06T08:01:00Z', 'staff'),
            ('wh-2', 'S2', 'waiting', '2026-11-06T08:00:00Z', '2026-11-06T08:01:00Z', 'staff');
        INSERT INTO eta_update VALUES
            ('eta-old', 2, '2026-11-06T14:00:00Z', '2026-11-06T09:00:00Z', '2026-11-06T09:01:00Z', 'staff'),
            ('eta-late', 2, '2026-11-06T18:00:00Z', '2026-11-06T09:10:00Z', '2026-11-06T09:45:00Z', 'staff');
    """)
    try:
        yield db
    finally:
        db.close()


class FeatureTests(unittest.TestCase):
    def test_lines_are_not_multiplied_by_shipments(self):
        with fixture() as db:
            result = build_features(db, 1002, AT)
        self.assertEqual(result.values["item_count"], 2)
        self.assertEqual(result.values["item_quantity"], 7)
        self.assertEqual(result.values["weight_kg"], 18)
        self.assertAlmostEqual(result.values["volume_m3"], 1.1)
        self.assertEqual(result.values["special_handling"], 1)
        self.assertEqual(result.values["warehouse_stage"], "waiting")
        self.assertIsNone(result.values["carrier"])

    def test_late_recorded_eta_and_promise_are_invisible(self):
        with fixture() as db:
            result = build_features(db, 1002, AT)
            later = build_features(db, 1002, datetime(2026, 11, 6, 10, 30, tzinfo=timezone.utc))
        self.assertEqual(result.promise_version, 1)
        self.assertEqual(result.values["eta_delay_minutes"], 60)
        self.assertEqual(result.values["hours_to_deadline"], 5.5)
        self.assertEqual(later.promise_version, 2)
        self.assertEqual(later.values["eta_delay_minutes"], 300)
        self.assertIn("eta_update:eta-old", result.sources["eta_delay_minutes"])
        self.assertNotIn("eta_update:eta-late", result.sources["eta_delay_minutes"])

    def test_future_occurrence_recorded_early_is_invisible(self):
        with fixture() as db:
            db.execute("""
                INSERT INTO eta_update VALUES
                ('future-eta', 2, '2026-11-06T20:00:00Z',
                 '2026-11-06T10:00:00Z', '2026-11-06T09:20:00Z', 'staff')
            """)
            result = build_features(db, 1002, AT)
        self.assertEqual(result.values["eta_delay_minutes"], 60)

    def test_unknown_external_semantics_remain_missing(self):
        with fixture() as db:
            result = build_features(db, 1002, AT)
        self.assertIsNone(result.values["travel_hours"])
        self.assertIsNone(result.values["weather_severity"])
        self.assertIsNone(result.values["holiday_flag"])
        self.assertEqual(len(result.values), 17)

    def test_completed_installment_does_not_drive_transport_state(self):
        with fixture() as db:
            db.executescript("""
                INSERT INTO handover VALUES
                    ('H1', 1, '2026-11-06T09:00:00Z', '2026-11-06T09:01:00Z', 'staff');
                INSERT INTO handover_line VALUES
                    (1, 'H1', 'S1', 1002, 1, 3, 0, 0);
            """)
            result = build_features(db, 1002, AT)
        self.assertEqual(result.values["carrier"], "Carrier B")
        self.assertEqual(result.values["eta_delay_minutes"], 60)

    def test_cached_travel_and_holiday_are_visible_only_after_fetch(self):
        with fixture() as db:
            db.executescript("""
                INSERT INTO travel_observation VALUES
                    (1, 2, 'fixture', NULL, 7200, '2026-11-06T09:00:00Z');
                INSERT INTO holiday_observation VALUES
                    (1, 1, '2026-11-06', 1, 'fixture', '2026-11-06T09:00:00Z');
            """)
            before = build_features(db, 1002, datetime(2026, 11, 6, 8, 30, tzinfo=timezone.utc))
            after = build_features(db, 1002, AT)
        self.assertIsNone(before.values["travel_hours"])
        self.assertIsNone(before.values["holiday_flag"])
        self.assertEqual(after.values["travel_hours"], 2)
        self.assertEqual(after.values["holiday_flag"], 1)

    def test_rejects_naive_decision_time(self):
        with fixture() as db:
            with self.assertRaises(ValueError):
                build_features(db, 1002, datetime(2026, 11, 6, 9, 30))


if __name__ == "__main__":
    unittest.main()
