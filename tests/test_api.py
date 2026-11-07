from contextlib import closing
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from backend.api import ApiContext, make_server
from backend.migrations import migrate

ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 11, 6, 12, 5, tzinfo=timezone.utc)
AS_OF = "2026-11-06T12:00:00Z"


def seeded_database(folder: str) -> Path:
    path = Path(folder) / "api.db"
    with closing(sqlite3.connect(path)) as db:
        db.executescript((ROOT / "schema_fresh.sql").read_text(encoding="utf-8"))
        db.executescript((ROOT / "inference_seed.sql").read_text(encoding="utf-8"))
    migrate(path, backup_path=Path(folder) / "api.backup.db")
    return path


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.ctx = ApiContext(db_path=seeded_database(self.folder.name), clock=lambda: NOW,
                              ollama_endpoint="http://127.0.0.1:1/api/generate")
        self.server = make_server(self.ctx, "127.0.0.1", 0)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = Request(self.base + path, data=data, method=method,
                          headers={"Content-Type": "application/json"})
        try:
            with urlopen(request, timeout=30) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def run_mock(self, order_id=1002, as_of=AS_OF):
        return self.call("POST", f"/api/orders/{order_id}/run", {"mode": "mock", "as_of": as_of})

    def test_health_and_unknown_route(self):
        status, body = self.call("GET", "/api/health")
        self.assertEqual((status, body["schema_version"]), (200, 2))
        self.assertEqual(self.call("GET", "/api/nope")[0], 404)
        self.assertEqual(self.call("POST", "/api/health", {})[0], 405)

    def test_system_reports_ollama_unreachable_without_failing(self):
        status, body = self.call("GET", "/api/system")
        self.assertEqual(status, 200)
        self.assertFalse(body["ollama"]["reachable"])
        self.assertEqual(body["scheduler"]["mode"], "off")

    def test_unscored_orders_listed_before_any_run(self):
        _, orders = self.call("GET", "/api/orders")
        self.assertEqual([o["order_id"] for o in orders["items"]], [1001, 1002, 1003])
        self.assertTrue(all(o["risk_band"] is None for o in orders["items"]))
        self.assertEqual(self.call("GET", "/api/worklist")[1]["items"], [])

    def test_mock_run_puts_high_risk_order_on_worklist_with_alert(self):
        status, run = self.run_mock()
        self.assertEqual(status, 200)
        self.assertEqual(run["risk_band"], "High")
        self.assertEqual(run["recommendation"]["action_id"], "confirm_route")
        self.assertTrue(run["notification_id"])
        _, worklist = self.call("GET", "/api/worklist")
        item = worklist["items"][0]
        self.assertEqual(item["order_id"], 1002)
        self.assertEqual(item["alert"]["notification_id"], run["notification_id"])
        self.assertEqual(item["recommendation"]["output"]["action_id"], "confirm_route")

    def test_order_detail_exposes_all_model_inputs_and_history(self):
        self.run_mock()
        status, detail = self.call("GET", "/api/orders/1002")
        self.assertEqual(status, 200)
        self.assertEqual(len(detail["inputs"]["features"]), 17)
        self.assertEqual(len(detail["score_history"]), 1)
        self.assertEqual(detail["eligibility"], "eligible")
        self.assertEqual(detail["lines"][0]["stock_status"], "short")
        self.assertEqual(self.call("GET", "/api/orders/9999")[0], 404)

    def test_acknowledge_is_idempotent_and_unknown_alert_is_404(self):
        alert = self.run_mock()[1]["notification_id"]
        first = self.call("POST", f"/api/alerts/{alert}/ack", {})
        second = self.call("POST", f"/api/alerts/{alert}/ack", {})
        self.assertEqual(first[1]["acknowledged_at_utc"], second[1]["acknowledged_at_utc"])
        self.assertEqual(self.call("POST", "/api/alerts/missing/ack", {})[0], 404)

    def decide(self, rec_id, **body):
        return self.call("POST", f"/api/recommendations/{rec_id}/decision", body)

    def recommendation_id(self):
        self.run_mock()
        return self.call("GET", "/api/orders/1002")[1]["recommendation"]["recommendation_id"]

    def test_decision_validation(self):
        rec = self.recommendation_id()
        self.assertEqual(self.decide(rec, decision="approved")[0], 400)  # role missing
        self.assertEqual(self.decide(rec, decision="maybe", role="dispatcher")[0], 400)
        self.assertEqual(self.decide(rec, decision="edited", role="dispatcher",
                                     action_id="launch_rocket")[0], 400)
        self.assertEqual(self.decide(rec, decision="edited", role="dispatcher",
                                     action_id="confirm_route")[0], 400)  # same as recommended
        self.assertEqual(self.decide(rec, decision="dismissed", role="dispatcher")[0], 400)  # no reason
        self.assertEqual(self.decide("missing", decision="approved", role="dispatcher")[0], 404)

    def test_decisions_are_logged_with_role_and_latest_wins(self):
        rec = self.recommendation_id()
        self.assertEqual(self.decide(rec, decision="dismissed", role="dispatcher",
                                     reason="already_handled", notes="called the carrier")[0], 200)
        self.assertEqual(self.decide(rec, decision="edited", role="dispatch_lead",
                                     action_id="check_stock")[0], 200)
        self.assertEqual(self.decide(rec, decision="approved", role="dispatcher")[0], 200)
        _, detail = self.call("GET", "/api/orders/1002")
        self.assertEqual(detail["recommendation"]["decision"]["decision"], "approved")
        self.assertEqual([d["decision"] for d in detail["decisions"]], ["approved", "edited", "dismissed"])
        self.assertEqual(detail["decisions"][-1]["reason"], "already_handled")
        self.assertEqual({d["role"] for d in detail["decisions"]}, {"dispatcher", "dispatch_lead"})
        _, kpi = self.call("GET", "/api/kpis")
        self.assertEqual(kpi["decisions"], {"approved": 1, "edited": 1, "dismissed": 1})
        self.assertEqual(kpi["dismiss_reasons"]["already_handled"], 1)

    def test_case_file_has_signals_timeline_and_pipeline(self):
        self.run_mock()
        _, detail = self.call("GET", "/api/orders/1002")
        codes = {s["code"] for s in detail["signals"]}
        self.assertTrue({"STOCK_SHORT", "ETA_DELAYED"} <= codes)
        kinds = {e["kind"] for e in detail["timeline"]}
        self.assertTrue({"order", "promise", "stock", "warehouse", "transport", "score", "alert"} <= kinds)
        self.assertEqual(detail["shipments"][0]["stage_index"], 3)  # loaded
        self.assertFalse(detail["stale"])
        self.assertEqual(detail["age_minutes"], 5)

    def test_data_goes_stale_after_ninety_minutes(self):
        self.run_mock()
        self.ctx.clock = lambda: datetime(2026, 11, 6, 13, 31, tzinfo=timezone.utc)
        _, detail = self.call("GET", "/api/orders/1002")
        self.assertTrue(detail["stale"])
        self.assertEqual(self.call("GET", "/api/meta")[1]["stale_after_minutes"], 90)

    def test_kpis_without_outcomes_do_not_invent_numbers(self):
        _, kpi = self.call("GET", "/api/kpis")
        self.assertIsNone(kpi["outcomes"]["on_time_rate"])
        self.assertIsNone(kpi["outcomes"]["precision_at_k"])
        self.assertIsNone(kpi["alerts"]["median_minutes_to_acknowledge"])

    def test_meta_lists_roles_playbooks_and_reasons(self):
        _, meta = self.call("GET", "/api/meta")
        self.assertEqual(meta["roles"], ["dispatcher", "dispatch_lead", "manager"])
        self.assertIn("check_stock", meta["playbooks"])
        self.assertIn("false_alarm", meta["dismiss_reasons"])

    def fake_model(self, *pieces):
        self.ctx.llm_transport = lambda kind, payload, timeout: iter([{"message": {"content": p}} for p in pieces])

    def test_chat_answers_from_the_facts(self):
        self.run_mock()
        self.fake_model("ORDER-1002 is at high risk.")
        status, answer = self.call("POST", "/api/chat", {
            "messages": [{"role": "user", "content": "why is 1002 flagged?"}], "order_id": 1002})
        self.assertEqual(status, 200)
        self.assertEqual(answer["reply"], "ORDER-1002 is at high risk.")
        self.assertEqual((answer["steps"], answer["order_ref"], answer["fallback"]),
                         (["Read the details of ORDER-1002"], "ORDER-1002", False))

    def test_chat_just_talks_when_asked_to(self):
        self.fake_model("Hello! How can I help?")
        _, answer = self.call("POST", "/api/chat", {"messages": [{"role": "user", "content": "xin chào"}]})
        self.assertEqual((answer["reply"], answer["steps"]), ("Hello! How can I help?", []))

    def test_chat_without_a_model_still_helps_with_the_facts(self):
        self.run_mock()  # no fake model: the endpoint is unreachable
        status, answer = self.call("POST", "/api/chat", {"messages": [{"role": "user", "content": "which orders need attention?"}]})
        self.assertEqual(status, 200)
        self.assertTrue(answer["fallback"])
        self.assertIn("ORDER-1002", answer["reply"])

    def test_chat_stream_reports_progress_then_words_then_a_summary(self):
        self.run_mock()
        self.fake_model("It ", "is ", "1002.")
        request = Request(self.base + "/api/chat/stream", method="POST", headers={"Content-Type": "application/json"},
                          data=json.dumps({"messages": [{"role": "user", "content": "which orders need attention?"}]}).encode())
        with urlopen(request, timeout=30) as response:
            self.assertTrue(response.headers["Content-Type"].startswith("text/event-stream"))
            events = [json.loads(line[6:]) for line in response.read().decode().splitlines() if line.startswith("data: ")]
        self.assertEqual([e["type"] for e in events][:2], ["status", "status"])
        self.assertEqual("".join(e["text"] for e in events if e["type"] == "token"), "It is 1002.")
        self.assertEqual(events[-1]["type"], "done")

    def test_chat_validates_input(self):
        self.assertEqual(self.call("POST", "/api/chat", {"messages": []})[0], 400)
        self.assertEqual(self.call("POST", "/api/chat", {"messages": [{"role": "assistant", "content": "hi"}]})[0], 400)
        self.assertEqual(self.call("POST", "/api/chat", {"messages": [{"role": "user", "content": "hi"}], "order_id": "x"})[0], 400)
        self.assertEqual(self.call("POST", "/api/chat/stream", {"messages": []})[0], 400)

    def test_customer_message_draft_in_requested_language(self):
        self.run_mock()
        seen = {}

        def fake(kind, payload, timeout):
            seen.update(kind=kind, prompt=payload["prompt"])
            return {"response": "<think>x</think>Hej! Din leverans kan bli försenad."}

        self.ctx.llm_transport = fake
        status, draft = self.call("POST", "/api/orders/1002/customer-message", {"language": "sv"})
        self.assertEqual(status, 200)
        self.assertEqual(draft["message"], "Hej! Din leverans kan bli försenad.")
        self.assertTrue(draft["requires_human_review"])
        self.assertIn("Swedish", seen["prompt"])
        self.assertEqual(self.call("POST", "/api/orders/1002/customer-message", {"language": "xx"})[0], 400)
        self.assertEqual(self.call("POST", "/api/orders/1001/customer-message", {"language": "sv"})[0], 400)
        self.assertEqual(self.call("POST", "/api/orders/9999/customer-message", {"language": "sv"})[0], 404)

    def test_run_rejects_bad_input(self):
        self.assertEqual(self.call("POST", "/api/orders/1002/run", {"mode": "magic"})[0], 400)
        self.assertEqual(self.call("POST", "/api/orders/1002/run",
                                   {"mode": "mock", "as_of": "2030-01-01T00:00:00Z"})[0], 400)
        self.assertEqual(self.call("POST", "/api/orders/1002/run",
                                   {"mode": "mock", "as_of": "yesterday"})[0], 400)
        self.assertEqual(self.call("POST", "/api/orders/9999/run", {"mode": "mock"})[0], 404)

    def test_live_run_refuses_historical_decision_time(self):
        status, body = self.call("POST", "/api/orders/1002/run", {"mode": "live", "as_of": AS_OF})
        self.assertEqual(status, 400)
        self.assertIn("historical", body["error"])

    def test_overlapping_run_for_same_order_is_rejected(self):
        lock = self.ctx.order_lock(1002)
        self.assertTrue(lock.acquire(blocking=False))
        self.addCleanup(lock.release)
        self.assertEqual(self.run_mock()[0], 409)

    def test_offline_run_without_fixture_still_alerts_without_recommendation(self):
        _, run = self.call("POST", "/api/orders/1002/run", {"mode": "offline", "as_of": AS_OF})
        self.assertIsNone(run["recommendation"])
        self.assertIn("no saved offline Qwen response fixture", run["recommendation_error"])
        self.assertTrue(run["notification_id"])

    def test_shift_freeze_is_stable_and_validates(self):
        self.run_mock()
        body = {"shift_id": "shift-am", "region_id": 1, "capacity": 1, "started_at": AS_OF}
        self.assertEqual(self.call("POST", "/api/shifts", body)[0], 200)
        self.assertEqual(self.call("POST", "/api/shifts", body)[0], 200)  # same params: idempotent
        self.assertEqual(self.call("POST", "/api/shifts", {**body, "capacity": 2})[0], 400)
        self.assertEqual(self.call("POST", "/api/shifts", {**body, "region_id": 99,
                                                          "shift_id": "x"})[0], 404)
        _, detail = self.call("GET", "/api/shifts/shift-am")
        self.assertEqual([c["order_id"] for c in detail["candidates"]], [1002])
        self.assertTrue(detail["candidates"][0]["selected_for_review"])
        self.assertEqual(len(self.call("GET", "/api/shifts")[1]), 1)

    def test_scheduler_mode_switch_and_run_once(self):
        self.assertEqual(self.call("POST", "/api/scheduler", {"mode": "bogus"})[0], 400)
        self.assertEqual(self.call("POST", "/api/scheduler", {"mode": "offline"})[1]["mode"], "offline")
        _, before = self.call("GET", "/api/scheduler")
        self.assertTrue(all(o["due"] for o in before["orders"]))
        status, ran = self.call("POST", "/api/scheduler/run-once", {"mode": "offline"})
        self.assertEqual((status, ran["processed"]), (200, 3))
        _, after = self.call("GET", "/api/scheduler")
        self.assertFalse(any(o["never_run"] for o in after["orders"]))

    def test_replacement_requires_claim_of_this_order(self):
        body = {"claim_id": "nope", "representative_id": "rep", "finding": "damaged",
                "lines": [{"claim_line_id": 1, "quantity": 1}]}
        self.assertEqual(self.call("POST", "/api/orders/1002/replacement", body)[0], 404)
        self.assertEqual(self.call("POST", "/api/orders/1002/replacement", {"lines": []})[0], 400)

    def test_overview_counts_bands_after_scoring(self):
        self.run_mock()
        _, summary = self.call("GET", "/api/overview")
        self.assertEqual(summary["orders"], 3)
        self.assertEqual(summary["active_high_risk"], 1)
        self.assertEqual(summary["unacknowledged_alerts"], 1)
        self.assertEqual(summary["bands"]["Unscored"], 2)


if __name__ == "__main__":
    unittest.main()
