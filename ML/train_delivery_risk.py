"""Preprocess synthetic order snapshots and compare two delivery-risk models."""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


NUMERIC_FEATURES = [
    "hours_to_deadline", "item_count", "item_quantity", "weight_kg", "volume_m3",
    "special_handling", "actual_departure_delay_minutes", "eta_delay_minutes",
    "travel_hours", "weather_severity", "holiday_flag",
]
CATEGORICAL_FEATURES = [
    "customer_type", "stock_status", "warehouse_stage", "region", "warehouse", "carrier",
]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
SPLITS = ("train", "validation", "test")


def prepare_data(frame):
    """Select decision-time features and the independently recorded binary label."""
    missing = set(FEATURES + ["original_late"]) - set(frame)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    features = frame[FEATURES].copy()
    for name in NUMERIC_FEATURES:
        features[name] = pd.to_numeric(features[name], errors="raise")
    labels = pd.to_numeric(frame["original_late"], errors="raise").astype(int)
    if not labels.isin((0, 1)).all():
        raise ValueError("original_late must contain only 0 and 1")
    return features, labels


def validate_splits(frame):
    required = {"order_id", "split", "scored_at_utc"}
    missing = required - set(frame)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    if set(frame["split"]) != set(SPLITS):
        raise ValueError("Expected train, validation, and test splits")
    if frame.groupby("order_id")["split"].nunique().gt(1).any():
        raise ValueError("All snapshots of an order must be in one split")
    if frame["scored_at_utc"].isna().any():
        raise ValueError("scored_at_utc cannot be blank")


def make_preprocessor(scale_numeric):
    numeric_steps = [("impute", SimpleImputer(strategy="median", add_indicator=True))]
    if scale_numeric:
        numeric_steps.append(("scale", StandardScaler()))
    return ColumnTransformer([
        ("numeric", Pipeline(numeric_steps), NUMERIC_FEATURES),
        ("categorical", Pipeline([
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("encode", OneHotEncoder(handle_unknown="ignore")),
        ]), CATEGORICAL_FEATURES),
    ])


def make_models():
    return {
        "logistic_regression": Pipeline([
            ("preprocess", make_preprocessor(scale_numeric=True)),
            ("model", LogisticRegression(max_iter=1000, random_state=42)),
        ]),
        "lightgbm": Pipeline([
            ("preprocess", make_preprocessor(scale_numeric=False)),
            ("model", LGBMClassifier(
                n_estimators=150, learning_rate=0.05, num_leaves=15,
                min_child_samples=40, reg_lambda=1.0, random_state=42,
                n_jobs=2, verbosity=-1,
            )),
        ]),
    }


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


def train_and_evaluate(input_path, output_dir, k=10):
    frame = pd.read_csv(input_path)
    validate_splits(frame)
    features, labels = prepare_data(frame)
    output_dir.mkdir(parents=True, exist_ok=True)
    results = {"source": str(input_path), "k": k, "models": {}}

    for name, pipeline in make_models().items():
        train_mask = frame["split"] == "train"
        pipeline.fit(features.loc[train_mask], labels.loc[train_mask])
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
        joblib.dump(pipeline, output_dir / f"{name}.joblib")

    with (output_dir / "metrics.json").open("w", encoding="utf-8") as file:
        json.dump(results, file, indent=2)
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    dataset_dir = Path(__file__).parent / "data"
    parser.add_argument("--input", type=Path, default=dataset_dir / "training_snapshots.csv")
    parser.add_argument("--output-dir", type=Path, default=dataset_dir / "trained_models")
    parser.add_argument("--k", type=int, default=10, help="Orders a planner can review per shift")
    args = parser.parse_args()
    print(json.dumps(train_and_evaluate(args.input, args.output_dir, args.k), indent=2))
