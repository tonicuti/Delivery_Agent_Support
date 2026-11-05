"""Evaluate and compare fitted delivery-risk models on shift-start worklists."""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss

from preprocess_delivery_risk import DEFAULT_DATASET, DEFAULT_MODELS_DIR, load_dataset


def evaluate_shift_start(frame, probabilities, k):
    """Rank distinct open orders at 08:00 Stockholm time for each daily shift."""
    if k < 1:
        raise ValueError("k must be positive")
    scored_local = pd.to_datetime(frame["scored_at_utc"], utc=True).dt.tz_convert("Europe/Stockholm")
    shift_rows = frame.loc[(scored_local.dt.hour == 8) & (scored_local.dt.minute == 0)
                           & (scored_local.dt.second == 0)].copy()
    shift_rows["score"] = np.asarray(probabilities)[shift_rows.index.to_numpy()]
    shift_rows["shift_date"] = scored_local.loc[shift_rows.index].dt.date
    if shift_rows.duplicated(["shift_date", "order_id"]).any():
        raise ValueError("Duplicate shift-start snapshots for an order")
    if shift_rows.empty:
        raise ValueError("No shift-start snapshots found at 08:00 Europe/Stockholm")

    selected = shift_rows.sort_values(["shift_date", "score"], ascending=[True, False])
    selected = selected.groupby("shift_date", group_keys=False).head(k)
    late_found = int(selected["original_late"].sum())
    total_late = int(shift_rows["original_late"].sum())
    return {
        "shifts": int(shift_rows["shift_date"].nunique()),
        "eligible_orders": int(len(shift_rows)),
        "reviewed_orders": int(len(selected)),
        "late_orders": total_late,
        "late_found": late_found,
        "precision_at_k": round(late_found / len(selected), 4),
        "recall_at_k": round(late_found / total_late, 4) if total_late else 0.0,
        "average_precision": round(average_precision_score(shift_rows["original_late"], shift_rows["score"]), 4),
        "brier_score": round(brier_score_loss(shift_rows["original_late"], shift_rows["score"]), 4),
    }


def compare_models(input_path=DEFAULT_DATASET, models_dir=DEFAULT_MODELS_DIR, k=10):
    frame, features, labels = load_dataset(input_path)
    results = {"source": str(input_path), "k": k, "models": {}}

    for name in ("logistic_regression", "lightgbm"):
        pipeline = joblib.load(models_dir / f"{name}.joblib")
        model_results = {}
        for split in ("validation", "test"):
            mask = frame["split"] == split
            split_frame = frame.loc[mask].reset_index(drop=True)
            probabilities = pipeline.predict_proba(features.loc[mask])[:, 1]
            model_results[split] = evaluate_shift_start(split_frame, probabilities, k)
            model_results[split]["snapshot_average_precision"] = round(
                average_precision_score(labels.loc[mask], probabilities), 4
            )
        results["models"][name] = model_results

    with (models_dir / "metrics.json").open("w", encoding="utf-8") as file:
        json.dump(results, file, indent=2)
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--models-dir", type=Path, default=DEFAULT_MODELS_DIR)
    parser.add_argument("--k", type=int, default=10, help="Orders a planner can review per shift")
    args = parser.parse_args()
    print(json.dumps(compare_models(args.input, args.models_dir, args.k), indent=2))
