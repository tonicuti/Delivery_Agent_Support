"""Tune and save a LightGBM delivery-risk pipeline."""

import json

import joblib
from lightgbm import LGBMClassifier
from sklearn.model_selection import ParameterGrid, StratifiedGroupKFold
from sklearn.pipeline import Pipeline

from evaluate_models import evaluate_shift_start
from preprocess_delivery_risk import DEFAULT_DATASET, DEFAULT_MODELS_DIR, load_dataset, make_preprocessor


class CFG:
    INPUT_PATH = DEFAULT_DATASET
    MODELS_DIR = DEFAULT_MODELS_DIR
    K = 10
    PARAM_GRID = {
        "metric": ["auc", "binary_logloss"],
        "num_leaves": (7, 15, 31),
        "n_estimators": (100, 150, 200),
        "learning_rate": (0.03, 0.05, 0.1),
        "min_child_samples": (20, 40),
        "reg_lambda": (0.0, 1.0),
    }
    CV_FOLDS = 3
    RANDOM_STATE = 42
    N_JOBS = 2
    VERBOSITY = -1


def train_lightgbm(input_path=CFG.INPUT_PATH, models_dir=CFG.MODELS_DIR, k=CFG.K):
    frame, features, labels = load_dataset(input_path)
    train_mask = frame["split"] == "train"
    validation_mask = frame["split"] == "validation"
    train_frame = frame.loc[train_mask].reset_index(drop=True)
    train_features = features.loc[train_mask].reset_index(drop=True)
    train_labels = labels.loc[train_mask].reset_index(drop=True)
    validation_frame = frame.loc[validation_mask].reset_index(drop=True)
    cv = StratifiedGroupKFold(n_splits=CFG.CV_FOLDS, shuffle=True, random_state=CFG.RANDOM_STATE)
    trials = []
    best_pipeline = None
    best_rank = None

    for params in ParameterGrid(CFG.PARAM_GRID):
        pipeline = Pipeline([
            ("preprocess", make_preprocessor(scale_numeric=False)),
            ("model", LGBMClassifier(
                **params, random_state=CFG.RANDOM_STATE, n_jobs=CFG.N_JOBS,
                verbosity=CFG.VERBOSITY,
            )),
        ])
        fold_metrics = []
        for fit_indices, score_indices in cv.split(train_features, train_labels, train_frame["order_id"]):
            pipeline.fit(train_features.iloc[fit_indices], train_labels.iloc[fit_indices])
            probabilities = pipeline.predict_proba(train_features.iloc[score_indices])[:, 1]
            fold_frame = train_frame.iloc[score_indices].reset_index(drop=True)
            fold_metrics.append(evaluate_shift_start(fold_frame, probabilities, k))
        rank = tuple(
            sum(metrics[name] for metrics in fold_metrics) / len(fold_metrics)
            for name in ("precision_at_k", "average_precision")
        )
        trials.append({"params": params, "cv_precision_at_k": rank[0],
                       "cv_average_precision": rank[1], "folds": fold_metrics})
        if best_rank is None or rank > best_rank:
            best_rank = rank
            best_pipeline = pipeline
            best_params = params

    best_pipeline.fit(train_features, train_labels)
    probabilities = best_pipeline.predict_proba(features.loc[validation_mask])[:, 1]
    validation_metrics = evaluate_shift_start(validation_frame, probabilities, k)
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_pipeline, models_dir / "lightgbm.joblib")
    summary = {"model": "lightgbm", "selection": "grouped cross-validation precision@K, then average precision",
               "k": k, "cv_folds": CFG.CV_FOLDS, "best_num_leaves": best_params["num_leaves"],
               "best_params": best_params,
               "trials": trials, "validation": validation_metrics}
    with (models_dir / "lightgbm_tuning.json").open("w", encoding="utf-8") as file:
        json.dump(summary, file, indent=2)
    return summary


if __name__ == "__main__":
    result = train_lightgbm(CFG.INPUT_PATH, CFG.MODELS_DIR, CFG.K)
    print(f"Saved LightGBM with parameters: {result['best_params']}")
