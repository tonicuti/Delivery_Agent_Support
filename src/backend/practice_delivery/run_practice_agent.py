"""Run the agent on historical practice data with a mock or local Qwen."""

import argparse
from datetime import datetime
import json
from pathlib import Path
import sys


DEFAULT_BACKEND = Path(r"C:\Itoni\IT Consultant Netcompany\backend")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", type=Path, default=DEFAULT_BACKEND)
    parser.add_argument("--db", type=Path,
                        default=Path(__file__).with_name("practice_delivery.db"))
    parser.add_argument("--order-id", type=int, required=True)
    parser.add_argument("--as-of", default="2026-11-06T12:00:00Z")
    parser.add_argument("--qwen", action="store_true",
                        help="ask local Ollama instead of using the mock recommendation")
    args = parser.parse_args()
    at = datetime.fromisoformat(args.as_of.replace("Z", "+00:00"))
    if at.tzinfo is None or at.utcoffset() is None:
        parser.error("--as-of must include Z or a timezone offset")
    sys.path.insert(0, str(args.backend.resolve() / "src"))
    from backend.agent.graph import run_agent
    from backend.agent.mock_recommendation import mock_recommendation
    from backend.agent.recommendations import request_qwen

    def local_qwen(evidence: dict, allowed_actions: dict[str, str],
                   decision_time: str) -> dict:
        return request_qwen(evidence, allowed_actions=allowed_actions,
                            decision_time=decision_time)

    state = run_agent(args.db.resolve(), args.order_id, at, offline=True,
                      recommendation_client=local_qwen if args.qwen else mock_recommendation)
    print(json.dumps({
        "order_id": state["order_id"],
        "decision_time": state["decision_time"],
        "eligibility_reason": state.get("eligibility_reason"),
        "p_late": state.get("p_late"),
        "risk_band": state.get("risk_band"),
        "recommendation": state.get("recommendation"),
        "recommendation_error": state.get("recommendation_error"),
        "notification_id": state.get("notification_id"),
    }, indent=2))


if __name__ == "__main__":
    main()
