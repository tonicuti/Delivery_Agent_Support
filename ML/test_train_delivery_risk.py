import unittest

import pandas as pd

from train_delivery_risk import CATEGORICAL_FEATURES, NUMERIC_FEATURES, evaluate_shift_start, prepare_data


class TrainingTests(unittest.TestCase):
    def test_prepare_data_excludes_identifiers_and_outcome(self):
        frame = pd.DataFrame({
            "order_id": ["a", "b", "c"],
            "split": ["train", "validation", "test"],
            "original_late": [0, 1, 0],
            "scored_at_utc": ["2026-01-05T07:00:00Z"] * 3,
            **{name: [1, 2, 3] for name in NUMERIC_FEATURES},
            **{name: ["x", "y", "z"] for name in CATEGORICAL_FEATURES},
        })
        features, labels = prepare_data(frame)
        self.assertEqual(set(features), set(NUMERIC_FEATURES + CATEGORICAL_FEATURES))
        self.assertEqual(labels.tolist(), [0, 1, 0])

    def test_precision_at_k_uses_one_shift_start_row_per_order(self):
        frame = pd.DataFrame({
            "order_id": ["a", "a", "a", "b", "c"],
            "scored_at_utc": ["2026-01-05T07:00:00Z", "2026-01-05T07:00:15Z",
                              "2026-01-05T09:00:00Z", "2026-01-05T07:00:00Z",
                              "2026-01-05T07:00:00Z"],
            "original_late": [1, 1, 1, 0, 1],
        })
        result = evaluate_shift_start(frame, [0.9, 0.01, 0.01, 0.8, 0.2], k=2)
        self.assertEqual(result["eligible_orders"], 3)
        self.assertEqual(result["precision_at_k"], 0.5)
        self.assertEqual(result["recall_at_k"], 0.5)


if __name__ == "__main__":
    unittest.main()
