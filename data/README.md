# Synthetic delivery risk training data

Run `py work/generate_training_data.py` from the workspace root to recreate these files. The default seed is 42. `--orders` and `--seed` change the size and random sequence.

`training_snapshots.csv` has one row per eligible order and scoring time. `original_late` is the binary label for whether the original delivery arrived after the promise deadline. Repeated snapshots of an order share that eventual outcome. `source_events.csv` records the simulated warehouse and ETA updates, including when each update occurred and when it became visible. `order_outcomes.csv` records the simulated original arrival and deadline so the label can be checked independently.

Use the `split` column to compare models. Orders are assigned chronologically to train (70%), validation (15%), and test (15%), and all snapshots of an order stay in one split. The test split should remain untouched during model selection. For Precision@K, choose the latest eligible snapshot per order at each shift start, rank distinct orders, and calculate K within that shift.

Train on numeric and categorical business features such as `hours_to_deadline`, `stock_status`, `warehouse_stage`, `eta_delay_minutes`, and `region`. Convert or omit raw timestamp columns when fitting a model. Keep `snapshot_id`, `order_id`, `split`, `scored_at_utc`, `promise_version`, and `promised_to_utc` for grouping and audit. `original_late` is the label. Blank departure and ETA values mean that information was not recorded by the scoring time. The simulated stock and weather values are assumed to be known at the start of the shift.

The generator uses deliberately chosen Swedish regional routes, stock constraints, warehouse delays, weather, and travel variation. Its lateness rate and model scores describe this simulation only. The data does not establish expected performance on real orders.
