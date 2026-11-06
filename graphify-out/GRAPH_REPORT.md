# Graph Report - Delivery_Agent_Support  (2026-11-06)

## Corpus Check
- 127 files · ~198,713 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 54 file(s) not represented in the graph (top: .csv 38, (none) 7, .joblib 2)
- WARNING: 54 of 194 files seen (28%) have no supported extractor and are missing from this graph entirely. It may look complete while representing only part of the codebase.

## Summary
- 1147 nodes · 3434 edges · 51 communities (40 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ed9b0710`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- graph.py
- cli.py
- json
- core.py
- score_order
- sqlite3
- connect
- fixture
- queries.py
- Assistant.jsx
- validate_data.py
- backend
- AlertCard.jsx
- be
- Worklist.jsx
- OrderCase.jsx
- ApiTests
- api.py
- ChatTests
- package.json
- Evidence.jsx
- components.json
- react
- ApiError
- context.jsx
- dropdown-menu.jsx
- design_system.py
- format_ascii_box
- common.jsx
- ApiContext
- _contrast_ratio
- _utc_text
- Automation.jsx
- reasoning_contract.py
- DesignSystemGenerator
- scripts
- .generate
- request_qwen
- replacements.py
- _make_handler
- alert.jsx
- main.jsx
- setup-ollama.sh
- _resolve_color_mode
- init_db.py
- freeze_shift
- compilerOptions
- entrypoint.sh

## God Nodes (most connected - your core abstractions)
1. `connect()` - 45 edges
2. `react` - 40 edges
3. `_utc_text()` - 39 edges
4. `Button()` - 38 edges
5. `fixture()` - 35 edges
6. `ApiTests` - 34 edges
7. `build_graph()` - 31 edges
8. `OrderCase()` - 29 edges
9. `LiveQueue()` - 28 edges
10. `Orders()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `ApiTests` --uses--> `ApiContext`  [INFERRED]
  tests/test_api.py → src/backend/api.py
- `main()` --calls--> `migrate()`  [EXTRACTED]
  docker/init_db.py → src/backend/migrations.py
- `seeded_database()` --calls--> `migrate()`  [EXTRACTED]
  tests/test_api.py → src/backend/migrations.py
- `build_graph()` --uses--> `AgentState`  [INFERRED]
  src/backend/agent/graph.py → src/backend/agent/state.py
- `run_agent()` --uses--> `AgentState`  [INFERRED]
  src/backend/agent/graph.py → src/backend/agent/state.py

## Import Cycles
- None detected.

## Communities (51 total, 11 thin omitted)

### Community 0 - "graph.py"
Cohesion: 0.08
Nodes (9): select_playbooks(), applicable_actions(), AgentState, check_eligibility(), EligibilityResult, load_model(), model_identity(), predict_probability() (+1 more)

### Community 1 - "cli.py"
Cohesion: 0.09
Nodes (12): run_agent(), mock_recommendation(), _approved_line(), _as_of(), _inspect(), main(), main(), next_due_time() (+4 more)

### Community 2 - "json"
Cohesion: 0.07
Nodes (21): compare_models(), evaluate_shift_start(), load_dataset(), make_preprocessor(), prepare_data(), CFG, train_lightgbm(), CFG (+13 more)

### Community 3 - "core.py"
Cohesion: 0.05
Nodes (32): BM25, _contains_phrase(), detect_domain(), _domain_keywords(), _exact_match_diagnostic(), _exact_row_identity(), _exact_stack_identifier(), _file_signature() (+24 more)

### Community 4 - "score_order"
Cohesion: 0.13
Nodes (12): _apply(), _backup(), migrate(), _from_run(), _json(), score_order(), GraphTests, MigrationTests (+4 more)

### Community 6 - "connect"
Cohesion: 0.13
Nodes (21): build_graph(), build_feature_row(), current_evidence(), eligibility(), external_context(), high_worklist(), low_medium(), persist_alert() (+13 more)

### Community 7 - "fixture"
Cohesion: 0.18
Nodes (5): build_features(), FeatureRow, EligibilityTests, FeatureTests, fixture()

### Community 8 - "queries.py"
Cohesion: 0.06
Nodes (46): _age(), _at(), chat_events(), ChatUnavailable, draft_customer_message(), _find_order(), kpi_facts(), _ollama_transport() (+38 more)

### Community 9 - "Assistant.jsx"
Cohesion: 0.09
Nodes (39): AppShell(), OrderSearch(), inline(), Markdownish(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent() (+31 more)

### Community 10 - "validate_data.py"
Cohesion: 0.08
Nodes (41): _catalog_date(), _check_app_interface_contract(), _check_catalog_contract(), _check_catalog_summary(), _check_chart_contract(), _check_color_contract(), _check_core_data_contract(), _check_file() (+33 more)

### Community 14 - "AlertCard.jsx"
Cohesion: 0.12
Nodes (32): Brand(), NAV, NavItems(), RolePicker(), Sidebar(), Button(), buttonVariants, Dialog() (+24 more)

### Community 15 - "be"
Cohesion: 0.06
Nodes (39): build, condition, environment, healthcheck, image, restart, volumes, be (+31 more)

### Community 16 - "Worklist.jsx"
Cohesion: 0.20
Nodes (31): EmptyState(), LoadState(), Notice(), RiskBadge(), StaleBadge(), Time(), Switch(), Table() (+23 more)

### Community 17 - "OrderCase.jsx"
Cohesion: 0.18
Nodes (27): App(), PageHeader(), Pipeline(), Card(), CardContent(), CardDescription(), CardHeader(), CardTitle() (+19 more)

### Community 19 - "api.py"
Cohesion: 0.16
Nodes (23): chat(), _chat_arguments(), chat_stream(), customer_message(), health(), kpis(), meta(), _ollama_status() (+15 more)

### Community 20 - "ChatTests"
Cohesion: 0.17
Nodes (3): ask(), ChatTests, broken()

### Community 21 - "package.json"
Cohesion: 0.10
Nodes (24): dependencies, @fontsource/be-vietnam-pro@^5.3.0, @fontsource-variable/jetbrains-mono@^5.3.0, lucide-react@^1.70.0, next-themes@^0.4.6, react@19.1.0, react-dom@19.1.0, react-router-dom@6.28.0 (+16 more)

### Community 22 - "Evidence.jsx"
Cohesion: 0.14
Nodes (20): Remaining(), arc(), ARCS, Gauge(), point(), bandOf(), CLOCK, DAY_TIME (+12 more)

### Community 23 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 24 - "react"
Cohesion: 0.18
Nodes (10): cn@^0.5.2, radix-ui@^1.8.1, ScrollArea(), ScrollBar(), ToggleGroupContext, Toggle(), toggleVariants, cn (+2 more)

### Community 25 - "ApiError"
Cohesion: 0.19
Nodes (11): ack_alert(), ApiError, authorize_replacement(), create_shift(), decide(), _instant(), refresh_replacement(), _require_order() (+3 more)

### Community 26 - "context.jsx"
Cohesion: 0.19
Nodes (12): api, ApiError, request(), EMPTY, MetaContext, RoleContext, useWords(), fmtPct() (+4 more)

### Community 27 - "dropdown-menu.jsx"
Cohesion: 0.14
Nodes (5): ThemeMenu(), DropdownMenu(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuTrigger()

### Community 28 - "design_system.py"
Cohesion: 0.17
Nodes (6): _detect_page_type(), format_page_override_md(), _generate_intelligent_overrides(), persist_design_system(), safe_slug(), _write_persisted_file()

### Community 29 - "format_ascii_box"
Cohesion: 0.14
Nodes (9): ansi_ljust(), format_ascii_box(), add_wrapped(), wrap_text(), format_markdown(), generate_design_system(), hex_to_ansi(), _mode_support_labels() (+1 more)

### Community 30 - "common.jsx"
Cohesion: 0.19
Nodes (14): BAND, DecisionBadge(), EligibilityBadge(), REMAINING_CLASS, SignalBadge(), Status(), TONES, AlertDescription() (+6 more)

### Community 31 - "ApiContext"
Cohesion: 0.17
Nodes (5): ApiContext, make_server(), _scheduler_loop(), scheduler_tick(), serve()

### Community 32 - "_contrast_ratio"
Cohesion: 0.15
Nodes (7): _button_outline_text_color(), _contrast_ratio(), _derive_dark_palette(), format_master_md(), _palette_is_dark(), _relative_luminance(), _select_palette_for_mode()

### Community 33 - "_utc_text"
Cohesion: 0.23
Nodes (4): record_decision(), _utc_text(), acknowledge_alert(), record_feedback()

### Community 34 - "Automation.jsx"
Cohesion: 0.24
Nodes (8): Automation(), Line(), Popover(), PopoverContent(), PopoverTrigger(), ToggleGroup(), ToggleGroupItem(), STAGES

### Community 35 - "reasoning_contract.py"
Cohesion: 0.21
Nodes (4): apply_decision_rules(), _object_without_duplicates(), parse_decision_rules(), _validate_action()

### Community 37 - "scripts"
Cohesion: 0.18
Nodes (9): devDependencies, vite@5.4.11, @vitejs/plugin-react@4.3.4, scripts, build, dev, preview, vite (+1 more)

### Community 39 - "request_qwen"
Cohesion: 0.27
Nodes (6): recommend(), request_qwen(), validate_recommendation(), main(), local_qwen(), RecommendationTests

### Community 40 - "replacements.py"
Cohesion: 0.29
Nodes (3): approve_replacement(), refresh_replacement_tasks(), ReplacementTests

### Community 41 - "_make_handler"
Cohesion: 0.36
Nodes (7): _make_handler(), _body(), _dispatch(), do_GET(), do_POST(), _send(), _stream()

### Community 42 - "alert.jsx"
Cohesion: 0.28
Nodes (6): class-variance-authority@^0.7.1, Alert(), alertVariants, Badge(), badgeVariants, class-variance-authority

### Community 43 - "main.jsx"
Cohesion: 0.31
Nodes (5): Toaster(), TooltipProvider(), MetaProvider(), RoleProvider(), next-themes

### Community 44 - "setup-ollama.sh"
Cohesion: 0.53
Nodes (8): ensure_cli(), ensure_model(), ensure_server(), log(), run_demo(), server_up(), setup-ollama.sh script, warm_up()

### Community 45 - "_resolve_color_mode"
Cohesion: 0.33
Nodes (3): _query_wants_dark(), _resolve_color_mode(), _style_is_dark_primary()

### Community 48 - "compilerOptions"
Cohesion: 0.40
Nodes (4): compilerOptions, baseUrl, paths, include

## Knowledge Gaps
- **1 isolated node(s):** `backend`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 324 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connect()` connect `connect` to `graph.py`, `cli.py`, `json`, `score_order`, `sqlite3`, `queries.py`, `replacements.py`, `api.py`, `ChatTests`, `ApiError`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `backend` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `graph.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07926829268292683 - nodes in this community are weakly interconnected._
- **Why does `_utc_text()` connect `_utc_text` to `graph.py`, `cli.py`, `json`, `score_order`, `connect`, `fixture`, `queries.py`, `replacements.py`, `freeze_shift`, `api.py`, `ApiContext`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `cli.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08819345661450925 - nodes in this community are weakly interconnected._
- **Why does `ApiTests` connect `ApiTests` to `sqlite3`, `ApiContext`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `json` be split into smaller, more focused modules?**
  _Cohesion score 0.06861239119303636 - nodes in this community are weakly interconnected._