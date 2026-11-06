"""Build a fresh, migrated SQLite database for offline delivery-risk practice."""

import argparse
from contextlib import closing
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory


DEFAULT_BACKEND = Path(r"C:\Itoni\IT Consultant Netcompany\backend")
EXTRA = Path(__file__).with_name("practice_extra.sql")
SCRIPTS = ("schema_fresh.sql", "inference_seed.sql", "practice_extra.sql",
           "migrations/0001_agent.sql")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", type=Path, default=DEFAULT_BACKEND)
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).with_name("practice_delivery.db"))
    args = parser.parse_args()
    backend = args.backend.resolve()
    output = args.output.resolve()
    if output.exists():
        parser.error(f"output already exists: {output}")
    if not output.parent.is_dir():
        parser.error(f"output directory does not exist: {output.parent}")
    paths = (backend / SCRIPTS[0], backend / SCRIPTS[1], EXTRA,
             backend / SCRIPTS[3])
    for path in paths:
        if not path.is_file():
            parser.error(f"required SQL file does not exist: {path}")

    with TemporaryDirectory(dir=output.parent) as folder:
        trial = Path(folder) / "practice.db"
        with closing(sqlite3.connect(trial)) as db:
            db.execute("PRAGMA foreign_keys = ON")
            for path in paths:
                db.executescript(path.read_text(encoding="utf-8"))
            db.execute("PRAGMA user_version = 1")
            db.commit()
            integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
            foreign_keys = db.execute("PRAGMA foreign_key_check").fetchall()
            orders = db.execute("SELECT COUNT(*) FROM customer_order").fetchone()[0]
            if integrity != "ok" or foreign_keys or orders != 10:
                raise RuntimeError(
                    f"invalid practice database: integrity={integrity}, "
                    f"foreign_key_errors={len(foreign_keys)}, orders={orders}"
                )
        trial.replace(output)
    print(f"Created {output} with {orders} synthetic orders (schema version 1).")


if __name__ == "__main__":
    main()
