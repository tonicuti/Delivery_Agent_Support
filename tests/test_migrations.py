import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.db import SCHEMA_SQL, SEED_SQL
from backend.migrations import migrate


class MigrationTests(unittest.TestCase):
    def test_checks_copy_and_backs_up_before_migrating(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            backup = Path(folder) / "pilot.backup.db"
            with closing(sqlite3.connect(path)) as db:
                db.execute("PRAGMA foreign_keys = ON")
                db.executescript(SCHEMA_SQL.read_text(encoding="utf-8"))
                db.executescript(SEED_SQL.read_text(encoding="utf-8"))
            result = migrate(path, backup_path=backup)
            self.assertEqual(result, 2)
            self.assertTrue(backup.exists())
            with closing(sqlite3.connect(backup)) as original:
                self.assertEqual(original.execute("PRAGMA user_version").fetchone()[0], 0)
                self.assertEqual(original.execute("SELECT COUNT(*) FROM customer_order").fetchone()[0], 3)
            with closing(sqlite3.connect(path)) as migrated:
                self.assertEqual(migrated.execute("PRAGMA user_version").fetchone()[0], 2)
                self.assertEqual(migrated.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(migrated.execute("SELECT COUNT(*) FROM customer_order").fetchone()[0], 3)
                self.assertEqual(migrated.execute("SELECT COUNT(*) FROM model_input_snapshot").fetchone()[0], 0)
            self.assertEqual(migrate(path, backup_path=backup), 2)

    def test_a_database_already_at_version_one_is_upgraded_in_place(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with closing(sqlite3.connect(path)) as db:
                db.executescript(SCHEMA_SQL.read_text(encoding="utf-8"))
                db.executescript(SEED_SQL.read_text(encoding="utf-8"))
                db.executescript((root / "migrations" / "0001_agent.sql").read_text(encoding="utf-8"))
                db.execute("PRAGMA user_version = 1")
                db.commit()
            self.assertEqual(migrate(path, backup_path=Path(folder) / "v1.backup.db"), 2)
            with closing(sqlite3.connect(path)) as migrated:
                self.assertEqual(migrated.execute("SELECT COUNT(*) FROM chat_message").fetchone()[0], 0)
                self.assertEqual(migrated.execute("SELECT COUNT(*) FROM customer_order").fetchone()[0], 3)
            with closing(sqlite3.connect(Path(folder) / "v1.backup.db")) as backup:
                self.assertEqual(backup.execute("PRAGMA user_version").fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
