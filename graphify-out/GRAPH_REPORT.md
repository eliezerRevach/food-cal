# Graph Report - food cal  (2026-07-22)

## Corpus Check
- 86 files · ~42,797 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 987 nodes · 2062 edges · 98 communities (41 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fb195288`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 90
- resolve_item_for_db
- test_manual_presets_and_history_suggest.py
- Hybrid calorie app — architecture
- expose_unhandled_errors
- clsx

## God Nodes (most connected - your core abstractions)
1. `FoodLookupResult` - 40 edges
2. `cn()` - 34 edges
3. `log_meal()` - 24 edges
4. `ManualFoodInput()` - 20 edges
5. `RecipeIngredientInput` - 19 edges
6. `_pick_best_off_product()` - 18 edges
7. `DailyLog()` - 18 edges
8. `compilerOptions` - 18 edges
9. `getApiBaseUrl()` - 17 edges
10. `_try_resolve_single_structured()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `test_fdc_style_head_fallback_resolves_without_meal_llm()` --calls--> `FoodLookupResult`  [EXTRACTED]
  tests/test_log_meal_and_daily_summary.py → app/food_types.py
- `test_fdc_style_usda_line_resolves_without_llm()` --calls--> `FoodLookupResult`  [EXTRACTED]
  tests/test_log_meal_and_daily_summary.py → app/food_types.py
- `test_validate_food_result_with_llm_requires_sanity_model_env()` --calls--> `FoodLookupResult`  [EXTRACTED]
  tests/test_log_meal_and_daily_summary.py → app/food_types.py
- `test_resolve_exact_hebrew_lexicon_calls_lookup_with_english()` --calls--> `FoodLookupResult`  [EXTRACTED]
  tests/test_resolve_structured.py → app/food_types.py
- `test_resolve_latin_phrase_direct_lookup()` --calls--> `FoodLookupResult`  [EXTRACTED]
  tests/test_resolve_structured.py → app/food_types.py

## Import Cycles
- None detected.

## Communities (98 total, 57 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (73): ChatInput(), ChatInputProps, SuggestionRow, emptyIngredientRow(), IngredientRowEditor(), IngredientRowEditorProps, IngredientRowState, rowHasValidNumbers() (+65 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (77): FoodLookupResult, baseline_context(), _baseline_meta(), _baseline_row(), BaselineMeta, _category_from_off_product(), _category_match_penalty(), _choose_primary_by_anchor() (+69 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (48): MonkeyPatch, API contract: POST /log-meal then GET /get-daily-summary for `today`.  These t, Restaurant-style text uses LLM JSON; summary uses the same primary calories as t, Single English 'apple' → DB/OFF path (~100 kcal typical portion); LLM must not r, Single English 'banana' → DB/stub path; LLM must not run., `2 bananas` should use deterministic count*serving and avoid meal LLM., 200g scale weight × 0.6 edible yield → 120g for kcal; matches stub 165 kcal/100g, Single English 'tomato' uses deterministic medium-unit serving from resolver pat (+40 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (23): _finalize_item(), meal_needs_estimate_heuristic(), _normalize_item_string(), parse_local_meal(), _parse_one_segment(), Rule-based parsing for structured `Ng food` segments (comma-separated)., True if wording suggests preparation, extra fat, or vague portions (route to LLM, Return list of (grams, raw_item) or None if text is not fully structured. (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (22): _db_path(), _entries_column_names(), find_food_by_name(), _food_baselines_column_names(), _foods_column_names(), get_connection(), get_food_baseline(), _init_schema() (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (33): agent_log(), Session debug NDJSON (agent instrumentation)., _assistant_text(), _extract_llm_reply_text(), _first_json_object(), food_query_from_phrase_llm(), FoodSanityVerdict, _openrouter_http_error_message() (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (33): ApiEntryRow, apiFetch(), apiJson(), BackupImportResult, BackupServerPayload, deleteEntryRemote(), deleteManualPresetRemote(), enqueueLogMealJob() (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (24): contains_hebrew_script(), english_bare_query_name(), english_counted_bare_query(), english_food_query_for_hebrew_bare(), fdc_style_single_food_query(), _fdc_tail_matches_usda_style(), normalize_food_input(), Hebrew food phrases → English canonical name for DB lookup (lexicon only, no LLM (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (29): get_daily_summary(), _bare_serving_with_baseline(), _baseline_serving_grams(), daily_summary(), _display_name_for_entry(), _fetch_entry(), _grams_rollups_for_entries(), _history_food_signature() (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (7): FoodSuggestResponse, get_food_suggest(), USDA FDC search hit descriptions for meal input autocomplete (search-only)., True when FDC autocomplete/search can run (same guards as `search_food_names_usd, USDA FDC search only — descriptions from `foods/search`, no per-food GET (for au, search_food_names_usda(), usda_fdc_suggest_enabled()

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (29): devDependencies, tailwindcss, @tailwindcss/vite, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react (+21 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (24): _drain_queue(), _process_one_job(), MonkeyPatch, Tests for the async meal log job queue: POST/GET /log-meal/jobs., After the worker processes a job, status becomes done and entry_id is set., After job is done, the resulting entry appears in GET /entries., Remove any leftover items from the module-level queue (test isolation)., GET /log-meal/jobs?date=... returns queued/processing jobs for that date. (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (17): PendingFoodEntryCard(), PendingFoodEntryCardProps, Card(), CardContent(), CardDescription(), CardHeader(), CardTitle(), buildChartDay() (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (25): get_recipe_by_id(), get_recipes(), _ingredients_from_body(), post_recipe(), put_recipe(), RecipeBody, create_recipe(), export_recipes_for_backup() (+17 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (18): create_job(), get_job(), _get_job_payload(), _job_row_to_dict(), list_active_jobs_for_date(), Any, Row, Async FIFO queue for meal log jobs.  Flow:   POST /log-meal/jobs  → insert ro (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.23
Nodes (14): effective_grams(), lookup_yield(), normalize_label(), Connection, Longest-phrase match for bone-in / yield rules (portion_yield_rules in SQLite)., Return (edible_ratio, bone_in) if `label` contains a seeded phrase, longest phra, Scale grams by edible_ratio when a rule matches; pass through None or non-finite, portion_yield: longest phrase match and effective grams. (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (26): Dashboard(), buildHistoryRows(), calendarDaysBetweenEarlierAndLater(), History(), HistoryRow, relativeDayBadge(), BackupImportMode, addHistoryPinDate() (+18 more)

### Community 18 - "Community 18"
Cohesion: 0.21
Nodes (15): BackupEntryExport, BackupImportBody, BackupItemExport, BackupManualPresetExport, BackupRecipeExport, BackupRecipeIngredientExport, export_backup(), _finite_nonneg() (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (25): Close and drop the singleton so the next get_connection() is fresh (for :memory:, reset_for_testing(), bare_serving_grams(), Row, Bare-meal portions for one implicit unit (e.g. plain "apple").  Data-driven on, Return implicit single-unit grams from row metadata., is_likely_mass_reference_100g(), Shared value objects for food resolution. (+17 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (15): embla-carousel-react, dependencies, embla-carousel-react, @radix-ui/react-aspect-ratio, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-select, @radix-ui/react-separator (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.26
Nodes (14): _apply_baselines(), _apply_foods(), _ensure_repo_path(), _load_dotenv(), _load_rows(), main(), _normalize_row(), _parse_float() (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (16): _apply_sanity_verdict(), _maybe_apply_llm_sanity_guardrail(), _maybe_repair_cached_row(), Connection, Row, Resolve a normalized food name: SQLite cache kept in sync with USDA + Open Food, Return a `foods` row, refreshing from APIs whenever `lookup_food` succeeds., resolve_food_row() (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (27): enqueue_log_meal_job(), EnqueueJobBody, get_entries(), get_entries_rollups(), get_meal_job_status(), lifespan(), list_active_meal_jobs(), LogRecipeBody (+19 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (12): get_history_food_suggest(), HistoryFoodSuggestResponse, LogMealBody, LogMealManualBody, ManualPresetBody, ParseIngredientBody, post_log_meal(), post_manual_preset() (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, skipLibCheck, target, include, ES2023 (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (5): WebSpeechRecognition, WebSpeechRecognitionConstructor, WebSpeechRecognitionErrorEvent, WebSpeechRecognitionResultEvent, Window

### Community 28 - "Community 28"
Cohesion: 0.36
Nodes (6): MonkeyPatch, GET /entries, DELETE /entries/{id}, GET /entries-rollups., test_delete_entry_removes_row(), test_entries_rollups_groups_by_day(), test_get_entries_grams_partial_when_some_items_missing_grams(), test_get_entries_lists_logged_meal()

### Community 29 - "Community 29"
Cohesion: 0.47
Nodes (3): App(), Toaster(), router

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (3): MonkeyPatch, GET /food-suggest — USDA search name hints., test_food_suggest_returns_suggestions()

### Community 32 - "Community 32"
Cohesion: 0.40
Nodes (4): MonkeyPatch, GET /backup/export, POST /backup/import., test_export_import_round_trip_append(), test_import_replace_clears_then_restores()

### Community 61 - "Community 61"
Cohesion: 0.28
Nodes (12): get_manual_presets(), export_manual_presets_for_backup(), import_manual_presets_from_backup(), list_manual_presets(), _preset_signature(), Any, Server-persisted manual food presets (Save to List)., Upsert presets from backup; returns count of rows written/updated. (+4 more)

### Community 84 - "Community 84"
Cohesion: 0.14
Nodes (19): FoodEntry(), FoodEntryProps, Popover(), PopoverContent(), PopoverTrigger(), Tabs(), TabsContent(), TabsList() (+11 more)

### Community 93 - "resolve_item_for_db"
Cohesion: 0.26
Nodes (10): Connection, Row, Map a structured segment food phrase (from parse_local) to a foods row and displ, Return (display_label, lookup_query, foods row) or None if the DB cannot resolve, resolve_item_for_db(), MonkeyPatch, resolve_item_for_db: lexicon and Latin DB paths (no LLM translation)., test_resolve_exact_hebrew_lexicon_calls_lookup_with_english() (+2 more)

### Community 95 - "Hybrid calorie app — architecture"
Cohesion: 0.33
Nodes (5): Food data sources and bulk import, Hybrid calorie app — architecture, LLM JSON: calories + uncertainty (for the user), Log meal flow, System context

### Community 96 - "expose_unhandled_errors"
Cohesion: 0.67
Nodes (3): expose_unhandled_errors(), Return JSON {detail: ...} for bugs instead of a blank 500 (helps UI + debug)., Request

## Knowledge Gaps
- **138 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+133 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FoodLookupResult` connect `Community 1` to `Community 2`, `Community 5`, `Community 19`, `Community 22`, `resolve_item_for_db`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 20` to `Community 10`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 52`, `Community 53`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 62`, `Community 63`, `Community 64`, `Community 65`, `Community 66`, `Community 67`, `Community 68`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 73`, `Community 74`, `Community 75`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`, `Community 81`, `Community 82`, `Community 83`, `clsx`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `log_meal()` connect `Community 8` to `Community 3`, `Community 5`, `Community 7`, `Community 12`, `Community 15`, `Community 16`, `Community 22`, `Community 23`, `Community 24`, `resolve_item_for_db`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `FoodLookupResult` (e.g. with `FoodSanityVerdict` and `BaselineMeta`) actually correct?**
  _`FoodLookupResult` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _138 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07073544433094994 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05553923009109609 - nodes in this community are weakly interconnected._