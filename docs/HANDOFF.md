# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

Application baseline entering this documentation refresh:

`d67958712770d64908e4eeb64978c6a9d2643d51`

That commit is the merge of PR #172, **Simplify channel browser control hierarchy**. The documentation-only merge produced by this refresh will become the newer authoritative `main`; it must not change application behavior.

## Hosted application

`https://pjawzk.github.io/EpicEFI-EpicScope/`

GitHub Actions is the required Web validation path and GitHub Pages is the normal project-owner test surface. Normal testing must not require a local clone, Node.js or npm.

## Current project position

EpicScope Web now has a stable large-log/import/workspace foundation and the earlier storage/channel optimization campaign is **done for now**. The subsequent repository/file-structure audit is also at its natural stopping point.

The active product focus is **UI hierarchy and workflow clarity before adding more generic analysis tools**.

Approved top-level user workflow:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

The first three UI hierarchy passes are implemented and deployed. The next implementation pass is the timeline area: **Navigate → Range/Markers → Analyze**.

Do not restart broad performance micro-optimization or structural refactoring unless a feature/regression gives a concrete reason.

## Current implemented UI hierarchy

### PR #170 — Channels foundation

Completed:

- Active/Favorites/Recent/group/search filter semantics have focused tests;
- live channel values use standardized unit-aware presentation;
- examples: `848 rpm`, `2.1 %`, `λ 0.987`, `82.2 °C`;
- no value bars;
- source/channel identity semantics remain unchanged.

### PR #171 — Header workflow hierarchy

Completed:

- separate **Open Log** and **Load INI** top-level buttons became **Load Data ▾**;
- workspace context now reads **Graphs · <workspace> ▾** instead of an unexplained bare workspace name;
- empty top-level **Tools** and **Compare** placeholders were removed;
- the **EpicScope logo dropdown** is explicitly the in-product mode switcher, following the intent of EpicHub without inheriting EpicHub's broader app shell;
- current mode entries:
  - **Logger** — active;
  - **Analyzer** — planned;
  - **Histogram** — planned;
- existing file-loading handlers/data semantics were intentionally preserved.

### PR #172 — Channel browser hierarchy

Completed:

- clearer **Channels / Channel browser** identity;
- Search remains the first interaction;
- Group + visibility filters remain together;
- three permanent sort buttons became a compact Sort selector plus ↑/↓ direction button;
- **Load now** is the primary footer action;
- **Add all filtered** and **Clear active pane** moved under `⋯`;
- existing filter, queued-channel and active-channel semantics remain in force.

Exact-main validation for PR #172 passed type-check, tests, production build, Web CI, Pages build and Pages deployment.

## UI rules now considered authoritative

### EpicScope mode switcher

The EpicScope logo dropdown in the upper-right is reserved as the mode/surface switcher.

It is **not** merely branding and it is **not** the broader EpicHub Dashboard/Tuner/Diagnostics shell.

Expected future EpicScope modes/surfaces may include Logger, Analyzer, Histogram/Table, Scatter, Math Channels and other approved analysis surfaces as they become real capabilities. Do not add disabled clutter merely to advertise future work; planned entries should be deliberate and compact.

### Workflow hierarchy

Controls should be grouped according to normal use and importance rather than by implementation ownership.

Permanent visibility rule:

> A control should remain permanently visible only when it is frequently useful at the current workflow stage.

Other controls should be contextual, grouped, placed in overflow menus, or revealed by state.

### Graph workspace context

- global workspace context is **Graphs · <workspace>**;
- individual graph/pane identity stays local to each pane;
- do not clutter the header with `Graph - General`-style repetition;
- active-pane treatment should make the currently targeted graph obvious locally.

### Channels

- Search is first;
- Group and visibility filters are a single conceptual filter group;
- Active/Favorites/Recent semantics must remain tested;
- channel rows may show current values directly with proper unit/symbol formatting;
- use conventional symbols where genuinely useful, e.g. `λ`; otherwise use normal units such as `rpm`, `%`, `kPa`, `°C`, `V`;
- do not add value bars merely for decoration;
- primary and secondary actions must remain visually distinct.

### Timeline next-pass direction

The current timeline exposes many useful functions simultaneously and is the next major clutter target.

Planned grouping:

1. **Navigate** — playback/step, timeline scrub/cursor, Fit, zoom, view history;
2. **Range / Markers** — A/B selection, selected-range status, saved ranges, marker actions/navigation;
3. **Analyze** — contextual next action once source/channel/range context is meaningful.

Buttons within each group should be ordered by frequency/importance. Rare maintenance actions should move behind compact menus instead of occupying permanent space.

The existing underlying navigation/range/marker semantics are valuable and should be reorganized rather than discarded.

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

The most recent supplied post-audit benchmark before the UI-only PR #170–#172 series showed approximately:

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

The audit reached a natural stopping point. Large files alone are not a defect. Do not continue splitting modules simply to reduce line count.

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
- Now/Min/Max context and channel details;
- timeline overview;
- versioned exact-log and reusable workspace persistence.

The timeline feature set is mature enough that the next work is **information hierarchy**, not removal of capability.

## Generic analysis roadmap after UI hierarchy

Once the navigation/range flow is clear, Phase 2 should resume with reusable analysis primitives before specialized analyzers:

- range statistics;
- filters/qualification;
- histogram;
- 2D histogram/heatmap;
- scatter;
- aggregation/statistics/sample-count semantics;
- generic Events;
- generic Compare base;
- then MSQ/table correlation;
- then specialized Boost/Idle/AE/etc analyzers.

The UI hierarchy work exists specifically so these capabilities do not create another layer of permanent toolbar clutter.

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

Continue the approved UI hierarchy work from current `main`.

Next implementation pass:

1. inspect the current `timeline-shell.ts` presentation and logger wiring without changing underlying semantics;
2. separate/reorder permanently visible controls into **Navigate**, **Range/Markers**, and contextual **Analyze** responsibility;
3. order controls by frequency and importance;
4. move rare range/marker maintenance actions into compact menus where appropriate;
5. preserve playback, cursor, zoom, A/B, markers, saved ranges and view-history behavior;
6. keep the EpicScope logo mode switcher in the upper-right unchanged except where a deliberate mode-surface update is part of the task;
7. add focused tests for any extracted pure UI-state/grouping logic where appropriate;
8. hosted visual review after deployment.

Do not begin Range Statistics/Histogram implementation until the navigation/range UI hierarchy is in a good state unless the project owner explicitly changes priority.

## Continuation instruction

A new chat should be able to start with:

> Read `docs/HANDOFF.md` in `PJawZK/EpicEFI-EpicScope`, inspect current `main`/PR/CI state, and continue the timeline UI hierarchy pass from there.

Use the repository handoff and current repository state as authority. Do not reconstruct present architecture from older chats or superseded performance experiments.
