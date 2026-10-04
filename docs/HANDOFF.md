# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

Application baseline entering this handoff refresh:

`d01c31ee05803e3a4d6255c285ada824697d3b66`

That commit is the merge of PR #187, **Expose Heatmap cell aggregation controls**.

## Hosted application

`https://pjawzk.github.io/EpicEFI-EpicScope/`

GitHub Actions is the required Web validation path and GitHub Pages is the normal project-owner test surface. Normal owner testing must not require a local clone, Node.js or npm.

## Current project position

EpicScope Web has a stable large-log/import/workspace foundation. The earlier storage/channel optimization campaign and repository/file-structure audit are **done for now**.

The approved UI-hierarchy work is complete enough that the active product focus is now:

> **generic, reusable analysis primitives and surfaces before specialized Boost/Idle/AE/etc analyzers**

Approved top-level workflow:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

Generic analysis is now implemented through:

- selected-range statistics;
- generic qualification/filter semantics;
- contextual A/B qualification UI;
- 1D Histogram;
- 2D Histogram / Heatmap;
- Scatter;
- shared numeric aggregation/statistics/sample-count semantics;
- explicit Heatmap cell-value aggregation.

The next roadmap primitive is **generic Events**.

Do not restart broad performance micro-optimization or structural refactoring unless a feature/regression gives a concrete reason.

## Implemented workflow hierarchy

### PR #170 — Channels foundation

Completed:

- Active/Favorites/Recent/group/search semantics have focused tests;
- live values use standardized unit-aware presentation;
- no decorative value bars;
- source/channel identity semantics remain unchanged.

### PR #171 — Header workflow hierarchy

Completed:

- **Load Data ▾** owns log/INI loading;
- workspace context is **Graphs · <workspace> ▾**;
- empty top-level placeholder controls were removed;
- the EpicScope logo dropdown is the in-product mode/surface switcher.

### PR #172 — Channel browser hierarchy

Completed:

- Search first;
- Group + visibility filters together;
- compact sort controls;
- **Load now** primary;
- low-frequency actions under `⋯`;
- queued/active semantics preserved.

### PR #174 — Timeline workflow hierarchy

Completed:

- primary row is **Navigate**;
- playback/step, scrub/cursor, Fit/zoom and view history stay together;
- A/B, saved ranges and marker actions are under **Range / Markers**;
- rare range/marker maintenance actions are behind `⋯`;
- compact timeline retains the interactive overview/focus strip;
- the Analyze context becomes actionable when A/B is valid.

## Generic analysis foundation

### PR #175 — Selected range statistics

Implemented and deployed:

- reusable `core/analysis/range-statistics.ts`;
- selected A/B statistics in Channel Details;
- min/max/mean/sample standard deviation/valid/invalid counts;
- reversed A/B normalization;
- explicit complete vs partial decoded coverage;
- open Channel Details refreshes when A/B changes;
- operates on already-decoded active traces without a new source-read path.

### PR #177 — Sample qualification core

Implemented and deployed:

- reusable `core/analysis/sample-qualification.ts`;
- numeric operators `gt/gte/lt/lte/eq`;
- multiple conditions with explicit **AND** semantics;
- time scope remains independent from value conditions;
- multi-channel alignment by source sample index;
- explicit evidence buckets:
  - eligible;
  - value-rejected;
  - invalid;
  - unavailable/not decoded;
- explicit decoded-coverage/completeness state;
- source sample indices returned for downstream Histogram/Heatmap/Scatter/etc consumers;
- Channel Value Search reuses the same comparison predicate/type.

### PR #178 — Contextual A/B qualification UI

Implemented and deployed:

- **Analyze · range ready** becomes a real contextual action;
- modal analysis UI works on current A/B plus active decoded traces only;
- supports multiple AND conditions;
- reports qualification provenance counts and decoded coverage;
- does not trigger a hidden full-log/source scan.

## Histogram mode

### PR #179 — 1D Histogram core

Implemented and deployed:

- `core/analysis/histogram.ts`;
- optional source-sample-index input from qualification;
- configurable numeric bins;
- inclusive final maximum;
- constant-value collapse;
- explicit input/valid/binned/invalid/unavailable/below/above counts;
- no source reads.

### PR #180 — Histogram EpicScope mode surface

Implemented and deployed:

- **Histogram** is a real EpicScope mode in the logo switcher;
- Logger remains default mode;
- Histogram is a read-only analysis view over Logger's current active decoded traces and current A/B range;
- no second importer or second data-source path;
- global Load Data/settings remain global while Logger-specific graph controls hide in Histogram mode.

### PR #181 / #182 — 2D Histogram / Heatmap

Implemented and deployed:

- reusable `core/analysis/heatmap.ts`;
- X/Y alignment by source sample index;
- independent X/Y bin counts;
- explicit pair evidence: input, valid pair, invalid, unavailable, binned, outside range;
- inclusive final X/Y maxima and constant-axis handling;
- **Heatmap** subview inside Histogram mode;
- X/Y channels are selected from active decoded traces;
- same current Logger A/B scope is used;
- no new source reads.

### PR #183 / #184 — Scatter

Implemented and deployed:

- reusable `core/analysis/scatter.ts`;
- aligned source sample indices + typed X/Y arrays;
- explicit input/valid/invalid/unavailable counts and finite X/Y bounds;
- **Scatter** subview inside Histogram mode;
- uses current A/B plus active decoded traces;
- analysis retains all valid pairs;
- canvas presentation is deterministically thinned only above 20,000 points;
- **Valid pairs** remains the full analysis count and **Rendered points** reports the visual subset;
- correlation/regression/trend lines are intentionally not yet part of Scatter semantics.

## Aggregation / statistic semantics

### PR #185 — Reusable numeric aggregation

Implemented and deployed:

- `core/analysis/numeric-aggregation.ts`;
- methods:
  - count;
  - sum;
  - min;
  - max;
  - mean;
  - sample variance `(n - 1)`;
  - sample standard deviation `(n - 1)`;
- source-sample-index selection;
- explicit input/valid/invalid/unavailable evidence counts;
- mean/std-dev convention is explicitly tested against Range Statistics so analysis surfaces cannot drift.

### PR #186 — Heatmap cell aggregation core

Implemented and deployed:

- Count remains the default/backward-compatible density cell value;
- non-count cells take an explicit value channel/range;
- Heatmap returns row-major `cellValues` plus per-cell valid value sample counts;
- X/Y occupancy counts remain separate from cell aggregate values;
- explicit value-channel evidence:
  - valid;
  - invalid;
  - unavailable;
- finite cell-value min/max are provided for rendering normalization;
- non-count cell math reuses the shared aggregation primitive.

### PR #187 — Heatmap aggregation UI

Implemented and merged; use current CI/Pages state to confirm final deployment if continuation starts immediately after this handoff refresh.

- **Cell value** choices:
  - Count;
  - Mean;
  - Minimum;
  - Maximum;
  - Std dev;
- **Value channel** appears only for non-count aggregation;
- X channel, Y channel, value channel and cell statistic are all explicit;
- UI reports cell meaning, e.g. `Mean · Coolant`;
- cell-value range is shown with units;
- X/Y pair evidence stays separate from value-channel evidence;
- decoded coverage includes the value trace for non-count aggregation;
- Count preserves the existing `count / peak` density visual scaling;
- non-count cell intensity is normalized from finite aggregate-value min→max;
- no original-log/source rereads are introduced.

## Current EpicScope mode/surface model

The EpicScope logo dropdown remains the mode/surface switcher.

Current real modes:

- **Logger** — recorded log viewing/navigation, graphs, channels, A/B and range workflow;
- **Histogram** — analysis surface containing:
  - Distribution;
  - Heatmap;
  - Scatter.

**Analyzer** remains planned. Do not enable it merely as an empty shell.

Do not add new top-level modes when an analysis view naturally belongs inside an existing real surface.

## Analysis provenance rules now authoritative

Analysis must not silently discard or invent evidence.

Where applicable expose or retain:

- requested/input sample count;
- valid/eligible sample count;
- invalid sample count;
- unavailable/not-decoded sample count;
- value-rejected count when qualification applies;
- binned/used sample count;
- explicit complete vs partial decoded coverage.

For pair analysis, distinguish X/Y pair validity/availability from a third value-channel's validity/availability.

Presentation thinning must never be represented as analysis thinning. Example: Scatter may draw a capped subset while retaining the full valid-pair analysis count.

## Statistical conventions

Unless a future documented decision deliberately changes it:

- mean uses the normal arithmetic mean;
- variance is **sample variance `(n - 1)`**;
- standard deviation is **sample standard deviation `(n - 1)`**;
- one valid sample yields variance/std-dev `0`;
- no valid samples yield undefined numeric statistics;
- shared aggregation helpers are the authority instead of surface-specific copies.

## Current large-log architecture

Primary benchmark log:

`2026-07-14_22.07.05.mlg`

Known structure:

- 1,193,898,186 bytes;
- MLVLG v2;
- 320,458 records;
- 1,389 logged channels;
- 2-thread / 4 GB class low-spec machine remains the important Web acceptance environment.

Current post-index access layers:

1. session/RAM full-range cache for already materialized channels;
2. primary OPFS MLG sidecar storing native-width transposed stripes;
3. sparse per-channel native OPFS cache for channels actually selected;
4. original row-reader fallback for missing/unsupported paths.

Authoritative primary-sidecar configuration on the canonical log remains:

- 59 stripes;
- 64-byte target stripe width;
- 1,191,462,844 bytes native payload.

The 16-byte stripe experiment was rejected because transpose/build cost rose substantially without enough end-to-end gain.

## Current performance position

Performance remains **good enough for the current feature stage**.

Most recent supplied post-audit benchmark before this analysis sequence was approximately:

- MLG load: **8.47 s**;
- workspace restore: **0.54 s**;
- workspace shared batch: single-digit milliseconds with zero original-log rereads;
- first native-cached arbitrary-channel activation: about **0.27 s**;
- repeated same-session selection: about **0.05 s**.

These are observations, not universal SLA values.

Re-profile only after meaningful feature growth or a concrete regression. Do not restart generic micro-optimization merely because analysis features were added.

## Current source/workspace behavior

Retained semantics:

- INI parsing and normalized channel catalog;
- stable logical `ini:<logicalKey>` identity;
- conservative INI↔MLG binding;
- MLG authoritative for recorded values/validity;
- known/no-data channels remain visible;
- usable log-only channels remain usable;
- reusable named application workspaces persist independently of exact log identity;
- exact-log cursor/viewport/A-B/markers/ranges remain separate;
- visible workspace channels share one restore batch;
- explicit channel/cache clear must not remove reusable workspace state;
- MSQ/table enrichment remains later work;
- CSV remains deferred unless roadmap priority changes.

## Generic analysis roadmap

Completed/deployed or merged:

1. range statistics — PR #175;
2. filters / qualification — PR #177 / #178;
3. histogram — PR #179 / #180;
4. 2D histogram / heatmap — PR #181 / #182;
5. scatter — PR #183 / #184;
6. aggregation/statistics/sample-count semantics — PR #185 / #186 / #187.

Next:

7. **generic Events**;
8. generic Compare base;
9. MSQ/table correlation;
10. specialized Boost/Idle/AE/etc analyzers.

## Generic Events direction — next task

The next reusable primitive should answer:

> Which meaningful intervals or occurrences in the selected source/range satisfy an event definition, and what evidence belongs to each occurrence?

Start data-model/core first. Investigate at minimum:

- event conditions built from existing generic qualification/comparison semantics where appropriate;
- point event vs interval event representation;
- rising/enter and falling/exit boundaries;
- minimum duration / debounce semantics;
- whether adjacent qualifying samples should merge into one event;
- source sample indices and start/end times;
- sample/evidence counts per event;
- invalid/unavailable handling at event boundaries;
- explicit A/B time scope independent from value conditions;
- deterministic behavior for partial decoded coverage;
- no hidden original-log rereads on the normal active-trace path;
- pure focused tests before a substantial Events UI.

Do **not** start with specialized labels such as knock event, overboost event, clutch event or lean event. Generic channel/value event semantics should be the base.

## UI/reference constraints still in force

- authoritative visual/interaction reference remains `EpicHub-Tablet-Landscape-0.0.45(2).html`, as interpreted by `docs/UI_REFERENCE.md`;
- EpicScope may deliberately refine that reference;
- use TunerStudio/MegaLogViewer terminology where practical;
- do not alter established colors based only on viewing-angle artifacts;
- performance/cleanup work must not silently change interaction semantics;
- right-side channel/detail/control responsibility remains preferred on wide Logger layouts;
- the EpicScope logo dropdown owns mode/surface switching;
- avoid permanent toolbar clutter as analysis capabilities expand.

## Repository/workflow constraints

- `main` is authoritative;
- normal implementation uses a focused branch/PR;
- type-check, tests and production build must pass before merge;
- verify post-merge Web CI and GitHub Pages deployment;
- temporary patch/validation workflows/scripts must not remain in the final feature diff;
- avoid accidental/no-op commits on `main`;
- project-owner testing is hosted.

## Architecture authority

Read before significant implementation:

1. `docs/HANDOFF.md`
2. `docs/PRODUCT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/FILE_ARCHITECTURE.md`
5. `docs/DATA_MODEL.md`
6. `docs/UI_REFERENCE.md`
7. `docs/LOG_MLG_PLAN.md`
8. `docs/PERFORMANCE.md`
9. `docs/PLATFORMS.md`
10. `docs/ROADMAP.md`
11. `docs/WORKFLOW.md`
12. `docs/DECISIONS.md`

When an older milestone/status statement conflicts with this handoff or current `main`, use this handoff plus current repository/CI state for present-tense continuation.

## Exact next task

Continue Phase 2 generic analysis from current `main` with **generic Events**.

Recommended next implementation pass:

1. inspect existing qualification/range/sample-index primitives;
2. define a small reusable event model in `core/analysis`;
3. start with one or more generic numeric AND conditions rather than domain-specific event types;
4. define point vs interval semantics and deterministic enter/exit boundaries;
5. define minimum-duration/debounce/merge behavior explicitly;
6. preserve source sample indices, timestamps and evidence counts;
7. define invalid/unavailable/partial-coverage behavior;
8. add focused pure tests before UI;
9. only then expose a minimal contextual Events surface;
10. keep normal active-trace analysis free of silent original-log rereads.

Do not start Compare/MSQ/specialized analyzers until generic Events semantics are clear unless the project owner changes priority.

## Continuation instruction

A new chat should be able to start with:

> Read `docs/HANDOFF.md` in `PJawZK/EpicEFI-EpicScope`, inspect current `main`/PR/CI state, and continue the generic Events analysis primitive from there.

Use the repository handoff and current repository state as authority. Do not reconstruct present architecture from older chats or superseded performance experiments.
