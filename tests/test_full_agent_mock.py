"""End-to-end check for the current-time agent practice database."""

import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from backend.agent.graph import run_agent
from backend.agent.mock_recommendation import mock_recommendation
from backend.db import connect
from backend.external.context import live_enrich
from backend.features import build_features


LIVE_MOCK_SQL = ROOT / "src" / "backend" / "practice_delivery" / "live_agent_mock.sql"


class FullAgentMockTests(unittest.TestCase):
    @unittest.skipUnless(LIVE_MOCK_SQL.is_file(),
                         "live_agent_mock.sql was never committed, so build_practice_db.py cannot build this fixture")
    def test_live_mock_turns_api_weather_into_high_risk_recommendation(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "live_agent_mock.db"
            builder = ROOT / "src" / "backend" / "practice_delivery" / "build_practice_db.py"
            built = subprocess.run(
                [sys.executable, str(builder), "--live-agent-mock", "--output", str(path)],
                capture_output=True, text=True,
            )
            self.assertEqual(built.returncode, 0, built.stderr)
            with closing(connect(path)) as db:
                self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertFalse(db.execute("PRAGMA foreign_key_check").fetchall())
                promised_to = db.execute(
                    "SELECT window_end_utc FROM promise_version WHERE order_id = 2001"
                ).fetchone()[0]
                delivery_hour = datetime.fromisoformat(
                    promised_to.replace("Z", "+00:00")
                ).strftime("%Y-%m-%dT%H:00")

                def fake_fetch(url, timeout):
                    if "open-meteo" in url:
                        return {
                            "hourly": {"time": [delivery_hour], "precipitation": [6.0],
                                       "wind_gusts_10m": [12.0], "weather_code": [61]},
                            "hourly_units": {"precipitation": "mm",
                                             "wind_gusts_10m": "m/s"},
                        }
                    return []

                at = datetime.now(timezone.utc)
                context = live_enrich(db, 2001, at, now=at, fetcher=fake_fetch)
                features = build_features(db, 2001, at)
            self.assertEqual(features.values["actual_departure_delay_minutes"], 30)
            self.assertEqual(features.values["travel_hours"], 2)
            self.assertEqual(features.values["holiday_flag"], 0)
            self.assertEqual(features.values["weather_severity"], 1)
            self.assertEqual(features.missing, [])
            self.assertEqual(context["weather_status"], "fresh")
            self.assertEqual(context["weather"]["severity"], 1)
            self.assertEqual(context["holiday_status"], "fresh")
            self.assertEqual(context["holiday_flag"], 0)

            state = run_agent(path, 2001, at, offline=True,
                              recommendation_client=mock_recommendation)
            self.assertEqual(state["risk_band"], "High")
            self.assertNotIn("review_conflicting_evidence", state["allowed_actions"])
            self.assertIsNotNone(state["recommendation"])
            self.assertEqual(state["recommendation"]["action_id"], "confirm_route")
            self.assertIsNone(state["recommendation_error"])
            self.assertIsNotNone(state["notification_id"])


if __name__ == "__main__":
    unittest.main()
