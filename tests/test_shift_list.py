import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.db import connect
from backend.migrations import migrate
from backend.scoring import score_order
from backend.worklist import freeze_shift
from test_predictor import ModelStub


class ShiftListTests(unittest.TestCase):
    def test_candidate_ranks_stay_frozen_after_new_scores(self):
        root = Path(__file__).resolve().parents[1]
        at = datetime(2026, 11, 6, 12, 0, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "seeded.db"
            with closing(sqlite3.connect(path)) as db:
                db.execute("PRAGMA foreign_keys = ON")
                db.executescript((root / "schema_fresh.sql").read_text(encoding="utf-8"))
                db.executescript((root / "inference_seed.sql").read_text(encoding="utf-8"))
            migrate(path, backup_path=Path(folder) / "backup.db")
            with closing(connect(path)) as db:
                for order_id, p in ((1001, 0.3), (1002, 0.7), (1003, 0.5)):
                    score_order(db, order_id, at, model=ModelStub(p), model_version="test-v1")
                started = datetime(2026, 11, 6, 12, 5, tzinfo=timezone.utc)
                first = freeze_shift(db, "shift-1", 1, started, 1)
                self.assertEqual([row["order_id"] for row in first], [1002, 1003, 1001])
                self.assertEqual([row["selected_for_review"] for row in first], [1, 0, 0])
                score_order(db, 1001, datetime(2026, 11, 6, 12, 10, tzinfo=timezone.utc),
                            model=ModelStub(0.95), model_version="test-v1")
                self.assertEqual(freeze_shift(db, "shift-1", 1, started, 1), first)


if __name__ == "__main__":
    unittest.main()
