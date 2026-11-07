"""Explicit LangGraph routing for a local delivery-risk decision."""

from contextlib import closing
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Callable

from langgraph.graph import END, START, StateGraph

if __package__ in (None, ""):
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    __package__ = "backend.agent"

from ..db import DEFAULT_DB, connect
from ..eligibility import check_eligibility
from ..features import _utc_text, build_features
from ..external.context import get_context, live_enrich
from ..scoring import ScoreResult, score_order
from .playbooks import PLAYBOOKS, applicable_actions
from .recommendations import request_qwen, validate_recommendation
from .state import AgentState
from .worklist import close_monitoring, preview_high_risk, persist_recommendation_and_alert


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def build_graph(db_path: Path, *, model=None, model_version: str | None = None,
                recommendation_client: Callable | None = None):
    path = Path(db_path)

    def eligibility(state: AgentState) -> dict:
        with closing(connect(path, readonly=True)) as db:
            result = check_eligibility(db, state["order_id"], _parse(state["decision_time"]))
        return {"eligibility_reason": result.reason}

    def read_evidence(state: AgentState) -> dict:
        with closing(connect(path, readonly=True)) as db:
            row = db.execute("""
                SELECT t.name FROM customer_order o
                JOIN management_team t ON t.team_id = o.management_team_id
                WHERE o.order_id = ?
            """, (state["order_id"],)).fetchone()
        return {"owner_team": row["name"]}

    def external_context(state: AgentState) -> dict:
        if state["offline"]:
            with closing(connect(path, readonly=True)) as db:
                context = get_context(db, state["order_id"], _parse(state["decision_time"]))
        else:
            with closing(connect(path)) as db:
                context = live_enrich(db, state["order_id"], _parse(state["decision_time"]))
            return {"external_status": context,
                    "decision_time": context["effective_decision_time"]}
        return {"external_status": context}

    def build_feature_row(state: AgentState) -> dict:
        with closing(connect(path, readonly=True)) as db:
            row = build_features(db, state["order_id"], _parse(state["decision_time"]))
        return {"feature_values": row.values, "feature_sources": row.sources,
                "missing": row.missing, "promise_version": row.promise_version,
                "promised_to_utc": row.promised_to_utc}

    def score(state: AgentState) -> dict:
        with closing(connect(path)) as db:
            result = score_order(db, state["order_id"], _parse(state["decision_time"]),
                                 trigger_id=state.get("trigger_id"), model=model,
                                 model_version=model_version)
        updates = {"score": asdict(result), "run_id": result.run_id,
                   "eligibility_reason": result.eligibility_reason,
                   "next_due_at_utc": result.next_due_at_utc}
        if result.score_id is not None:
            updates.update({"snapshot_id": result.snapshot_id, "score_id": result.score_id,
                            "p_late": result.p_late, "risk_band": result.risk_band})
        return updates

    def low_medium(state: AgentState) -> dict:
        with closing(connect(path)) as db:
            close_monitoring(db, state["order_id"], _parse(state["decision_time"]))
        return {}

    def high_worklist(state: AgentState) -> dict:
        with closing(connect(path, readonly=True)) as db:
            episode, previous = preview_high_risk(db, ScoreResult(**state["score"]))
        return {"episode_id": episode, "previous_probability": previous}

    def current_evidence(state: AgentState) -> dict:
        with closing(connect(path, readonly=True)) as db:
            current = build_features(db, state["order_id"], _parse(state["decision_time"]))
        changed = [name for name, value in current.values.items()
                   if value != state["feature_values"].get(name)]
        return {"evidence_differences": changed}

    def select_playbooks(state: AgentState) -> dict:
        if state.get("evidence_differences"):
            actions = {"review_conflicting_evidence": PLAYBOOKS["review_conflicting_evidence"]}
        else:
            actions = applicable_actions(state["feature_values"])
            if not state["missing"] and len(actions) > 1:
                actions.pop("review_conflicting_evidence", None)
        return {"allowed_actions": actions}

    def recommend(state: AgentState) -> dict:
        evidence_ids = sorted({ref for refs in state["feature_sources"].values() for ref in refs}
                              | set(state.get("external_status", {}).get("evidence_ids", [])))
        evidence = {
            "order_id": state["order_id"], "p_late": state["p_late"],
            "promise_version": state["promise_version"],
            "promised_to_utc": state["promised_to_utc"],
            "features": state["feature_values"], "feature_sources": state["feature_sources"],
            "missing": state["missing"],
            "evidence_ids": evidence_ids, 
            "evidence_differences": state.get("evidence_differences", []),
            "owner_team": state["owner_team"],
            "external_status": state.get("external_status", {}),
        }
        try:
            if recommendation_client is not None:
                candidate = recommendation_client(evidence, state["allowed_actions"], state["decision_time"])
            elif state["offline"]:
                raise RuntimeError("no saved offline Qwen response fixture")
            else:
                candidate = request_qwen(evidence, allowed_actions=state["allowed_actions"],
                                         decision_time=state["decision_time"])
            validated = validate_recommendation(candidate,
                                                allowed_actions=set(state["allowed_actions"]),
                                                evidence_ids=set(evidence_ids),
                                                decision_time=state["decision_time"],
                                                feature_values=state["feature_values"])
            if validated["suggested_owner"] != state["owner_team"]:
                raise ValueError("Qwen suggested an owner outside the assigned team")
            return {"recommendation": validated, "recommendation_error": None}
        except (OSError, RuntimeError, ValueError, KeyError, TypeError) as exc:
            return {"recommendation": None, "recommendation_error": str(exc)[:500]}

    def persist_alert(state: AgentState) -> dict:
        with closing(connect(path)) as db:
            notification_id = persist_recommendation_and_alert(
                db, ScoreResult(**state["score"]), state["episode_id"],
                recommendation=state.get("recommendation"),
                error=state.get("recommendation_error"),
                previous_probability=state.get("previous_probability"),
                decision_time=_parse(state["decision_time"]))
            active = db.execute("""
                SELECT episode_id FROM risk_episode WHERE order_id = ? AND closed_at_utc IS NULL
            """, (state["order_id"],)).fetchone()
        return {"notification_id": notification_id, "episode_id": active["episode_id"]}

    def schedule(state: AgentState) -> dict:
        return {"next_due_at_utc": state["score"]["next_due_at_utc"]}

    graph = StateGraph(AgentState)
    for name, node in (
        ("check_eligibility", eligibility), ("read_evidence", read_evidence),
        ("external_context", external_context), ("build_features", build_feature_row),
        ("score_and_save", score), ("monitor", low_medium),
        ("high_worklist", high_worklist), ("current_evidence", current_evidence),
        ("select_playbooks", select_playbooks), ("recommend", recommend),
        ("persist_alert", persist_alert), ("schedule", schedule),
    ):
        graph.add_node(name, node)
    graph.add_edge(START, "check_eligibility")
    graph.add_conditional_edges("check_eligibility",
                                lambda state: "eligible" if state["eligibility_reason"] == "eligible" else "ineligible",
                                {"eligible": "read_evidence", "ineligible": "score_and_save"})
    graph.add_edge("read_evidence", "external_context")
    graph.add_edge("external_context", "build_features")
    graph.add_edge("build_features", "score_and_save")
    graph.add_conditional_edges("score_and_save",
                                lambda state: "high" if state.get("risk_band") == "High" else "not_high",
                                {"high": "high_worklist", "not_high": "monitor"})
    graph.add_edge("monitor", "schedule")
    graph.add_edge("high_worklist", "current_evidence")
    graph.add_edge("current_evidence", "select_playbooks")
    graph.add_edge("select_playbooks", "recommend")
    graph.add_edge("recommend", "persist_alert")
    graph.add_edge("persist_alert", "schedule")
    graph.add_edge("schedule", END)
    return graph.compile()


def export_mermaid(output_path: Path) -> Path:
    """Write the compiled agent graph as Mermaid text without running it."""
    output_path = Path(output_path)
    mermaid = build_graph(DEFAULT_DB).get_graph().draw_mermaid()
    output_path.write_text(mermaid.rstrip() + "\n", encoding="utf-8")
    return output_path


def run_agent(db_path: Path, order_id: int, decision_time: datetime, *,
              trigger_id: str | None = None, offline: bool = True,
              model=None, model_version: str | None = None,
              recommendation_client: Callable | None = None) -> AgentState:
    graph = build_graph(db_path, model=model, model_version=model_version,
                        recommendation_client=recommendation_client)
    state: AgentState = {"order_id": order_id, "decision_time": _utc_text(decision_time),
                         "offline": offline}
    if trigger_id:
        state["trigger_id"] = trigger_id
    return graph.invoke(state)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Export the agent graph as Mermaid text")
    parser.add_argument("--output", type=Path, required=True, help="destination .mmd file")
    args = parser.parse_args()
    print(export_mermaid(args.output))
