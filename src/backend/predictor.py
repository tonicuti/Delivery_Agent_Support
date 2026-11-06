"""Validated inference for the trusted, local LightGBM pipeline."""

from functools import lru_cache
import hashlib
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .features import FEATURE_NAMES


MODEL_PATH = Path(__file__).resolve().parents[2] / "ML" / "data" / "trained_models" / "lightgbm.joblib"
NUMERIC_FEATURES = FEATURE_NAMES[:11]
CATEGORICAL_FEATURES = FEATURE_NAMES[11:]


@lru_cache(maxsize=1)
def load_model(path: Path = MODEL_PATH) -> Any:
    """Load only a trusted local artifact; joblib deserialization runs code."""
    return joblib.load(path)


def model_identity(path: Path = MODEL_PATH) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return f"lightgbm-sha256:{digest}"


def risk_band(probability: float) -> str:
    if not math.isfinite(probability) or not 0 <= probability <= 1:
        raise ValueError("p_late must be finite and between 0 and 1")
    return "Low" if probability < 0.2 else "Medium" if probability <= 0.5 else "High"


def predict_probability(model: Any, values: dict[str, Any]) -> float:
    """Apply the persisted preprocessing pipeline to exactly one feature row."""
    if set(values) != set(FEATURE_NAMES):
        raise ValueError("feature names do not match the model contract")
    if tuple(model.feature_names_in_) != FEATURE_NAMES:
        raise ValueError("saved pipeline expects a different feature schema")
    for name in NUMERIC_FEATURES:
        value = values[name]
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))
                                  or not math.isfinite(value)):
            raise ValueError(f"invalid numeric feature: {name}")
    for name in CATEGORICAL_FEATURES:
        value = values[name]
        if value is not None and not isinstance(value, str):
            raise ValueError(f"invalid categorical feature: {name}")
    classes = list(model.classes_)
    if classes.count(1) != 1:
        raise ValueError("saved pipeline has no unique late-delivery class")
    frame = pd.DataFrame([{name: np.nan if values[name] is None else values[name]
                           for name in FEATURE_NAMES}], columns=FEATURE_NAMES)
    probabilities = model.predict_proba(frame)
    if len(probabilities) != 1 or len(probabilities[0]) != len(classes):
        raise ValueError("saved pipeline returned an invalid probability shape")
    probability = float(probabilities[0][classes.index(1)])
    risk_band(probability)  # validates range and finiteness
    return probability
