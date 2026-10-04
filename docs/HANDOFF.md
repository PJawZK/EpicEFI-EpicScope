# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

Application baseline entering this documentation refresh:

`0e1f003364c589c531ac021cb2ba74a7eb9a8e4c`

That commit is the merge of PR #175, **Add selected range statistics**.

## Hosted application

`https://pjawzk.github.io/EpicEFI-EpicScope/`

GitHub Actions is the required Web validation path and GitHub Pages is the normal project-owner test surface. Normal testing must not require a local clone, Node.js or npm.

## Current project position

EpicScope Web has a stable large-log/import/workspace foundation. The earlier storage/channel optimization campaign and repository/file-structure audit are **done for now**.

The approved UI-hierarchy sequence is also complete enough to proceed with generic analysis primitives.

Approved top-level user workflow:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

Current active product focus:

> **generic, reusable analysis primitives before specialized Boost/Idle/AE/etc analyzers**

The first primitive, **selected-range statistics**, is implemented and deployed. The next implementation target is **filters / qualification**.

Do not restart broad performance micro-optimization or structural refactoring unless a feature/regression gives a concrete reason.

## Current implemented UI hierarchy

### PR #170 — Channels foundation

Completed:

- Active/Favorites/Recent/group/search filter semantics have focused tests;
- live channel values use standardized unit-aware presentation;
- examples: `848 rpm`, `2.1 %`, `λ 0.987`, `82.2 °C`;
- no decorative value bars;
- source/channel identity semantics remain unchanged.

### PR #171 — Header workflow hierarchy

Completed:

- separate **Open Log** and **Load INI** top-level buttons became **Load Data ▾**;
- workspace context reads **Graphs · <workspace> ▾**;
- empty top-level **Tools** and **Compare** placeholders were removed;
- the **EpicScope logo dropdown** is the in-product mode/surface switcher;
- existing file-loading handlers/data semantics were preserved.

### PR #172 — Channel browser hierarchy

Completed:

- clearer **Channels / Channel browser** identity;
- Search is first;
- Group + visibility filters remain together;
- sort controls are compact;
- **Load now** is the primary footer action;
- **Add all filtered** and **Clear active pane** moved under `⋯`;
- existing filter, queued-channel and active-channel semantics remain in force.

### PR #174 — Timeline workflow hierarchy

Completed:

- timeline primary row is explicitly **Navigate**;
- playback/step, scrub/cursor, Fit/zoom and view history stay together;
- A/B, saved ranges and marker actions are grouped under **Range / Markers**;
- low-frequency range/marker maintenance actions are behind `⋯`;
- contextual Analyze state reports whether A/B is ready without presenting a fake analysis tool;
- playback, cursor, viewport, A/B, markers, saved ranges, view history and persistence semantics were preserved;
- compact timeline retains the interactive overview/focus strip.

PR #174 passed PR CI, post-merge Web CI and Pages deployment.

## Current generic analysis foundation

### PR #175 — Selected range statistics

Completed and deployed:

- reusable numeric range summarization extracted to `core/analysis/range-statistics.ts`;
- full/visible graph statistics reuse that primitive rather than maintaining a second implementation;
- selected A/B statistics are exposed through existing **Channel Details**;
- selected range reports:
  - span;
  - decoded coverage state;
  - min;
  - max;
  - mean;
  - standard deviation;
  - valid sample count;
  - invalid sample count;
- reversed A/B boundaries are normalized;
- incomplete active-trace coverage is shown as **Partial decoded coverage** rather than being presented as complete;
- an already-open Channel Details window refreshes when A/B changes;
- the selected-range calculation works on the already-decoded active trace and does not introduce a new original-log read path;
- focused tests cover range selection, invalid samples, reversed boundaries and decoded coverage semantics.

PR #175 exact-head Web CI passed type-check, tests and production build. Post-merge Web CI and GitHub Pages deployment passed on merge commit `0e1f003364c589c531ac021cb2ba74a7eb9a8e4c`.

## UI rules now considered authoritative

### EpicScope mode switcher

The EpicScope logo dropdown in the upper-right is reserved as the mode/surface switcher.

It is **not** merely branding and it is **not** the broader EpicHub Dashboard/Tuner/Diagnostics shell.

Expected future EpicScope modes/surfaces may include Logger, Analyzer, Histogram/Table, Scatter, Math Channels and other approved analysis surfaces as they become real capabilities. Do not add disabled clutter merely to advertise future work.

### Workflow hierarchy

Controls should be grouped according to normal use and importance rather than implementation ownership.

Permanent visibility rule:

> A control should remain permanently visible only when it is frequently useful at the current workflow stage.

Other controls should be contextual, grouped, placed in overflow menus, or revealed by state.

### Graph workspace context

- global workspace context is **Graphs · <workspace>**;
- individual graph/pane identity stays local to each pane;
- do not clutter the header with repeated graph naming;
- active-pane treatment should make the targeted graph obvious locally.

### Channels

- Search is first;
- Group and visibility filters are one conceptual filter group;
- Active/Favorites/Recent semantics must remain tested;
- channel rows may show current values with proper unit/symbol formatting;
- use conventional symbols where genuinely useful, e.g. `λ`; otherwise use normal units such as `rpm`, `%`, `kPa`, `°C`, `V`;
- do not add decorative value bars;
- primary and secondary actions must remain visually distinct.

### Timeline / range selection

- **Navigate** owns playback/step, scrub/cursor, Fit/zoom and view history;
- **Range / Markers** owns A/B, saved ranges and marker actions/navigation;
- rare maintenance actions stay contextual/overflowed;
- Analyze should become a real action only when a real analysis surface exists;
- existing navigation/range/marker semantics are valuable and should be extended rather than replaced.

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

Performance is considered **good enough for the current feature stage**.

The most recent supplied post-audit benchmark before the UI/analysis feature sequence showed approximately:

- MLG load: **8.47 s**;
- workspace restore: **0.54 s**;
- workspace shared data batch: single-digit milliseconds with zero original-log rereads;
- first native-cached arbitrary-channel activation: about **0.27 s** total;
- repeated same-session selection: about **0.05 s** total with effectively free data lookup.

Earlier/better runs and hardware variance exist. Do not treat one number as a universal SLA. The important architectural result is that restored/arbitrary channel access no longer requires repeated full original-MLG traversal in the normal sidecar/cache path.

Background CRC/sidecar completion and time-to-usable UI are distinct measurements and must not be collapsed into one performance claim.

Performance should be re-profiled after meaningful feature growth or if a regression is observed.

## Repository/file-structure audit — concluded for now

Completed cleanup/refactor sequence:

- **PR #161** — removed rejected predecode runtime path;
- **PR #162** — corrected diagnostics ownership drift;
- **PR #163** — extracted logger pane/layout state;
- **PR #164** — parser/source-integrity diagnostics extraction;
- **PR #165** — parser diagnostics helper/test cleanup and merge verification;
- **PR #166** — extracted pure performance-report formatting;
- **PR #167** — extracted Bug report health evaluation;
- **PR #168** — repository cleanup only after accidental temp-file commits; no runtime application content affected;
- **PR #169** — extracted pure Bug report formatter.

Large files alone are not a defect. Do not continue splitting modules simply to reduce line count.

## Current source/workspace behavior

Retained semantics:

- INI parsing and normalized channel catalog;
- stable logical `ini:<logicalKey>` identity;
- conservative INI↔MLG binding;
- MLG authoritative for recorded values/validity;
- known/no-data channels remain visible;
- usable log-only channels remain usable;
- reusable named application workspaces persist independently of exact log identity;
- exact-log persistence remains separate for cursor/viewport/A-B/markers/ranges;
- visible workspace channels share one restore batch;
- channel/cache clearing is explicit and must not remove reusable workspace/state;
- MSQ tune/table enrichment remains later work;
- CSV remains deferred unless roadmap priorities change.

## Graph / timeline state

Implemented and working:

- multiple reusable workspaces;
- fixed and freeform multi-pane layouts;
- active-pane context;
- shared viewport/cursor/timeline navigation;
- source markers and user markers;
- saved ranges and view history;
- A/B boundaries and range shading;
- zoomed-in raw-sample and zoomed-out exact-envelope rendering;
- Now/Min/Max context and Channel Details;
- selected A/B range statistics;
- timeline overview;
- versioned exact-log and reusable workspace persistence.

## Generic analysis roadmap

Reusable analysis primitives should continue before specialized analyzers:

1. **range statistics — implemented in PR #175**;
2. **filters / qualification — next**;
3. histogram;
4. 2D histogram / heatmap;
5. scatter;
6. aggregation/statistics/sample-count semantics;
7. generic Events;
8. generic Compare base;
9. MSQ/table correlation;
10. specialized Boost/Idle/AE/etc analyzers.

The UI hierarchy work exists specifically so these capabilities do not create another layer of permanent toolbar clutter.

## Filters / qualification direction

The next primitive should answer the reusable question:

> Which samples inside the current source/range are eligible for this analysis?

Initial implementation should remain generic and data-model-first. Prefer a small qualification model that can later feed histogram, scatter, heatmap, events and compare without each surface inventing its own filter semantics.

At minimum investigate:

- qualification against one or more channel values;
- comparison operators/ranges appropriate for numeric channels;
- combining conditions with explicit AND semantics first unless there is a strong reason to add OR immediately;
- selected A/B range as an independent time scope rather than a hidden filter;
- valid/invalid sample handling;
- sample counts before/after qualification;
- explicit coverage/completeness state when the active decoded range does not contain all requested samples;
- no silent original-log rereads merely to evaluate an already-active qualification;
- testable pure logic in `core/analysis` before substantial UI.

Do not jump directly to a specialized engine-load/RPM/TPS filter vocabulary. Generic channel/value qualification should be the base.

## UI/reference constraints still in force

- authoritative visual/interaction reference remains `EpicHub-Tablet-Landscape-0.0.45(2).html`, as interpreted by `docs/UI_REFERENCE.md`;
- current EpicScope implementation may deliberately refine that reference;
- use TunerStudio/MegaLogViewer terminology where practical;
- do not alter established colors based only on viewing-angle artifacts;
- performance/cleanup work must not silently change interaction semantics;
- right-side channel/detail/control responsibility remains preferred on wide layouts;
- EpicScope logo dropdown owns mode/surface switching.

## Repository/workflow constraints

- `main` is authoritative;
- normal implementation uses a focused branch/PR;
- type-check, tests and production build must pass before merge;
- verify post-merge Web CI and GitHub Pages deployment;
- temporary patch/validation workflows/scripts must not remain in the final PR diff;
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

Continue Phase 2 generic analysis from current `main`.

Next implementation pass:

1. inspect existing channel/range data models and active-trace access paths;
2. define a small reusable numeric **qualification/filter model** in `core/analysis`;
3. define explicit validity and decoded-coverage semantics;
4. expose before/after eligible sample counts so later analysis surfaces can make sample-count provenance visible;
5. start with explicit AND composition unless evidence requires more complexity;
6. add focused pure tests before UI integration;
7. integrate with the current selected A/B range without conflating time range with value qualification;
8. avoid introducing new original-log reads on the normal active-trace path;
9. keep the UI minimal/contextual and do not add a permanent toolbar of analysis controls;
10. validate on hosted Web after merge.

Do not begin Histogram/Scatter/Heatmap or a specialized analyzer until the qualification primitive has clear semantics unless the project owner explicitly changes priority.

## Continuation instruction

A new chat should be able to start with:

> Read `docs/HANDOFF.md` in `PJawZK/EpicEFI-EpicScope`, inspect current `main`/PR/CI state, and continue the filters/qualification analysis primitive from there.

Use the repository handoff and current repository state as authority. Do not reconstruct present architecture from older chats or superseded performance experiments.
