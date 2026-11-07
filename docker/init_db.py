"""Container start-up step: create the schema if missing, migrate, optionally seed demo orders."""

import os
from pathlib import Path
import sqlite3
import sys

from backend.db import SCHEMA_SQL, SEED_SQL
from backend.migrations import migrate

TRUTHY = {"1", "true", "yes", "on"}
BUSINESS_TABLES = ("customer_order", "planning_region", "management_team", "customer")


def _is_empty(db: sqlite3.Connection) -> bool:
    return all(db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 0
               for table in BUSINESS_TABLES)


def main() -> int:
    path = Path(os.environ["DELIVERY_DB_PATH"])
    if not path.exists():
        with sqlite3.connect(path) as db:
            db.executescript(SCHEMA_SQL.read_text(encoding="utf-8"))
        print(f"created empty schema at {path}")
    print(f"schema_version={migrate(path)} ({path})")

    if os.environ.get("SEED_DEMO", "").lower() in TRUTHY:
        # Only a database with no business rows at all is seeded, never one holding real data.
        with sqlite3.connect(path) as db:
            if _is_empty(db):
                db.executescript(SEED_SQL.read_text(encoding="utf-8"))
                print("loaded synthetic demo orders 1001-1003 (SEED_DEMO)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
