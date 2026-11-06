import io
import json
import sqlite3
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.cli import main
from backend.db import connect
from backend.migrations import migrate
from test_features import fixture


class CLITests(unittest.TestCase):
    def test_mock_replay_prints_recommendations_and_alerts(self):
        output = io.StringIO()
        with redirect_stdout(output):
            self.assertEqual(main(["replay", "--scenario", "eta-delay",
                                   "--mock-recommendation", "--json"]), 0)
        result = json.loads(output.getvalue())
        self.assertEqual(result["before"]["risk_band"], "High")
        self.assertEqual(result["before"]["recommendation"]["action_id"], "check_stock")
        self.assertIsNotNone(result["before"]["notification_id"])
        self.assertEqual(result["after"]["feature_values"]["eta_delay_minutes"], 120)
        self.assertEqual(result["after"]["recommendation"]["action_id"], "confirm_route")
        self.assertIsNotNone(result["after"]["notification_id"])

    def test_supplied_seed_exposes_late_eta_without_touching_live_db(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "seeded.db"
            with closing(sqlite3.connect(path)) as db:
                db.execute("PRAGMA foreign_keys = ON")
                db.executescript((root / "schema_fresh.sql").read_text(encoding="utf-8"))
                db.executescript((root / "inference_seed.sql").read_text(encoding="utf-8"))
            output = io.StringIO()
            with redirect_stdout(output):
                self.assertEqual(main(["--db", str(path), "features", "--order-id", "1002",
                                       "--as-of", "2026-11-06T12:00:00Z", "--json"]), 0)
            result = json.loads(output.getvalue())
            self.assertEqual(result["values"]["eta_delay_minutes"], 120)
            self.assertEqual(result["values"]["stock_status"], "short")

    def test_score_command_persists_one_snapshot_on_retry(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "seeded.db"
            with closing(sqlite3.connect(path)) as db:
                db.execute("PRAGMA foreign_keys = ON")
                db.executescript((root / "schema_fresh.sql").read_text(encoding="utf-8"))
                db.executescript((root / "inference_seed.sql").read_text(encoding="utf-8"))
            migrate(path, backup_path=Path(folder) / "seeded.backup.db")
            command = ["--db", str(path), "score", "--order-id", "1002", "--as-of",
                       "2026-11-06T12:00:00Z", "--trigger-id", "cli-seed-1002", "--offline", "--json"]
            output = io.StringIO()
            with redirect_stdout(output):
                self.assertEqual(main(command), 0)
            first = json.loads(output.getvalue())
            self.assertGreaterEqual(first["p_late"], 0)
            self.assertLessEqual(first["p_late"], 1)
            output = io.StringIO()
            with redirect_stdout(output):
                self.assertEqual(main(command), 0)
            self.assertEqual(json.loads(output.getvalue())["score_id"], first["score_id"])
            with closing(connect(path, readonly=True)) as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM order_snapshot").fetchone()[0], 1)

    def test_inspect_and_features_against_temporary_database(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            output = io.StringIO()
            with redirect_stdout(output):
                self.assertEqual(main(["--db", str(path), "inspect-db", "--json"]), 0)
            self.assertEqual(json.loads(output.getvalue())["tables"]["customer_order"], 1)
            output = io.StringIO()
            with redirect_stdout(output):
                self.assertEqual(main(["--db", str(path), "features", "--order-id", "1002",
                                       "--as-of", "2026-11-06T09:30:00Z", "--json"]), 0)
            result = json.loads(output.getvalue())
            self.assertEqual(result["values"]["item_quantity"], 7)
            self.assertEqual(result["promise_version"], 1)


if __name__ == "__main__":
    unittest.main()
