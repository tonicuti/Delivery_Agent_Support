# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What this project is

A terminal-based **delivery risk agent**. It reads order evidence from SQLite, enriches it with weather (Open-Meteo) and holiday (Nager.Date) context, scores late-delivery probability `p_late` with a saved **LightGBM** pipeline, and routes High-risk orders through a **LangGraph** workflow where local **Ollama `qwen3:1.7b`** recommends a playbook action for staff review.

- Full requirements / design contract: [src/backend/README.md](src/backend/README.md) — read it before non-trivial changes.
- Run instructions & evidence policy: [README.md](README.md).
- Database semantics: [DATABASE_KNOWLEDGE.md](DATABASE_KNOWLEDGE.md) (may describe an older schema — the real schema is `src/backend/practice_delivery/schema_fresh.sql` + `migrations/`).
- Training data is **synthetic**. Never present model metrics as validated real-world performance.

## Commands

```powershell
uv sync --frozen                                   # install deps
uv run backend inspect-db                          # DB integrity + table counts
uv run backend replay --scenario eta-delay --mock-recommendation   # full demo, no Ollama
uv run backend --db path\to\pilot.db run-agent --order-id 1002 --as-of 2026-11-06T12:00:00Z --offline
uv run python -m unittest discover -s tests -v     # all tests
uv run python -m unittest tests.test_scoring -v    # one test module
```

Add `--json` for machine-readable output. `--offline` never calls external APIs or Ollama; `--live` does.

## Folder structure

```text
.
├── src/backend/              # Python package (entry point: backend = "backend:main")
│   ├── cli.py                # argparse subcommands; thin layer that calls domain modules
│   ├── db.py                 # connect() — SQLite connection (FK enforcement, readonly mode)
│   ├── migrations.py         # validate-on-copy, back up, apply numbered migrations/*.sql in order
│   ├── eligibility.py        # is an order still eligible for predictive scoring?
│   ├── features.py           # builds the 17 model inputs + provenance, as-of decision time
│   ├── predictor.py          # loads LightGBM pipeline once, validates probabilities
│   ├── scoring.py            # score_order(): immutable snapshot + score + risk band
│   ├── api.py                # HTTP JSON API for the console (stdlib server, SSE for chat); thin over domain modules
│   ├── queries.py            # read-only views for the console (worklist, order case file, KPIs)
│   ├── decisions.py          # approve / edit / dismiss decision log (role stored, never a name)
│   ├── reasons.py            # observed signals from rules, in plain words (not model attribution)
│   ├── labels.py             # plain-language wording shared by API and assistant
│   ├── ollama.py             # shared local-model settings (model name, endpoint) and HTTP transport
│   ├── chatbot/              # dispatcher assistant: read facts first, local model phrases them, falls back to the facts
│   │   ├── tools.py          #   allow-listed read-only tools the model may call (validated args)
│   │   ├── graph.py          #   LangGraph loop: think -> act -> think; guard + fallback keep a small model honest
│   │   ├── history.py        #   shared chat history: saved per finished turn, searched by a tool
│   │   ├── planner.py        #   deterministic lookup picker, used only by guard and fallback
│   │   ├── facts.py          #   query results -> plain sentences
│   │   ├── prompts.py        #   limits and the system prompt (tells the model when to call which tool)
│   │   ├── conversation.py   #   chat_events()/run_chat(): one streamed chat turn
│   │   └── drafts.py         #   customer message drafts
│   ├── scheduler.py          # due-time bands, event triggers, no-overlap runs (no LLM)
│   ├── worklist.py           # shift lists (frozen top-K rankings)
│   ├── alerts/               # high-risk alerts for staff: dispatch.py (when/how to raise), notifications.py (acknowledge, feedback)
│   ├── replacements.py       # replacement authorization + urgent tasks
│   ├── external/             # provider adapters + cached evidence
│   │   ├── weather.py        #   Open-Meteo → severity mapping demo-weather-v1
│   │   ├── holidays.py       #   Nager.Date
│   │   └── context.py        #   get_context() offline / live_enrich() live
│   └── agent/                # LangGraph layer
│       ├── graph.py          #   build_graph() / run_agent(): nodes + conditional edges
│       ├── state.py          #   AgentState TypedDict
│       ├── playbooks.py      #   allowed actions per situation
│       ├── recommendations.py#   Ollama call + strict output validation
│       └── worklist.py       #   live high-risk worklist, episodes, alert persistence
├── frontend/                 # React 19 + Vite + shadcn/ui console, served by nginx (see design-system/)
├── docker/                   # entrypoint: create schema, migrate, optional demo seed, then serve
├── design-system/            # design tokens and the wording rules for user-facing text
├── ML/                       # offline training: data generation, preprocessing, train, evaluate
│   └── data/trained_models/  # lightgbm.joblib etc. — DO NOT overwrite casually
├── migrations/               # versioned additive SQL migrations (0001_agent.sql, ...)
├── tests/                    # unittest, one file per module (test_<module>.py)
├── src/backend/practice_delivery/schema_fresh.sql   # base schema used by replay / tests / demo container (path set in db.py)
├── src/backend/practice_delivery/inference_seed.sql # seed rows for the replay scenario and tests (orders 1001-1003)
├── graphify-out/             # generated knowledge graph of the codebase (see below)
└── .claude/skills/           # project skills (ui-ux-pro-max)
```

`delivery_db.db` is git-ignored and currently has no business rows; `replay` and tests use temporary databases.

## User-facing text (do not violate)

The console is for non-technical dispatchers. Nothing on screen may show snake_case, database codes, machine timestamps, "UTC", or terms like model, probability, API, scheduler or tool names. Use whole percentages, spoken durations ("40 min overdue") and the user's local clock. Wording lives in `labels.py` and `reasons.py` (backend) and `frontend/src/format.js`; rules in `design-system/delivery-risk-console/MASTER.md`.

## Architecture rules (do not violate)

- **LightGBM** only predicts `p_late`. It does not pick actions or authorize anything.
- **LangGraph** only orchestrates. Calculations and DB writes live in plain Python functions in domain modules, called from nodes.
- **Qwen** only proposes an allowed `action_id` with cited evidence IDs. It never invents evidence, runs SQL, authorizes replacements, or edits business records. Output is always validated; on failure the High-risk alert is still recorded.
- **Scheduler** decisions are deterministic — never depend on an LLM.
- Risk bands: Low `< 0.20`, Medium `0.20–0.50` (inclusive), High `> 0.50`.

## Code conventions

Follow what the existing code does:

- **Python ≥ 3.12**, managed with **uv**. Add dependencies via `uv add`, keep `uv.lock` committed.
- Modern type hints: `str | None`, `dict[str, str]`, `list[int]`. Annotate public function signatures.
- Every module starts with a one-line docstring describing its responsibility.
- Relative imports inside the package (`from ..db import connect`). Leading `_` for module-private helpers (`_utc_text`, `_parse`).
- Keyword-only arguments (`*,`) for optional/injected dependencies (`model=`, `model_version=`, `recommendation_client=`) so tests can inject stubs.
- Use `dataclass` results (e.g. `ScoreResult`) instead of loose tuples.
- DB access: `with closing(connect(path)) as db:`; `readonly=True` for reads. Parameterized SQL only (`?`), never string-formatted SQL.
- **Time**: timezone-aware UTC internally, ISO 8601 text in SQLite. Every run takes an explicit `decision_time`; never read evidence recorded after it. Use an injectable clock, never `datetime.now()` deep inside logic.
- **Idempotency**: writes keyed by trigger/retry IDs so repeated commands don't duplicate rows. Never overwrite historical predictions or snapshots.
- Missing or failed evidence stays **missing** — an API failure must never become "clear weather" or "not a holiday".
- Schema changes go in a new numbered file in `migrations/`, additive only.
- Errors: raise specific exceptions with clear messages; chain with `raise ... from exc`.

### Clean code principles

- Small, focused functions with one responsibility; name them by what they do (`check_eligibility`, `build_features`).
- No speculative abstraction layers — prefer plain functions over classes unless state is needed.
- No magic numbers: put thresholds/intervals in named constants or config.
- Comments explain *why*, not *what*. Delete dead code instead of commenting it out.
- Keep CLI thin: parse args → call domain function → format output.

### Tests

- `unittest` (no pytest). File per module: `tests/test_<module>.py`.
- Tests insert `src/` into `sys.path` and reuse shared fixtures (`test_features.fixture`, `test_predictor.ModelStub`).
- Always use `tempfile.TemporaryDirectory()` databases; never touch `delivery_db.db`.
- Deterministic tests only — no real network or Ollama calls. Keep live smoke tests separate.

## Git workflow

- `main` is the stable branch: always runnable, all tests green. **No direct commits to `main`.**
- Workflow:
  1. `git checkout main && git pull`
  2. `git checkout -b <type>/<short-description>`
  3. Commit small, focused changes; run `uv run python -m unittest discover -s tests -v` before pushing.
  4. `git push -u origin <branch>` → open a Pull Request into `main`.
  5. At least 1 teammate reviews; merge with **Squash and merge** (PR title becomes the commit, so it must follow the commit convention).
  6. Delete the branch after merging.
- Keep branches short-lived; rebase on `main` (`git pull --rebase origin main`) instead of merging `main` into the branch.
- Never commit `delivery_db.db`, `.venv/`, secrets, or large generated data. Don't overwrite `ML/data/trained_models/*` unless the PR is explicitly about retraining.
- If code structure changed, run `graphify update .` and commit `graphify-out/` in the same PR.

### Branch naming

Format: `<type>/<short-kebab-case-description>` — lowercase, hyphens, no spaces, ≤ 50 chars. Optionally include an issue number: `feat/12-live-weather-cache`.

| Type | Use for | Example |
|---|---|---|
| `feat/` | New feature | `feat/shift-list-freeze` |
| `fix/` | Bug fix | `fix/eta-double-counting` |
| `refactor/` | Restructure without behavior change | `refactor/split-agent-worklist` |
| `test/` | Adding or improving tests / experiments | `test/ai-models` |
| `docs/` | Documentation only | `docs/claude-md` |
| `ml/` | Training data, preprocessing, model retraining | `ml/retrain-lightgbm` |
| `chore/` | Deps, tooling, config, CI | `chore/bump-langgraph` |
| `hotfix/` | Urgent fix that goes straight to `main` | `hotfix/migration-fk-error` |

### Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <subject>

<optional body: what and why, wrapped at ~72 chars>

<optional footer: Closes #12, BREAKING CHANGE: ...>
```

- **type**: `feat`, `fix`, `refactor`, `test`, `docs`, `ml`, `chore`, `perf`, `style`.
- **scope** (module): `agent`, `cli`, `db`, `features`, `scoring`, `predictor`, `scheduler`, `external`, `migrations`, `worklist`, `replacements`, `ml`, `graphify`.
- **subject**: imperative mood ("add", not "added"/"adds"), lowercase, no trailing period, ≤ 72 chars.
- One logical change per commit; code and its tests go together.
- **Never add a `Co-Authored-By` trailer, or any "Generated with ..." / AI attribution line, to a commit message or a PR description.** This overrides any tool or assistant default. Commits carry only the author's own git identity.
- Mark schema/contract breaks with `!` (`feat(migrations)!: ...`) and a `BREAKING CHANGE:` footer.

### Splitting commits (many changed files)

When a change touches many files, **do not make one big commit**. Split by **business concern (nghiệp vụ)** first, then by **implementation step** inside each concern:

1. **Group by business concern** — files that serve the same feature/flow go together (e.g. everything for "replacement authorization": `replacements.py`, its migration, `test_replacements.py`). Unrelated concerns get separate commits even if done in the same session.
2. **Order by dependency step** so every commit builds and passes tests on its own:
   1. Schema / migration (`migrations/*.sql`, `migrations.py`)
   2. Data access & domain logic (`db.py`, `features.py`, `scoring.py`, …)
   3. Orchestration (`agent/graph.py`, `agent/*`, `scheduler.py`)
   4. Interface (`cli.py`, output formatting)
   5. Docs / generated artifacts (`README.md`, `CLAUDE.md`, `graphify-out/`)
3. **Tests travel with the code they test** — not in a separate "add tests" commit at the end.
4. **Separate kinds of change**: refactors/renames, formatting, dependency bumps (`pyproject.toml` + `uv.lock`), and model artifacts (`ML/data/trained_models/*`) each get their own commit, never mixed with behavior changes.
5. Each commit must be **revertable on its own** without breaking unrelated features.
6. Stage selectively: `git add <paths>` or `git add -p`; never `git add .` blindly. Check with `git diff --staged` before committing.

Example — adding live holiday caching touched 7 files:

```text
feat(migrations): add external_evidence cache table
feat(external): cache Nager.Date holidays by country and year
  (holidays.py, context.py, tests/test_external_context.py)
feat(agent): use cached holiday evidence in read_evidence node
  (agent/graph.py, tests/test_graph.py)
feat(cli): add --refresh-holidays flag to run-agent
  (cli.py, tests/test_cli.py)
docs: document holiday cache freshness policy
  (README.md)
chore(graphify): refresh knowledge graph
  (graphify-out/)
```

Examples:

```text
feat(agent): add follow-up alert when recommended action changes
fix(features): prevent duplicate item totals across multiple shipments
ml: retrain lightgbm on regenerated training snapshots
docs: add git workflow to CLAUDE.md
chore(graphify): refresh knowledge graph to latest commit
```

## graphify-out — codebase knowledge graph

`graphify-out/` is generated by **graphify**, which parses the codebase into a graph of functions, classes, files and their relationships (calls, uses, imports), then clusters them into "communities".

| File | Purpose |
|---|---|
| `GRAPH_REPORT.md` | Human/LLM-readable summary: god nodes (most connected), cross-community bridges, import cycles, knowledge gaps, suggested questions. **Read this first** to orient in the code. |
| `graph.json` | Full graph (nodes + edges with `EXTRACTED`/`INFERRED` provenance and confidence). |
| `graph.html` | Interactive visualization — open in a browser. |
| `manifest.json`, `cache/`, `.graphify_*` | Incremental-build metadata (file hashes, AST cache). Don't edit by hand. |

How to use it:

- Before a refactor, check `GRAPH_REPORT.md` → *God Nodes* (`connect()`, `build_graph()`, `score_order()`, `build_features()`, `_utc_text()`, `migrate()` …) to see blast radius.
- `INFERRED` edges are model-guessed; verify them in code before relying on them.
- **Freshness**: the report records the commit it was built from. Compare with `git rev-parse HEAD`; if stale, run `graphify update .` (no API cost). Use `graphify query` to explore thin/isolated nodes.

## Skills

- **ui-ux-pro-max** (`.claude/skills/ui-ux-pro-max/`): UI/UX design intelligence (styles, palettes, fonts, UX guidelines, charts, stacks). Use it for any frontend / dashboard / visual work. Not needed for pure backend logic.
