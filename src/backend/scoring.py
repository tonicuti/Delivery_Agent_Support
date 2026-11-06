"""Atomic score persistence with immutable model inputs and retry identity."""

from dataclasses import dataclass
from datetime import datetime
import json
from sqlite3 import Connection
from uuid import uuid4

from .eligibility import check_eligibility
from .features import _parse_utc, _utc_text, build_features
from .predictor import load_model, model_identity, predict_probability, risk_band
from .scheduler import next_due_time


@dataclass(frozen=True)
class ScoreResult:
    run_id: str
    order_id: int
    decision_time: str
    eligibility_reason: str
    snapshot_id: str | None
    score_id: int | None
    p_late: float | None
    risk_band: str | None
    promise_version: int | None
    promised_to_utc: str | None
    next_due_at_utc: str | None


def _json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _from_run(db: Connection, run_id: str) -> ScoreResult:
    row = db.execute("""
        SELECT r.*, s.p_late, s.snapshot_id, sn.promise_version_no,
               sn.promised_to_utc
        FROM agent_run r
        LEFT JOIN risk_score s ON s.score_id = r.score_id
        LEFT JOIN order_snapshot sn ON sn.snapshot_id = s.snapshot_id
        WHERE r.run_id = ?
    """, (run_id,)).fetchone()
    return ScoreResult(
        run_id=run_id, order_id=row["order_id"], decision_time=row["decision_time_utc"],
        eligibility_reason=row["eligibility_reason"], snapshot_id=row["snapshot_id"],
        score_id=row["score_id"], p_late=row["p_late"],
        risk_band=risk_band(row["p_late"]) if row["p_late"] is not None else None,
        promise_version=row["promise_version_no"], promised_to_utc=row["promised_to_utc"],
        next_due_at_utc=row["next_due_at_utc"],
    )


def score_order(db: Connection, order_id: int, decision_time: datetime, *,
                trigger_id: str | None = None, model=None,
                model_version: str | None = None) -> ScoreResult:
    """Score an eligible order once per snapshot/model, safe under retries.

    A SQLite immediate transaction serializes writes and evidence reads for
    this local pilot. Caller supplies a connection to the migrated schema.
    """
    at = _utc_text(decision_time)
    if model is not None and model_version is None:
        raise ValueError("custom model requires model_version")
    if model_version is None:
        model_version = model_identity()
    if db.in_transaction:
        raise ValueError("score_order requires a connection outside a transaction")
    db.execute("BEGIN IMMEDIATE")
    try:
        if trigger_id:
            existing = db.execute("""
                SELECT r.run_id, r.order_id, r.decision_time_utc, s.model_version
                FROM agent_run r LEFT JOIN risk_score s ON s.score_id = r.score_id
                WHERE r.trigger_id = ?
            """, (trigger_id,)).fetchone()
            if existing:
                if (existing["order_id"] != order_id or existing["decision_time_utc"] != at
                        or (existing["model_version"] and existing["model_version"] != model_version)):
                    raise ValueError("trigger_id reused for a different scoring request")
                result = _from_run(db, existing["run_id"])
                db.commit()
                return result
        if db.execute("SELECT 1 FROM customer_order WHERE order_id = ?", (order_id,)).fetchone() is None:
            raise LookupError(f"order {order_id} does not exist")
        run_id = str(uuid4())
        db.execute("""
            INSERT INTO agent_run
            (run_id, trigger_id, order_id, decision_time_utc, status, created_at_utc)
            VALUES (?, ?, ?, ?, 'running', ?)
        """, (run_id, trigger_id, order_id, at, _utc_text(datetime.now().astimezone())))
        eligibility = check_eligibility(db, order_id, decision_time)
        if not eligibility.eligible:
            db.execute("""
                UPDATE agent_run SET status = 'ineligible', eligibility_reason = ? WHERE run_id = ?
            """, (eligibility.reason, run_id))
            db.execute("""
                INSERT INTO schedule_state(order_id, next_due_at_utc, last_trigger_id, updated_at_utc)
                VALUES (?, NULL, ?, ?)
                ON CONFLICT(order_id) DO UPDATE SET next_due_at_utc = NULL,
                    last_trigger_id = excluded.last_trigger_id, updated_at_utc = excluded.updated_at_utc
                WHERE excluded.updated_at_utc >= schedule_state.updated_at_utc
            """, (order_id, trigger_id, at))
            result = _from_run(db, run_id)
            db.commit()
            return result

        features = build_features(db, order_id, decision_time)
        values_json = _json(features.values)
        existing_snapshot = db.execute("""
            SELECT snapshot_id FROM order_snapshot WHERE order_id = ? AND as_of_utc = ?
        """, (order_id, at)).fetchone()
        if existing_snapshot:
            snapshot_id = existing_snapshot["snapshot_id"]
            saved = db.execute("""
                SELECT feature_values_json, missing_json, source_refs_json, limitations_json
                FROM model_input_snapshot WHERE snapshot_id = ?
            """, (snapshot_id,)).fetchone()
            if (saved is None or saved["feature_values_json"] != values_json
                    or saved["missing_json"] != _json(features.missing)
                    or saved["source_refs_json"] != _json(features.sources)
                    or saved["limitations_json"] != _json(features.limitations)):
                raise ValueError("evidence changed for an already scored decision time")
        else:
            snapshot_id = str(uuid4())
            v = features.values
            db.execute("""
                INSERT INTO order_snapshot
                (snapshot_id, order_id, promise_version_no, as_of_utc,
                 feature_schema_version, promised_to_utc, hours_to_deadline,
                 customer_type, item_count, item_quantity, weight_kg, volume_m3,
                 special_handling, stock_status, warehouse_stage,
                 actual_departure_delay_minutes, eta_delay_minutes, travel_hours,
                 region_name, warehouse_name, carrier_name, weather_severity, holiday_flag)
                VALUES (?, ?, ?, ?, 'lightgbm-v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (snapshot_id, order_id, features.promise_version, at,
                  features.promised_to_utc, v["hours_to_deadline"], v["customer_type"],
                  v["item_count"], v["item_quantity"], v["weight_kg"], v["volume_m3"],
                  v["special_handling"], v["stock_status"], v["warehouse_stage"],
                  v["actual_departure_delay_minutes"], v["eta_delay_minutes"],
                  v["travel_hours"], v["region"], v["warehouse"], v["carrier"],
                  v["weather_severity"], v["holiday_flag"]))
            db.execute("""
                INSERT INTO model_input_snapshot
                (snapshot_id, feature_values_json, missing_json, source_refs_json,
                 limitations_json, saved_at_utc) VALUES (?, ?, ?, ?, ?, ?)
            """, (snapshot_id, values_json, _json(features.missing), _json(features.sources),
                  _json(features.limitations), at))

        existing_score = db.execute("""
            SELECT score_id FROM risk_score WHERE snapshot_id = ? AND model_version = ?
        """, (snapshot_id, model_version)).fetchone()
        if existing_score:
            score_id = existing_score["score_id"]
        else:
            p_late = predict_probability(model or load_model(), features.values)
            score_id = db.execute("""
                INSERT INTO risk_score
                (snapshot_id, model_version, scored_at_utc, p_late)
                VALUES (?, ?, ?, ?)
            """, (snapshot_id, model_version, at, p_late)).lastrowid
        if not check_eligibility(db, order_id, decision_time).eligible:
            raise RuntimeError("order became ineligible before score commit")
        next_due = _utc_text(next_due_time(decision_time, _parse_utc(features.promised_to_utc)))
        db.execute("""
            UPDATE agent_run SET status = 'completed', eligibility_reason = 'eligible',
                score_id = ?, next_due_at_utc = ? WHERE run_id = ?
        """, (score_id, next_due, run_id))
        db.execute("""
            INSERT INTO schedule_state(order_id, next_due_at_utc, last_trigger_id, updated_at_utc)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(order_id) DO UPDATE SET next_due_at_utc = excluded.next_due_at_utc,
                last_trigger_id = excluded.last_trigger_id, updated_at_utc = excluded.updated_at_utc
            WHERE excluded.updated_at_utc >= schedule_state.updated_at_utc
        """, (order_id, next_due, trigger_id, at))
        result = _from_run(db, run_id)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
