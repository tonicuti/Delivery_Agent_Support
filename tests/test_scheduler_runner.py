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
from backend.scheduler import scheduler_once
from test_features import fixture
from test_predictor import ModelStub


class SchedulerRunnerTests(unittest.TestCase):
    def test_due_transitions_without_waiting(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            model = ModelStub(0.3)
            first = scheduler_once(path, now=datetime(2026, 11, 6, 9, 30, tzinfo=timezone.utc),
                                   offline=True, model=model, model_version="test-v1")
            middle = scheduler_once(path, now=datetime(2026, 11, 6, 9, 40, tzinfo=timezone.utc),
                                    offline=True, model=model, model_version="test-v1")
            next_run = scheduler_once(path, now=datetime(2026, 11, 6, 9, 45, tzinfo=timezone.utc),
                                      offline=True, model=model, model_version="test-v1")
            self.assertEqual(len(first), 1)
            self.assertEqual(middle, [])
            self.assertEqual(len(next_run), 1)
            with closing(connect(path, readonly=True)) as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM risk_score").fetchone()[0], 2)


if __name__ == "__main__":
    unittest.main()
