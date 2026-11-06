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

## Docker and planner console

Three services (`docker-compose.yml`): **fe** (React console served by nginx, proxies `/api`), **be** (Python API + scheduler thread + SQLite file in the `db-data` volume) and **ollama** (Qwen, downloads `qwen3:1.7b` on first start). SQLite has no server process, so the "database" is the volume. Only `fe` is published, on port 8080.

```powershell
docker compose up -d --build        # then open http://localhost:8080
docker compose logs -f be
docker compose down                 # keeps the database and the model; add -v to delete them
```

There is no migration container: the `be` entrypoint creates the schema when the volume has none and applies migrations on every start (idempotent). With `SEED_DEMO=true` (the compose default) a database with **no business rows at all** is filled with the synthetic demo orders 1001-1003; set `SEED_DEMO=false` for a real database. `SCHEDULER_MODE` (`off`, `offline`, `live`) sets the background scheduler and can be changed from the console's System page.

**Reuse an Ollama already running on the host** (e.g. to use its GPU and downloaded model instead of the container):

```powershell
$env:OLLAMA_ENDPOINT = "http://host.docker.internal:11434/api/generate"
docker compose up -d --build --scale ollama=0
```

The `ollama` service reserves an NVIDIA GPU; delete its `deploy:` block on machines without one. Tests and one-off CLI commands run in the `be` image:

```powershell
docker compose run --rm --no-deps --entrypoint python be -m unittest discover -s tests -v
docker compose run --rm --no-deps be replay --scenario eta-delay --mock-recommendation
```

### Console

| Page | What people do there |
|---|---|
| Worklist, Right now | See the orders most likely to be late, most urgent first. Filter by reason or by what needs attention, mark alerts as read |
| Worklist, Shift plan | Save a ranked list of orders to review for the shift; saved plans never change |
| Orders | Every order, how likely it is to be late, and when it is next checked |
| Order page | The chance of being late, the promise, where the shipment is, why it is at risk, the suggested action (accept, choose another, or not needed), a draft customer message in Swedish, Norwegian, Danish or English, the activity history, and claims and replacements |
| Chat | Ask the assistant anything about the day's deliveries; past chats are kept on the device |
| Insights | How many orders were flagged, how alerts and decisions are going, and the pilot goals |

"Check now" re-checks an order with the latest information and the local model. The menu at the top shows whether the assistant is ready and lets you switch automatic checks on or off.

Wording rules for anything shown to users (no codes, no technical terms, spoken durations, local time) are in [design-system/delivery-risk-console/MASTER.md](design-system/delivery-risk-console/MASTER.md). The chat assistant reads facts first, then phrases them; if the local model is down it shows the facts. The API (`backend serve`) has no sign-in: keep it unpublished and put the console behind your own access control before any shared use. Frontend development: `cd frontend && npm install && npm run dev` (proxies `/api` to a local `backend serve`).
