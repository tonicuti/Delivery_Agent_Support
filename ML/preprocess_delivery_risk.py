"""Shared feature selection and preprocessing for delivery-risk models."""

from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


DEFAULT_DATASET = Path(__file__).parent / "data" / "training_snapshots.csv"
DEFAULT_MODELS_DIR = Path(__file__).parent / "data" / "trained_models"
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
    """Select decision-time features and the observed binary outcome."""
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


def load_dataset(path=DEFAULT_DATASET):
    frame = pd.read_csv(path)
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
    features, labels = prepare_data(frame)
    return frame, features, labels


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
