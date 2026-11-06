import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.eligibility import check_eligibility
from test_features import AT, fixture


class EligibilityTests(unittest.TestCase):
    def test_open_order_is_eligible(self):
        with fixture() as db:
            self.assertEqual(check_eligibility(db, 1002, AT).reason, "eligible")

    def test_cancellation_stops_scoring(self):
        with fixture() as db:
            db.execute("UPDATE customer_order SET cancelled_at_utc = ? WHERE order_id = 1002",
                       ("2026-11-06T09:00:00Z",))
            self.assertEqual(check_eligibility(db, 1002, AT).reason, "cancelled")

    def test_approved_replacement_stops_scoring_but_claim_alone_does_not(self):
        with fixture() as db:
            db.executescript("""
                INSERT INTO handover VALUES
                    ('H1', 1, '2026-11-06T09:00:00Z', '2026-11-06T09:01:00Z', 'staff');
                INSERT INTO handover_line VALUES
                    (1, 'H1', 'S1', 1002, 1, 2, 1, 0);
                INSERT INTO claim VALUES
                    ('C1', 1002, '2026-11-06T09:02:00Z', '2026-11-06T09:02:00Z', 'staff', 'open');
                INSERT INTO claim_line VALUES (1, 'C1', 1, 'damaged', 1);
            """)
            self.assertEqual(check_eligibility(db, 1002, AT).reason, "eligible")
            db.executescript("""
                INSERT INTO inspection VALUES
                    ('I1', 'C1', 'rep', 'replace', 'approved',
                     '2026-11-06T09:10:00Z', '2026-11-06T09:11:00Z');
                INSERT INTO authorization_line VALUES
                    ('A1', 'I1', 'C1', 'approved', 1, 1);
            """)
            self.assertEqual(check_eligibility(db, 1002, AT).reason, "replacement_authorized")

    def test_complete_original_order_stops_scoring(self):
        with fixture() as db:
            db.executescript("""
                INSERT INTO handover VALUES
                    ('H1', 1, '2026-11-06T09:00:00Z', '2026-11-06T09:01:00Z', 'staff'),
                    ('H2', 2, '2026-11-06T09:00:00Z', '2026-11-06T09:01:00Z', 'staff');
                INSERT INTO handover_line VALUES
                    (1, 'H1', 'S1', 1002, 1, 3, 0, 0),
                    (2, 'H2', 'S2', 1002, 2, 4, 0, 0);
            """)
            self.assertEqual(check_eligibility(db, 1002, AT).reason, "delivered")


if __name__ == "__main__":
    unittest.main()
