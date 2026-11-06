import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from backend.features import FEATURE_NAMES
from backend.predictor import predict_probability, risk_band
from backend.predictor import load_model


class ModelStub:
    feature_names_in_ = FEATURE_NAMES
    classes_ = (1, 0)

    def __init__(self, probability):
        self.probability = probability
        self.seen = None

    def predict_proba(self, frame):
        self.seen = frame
        return [[self.probability, 1 - self.probability]]


class PredictorTests(unittest.TestCase):
    def test_saved_pipeline_on_known_synthetic_row(self):
        import pandas as pd

        root = Path(__file__).resolve().parents[1]
        row = pd.read_csv(root / "ML/data/training_snapshots.csv").iloc[0]
        self.assertEqual(row["snapshot_id"], "SYN-000001-0000000")
        values = {name: None if pd.isna(row[name]) else
                  (row[name].item() if hasattr(row[name], "item") else row[name])
                  for name in FEATURE_NAMES}
        self.assertAlmostEqual(predict_probability(load_model(), values), 0.3243279107638948)

    def test_positive_class_and_feature_order(self):
        model = ModelStub(0.7)
        values = {name: None for name in FEATURE_NAMES}
        values["hours_to_deadline"] = 5.5
        self.assertEqual(predict_probability(model, values), 0.7)
        self.assertEqual(tuple(model.seen.columns), FEATURE_NAMES)
        self.assertTrue(math.isnan(model.seen.loc[0, "travel_hours"]))

    def test_band_boundaries(self):
        self.assertEqual(risk_band(0.199999), "Low")
        self.assertEqual(risk_band(0.2), "Medium")
        self.assertEqual(risk_band(0.5), "Medium")
        self.assertEqual(risk_band(0.500001), "High")

    def test_rejects_bad_contract_or_probability(self):
        values = {name: None for name in FEATURE_NAMES}
        with self.assertRaises(ValueError):
            predict_probability(ModelStub(float("nan")), values)
        with self.assertRaises(ValueError):
            predict_probability(ModelStub(1.1), values)
        with self.assertRaises(ValueError):
            predict_probability(ModelStub(0.2), {"hours_to_deadline": 1})
        values["hours_to_deadline"] = float("inf")
        with self.assertRaises(ValueError):
            predict_probability(ModelStub(0.2), values)


if __name__ == "__main__":
    unittest.main()
