"""SQLite connection helpers for the pilot backend."""

import os
import sqlite3
from pathlib import Path


# DELIVERY_DB_PATH lets a container keep the database on a mounted volume.
DEFAULT_DB = Path(os.environ.get("DELIVERY_DB_PATH")
                  or Path(__file__).resolve().parents[2] / "delivery_db.db")


def connect(path: Path = DEFAULT_DB, *, readonly: bool = False) -> sqlite3.Connection:
    if readonly:
        connection = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    else:
        connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection
