# Graph Report - backend  (2026-11-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 287 nodes · 880 edges · 14 communities (10 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `468cc243`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 13

## God Nodes (most connected - your core abstractions)
1. `connect()` - 38 edges
2. `fixture()` - 35 edges
3. `build_graph()` - 29 edges
4. `_utc_text()` - 27 edges
5. `score_order()` - 26 edges
6. `ModelStub` - 24 edges
7. `main()` - 24 edges
8. `build_features()` - 22 edges
9. `migrate()` - 22 edges
10. `check_eligibility()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `build_graph()` --uses--> `AgentState`  [INFERRED]
  src/backend/agent/graph.py → src/backend/agent/state.py
- `run_agent()` --uses--> `AgentState`  [INFERRED]
  src/backend/agent/graph.py → src/backend/agent/state.py
- `read_evidence()` --calls--> `connect()`  [EXTRACTED]
  src/backend/agent/graph.py → src/backend/db.py
- `build_graph()` --calls--> `ScoreResult`  [EXTRACTED]
  src/backend/agent/graph.py → src/backend/scoring.py
- `persist_alert()` --calls--> `ScoreResult`  [EXTRACTED]
  src/backend/agent/graph.py → src/backend/scoring.py

## Import Cycles
- None detected.

## Communities (14 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (16): high_worklist(), AgentState, close_monitoring(), ensure_high_risk(), persist_recommendation_and_alert(), preview_high_risk(), _write_high_risk(), check_eligibility() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (11): _approved_line(), _as_of(), _inspect(), main(), _mock_recommendation(), acknowledge_alert(), record_feedback(), approve_replacement() (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (12): _fetch_json(), get_context(), live_enrich(), _scope(), _scope_json(), holiday_url(), validate_holidays(), classify_weather() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (9): compare_models(), evaluate_shift_start(), load_dataset(), make_preprocessor(), prepare_data(), CFG, train_lightgbm(), CFG (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (11): connect(), _apply(), _backup(), migrate(), GraphTests, MigrationTests, ModelStub, SchedulerRunnerTests (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (17): build_graph(), build_feature_row(), current_evidence(), eligibility(), external_context(), low_medium(), persist_alert(), read_evidence() (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.19
Nodes (5): build_features(), FeatureRow, EligibilityTests, FeatureTests, fixture()

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (5): load_model(), model_identity(), predict_probability(), risk_band(), PredictorTests

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (4): next_due_time(), scheduler_loop(), scheduler_once(), SchedulerTests

### Community 10 - "Community 10"
Cohesion: 0.33
Nodes (3): generate_dataset(), utc_text(), write_csv()

## Knowledge Gaps
- **1 isolated node(s):** `backend`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 75 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connect()` connect `Community 4` to `Community 0`, `Community 1`, `Community 2`, `Community 5`, `Community 6`, `Community 9`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `build_graph()` (e.g. with `build_feature_row()` and `current_evidence()`) actually correct?**
  _`build_graph()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `backend` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10372340425531915 - nodes in this community are weakly interconnected._
- **Why does `score_order()` connect `Community 0` to `Community 1`, `Community 4`, `Community 6`, `Community 7`, `Community 8`, `Community 9`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10160427807486631 - nodes in this community are weakly interconnected._
- **Why does `fixture()` connect `Community 7` to `Community 1`, `Community 2`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._