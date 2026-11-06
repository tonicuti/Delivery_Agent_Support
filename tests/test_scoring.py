import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.db import connect
from backend.migrations import migrate
from backend.scoring import score_order
from test_features import AT, fixture
from test_predictor import ModelStub


class ScoringTests(unittest.TestCase):
    def test_immutable_snapshot_and_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            with closing(connect(path)) as db:
                first = score_order(db, 1002, AT, trigger_id="event-1",
                                    model=ModelStub(0.7), model_version="test-v1")
                retry = score_order(db, 1002, AT, trigger_id="event-1",
                                    model=ModelStub(0.7), model_version="test-v1")
                another = score_order(db, 1002, AT, trigger_id="event-2",
                                      model=ModelStub(0.7), model_version="test-v1")
                self.assertEqual(first.score_id, retry.score_id)
                self.assertEqual(first.score_id, another.score_id)
                self.assertEqual(first.risk_band, "High")
                self.assertEqual(db.execute("SELECT COUNT(*) FROM order_snapshot").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM model_input_snapshot").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM risk_score").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM agent_run").fetchone()[0], 2)
                db.execute("""
                    INSERT INTO stock_event VALUES
                    ('stock-same-value', 1002, 1, 'in_stock',
                     '2026-11-06T09:10:00Z', '2026-11-06T09:11:00Z', 'staff')
                """)
                db.commit()
                with self.assertRaises(ValueError):
                    score_order(db, 1002, AT, trigger_id="event-new-source",
                                model=ModelStub(0.7), model_version="test-v1")
                with self.assertRaises(ValueError):
                    score_order(db, 1002, AT, trigger_id="event-1",
                                model=ModelStub(0.7), model_version="other-v1")

    def test_cancellation_records_ineligible_run_without_score(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            with closing(connect(path)) as db:
                db.execute("UPDATE customer_order SET cancelled_at_utc = ? WHERE order_id = 1002",
                           ("2026-11-06T09:00:00Z",))
                db.commit()
                result = score_order(db, 1002, AT, trigger_id="event-3",
                                     model=ModelStub(0.7), model_version="test-v1")
                self.assertEqual(result.eligibility_reason, "cancelled")
                self.assertIsNone(result.score_id)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM risk_score").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
