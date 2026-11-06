import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.db import connect
from backend.eligibility import check_eligibility
from backend.migrations import migrate
from backend.replacements import approve_replacement, refresh_replacement_tasks
from test_features import fixture


AT = datetime(2026, 11, 6, 10, 0, tzinfo=timezone.utc)


class ReplacementTests(unittest.TestCase):
    def test_authorization_stops_scoring_and_requires_accepted_quantity(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            with closing(connect(path)) as db:
                db.executescript("""
                    INSERT INTO handover VALUES ('H1', 2, '2026-11-06T09:20:00Z', '2026-11-06T09:21:00Z', 'staff');
                    INSERT INTO handover_line VALUES (1, 'H1', 'S2', 1002, 2, 2, 0, 2);
                    INSERT INTO claim VALUES ('C1', 1002, '2026-11-06T09:25:00Z', '2026-11-06T09:26:00Z', 'customer', 'open');
                    INSERT INTO claim_line VALUES (1, 'C1', 1, 'missing', 2);
                """)
                db.commit()
                self.assertTrue(check_eligibility(db, 1002, AT).eligible)
                first = approve_replacement(db, "I1", "C1", "rep-1", "approved missing items", AT, {1: 2})
                self.assertEqual(approve_replacement(db, "I1", "C1", "rep-1", "approved missing items", AT, {1: 2}), first)
                self.assertEqual(check_eligibility(db, 1002, AT).reason, "replacement_authorized")
                self.assertEqual(db.execute("SELECT COUNT(*) FROM redelivery_task").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT status FROM redelivery_task").fetchone()[0], "urgent")
                auth_id = first[0]
                db.execute("UPDATE shipment_item SET authorization_line_id = ? WHERE shipment_id = 'R1'", (auth_id,))
                db.execute("INSERT INTO handover VALUES ('HR1', 3, '2026-11-06T11:00:00Z', '2026-11-06T11:00:00Z', 'staff')")
                db.execute("INSERT INTO handover_line VALUES (2, 'HR1', 'R1', 1002, 2, 1, 0, 0)")
                db.commit()
                self.assertEqual(refresh_replacement_tasks(db, 1002, datetime(2026, 11, 6, 11, 30, tzinfo=timezone.utc)), 0)
                self.assertEqual(db.execute("SELECT status FROM redelivery_task").fetchone()[0], "urgent")
                db.execute("INSERT INTO handover VALUES ('HR2', 3, '2026-11-06T12:00:00Z', '2026-11-06T12:00:00Z', 'staff')")
                db.execute("INSERT INTO handover_line VALUES (3, 'HR2', 'R1', 1002, 2, 1, 0, 0)")
                db.commit()
                self.assertEqual(refresh_replacement_tasks(db, 1002, datetime(2026, 11, 6, 12, 30, tzinfo=timezone.utc)), 1)
                self.assertEqual(db.execute("SELECT status FROM redelivery_task").fetchone()[0], "done")


if __name__ == "__main__":
    unittest.main()
