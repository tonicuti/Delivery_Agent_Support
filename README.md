# Delivery risk backend pilot

The implementation follows the requirements in [`src/backend/README.md`](src/backend/README.md). It reads the current SQLite schema, keeps as-of model inputs and evidence references, scores with the saved LightGBM pipeline, and routes high-risk orders through LangGraph. Qwen recommendations use local Ollama `qwen3:1.7b`; failed or invalid output still produces a simulated alert for staff review.

## Run

```powershell
uv sync --frozen
uv run backend inspect-db
uv run backend replay --scenario eta-delay
uv run backend replay --scenario eta-delay --mock-recommendation
uv run backend --db path\to\pilot.db migrate
uv run backend --db path\to\pilot.db features --order-id 1002 --as-of 2026-11-06T12:00:00Z
uv run backend --db path\to\pilot.db run-agent --order-id 1002 --as-of 2026-11-06T12:00:00Z --offline
uv run backend --db path\to\pilot.db scheduler --once --offline
uv run python -m unittest discover -s tests -v
```

`delivery_db.db` currently has no business rows. `replay` creates a temporary database from `schema_fresh.sql` and `inference_seed.sql`; it does not change `delivery_db.db`. `migrate` validates a copy and creates a backup before applying the additive agent migration. Use `--json` for machine-readable command output. `--live` fetches Open-Meteo and Nager.Date context and calls Ollama only for high-risk recommendations; the decision timestamp advances to evidence receipt before scoring.

Add `--mock-recommendation` to `replay` to use a deterministic, schema-validated mock action without Ollama. The ETA-delay simulation recommends `check_stock` at the first High score, then `confirm_route` after the 120-minute ETA delay appears. It records an initial simulated alert and a follow-up because the recommended action changed. The output includes each recommendation, owner, response deadline, cited evidence, and alert ID.

Additional commands: `freeze-shift --shift-id ID --region-id 1 --started-at UTC --capacity K`, `authorize-replacement --inspection-id ID --claim-id ID --representative-id ID --finding TEXT --decided-at UTC --line CLAIM_LINE_ID:QTY`, `refresh-replacements --order-id ID --as-of UTC`, `ack-alert --notification-id ID --at UTC`, and `feedback --feedback-id ID --recommendation-id ID --recorded-by ID --at UTC [--chosen-action-id ACTION] [--notes TEXT]`.

## Evidence policy

Open-Meteo hourly precipitation (mm) and 10 m gusts (m/s) are mapped to operational severity `demo-weather-v1`: **0** below 5 mm and 10 m/s, **1** at or above either 5 mm or 10 m/s, and **2** at or above either 15 mm or 20 m/s. The mapped value and raw measurements are shown to the recommendation step. The saved model's `weather_severity` input remains missing because `ML/generate_training_data.py` assigned that training field randomly, with no physical mapping. The same generator synthesized `travel_hours`, so real route observations are used only when present; missing values stay missing. These synthetic scores are a workflow demonstration, not validated delivery probabilities.

The current schema does not version product attributes, shipment assignments, or cancellation recording time. Historical replay therefore cannot guarantee exact reconstruction across changes to those fields. Weather is destination-hour evidence, not route-wide conditions. The offline path never makes provider or Ollama calls.
