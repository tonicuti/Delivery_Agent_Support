"""Validate migrations on a copy, then back up and apply the numbered migrations/*.sql files to SQLite."""

from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory

from .db import connect

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"


def _migration_files() -> list[Path]:
    """Numbered files 0001_*.sql, 0002_*.sql, ... — the number is the schema version they reach."""
    files = sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9][0-9]_*.sql"))
    for expected, path in enumerate(files, start=1):
        if int(path.name[:4]) != expected:
            raise RuntimeError(f"migrations must be numbered without gaps; found {path.name} at position {expected}")
    return files


MIGRATIONS = _migration_files()
LATEST_VERSION = len(MIGRATIONS)


def _backup(source: Path, destination: Path) -> None:
    with closing(connect(source, readonly=True)) as original, closing(sqlite3.connect(destination)) as copy:
        original.backup(copy)


def _apply(path: Path, from_version: int) -> None:
    with closing(connect(path)) as db:
        for version, migration in enumerate(MIGRATIONS, start=1):
            if version <= from_version:
                continue
            sql = migration.read_text(encoding="utf-8")
            try:
                db.executescript(f"BEGIN IMMEDIATE;\n{sql}\nPRAGMA user_version = {version};\nCOMMIT;")
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
    if not 0 <= version < LATEST_VERSION:
        raise RuntimeError(f"unsupported schema version: {version}")
    with TemporaryDirectory() as folder:
        trial = Path(folder) / "trial.db"
        _backup(path, trial)
        _apply(trial, version)
    if backup_path is None:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_path = path.with_name(f"{path.name}.backup-{stamp}")
    if backup_path.exists():
        raise FileExistsError(f"backup destination already exists: {backup_path}")
    _backup(path, backup_path)
    _apply(path, version)
    return LATEST_VERSION
