import sys
import io
import json
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.agent.recommendations import request_qwen, validate_recommendation


class RecommendationTests(unittest.TestCase):
    def test_qwen_summary_is_grounded_in_recorded_features(self):
        candidate = {
            "action_id": "check_stock",
            "summary": "Stock is available and delivery is on schedule.",
            "supporting_evidence_ids": ["customer_order:1"],
            "suggested_owner": "Stockholm Order Team",
            "suggested_response_deadline": "2026-11-06T13:00:00Z",
            "missing_information": [],
            "requires_human_review": True,
        }

        class Response(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *_):
                self.close()

        def transport(request, timeout):
            payload = json.loads(request.data)
            self.assertEqual(payload["format"]["properties"]["missing_information"]["maxItems"], 0)
            return Response(json.dumps({"response": json.dumps(candidate)}).encode())

        result = request_qwen({"features": {"stock_status": "short"},
                               "missing": [], "evidence_ids": ["stock_event:SHORT", "customer_order:1"],
                               "feature_sources": {"stock_status": ["stock_event:SHORT"]},
                               "owner_team": "Stockholm Order Team"},
                              allowed_actions={"check_stock": "Verify stock"},
                              decision_time="2026-11-06T12:00:00Z", transport=transport)
        self.assertIn("Stock status is short", result["summary"])
        self.assertNotIn("on schedule", result["summary"])
        self.assertEqual(result["supporting_evidence_ids"], ["stock_event:SHORT"])

    def test_rejects_reporting_present_feature_as_missing(self):
        candidate = {
            "action_id": "confirm_route",
            "summary": "Ask transport to confirm the revised ETA.",
            "supporting_evidence_ids": ["eta_update:ETA-1002"],
            "suggested_owner": "Stockholm Order Team",
            "suggested_response_deadline": "2026-11-06T13:00:00Z",
            "missing_information": ["weather_severity"],
            "requires_human_review": True,
        }
        with self.assertRaisesRegex(ValueError, "available feature"):
            validate_recommendation(candidate, allowed_actions={"confirm_route"},
                                    evidence_ids={"eta_update:ETA-1002"},
                                    decision_time="2026-11-06T12:00:00Z",
                                    feature_values={"weather_severity": 0})

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
