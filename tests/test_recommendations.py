import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.agent.recommendations import validate_recommendation


class RecommendationTests(unittest.TestCase):
    def test_accepts_only_allowed_actions_and_real_evidence(self):
        candidate = {
            "action_id": "confirm_route",
            "summary": "Ask transport to confirm the revised ETA.",
            "supporting_evidence_ids": ["eta_update:ETA-1002"],
            "suggested_owner": "Stockholm Order Team",
            "suggested_response_deadline": "2026-11-06T13:00:00Z",
            "missing_information": ["route confirmation"],
            "requires_human_review": True,
        }
        valid = validate_recommendation(candidate, allowed_actions={"confirm_route"},
                                        evidence_ids={"eta_update:ETA-1002"},
                                        decision_time="2026-11-06T12:00:00Z")
        self.assertEqual(valid["action_id"], "confirm_route")
        for field, value in (("action_id", "authorize_reshipment"),
                             ("supporting_evidence_ids", ["invented"]),
                             ("requires_human_review", False)):
            invalid = dict(candidate, **{field: value})
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_recommendation(invalid, allowed_actions={"confirm_route"},
                                        evidence_ids={"eta_update:ETA-1002"},
                                        decision_time="2026-11-06T12:00:00Z")


if __name__ == "__main__":
    unittest.main()
