"""Validate migrations on a copy, then back up and apply to SQLite."""

from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory

from .db import connect


MIGRATION = Path(__file__).resolve().parents[2] / "migrations" / "0001_agent.sql"
LATEST_VERSION = 1


def _backup(source: Path, destination: Path) -> None:
    with closing(connect(source, readonly=True)) as original, closing(sqlite3.connect(destination)) as copy:
        original.backup(copy)


def _apply(path: Path) -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    with closing(connect(path)) as db:
        try:
            db.executescript("BEGIN IMMEDIATE;\n" + sql + "\nPRAGMA user_version = 1;\nCOMMIT;")
        except Exception:
            db.rollback()
            raise
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("integrity check failed after migration")
        if db.execute("PRAGMA foreign_key_check").fetchone():
            raise RuntimeError("foreign key check failed after migration")


def migrate(path: Path, *, backup_path: Path | None = None) -> int:
    path = Path(path)
    with closing(connect(path, readonly=True)) as db:
        version = db.execute("PRAGMA user_version").fetchone()[0]
    if version == LATEST_VERSION:
        return version
    if version != 0:
        raise RuntimeError(f"unsupported schema version: {version}")
    with TemporaryDirectory() as folder:
        trial = Path(folder) / "trial.db"
        _backup(path, trial)
        _apply(trial)
    if backup_path is None:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_path = path.with_name(f"{path.name}.backup-{stamp}")
    if backup_path.exists():
        raise FileExistsError(f"backup destination already exists: {backup_path}")
    _backup(path, backup_path)
    _apply(path)
    return LATEST_VERSION
