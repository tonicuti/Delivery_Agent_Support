import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.migrations import migrate


class MigrationTests(unittest.TestCase):
    def test_checks_copy_and_backs_up_before_migrating(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            backup = Path(folder) / "pilot.backup.db"
            with closing(sqlite3.connect(path)) as db:
                db.execute("PRAGMA foreign_keys = ON")
                db.executescript((root / "schema_fresh.sql").read_text(encoding="utf-8"))
                db.executescript((root / "inference_seed.sql").read_text(encoding="utf-8"))
            result = migrate(path, backup_path=backup)
            self.assertEqual(result, 1)
            self.assertTrue(backup.exists())
            with closing(sqlite3.connect(backup)) as original:
                self.assertEqual(original.execute("PRAGMA user_version").fetchone()[0], 0)
                self.assertEqual(original.execute("SELECT COUNT(*) FROM customer_order").fetchone()[0], 3)
            with closing(sqlite3.connect(path)) as migrated:
                self.assertEqual(migrated.execute("PRAGMA user_version").fetchone()[0], 1)
                self.assertEqual(migrated.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(migrated.execute("SELECT COUNT(*) FROM customer_order").fetchone()[0], 3)
                self.assertEqual(migrated.execute("SELECT COUNT(*) FROM model_input_snapshot").fetchone()[0], 0)
            self.assertEqual(migrate(path, backup_path=backup), 1)


if __name__ == "__main__":
    unittest.main()
