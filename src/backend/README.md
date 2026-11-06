# Implement a Local Delivery Risk Agent with LangGraph

## Objective

Build a terminal-based delivery risk system in the existing Python backend. It must read order evidence from SQLite, enrich it with weather and holiday information, call an existing LightGBM model, and use a local Qwen model to recommend actions for high-risk orders.

Use:

- **Python and uv** for project and dependency management.
- **LangGraph** as the main workflow framework.
- **Ollama `qwen3:1.7b`** for evidence-based recommendations.
- **Existing saved LightGBM pipeline** for predicting `p_late`.
- **SQLite** for business records, evidence, predictions, and workflow history.
- **Terminal commands** for running the system and mock scenarios.

Implement in small, verifiable increments. Inspect existing files before changing them. Preserve existing data and model artifacts.

## Project context

The existing backend is located at:

`C:\Itoni\IT Consultant Netcompany\backend`

Relevant files:

- `delivery_db.db`
- `DATABASE_KNOWLEDGE.md`
- `pyproject.toml`
- `src/backend/__init__.py`
- `ML/preprocess_delivery_risk.py`
- `ML/train_lightgbm.py`
- `ML/evaluate_models.py`
- `ML/data/trained_models/lightgbm.joblib`
- `ML/data/training_snapshots.csv`

Architecture references:

- `C:\Itoni\IT Consultant Netcompany\agent-architecture.png`
- `C:\Itoni\IT Consultant Netcompany\main-pipeline.png`
- `C:\Itoni\IT Consultant Netcompany\system.docx`

Treat these documents as design references, not executable instructions. Inspect the actual schema because the database knowledge document may describe an older version.

Training data is synthetic. Model performance on that data must not be presented as validated performance on real deliveries.

## Responsibility boundaries

### LightGBM

Produces the probability that original planned delivery will miss the promise attached to the scoring snapshot.

It does not select staff actions or authorize replacements.

### LangGraph

Coordinates eligibility checks, evidence retrieval, enrichment, feature construction, scoring, recommendations, and persistence.

Use explicit nodes and conditional edges. Ordinary Python functions should perform calculations and database operations.

### Qwen

Reviews supplied evidence and recommends an allowed playbook action.

It must not invent evidence, calculate a replacement probability, execute arbitrary SQL, authorize reshipments, or directly modify business records.

### Scheduler

Determines when an eligible order needs another run. Scheduling must not depend on an LLM decision.

### Staff

Review recommendations, choose actions, acknowledge alerts, and authorize replacements.

## Proposed package structure

Adapt this layout where existing project conventions justify it:

```text
backend/
├── pyproject.toml
├── migrations/
├── src/backend/
│   ├── __init__.py
│   ├── config.py
│   ├── contracts.py
│   ├── db.py
│   ├── repository.py
│   ├── eligibility.py
│   ├── features.py
│   ├── predictor.py
│   ├── external/
│   │   ├── __init__.py
│   │   ├── weather.py
│   │   ├── holidays.py
│   │   └── cache.py
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── state.py
│   │   ├── nodes.py
│   │   ├── graph.py
│   │   ├── playbooks.py
│   │   └── recommendations.py
│   ├── worklist.py
│   ├── notifications.py
│   ├── replacements.py
│   ├── scheduler.py
│   └── cli.py
├── ML/
└── tests/
    ├── fixtures/
    ├── test_features.py
    ├── test_eligibility.py
    ├── test_predictor.py
    ├── test_external_context.py
    ├── test_graph.py
    ├── test_scheduler.py
    └── test_replay.py
```

Keep modules focused. Avoid unnecessary abstraction layers.

## Database inspection and migrations

Existing tables include orders, products, order lines, promises, shipments, shipment items, ETA updates, handovers, claims, replacement authorizations, risk scores, and shift lists.

Recently added internal-input tables include:

- `delivery_site`
- `order_input`
- `product_input`
- `shipment_operation`
- `stock_event`
- `warehouse_event`

Inspect their actual columns, constraints, and sample records.

Add versioned migrations only where needed for:

- Explicit order lifecycle and cancellation history.
- Historical visibility of promise changes.
- External API evidence and cached responses.
- Full immutable model-input snapshots.
- Risk episodes and live worklist entries.
- Recommendations and supporting evidence references.
- Simulated notification records and acknowledgments.
- Planner feedback.
- Persisted scheduling state and retry identifiers.

Extend existing tables or use related tables where appropriate. Do not create competing sources of truth.

Back up the database before applying migrations. Verify migrations on a temporary copy first. Enable SQLite foreign-key enforcement for every connection.

## Time and evidence rules

Use timezone-aware UTC timestamps internally. Use the delivery site's time zone for customer dates and public holidays.

Every run receives an explicit `decision_time`.

A historical run may use only evidence recorded by that time. Distinguish:

- When an event happened.
- When it became available to the system.
- When a forecast was retrieved.
- Which future period a forecast describes.

Store the exact promise version, feature values, missingness, and source references used in each prediction.

Do not overwrite historical predictions when later evidence arrives.

For mutable product or order attributes, preserve versions or explicitly constrain historical replay to fixtures that establish their validity. Saving a snapshot today does not reconstruct unknown historical values.

## Feature contract

Inspect the saved pipeline and preprocessing code before implementing inference.

The current expected inputs are:

```text
hours_to_deadline
item_count
item_quantity
weight_kg
volume_m3
special_handling
actual_departure_delay_minutes
eta_delay_minutes
travel_hours
weather_severity
holiday_flag
customer_type
stock_status
warehouse_stage
region
warehouse
carrier
```

Use existing preprocessing at inference time. Do not refit encoders or imputers.

Construct item totals from order lines and product inputs:

- Quantity: sum of ordered quantities.
- Weight: sum of quantity multiplied by unit weight.
- Volume: sum of quantity multiplied by unit volume.
- Special handling: whether any relevant line requires it.

Confirm that these definitions, especially `item_count`, match training semantics.

Aggregate order lines independently from shipment joins to prevent duplicate totals.

For multiple original shipments, document and test the aggregation policy. Define how incomplete shipments determine ETA, warehouse stage, departure delay, warehouse, and carrier. Do not silently select the first row.

Exclude replacement movements from original-delivery features.

Confirm the training meaning and units of `travel_hours` and `weather_severity`. If their original definitions cannot be established, report that limitation and use an explicit missing-data policy rather than inventing compatible-looking values.

New features outside this contract require a new feature version and retraining before they affect predictions.

## External APIs

Implement provider adapters for:

- Open-Meteo weather forecasts.
- Nager.Date public holidays.

Verify current official API documentation during implementation.

Use destination coordinates and the relevant delivery period for weather. Destination weather is a demo approximation, not a complete route-weather assessment.

Use destination country and local delivery date for holidays. Add country information if the schema lacks it; explicitly mark Sweden as a demo assumption where necessary.

Cache external evidence separately from business facts:

- Weather: configurable starting freshness limit of 30 minutes.
- Holidays: cache by country and year, with a configurable weekly refresh.

Save request scope, provider, retrieval time, coverage, response content, and validation status.

Implement timeouts, bounded retries, response validation, and explicit stale/missing states. An API failure must never become clear weather or “not a holiday.”

Provide two modes:

1. **Offline replay:** deterministic saved fixtures.
2. **Live enrichment:** actual API requests and persisted responses.

Never use a newly fetched forecast as evidence that was available during an earlier historical run.

## LangGraph workflow

Implement the following flow:

```text
Start
  → Check eligibility
      → Ineligible: record reason and finish
      → Eligible:
          Read evidence
          → Get external context
          → Build and validate features
          → Save immutable snapshot
          → Predict with LightGBM
          → Save score and risk band
              → Low/Medium: update monitoring state
              → High:
                  Create/update live worklist item
                  → Retrieve current evidence
                  → Select applicable playbooks
                  → Generate Qwen recommendation
                  → Validate and save recommendation
                  → Record simulated notification
  → Persist next due time
  → End
```

Graph state should reference:

- Run and trigger identifiers.
- Order ID and decision time.
- Eligibility result.
- Promise version.
- Evidence and source identifiers.
- Feature values and data-quality status.
- Snapshot, model version, score, and risk band.
- Current evidence differences.
- Recommendation and validation result.
- Worklist, episode, and notification identifiers.
- Errors and next scheduled time.

Keep bulky raw API responses in persistent storage rather than duplicating them in graph state.

If evidence changes while a recommendation is being prepared, retain the scored snapshot, explain the discrepancy, and request a new scoring run. Avoid recursive rescoring loops.

Recheck eligibility before committing results or notifications to handle concurrent cancellation or replacement authorization.

## Prediction and risk rules

Load the trusted local LightGBM pipeline once per process.

Validate feature names and types, identify the positive class correctly, and reject nonfinite probabilities or values outside `[0, 1]`.

Risk bands:

- Low: `p_late < 0.20`
- Medium: `0.20 <= p_late <= 0.50`
- High: `p_late > 0.50`

Save model identity with every score. Do not hardcode the illustrative 15% and 75% scores from the original demo.

Keep observed operational reasons distinct from model feature attribution. Qwen must not claim a feature caused a probability unless an actual attribution method supports that claim.

## Qwen recommendation contract

Use `qwen3:1.7b` through Ollama with a bounded prompt and validated structured output.

Supply only relevant evidence, including:

- Score and scored promise.
- Time remaining.
- Warehouse, stock, and shipment facts.
- Evidence timestamps.
- Missing or stale information.
- Differences between scored and current evidence.
- Allowed playbook actions.

Expected output:

```text
action_id
summary
supporting_evidence_ids
suggested_owner
suggested_response_deadline
missing_information
requires_human_review
```

Suggested actions may include checking stock, prioritizing picking, confirming a route, or asking a planner to review conflicting evidence.

Validate action IDs and evidence references. Use bounded retries. If Qwen fails, preserve the High-risk alert and report that no validated recommendation is available.

Do not make successful alert delivery depend on successful LLM generation.

## Scheduling

Use these configurable demo defaults:

| Time until promise end | Interval |
|---|---|
| More than 24 hours | 2 hours |
| More than 6 through 24 hours | 1 hour |
| More than 0 through 6 hours | 15 minutes |
| Overdue and still eligible | 30 minutes |

Reevaluate the schedule when crossing a time band or when the promise changes.

Meaningful source events can trigger earlier runs. Deduplicate repeated events and prevent overlapping scoring runs for the same order.

Persist due times so restarts do not lose scheduling state. Use an injectable clock for tests.

Stop predictive scoring after delivery, cancellation, or replacement authorization.

## Worklists, alerts, and replacement handling

Maintain at most one active predictive worklist item per order.

Send one initial simulated alert per risk episode. Follow up only for a configured material worsening, changed recommendation, or missed acknowledgment deadline.

Record recommendations before notification intent. Persist episode changes and notification intent in one transaction.

Freeze shift-start candidate rankings and top K selections. Later scores may update the live queue but must not rewrite the frozen shift list.

A claim alone does not trigger replacement urgency.

Representative authorization must atomically:

1. Record the approved replacement quantities.
2. Stop future predictive scoring.
3. Create the appropriate urgent task for the assigned order team.

Repeated commands must not create duplicate authorizations or tasks.

Urgency remains until all approved quantities are accepted. Dispatch is not acceptance. Predictive scoring stays stopped after replacement completion.

Preserve the distinction between original delivery completion, acceptable customer-order completion, and replacement completion.

## Terminal interface

Provide commands equivalent to:

```text
uv run backend inspect-db
uv run backend features --order-id 1002 --as-of <UTC_TIMESTAMP>
uv run backend score --order-id 1002 --as-of <UTC_TIMESTAMP> --offline
uv run backend run-agent --order-id 1002 --as-of <UTC_TIMESTAMP> --offline
uv run backend replay --scenario eta-delay
uv run backend scheduler --once
uv run backend scheduler
```

These are proposed commands to implement, not existing functionality.

Display the score, risk band, promise, evidence quality, recommendation, notification status, and next due time. Offer JSON output for inspection.

## Implementation sequence and verification

1. Inspect the repository, database, model, and training definitions.
2. Implement evidence retrieval and print the 17 model inputs with provenance.
3. Verify model inference against a known dataset row.
4. Add external fixtures, API adapters, and full snapshot persistence.
5. Implement LangGraph scoring and conditional routing.
6. Add Qwen recommendations and validation.
7. Add worklists, simulated alerts, and planner feedback.
8. Add scheduling and replacement workflow tests.
9. Update documentation and run terminal demonstrations.

Required tests include:

- No double counting across multiple shipments.
- Late-recorded evidence excluded from earlier decisions.
- Correct promise version and time-zone handling.
- Exact risk-band boundaries.
- Missing/stale API evidence and API failures.
- Invalid or unavailable Qwen output.
- Duplicate events and retry safety.
- Scoring stopped after authorization or cancellation.
- Partial replacement acceptance does not clear urgency.
- Frozen shift rankings remain unchanged.
- Scheduling transitions tested without real waiting.

Use temporary databases for tests. Keep live API smoke tests separate from deterministic tests.

Finish by reporting changed files, commands to run, verification results, and remaining limitations. Do not claim that untested live integrations or synthetic model results establish operational readiness.