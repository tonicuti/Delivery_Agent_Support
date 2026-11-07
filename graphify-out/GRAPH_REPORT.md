# Graph Report - Delivery_Agent_Support  (2026-11-07)

## Corpus Check
- 141 files · ~205,053 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 54 file(s) not represented in the graph (top: .csv 38, (none) 7, .joblib 2)
- WARNING: 54 of 208 files seen (26%) have no supported extractor and are missing from this graph entirely. It may look complete while representing only part of the codebase.

## Summary
- 1326 nodes · 3953 edges · 50 communities (36 shown, 14 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e1ecd25f`
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
- tools.py
- dropdown-menu.jsx
- persist_design_system
- format_ascii_box
- common.jsx
- drafts.py
- _contrast_ratio
- persistence.py
- design_system.py
- history.py
- DesignSystemGenerator
- _generate_intelligent_overrides
- .generate
- setup-ollama.sh
- _resolve_color_mode
- compilerOptions
- entrypoint.sh

## God Nodes (most connected - your core abstractions)
1. `ChatTests` - 67 edges
2. `connect()` - 56 edges
3. `_utc_text()` - 48 edges
4. `react` - 40 edges
5. `Button()` - 38 edges
6. `ApiTests` - 35 edges
7. `fixture()` - 35 edges
8. `build_graph()` - 30 edges
9. `OrderCase()` - 29 edges
10. `chat_events()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `ApiTests` --uses--> `ApiContext`  [INFERRED]
  tests/test_api.py → src/backend/api.py
- `ChatTests` --uses--> `ToolError`  [INFERRED]
  tests/test_chatbot.py → src/backend/chatbot/tools.py
- `main()` --calls--> `migrate()`  [EXTRACTED]
  docker/init_db.py → src/backend/migrations.py
- `seeded_database()` --calls--> `migrate()`  [EXTRACTED]
  tests/test_api.py → src/backend/migrations.py
- `build_chat_graph()` --uses--> `ToolError`  [INFERRED]
  src/backend/chatbot/graph.py → src/backend/chatbot/tools.py

## Import Cycles
- 3-file cycle: `src/backend/chatbot/__init__.py -> src/backend/chatbot/conversation.py -> src/backend/chatbot/tools.py -> src/backend/chatbot/__init__.py`
- 4-file cycle: `src/backend/chatbot/__init__.py -> src/backend/chatbot/conversation.py -> src/backend/chatbot/graph.py -> src/backend/chatbot/tools.py -> src/backend/chatbot/__init__.py`

## Communities (50 total, 14 thin omitted)

### Community 0 - "_utc_text"
Cohesion: 0.09
Nodes (14): check_eligibility(), EligibilityResult, _parse_utc(), _utc_text(), model_identity(), next_due_time(), scheduler_loop(), scheduler_once() (+6 more)

### Community 1 - "cli.py"
Cohesion: 0.11
Nodes (9): mock_recommendation(), _approved_line(), _as_of(), _inspect(), main(), approve_replacement(), refresh_replacement_tasks(), CLITests (+1 more)

### Community 2 - "json"
Cohesion: 0.06
Nodes (24): compare_models(), evaluate_shift_start(), load_dataset(), make_preprocessor(), prepare_data(), CFG, train_lightgbm(), CFG (+16 more)

### Community 3 - "core.py"
Cohesion: 0.06
Nodes (31): BM25, _contains_phrase(), detect_domain(), _domain_keywords(), _exact_match_diagnostic(), _exact_row_identity(), _exact_stack_identifier(), _file_signature() (+23 more)

### Community 4 - "score_order"
Cohesion: 0.14
Nodes (10): _apply(), _backup(), migrate(), _migration_files(), GraphTests, MigrationTests, ModelStub, SchedulerRunnerTests (+2 more)

### Community 5 - "sqlite3"
Cohesion: 0.17
Nodes (4): _is_empty(), main(), main(), seeded_database()

### Community 6 - "connect"
Cohesion: 0.09
Nodes (24): build_graph(), build_feature_row(), current_evidence(), eligibility(), external_context(), high_worklist(), low_medium(), persist_alert() (+16 more)

### Community 7 - "fixture"
Cohesion: 0.27
Nodes (4): build_features(), FeatureRow, FeatureTests, fixture()

### Community 8 - "queries.py"
Cohesion: 0.09
Nodes (41): _age(), _at(), kpi_facts(), order_facts(), orders_facts(), _recommendation_lines(), _risk_lines(), _shipment_line() (+33 more)

### Community 9 - "Assistant.jsx"
Cohesion: 0.09
Nodes (43): AppShell(), Brand(), NAV, NavItems(), OrderSearch(), Sidebar(), inline(), Markdownish() (+35 more)

### Community 10 - "validate_data.py"
Cohesion: 0.07
Nodes (44): _object_without_duplicates(), parse_decision_rules(), _validate_action(), _catalog_date(), _check_app_interface_contract(), _check_catalog_contract(), _check_catalog_summary(), _check_chart_contract() (+36 more)

### Community 14 - "AlertCard.jsx"
Cohesion: 0.10
Nodes (35): api, ApiError, request(), RolePicker(), Dialog(), DialogContent(), DialogDescription(), DialogFooter() (+27 more)

### Community 15 - "be"
Cohesion: 0.06
Nodes (39): build, condition, environment, healthcheck, image, restart, volumes, be (+31 more)

### Community 16 - "Worklist.jsx"
Cohesion: 0.18
Nodes (36): App(), EmptyState(), LoadState(), PageHeader(), RiskBadge(), Time(), Card(), Switch() (+28 more)

### Community 17 - "ChatTests"
Cohesion: 0.08
Nodes (4): ask(), call(), ChatTests, broken()

### Community 19 - "api.py"
Cohesion: 0.05
Nodes (50): acknowledge_alert(), record_feedback(), ack_alert(), ApiContext, ApiError, authorize_replacement(), chat(), _chat_arguments() (+42 more)

### Community 20 - "chatbot/graph.py"
Cohesion: 0.10
Nodes (22): build_chat_graph(), act(), after_think(), correct_calls(), execute(), fallback(), finish(), guard() (+14 more)

### Community 21 - "package.json"
Cohesion: 0.06
Nodes (41): dependencies, class-variance-authority@^0.7.1, cn@^0.5.2, @fontsource/be-vietnam-pro@^5.3.0, @fontsource-variable/jetbrains-mono@^5.3.0, lucide-react@^1.70.0, next-themes@^0.4.6, radix-ui@^1.8.1 (+33 more)

### Community 22 - "OrderCase.jsx"
Cohesion: 0.11
Nodes (44): Remaining(), StaleBadge(), arc(), ARCS, Gauge(), point(), Pipeline(), CardContent() (+36 more)

### Community 23 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 24 - "react"
Cohesion: 0.09
Nodes (18): Automation(), Line(), buttonVariants, Popover(), PopoverContent(), PopoverTrigger(), ScrollArea(), ScrollBar() (+10 more)

### Community 25 - "conversation.py"
Cohesion: 0.14
Nodes (11): chat_events(), _earlier_questions(), _initial_messages(), _order_reference(), _remember(), run_chat(), validate_messages(), build_system_prompt() (+3 more)

### Community 26 - "tools.py"
Cohesion: 0.19
Nodes (12): _chat_history(), _coerce(), _list_orders(), _order_details(), _order_reference(), _order_timeline(), run_tool(), _simple() (+4 more)

### Community 27 - "dropdown-menu.jsx"
Cohesion: 0.14
Nodes (5): ThemeMenu(), DropdownMenu(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuTrigger()

### Community 28 - "persist_design_system"
Cohesion: 0.18
Nodes (5): _button_outline_text_color(), format_master_md(), persist_design_system(), safe_slug(), _write_persisted_file()

### Community 29 - "format_ascii_box"
Cohesion: 0.22
Nodes (6): ansi_ljust(), format_ascii_box(), add_wrapped(), wrap_text(), hex_to_ansi(), section_header()

### Community 30 - "common.jsx"
Cohesion: 0.14
Nodes (20): BAND, DecisionBadge(), EligibilityBadge(), Notice(), REMAINING_CLASS, SignalBadge(), Status(), TONES (+12 more)

### Community 31 - "drafts.py"
Cohesion: 0.18
Nodes (4): ChatUnavailable, draft_customer_message(), ollama_transport(), send()

### Community 32 - "_contrast_ratio"
Cohesion: 0.22
Nodes (5): _contrast_ratio(), _derive_dark_palette(), _palette_is_dark(), _relative_luminance(), _select_palette_for_mode()

### Community 33 - "persistence.py"
Cohesion: 0.12
Nodes (13): persist_recommendation_and_alert(), previous_valid_action(), recommendation_for_run(), save_recommendation(), close_monitoring(), ensure_high_risk(), preview_high_risk(), write_high_risk() (+5 more)

### Community 34 - "design_system.py"
Cohesion: 0.21
Nodes (4): format_markdown(), generate_design_system(), _mode_support_labels(), format_output()

### Community 35 - "history.py"
Cohesion: 0.25
Nodes (4): history_facts(), _like(), record_turn(), _snippet()

### Community 37 - "_generate_intelligent_overrides"
Cohesion: 0.33
Nodes (3): _detect_page_type(), format_page_override_md(), _generate_intelligent_overrides()

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
  These have ≤1 connection - possible missing edges. (Counts symbols only; 377 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ApiTests` connect `ApiTests` to `api.py`, `sqlite3`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `connect()` (e.g. with `.test_chat_turns_are_kept_when_the_page_names_the_chat()` and `.saved()`) actually correct?**
  _`connect()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `backend` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `_utc_text` be split into smaller, more focused modules?**
  _Cohesion score 0.08686868686868687 - nodes in this community are weakly interconnected._
- **Why does `connect()` connect `connect` to `_utc_text`, `cli.py`, `json`, `history.py`, `score_order`, `sqlite3`, `persistence.py`, `ChatTests`, `ApiTests`, `api.py`, `chatbot/graph.py`, `conversation.py`, `tools.py`, `drafts.py`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `cli.py` be split into smaller, more focused modules?**
  _Cohesion score 0.1053763440860215 - nodes in this community are weakly interconnected._
- **Why does `ChatTests` connect `ChatTests` to `cli.py`, `tools.py`, `sqlite3`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._