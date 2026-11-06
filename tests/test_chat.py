from contextlib import closing
from datetime import datetime, timezone
from itertools import chain, repeat
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from backend.agent.graph import run_agent
from backend.agent.mock_recommendation import mock_recommendation
from backend.chat import INCOMPLETE_NOTE, MAX_MESSAGE_CHARS, chat_events, run_chat
from backend.db import connect
from test_api import seeded_database

NOW = datetime(2026, 11, 6, 12, 5, tzinfo=timezone.utc)
SNAKE_CASE = re.compile(r"\b[a-z]+(?:_[a-z0-9]+)+\b")
ISO_TIME = re.compile(r"\d{4}-\d\d-\d\dT")


def ask(text, *, earlier=()):
    return [*earlier, {"role": "user", "content": text}]


class ChatTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.db = seeded_database(folder.name)
        run_agent(self.db, 1002, datetime(2026, 11, 6, 12, 0, tzinfo=timezone.utc), trigger_id="t1",
                  offline=True, recommendation_client=mock_recommendation)
        self.sent = []

    def model(self, *pieces):
        def transport(kind, payload, timeout):
            self.sent.append(payload)
            return iter([{"message": {"content": piece}} for piece in pieces])
        return transport

    def facts_sent(self):
        return self.sent[-1]["messages"][-1]["content"]

    def run_chat(self, text, *, transport=None, **kw):
        return run_chat(self.db, kw.pop("messages", ask(text)), now=kw.pop("now", NOW),
                        transport=transport or self.model("Fine."), **kw)

    # --- deciding what to look at ---
    def test_briefing_question_reads_the_worklist(self):
        result = self.run_chat("Shift briefing: what needs my attention first?")
        self.assertIn("Orders most at risk right now (1)", self.facts_sent())
        self.assertIn("ORDER-1002", self.facts_sent())
        self.assertEqual(result["steps"], ["Checked which orders are most at risk"])

    def test_named_order_is_read_in_detail(self):
        result = self.run_chat("Why is order 1002 flagged?")
        self.assertIn("Order ORDER-1002 (Stockholm, B2C customer)", self.facts_sent())
        self.assertNotIn("Orders most at risk", self.facts_sent())
        self.assertEqual((result["order_id"], result["order_ref"]), (1002, "ORDER-1002"))

    def test_order_on_screen_is_the_default_subject(self):
        self.run_chat("What can I do about it?", order_id=1002)
        self.assertIn("Suggested action:", self.facts_sent())

    def test_asking_about_many_orders_overrides_the_order_on_screen(self):
        self.run_chat("Which orders are most at risk?", order_id=1003)
        self.assertIn("Orders most at risk right now", self.facts_sent())

    def test_follow_up_remembers_the_order_from_earlier_in_the_chat(self):
        earlier = [{"role": "user", "content": "Tell me about 1002"}, {"role": "assistant", "content": "It is late."}]
        self.run_chat("", messages=ask("and where is the shipment?", earlier=earlier))
        self.assertIn("Shipment S1002", self.facts_sent())

    def test_numbers_and_warehouse_questions(self):
        self.run_chat("How are decisions going so far?")
        self.assertIn("Decisions:", self.facts_sent())
        self.run_chat("How busy are the warehouses?")
        self.assertIn("Shipments by warehouse", self.facts_sent())

    # --- ordinary conversation ---
    def test_greetings_and_small_talk_are_answered_without_reading_anything(self):
        for text in ("hello", "xin chào", "chào bạn", "Thanks!", "what can you do?", "tell me a joke"):
            self.sent.clear()
            result = self.run_chat(text, order_id=1002)
            self.assertEqual(result["steps"], [], text)
            self.assertTrue(self.sent[-1]["messages"][-1]["content"].startswith(text))
            self.assertNotIn("Facts", self.sent[-1]["messages"][-1]["content"])  # nothing was read
            self.assertEqual(result["reply"], "Fine.")

    def test_the_assistant_is_told_it_may_chat_and_what_it_can_look_up(self):
        self.run_chat("hello")
        system = self.sent[-1]["messages"][0]["content"]
        self.assertIn("Chat naturally", system)
        self.assertIn("same language", system)
        self.assertIn("never invent anything about an order", system)

    def test_the_answer_follows_the_latest_message_language(self):
        earlier = [{"role": "user", "content": "xin chào"}, {"role": "assistant", "content": "Xin chào!"}]
        self.run_chat("", messages=ask("What needs my attention first?", earlier=earlier))
        self.assertIn("language of the question above", self.sent[-1]["messages"][-1]["content"])

    def test_chat_with_the_model_down_says_so_kindly(self):
        def broken(*args):
            raise OSError("down")

        result = self.run_chat("hello", transport=broken)
        self.assertTrue(result["fallback"])
        self.assertEqual(result["reply"], "The assistant is not available right now. Please try again in a moment.")

    def test_normal_words_like_tool_or_function_are_not_mistaken_for_leaks(self):
        result = self.run_chat("hello", transport=self.model("Hi! I am the tool's assistant; ask me about any order."))
        self.assertFalse(result["fallback"])

    # --- plain language, honesty ---
    def test_facts_use_everyday_words_only(self):
        for question, scope in (("Which orders need attention?", None), ("Tell me about it", 1002), ("How are decisions going?", None)):
            self.run_chat(question, order_id=scope)
            facts = self.facts_sent()
            self.assertIsNone(SNAKE_CASE.search(facts), facts)
            self.assertIsNone(ISO_TIME.search(facts), facts)
            self.assertNotIn("UTC", facts)
            self.assertNotIn("p_late", facts)

    def test_times_are_in_the_delivery_sites_clock_and_unknowns_are_said_plainly(self):
        self.run_chat("Tell me about 1002")
        facts = self.facts_sent()
        self.assertIn("Promised delivery by today 17:00", facts)  # 16:00 UTC is 17:00 in Stockholm
        self.assertIn("2 h later than planned", facts)
        self.assertIn("short on stock", facts)
        self.assertIn("Not known yet:", facts)

    def test_old_information_is_called_out(self):
        late = datetime(2026, 11, 6, 14, 0, tzinfo=timezone.utc)
        self.run_chat("Tell me about 1002", now=late)
        self.assertIn("may be out of date", self.facts_sent())

    def test_the_prompt_forbids_jargon_and_keeps_only_recent_history(self):
        earlier = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}"} for i in range(20)]
        self.run_chat("", messages=ask("hello", earlier=earlier))
        roles = [m["content"] for m in self.sent[-1]["messages"]]
        self.assertIn("never use technical terms", roles[0])
        self.assertLessEqual(len(roles), 1 + 6 + 1)

    # --- never worse than the data ---
    def test_a_bad_model_answer_is_replaced_by_the_facts(self):
        result = self.run_chat("Which orders need attention?",
                               transport=self.model("Call the list_high_risk_orders function to find them."))
        self.assertTrue(result["fallback"])
        self.assertIn("ORDER-1002", result["reply"])
        self.assertNotIn("function", result["reply"])

    def test_model_down_still_shows_the_facts(self):
        def broken(*args):
            raise OSError("connection refused")

        result = self.run_chat("Which orders need attention?", transport=broken)
        self.assertTrue(result["fallback"])
        self.assertIn("ORDER-1002", result["reply"])

    def test_running_out_of_time_is_said_not_hidden(self):
        ticks = chain([0, 0], repeat(25))
        result = run_chat(self.db, ask("hello"), now=NOW, monotonic=lambda: next(ticks),
                          transport=self.model("Partial ", "answer"))
        self.assertTrue(result["incomplete"])
        self.assertTrue(result["reply"].endswith(INCOMPLETE_NOTE))

    # --- streaming and safety ---
    def test_events_show_progress_then_words_then_a_summary(self):
        events = list(chat_events(self.db, ask("Which orders need attention?"), now=NOW, transport=self.model("It ", "is ", "1002.")))
        kinds = [e["type"] for e in events]
        self.assertEqual(kinds[:2], ["status", "status"])
        self.assertEqual(events[0]["text"], "Checking which orders are most at risk…")
        self.assertEqual(events[1]["text"], "Writing the answer…")
        self.assertEqual("".join(e["text"] for e in events if e["type"] == "token"), "It is 1002.")
        self.assertEqual(kinds[-1], "done")

    def test_reading_never_changes_anything(self):
        with closing(connect(self.db, readonly=True)) as db:
            before = [db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("planner_feedback", "simulated_notification", "risk_score")]
        self.run_chat("Which orders need attention?")
        self.run_chat("Tell me about 1002")
        with closing(connect(self.db, readonly=True)) as db:
            after = [db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("planner_feedback", "simulated_notification", "risk_score")]
        self.assertEqual(before, after)

    def test_input_limits(self):
        for bad in ([], [{"role": "system", "content": "x"}], [{"role": "user", "content": " "}],
                    [{"role": "user", "content": "x" * (MAX_MESSAGE_CHARS + 1)}], [{"role": "assistant", "content": "hi"}]):
            with self.assertRaises(ValueError):
                list(chat_events(self.db, bad, now=NOW, transport=self.model("x")))


if __name__ == "__main__":
    unittest.main()
