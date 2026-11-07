# Graph Report - Delivery_Agent_Support  (2026-11-07)

## Corpus Check
- 143 files · ~205,991 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 51 file(s) not represented in the graph (top: .csv 38, (none) 7, .joblib 2)
- WARNING: 51 of 207 files seen (25%) have no supported extractor and are missing from this graph entirely. It may look complete while representing only part of the codebase.

## Summary
- 1340 nodes · 3992 edges · 55 communities (38 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6377af28`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _utc_text
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
- ChatTests
- ApiTests
- api.py
- chatbot/graph.py
- package.json
- OrderCase.jsx
- components.json
- react
- conversation.py
- run_agent
- dropdown-menu.jsx
- design_system.py
- format_ascii_box
- common.jsx
- drafts.py
- _contrast_ratio
- persistence.py
- ApiContext
- context.jsx
- DesignSystemGenerator
- _utc_text
- .generate
- setup-ollama.sh
- _resolve_color_mode
- compilerOptions
- replacements.py
- entrypoint.sh
- Gauge.jsx
- _button_outline_text_color
- chat_stream

## God Nodes (most connected - your core abstractions)
1. `ChatTests` - 67 edges
2. `connect()` - 57 edges
3. `_utc_text()` - 48 edges
4. `react` - 40 edges
5. `Button()` - 38 edges
6. `ApiTests` - 35 edges
7. `fixture()` - 35 edges
8. `build_graph()` - 30 edges
9. `OrderCase()` - 29 edges
10. `LiveQueue()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `ApiTests` --uses--> `ApiContext`  [INFERRED]
  tests/test_api.py → src/backend/api.py
- `ChatTests` --uses--> `ToolError`  [INFERRED]
  tests/test_chatbot.py → src/backend/chatbot/tools.py
- `main()` --calls--> `migrate()`  [EXTRACTED]
  docker/init_db.py → src/backend/migrations.py
- `seeded_database()` --calls--> `migrate()`  [EXTRACTED]
  tests/test_api.py → src/backend/migrations.py
- `ShipmentsCard()` --calls--> `Pipeline()`  [EXTRACTED]
  frontend/src/views/OrderCase.jsx → frontend/src/components/Pipeline.jsx

## Import Cycles
- 3-file cycle: `src/backend/chatbot/__init__.py -> src/backend/chatbot/conversation.py -> src/backend/chatbot/tools.py -> src/backend/chatbot/__init__.py`
- 4-file cycle: `src/backend/chatbot/__init__.py -> src/backend/chatbot/conversation.py -> src/backend/chatbot/graph.py -> src/backend/chatbot/tools.py -> src/backend/chatbot/__init__.py`

## Communities (55 total, 17 thin omitted)

### Community 0 - "_utc_text"
Cohesion: 0.10
Nodes (9): check_eligibility(), EligibilityResult, FeatureRow, model_identity(), _from_run(), _json(), score_order(), freeze_shift() (+1 more)

### Community 1 - "cli.py"
Cohesion: 0.12
Nodes (9): _approved_line(), _as_of(), _inspect(), main(), next_due_time(), scheduler_loop(), scheduler_once(), CLITests (+1 more)

### Community 2 - "json"
Cohesion: 0.06
Nodes (22): compare_models(), evaluate_shift_start(), load_dataset(), make_preprocessor(), prepare_data(), CFG, train_lightgbm(), CFG (+14 more)

### Community 3 - "core.py"
Cohesion: 0.06
Nodes (31): BM25, _contains_phrase(), detect_domain(), _domain_keywords(), _exact_match_diagnostic(), _exact_row_identity(), _exact_stack_identifier(), _file_signature() (+23 more)

### Community 4 - "score_order"
Cohesion: 0.13
Nodes (11): _apply(), _backup(), migrate(), _migration_files(), GraphTests, MigrationTests, ModelStub, SchedulerRunnerTests (+3 more)

### Community 5 - "sqlite3"
Cohesion: 0.17
Nodes (4): _is_empty(), main(), main(), seeded_database()

### Community 6 - "connect"
Cohesion: 0.17
Nodes (16): build_graph(), build_feature_row(), current_evidence(), eligibility(), external_context(), high_worklist(), low_medium(), persist_alert() (+8 more)

### Community 7 - "fixture"
Cohesion: 0.18
Nodes (5): build_features(), ExternalContextTests, fake_fetch(), FeatureTests, fixture()

### Community 8 - "queries.py"
Cohesion: 0.07
Nodes (46): _age(), _at(), kpi_facts(), order_facts(), orders_facts(), _recommendation_lines(), _risk_lines(), _shipment_line() (+38 more)

### Community 9 - "Assistant.jsx"
Cohesion: 0.09
Nodes (42): App(), AppShell(), inline(), Markdownish(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent() (+34 more)

### Community 10 - "validate_data.py"
Cohesion: 0.07
Nodes (44): _object_without_duplicates(), parse_decision_rules(), _validate_action(), _catalog_date(), _check_app_interface_contract(), _check_catalog_contract(), _check_catalog_summary(), _check_chart_contract() (+36 more)

### Community 14 - "AlertCard.jsx"
Cohesion: 0.11
Nodes (33): Brand(), NAV, NavItems(), OrderSearch(), RolePicker(), Sidebar(), Pipeline(), Dialog() (+25 more)

### Community 15 - "be"
Cohesion: 0.06
Nodes (39): build, condition, environment, healthcheck, image, restart, volumes, be (+31 more)

### Community 16 - "Worklist.jsx"
Cohesion: 0.16
Nodes (33): EmptyState(), PageHeader(), Remaining(), RiskBadge(), StaleBadge(), Switch(), Table(), TableBody() (+25 more)

### Community 17 - "ChatTests"
Cohesion: 0.08
Nodes (4): ask(), call(), ChatTests, broken()

### Community 19 - "api.py"
Cohesion: 0.13
Nodes (30): ack_alert(), ApiError, authorize_replacement(), chat(), create_shift(), decide(), health(), _instant() (+22 more)

### Community 20 - "chatbot/graph.py"
Cohesion: 0.07
Nodes (33): build_chat_graph(), act(), after_think(), correct_calls(), execute(), fallback(), guard(), missing_calls() (+25 more)

### Community 21 - "package.json"
Cohesion: 0.07
Nodes (36): dependencies, class-variance-authority@^0.7.1, cn@^0.5.2, @fontsource/be-vietnam-pro@^5.3.0, @fontsource-variable/jetbrains-mono@^5.3.0, lucide-react@^1.70.0, next-themes@^0.4.6, radix-ui@^1.8.1 (+28 more)

### Community 22 - "OrderCase.jsx"
Cohesion: 0.19
Nodes (29): LoadState(), Time(), Card(), CardContent(), CardDescription(), CardHeader(), CardTitle(), Tabs() (+21 more)

### Community 23 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 24 - "react"
Cohesion: 0.11
Nodes (18): Automation(), Line(), Popover(), PopoverContent(), PopoverTrigger(), ScrollArea(), ScrollBar(), TabsList() (+10 more)

### Community 25 - "conversation.py"
Cohesion: 0.15
Nodes (10): chat_events(), _earlier_questions(), _initial_messages(), _order_reference(), _remember(), run_chat(), build_system_prompt(), detect_answer_language() (+2 more)

### Community 26 - "run_agent"
Cohesion: 0.10
Nodes (10): recommend(), run_agent(), mock_recommendation(), _grounded_summary(), request_qwen(), validate_recommendation(), main(), local_qwen() (+2 more)

### Community 27 - "dropdown-menu.jsx"
Cohesion: 0.14
Nodes (5): ThemeMenu(), DropdownMenu(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuTrigger()

### Community 28 - "design_system.py"
Cohesion: 0.13
Nodes (7): _detect_page_type(), format_page_override_md(), _generate_intelligent_overrides(), persist_design_system(), safe_slug(), _write_persisted_file(), format_output()

### Community 29 - "format_ascii_box"
Cohesion: 0.14
Nodes (9): ansi_ljust(), format_ascii_box(), add_wrapped(), wrap_text(), format_markdown(), generate_design_system(), hex_to_ansi(), _mode_support_labels() (+1 more)

### Community 30 - "common.jsx"
Cohesion: 0.10
Nodes (30): BAND, DecisionBadge(), EligibilityBadge(), Notice(), REMAINING_CLASS, SignalBadge(), Status(), TONES (+22 more)

### Community 31 - "drafts.py"
Cohesion: 0.11
Nodes (8): _chat_arguments(), customer_message(), validate_messages(), ChatUnavailable, draft_customer_message(), valid_chat_id(), ollama_transport(), send()

### Community 32 - "_contrast_ratio"
Cohesion: 0.22
Nodes (5): _contrast_ratio(), _derive_dark_palette(), _palette_is_dark(), _relative_luminance(), _select_palette_for_mode()

### Community 33 - "persistence.py"
Cohesion: 0.12
Nodes (13): persist_recommendation_and_alert(), previous_valid_action(), recommendation_for_run(), save_recommendation(), AgentState, close_monitoring(), ensure_high_risk(), preview_high_risk() (+5 more)

### Community 34 - "ApiContext"
Cohesion: 0.12
Nodes (12): ApiContext, _make_handler(), _body(), _dispatch(), do_GET(), do_POST(), _send(), _stream() (+4 more)

### Community 35 - "context.jsx"
Cohesion: 0.16
Nodes (11): api, ApiError, request(), Toaster(), TooltipProvider(), EMPTY, MetaContext, MetaProvider() (+3 more)

### Community 37 - "_utc_text"
Cohesion: 0.19
Nodes (5): acknowledge_alert(), record_feedback(), finish(), record_decision(), _utc_text()

### Community 44 - "setup-ollama.sh"
Cohesion: 0.53
Nodes (8): ensure_cli(), ensure_model(), ensure_server(), log(), run_demo(), server_up(), setup-ollama.sh script, warm_up()

### Community 45 - "_resolve_color_mode"
Cohesion: 0.33
Nodes (3): _query_wants_dark(), _resolve_color_mode(), _style_is_dark_primary()

### Community 48 - "compilerOptions"
Cohesion: 0.40
Nodes (4): compilerOptions, baseUrl, paths, include

### Community 49 - "replacements.py"
Cohesion: 0.25
Nodes (3): approve_replacement(), refresh_replacement_tasks(), ReplacementTests

### Community 51 - "Gauge.jsx"
Cohesion: 0.60
Nodes (5): arc(), ARCS, Gauge(), point(), bandOf()

## Knowledge Gaps
- **1 isolated node(s):** `backend`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 385 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connect()` connect `connect` to `persistence.py`, `cli.py`, `score_order`, `sqlite3`, `fixture`, `queries.py`, `ChatTests`, `ApiTests`, `api.py`, `chatbot/graph.py`, `replacements.py`, `conversation.py`, `run_agent`, `drafts.py`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `backend` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `_utc_text` be split into smaller, more focused modules?**
  _Cohesion score 0.10080645161290322 - nodes in this community are weakly interconnected._
- **Why does `ChatTests` connect `ChatTests` to `run_agent`, `chatbot/graph.py`, `sqlite3`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `cli.py` be split into smaller, more focused modules?**
  _Cohesion score 0.12169312169312169 - nodes in this community are weakly interconnected._
- **Why does `ApiTests` connect `ApiTests` to `ApiContext`, `sqlite3`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `json` be split into smaller, more focused modules?**
  _Cohesion score 0.06277436347673397 - nodes in this community are weakly interconnected._