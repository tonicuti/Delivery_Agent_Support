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
from backend.agent.worklist import ensure_high_risk, persist_recommendation_and_alert, preview_high_risk
from backend.notifications import acknowledge_alert, record_feedback
from test_features import AT, fixture
from test_predictor import ModelStub


class WorklistTests(unittest.TestCase):
    def test_alert_failure_rolls_back_new_episode_and_queue(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            with closing(connect(path)) as db:
                score = score_order(db, 1002, AT, model=ModelStub(0.7), model_version="test-v1")
                episode, previous = preview_high_risk(db, score)
                with self.assertRaises(KeyError):
                    persist_recommendation_and_alert(db, score, episode,
                                                     recommendation={"invalid": True}, error=None,
                                                     previous_probability=previous, decision_time=AT)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM risk_episode").fetchone()[0], 0)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM worklist_item").fetchone()[0], 0)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM simulated_notification").fetchone()[0], 0)

    def test_high_alert_survives_unavailable_qwen_and_is_deduplicated(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            with closing(connect(path)) as db:
                score = score_order(db, 1002, AT, trigger_id="high-1",
                                    model=ModelStub(0.7), model_version="test-v1")
                episode, previous = ensure_high_risk(db, score, AT)
                first = persist_recommendation_and_alert(db, score, episode,
                                                          recommendation=None,
                                                          error="Ollama unavailable",
                                                          previous_probability=previous,
                                                          decision_time=AT)
                retry = persist_recommendation_and_alert(db, score, episode,
                                                          recommendation=None,
                                                          error="Ollama unavailable",
                                                          previous_probability=previous,
                                                          decision_time=AT)
                self.assertEqual(first, retry)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM worklist_item WHERE status='active'").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM simulated_notification").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT validation_status FROM agent_recommendation").fetchone()[0], "unavailable")
                self.assertEqual(acknowledge_alert(db, first, AT), "2026-11-06T09:30:00Z")
                self.assertEqual(acknowledge_alert(db, first, AT), "2026-11-06T09:30:00Z")
                rec_id = db.execute("SELECT recommendation_id FROM agent_recommendation").fetchone()[0]
                self.assertEqual(record_feedback(db, "feedback-1", rec_id, "call_carrier",
                                                 "planner", AT, "called"), "feedback-1")
                self.assertEqual(record_feedback(db, "feedback-1", rec_id, "call_carrier",
                                                 "planner", AT, "called"), "feedback-1")
                self.assertEqual(db.execute("SELECT COUNT(*) FROM planner_feedback").fetchone()[0], 1)

    def test_concurrent_cancellation_blocks_alert(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            with closing(connect(path)) as db:
                score = score_order(db, 1002, AT, model=ModelStub(0.7), model_version="test-v1")
                db.execute("UPDATE customer_order SET cancelled_at_utc = ? WHERE order_id = 1002",
                           ("2026-11-06T09:15:00Z",))
                db.commit()
                with self.assertRaises(ValueError):
                    ensure_high_risk(db, score, AT)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM simulated_notification").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
