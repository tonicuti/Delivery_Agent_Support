import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.agent.graph import run_agent
from backend.db import connect
from backend.migrations import migrate
from test_features import AT, fixture
from test_predictor import ModelStub


class GraphTests(unittest.TestCase):
    def test_high_route_alerts_when_recommendation_is_invalid(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            def invalid_client(evidence, allowed_actions, decision_time):
                return {"action_id": "authorize_reshipment"}
            result = run_agent(path, 1002, AT, trigger_id="graph-high", offline=True,
                               model=ModelStub(0.7), model_version="test-v1",
                               recommendation_client=invalid_client)
            self.assertEqual(result["risk_band"], "High")
            self.assertIsNotNone(result["notification_id"])
            self.assertIsNone(result["recommendation"])
            with closing(connect(path, readonly=True)) as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM simulated_notification").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT validation_status FROM agent_recommendation").fetchone()[0], "unavailable")

    def test_medium_route_skips_worklist(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            result = run_agent(path, 1002, AT, offline=True,
                               model=ModelStub(0.3), model_version="test-v1")
            self.assertEqual(result["risk_band"], "Medium")
            with closing(connect(path, readonly=True)) as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM worklist_item").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
