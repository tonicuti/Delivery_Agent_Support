import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.db import connect
from backend.external.context import get_context, live_enrich
from backend.external.weather import classify_weather
from backend.migrations import migrate
from test_features import fixture


AT = datetime(2026, 11, 6, 9, 0, tzinfo=timezone.utc)


class ExternalContextTests(unittest.TestCase):
    def test_demo_weather_thresholds(self):
        self.assertEqual(classify_weather(4.99, 9.99), 0)
        self.assertEqual(classify_weather(5, 0), 1)
        self.assertEqual(classify_weather(0, 10), 1)
        self.assertEqual(classify_weather(15, 0), 2)
        self.assertEqual(classify_weather(0, 20), 2)

    def test_fresh_stale_and_historical_visibility(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")

            def fake_fetch(url, timeout):
                if "open-meteo" in url:
                    return {"hourly": {"time": ["2026-11-06T15:00"],
                                       "precipitation": [1.2],
                                       "wind_gusts_10m": [5.0], "weather_code": [61]},
                            "hourly_units": {"wind_gusts_10m": "m/s", "precipitation": "mm"}}
                return []

            with closing(connect(path)) as db:
                self.assertEqual(get_context(db, 1002, AT)["weather_status"], "missing")
                result = live_enrich(db, 1002, AT, now=AT, fetcher=fake_fetch)
                self.assertEqual(result["weather_status"], "fresh")
                self.assertEqual(result["weather"]["severity"], 0)
                self.assertEqual(result["weather"]["mapping_version"], "demo-weather-v1")
                self.assertEqual(result["effective_decision_time"], "2026-11-06T09:00:00Z")
                self.assertEqual(result["holiday_status"], "fresh")
                self.assertEqual(result["holiday_flag"], 0)
                self.assertTrue(result["country_assumed"])
                past = get_context(db, 1002, AT - timedelta(minutes=1))
                self.assertEqual(past["weather_status"], "missing")
                stale = get_context(db, 1002, AT + timedelta(minutes=31))
                self.assertEqual(stale["weather_status"], "stale")
                self.assertEqual(stale["holiday_status"], "fresh")

    def test_live_fetch_advances_decision_time_to_evidence_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            def fake_fetch(url, timeout):
                if "open-meteo" in url:
                    return {"hourly": {"time": ["2026-11-06T15:00"],
                                       "precipitation": [15.0],
                                       "wind_gusts_10m": [2.0], "weather_code": [61]},
                            "hourly_units": {"wind_gusts_10m": "m/s", "precipitation": "mm"}}
                return []
            received = AT + timedelta(minutes=1)
            with closing(connect(path)) as db:
                result = live_enrich(db, 1002, AT, now=received, fetcher=fake_fetch)
                self.assertEqual(result["effective_decision_time"], "2026-11-06T09:01:00Z")
                self.assertEqual(result["weather"]["severity"], 2)
                self.assertEqual(get_context(db, 1002, AT)["weather_status"], "missing")

    def test_api_failure_is_missing_and_recorded(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pilot.db"
            with fixture() as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            migrate(path, backup_path=Path(folder) / "backup.db")
            def fail(url, timeout):
                raise OSError("network down")
            with closing(connect(path)) as db:
                result = live_enrich(db, 1002, AT, now=AT, fetcher=fail)
                self.assertEqual(result["weather_status"], "missing")
                self.assertEqual(result["holiday_status"], "missing")
                self.assertIsNone(result["holiday_flag"])
                self.assertEqual(db.execute("SELECT COUNT(*) FROM external_evidence WHERE validation_status='failed'").fetchone()[0], 2)


if __name__ == "__main__":
    unittest.main()
