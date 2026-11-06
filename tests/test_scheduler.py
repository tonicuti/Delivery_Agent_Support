import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.scheduler import next_due_time


class SchedulerTests(unittest.TestCase):
    def test_demo_intervals_and_boundary_crossing(self):
        now = datetime(2026, 11, 6, 9, 0, tzinfo=timezone.utc)
        self.assertEqual(next_due_time(now, now.replace(day=8)).isoformat(), "2026-11-06T11:00:00+00:00")
        self.assertEqual(next_due_time(now, now.replace(day=7, hour=10)).isoformat(), "2026-11-06T10:00:00+00:00")
        self.assertEqual(next_due_time(now, now.replace(hour=15)).isoformat(), "2026-11-06T09:15:00+00:00")
        self.assertEqual(next_due_time(now, now.replace(hour=8)).isoformat(), "2026-11-06T09:30:00+00:00")
        # Near a band boundary, reevaluate at the crossing, not after it.
        self.assertEqual(next_due_time(now, now.replace(day=7, hour=9, minute=30)).isoformat(),
                         "2026-11-06T09:30:00+00:00")


if __name__ == "__main__":
    unittest.main()
