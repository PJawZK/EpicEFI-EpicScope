<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Roadmap

## Roadmap principles

The roadmap describes intended capability and implementation order. It does not authorize code to bypass `FILE_ARCHITECTURE.md`.

Each implementation task should identify goal, architectural owner/location, dependencies, expected validation, and completion criteria. Large features should be split into reviewable tasks before coding.

## Current execution position — 2026-10-04

EpicScope Web has moved beyond the original shell/log-foundation and the intensive large-log optimization campaign.

Current established foundations include:

- MLG v1/v2 import/index/staged validation;
- OPFS sidecar/native-column post-index access;
- INI-backed channel catalog/binding;
- reusable application workspaces plus separate exact-log navigation persistence;
- multi-pane graphs and timeline/range/marker tooling;
- bounded diagnostics/performance observability;
- repository/file-structure cleanup through PR #169.

Performance and structural cleanup are **good enough for now**. Re-profile when features grow or a regression appears; do not keep optimizing/refactoring solely because further micro-work is possible.

The active milestone is **UI hierarchy before generic analysis expansion**.

Approved workflow:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Completed UI passes:

- PR #170 — Channels filter/value foundation;
- PR #171 — header hierarchy, Load Data, Graphs context, EpicScope mode switcher;
- PR #172 — Channel browser hierarchy.

Next pass:

- reorganize the timeline into **Navigate → Range/Markers → Analyze** while preserving existing behavior.

After that, resume Phase 2 generic analysis work beginning with reusable range/statistics/filter primitives and Histogram rather than jumping directly to specialized analyzers.

## Phase 0 — Foundation

Status: **Complete**

Established:

- product identity/scope;
- architecture/file ownership;
- normalized data model;
- performance/platform requirements;
- workflow/handoff/decision process;
- privacy/security/input rules.

## Phase 1 — Web log and navigation foundation

Status: **Complete as a functional foundation; regression maintenance continues**

### WEB-REFERENCE — Complete

Authority:

- `EpicHub-Tablet-Landscape-0.0.45(2).html`;
- `docs/UI_REFERENCE.md` contains the EpicScope interpretation and later project-owner refinements.

Important current refinement: EpicScope remains a dedicated product, but the **EpicScope logo dropdown is the in-product mode/surface switcher**.

### WEB-BOOT — Complete

Validated:

- npm lockfile;
- Vite 8.x;
- vanilla TypeScript 7.x;
- Chromium/Brave-first;
- GitHub Actions validation;
- GitHub Pages deployment;
- project-owner hosted testing without local tooling.

### LOG-MLG — Core path complete

Implemented:

- MLVLG v1/v2 parsing;
- bounded/random-access source access;
- normalized log contracts;
- source markers/timestamps/rollover handling;
- malformed/untrusted-input protection;
- Vitest parser/core coverage;
- staged Worker import and deferred CRC validation;
- bounded Blob caching;
- multi-channel decoding;
- OPFS column sidecar and sparse native per-channel persistence;
- session/RAM reuse and fallback source path.

MLVLG v3 remains deferred until authoritative evidence exists.

### LOG-CSV — Deferred

CSV remains a future secondary import format but does not block higher-value analysis/product work.

### TIMELINE / GRAPH FOUNDATION — Complete

Implemented:

- synchronized timeline/cursor;
- zoom/pan/focus window;
- cursor-follow behavior;
- source and user markers;
- A/B boundaries and shading;
- saved ranges;
- view history;
- multi-pane fixed/freeform workspaces;
- active-pane context;
- Single stacked-trace layout;
- high-zoom raw samples and zoomed-out exact-envelope rendering;
- timeline overview;
- keyboard shortcuts and persistence.

Current task is **presentation hierarchy**, not missing timeline capability.

### WORKSPACE / PERSISTENCE v1 + reusable application workspace — Implemented

- exact-log artifact retains recording-specific viewport/cursor/A-B/markers/ranges;
- reusable application workspace retains named workspaces/layouts/stable channel assignments independently of log identity;
- normalized INI catalog persists separately;
- incompatible artifacts are rejected rather than silently reinterpreted.

## Phase 2 — Channel catalog, UI workflow, and generic analysis foundation

Status: **In progress**

Purpose: establish stable channel/source context and generic analysis primitives before specialized analyzers multiply.

### TUNE-INI / CHANNEL-CATALOG — Foundation implemented

- raw INI decoding under `core/parsers/ini/`;
- stable logical channel identity;
- INI↔MLG binding;
- known+data / known-no-data / log-only states;
- MLG remains authoritative for samples and validity.

### CHANNELS — Foundation partially implemented

Implemented now:

- stable logical/source binding;
- group/search/Active/Favorites/Recent filter semantics with focused tests;
- unit-aware current-value display;
- channel statistics/detail foundation;
- persistent assignments and source availability states.

Still planned:

- richer aliases/group management where needed;
- derived/math channels;
- any further channel organization demanded by real analysis workflows.

### UI-HIERARCHY — Active

Approved flow:

1. Load Data
2. Channels
3. Navigate
4. Select / qualify range
5. Analyze
6. Compare / Export

Completed:

- Load Data menu;
- Graphs workspace identity;
- EpicScope mode switcher;
- Channel browser simplification;
- removal of empty Tools/Compare placeholders.

Next:

- timeline Navigate grouping;
- Range/Markers grouping;
- contextual Analyze entry point;
- later diagnostics/settings consolidation where needed.

### ANALYSIS — Next after UI hierarchy

Build generic reusable analysis services before specialized analyzers:

- filters and qualification;
- range statistics;
- histogram;
- 2D histogram/heatmap/table;
- scatter;
- selectable aggregation methods;
- sample count/variance/evidence display;
- explicit X/Y/value/filter semantics.

Preferred first implementation sequence:

1. generic Analysis Result / range scope contract;
2. Range Statistics;
3. Histogram;
4. 2D Histogram/Heatmap/Table;
5. Scatter;
6. reusable presets/filters as justified.

### EVENTS

- event data contract;
- detector framework;
- initial generic detectors;
- event rail/navigation;
- analyzers reuse generic events rather than private copies.

### COMPARE-BASE

- multiple-log/session relation;
- trace overlays;
- range/event alignment;
- metric deltas;
- linked source context.

Compare should become visible in the UI when real comparison capability exists, not as a disabled top-level placeholder.

Phase 2 exit criteria:

- stable workspace/channel context exists before a log is opened;
- supported INI binds safely to supported logs;
- known-no-data/log-only states remain explicit;
- generic analysis workflows are useful independently of specialized analyzers;
- analyzer implementation can reuse stable generic services.

## Phase 3 — MSQ tune enrichment and table correlation

### TUNE-MSQ

- raw MSQ decoding under `core/parsers/msq/`;
- normalized tune values/tables/curves/scalars under `core/tune/`;
- optional enrichment, not the runtime channel catalog;
- explicit compatibility reporting with INI/log context.

### TABLE-MAP

- map samples into tune coordinates/cells;
- expose tune value, observed result, target/error, sample count and stability;
- reusable table-overlay APIs.

## Phase 4 — Specialized analyzers

Specialized analyzers use generic analysis/events/compare/tune services.

Initial tracks:

### BOOST

Capability-driven support for single/dual solenoid, upper/lower chamber, open/closed loop, target/error, spool, steady-state and overshoot/undershoot analysis.

### IDLE

Target/error, valve duty/bias/feed-forward, PID terms where logged, disturbance/sag/recovery/settling.

### AE / MAP PREDICT

Tip-in/decel events, TPS/MAP timing, predicted/measured MAP, AFR response, lean/rich peak and recovery, before/after comparison.

### FUELING

VE/AFR target/actual error, qualification, tune-cell population/stability.

### IGNITION

Advance/retard/knock-oriented evidence where channels permit.

### FUEL PRESSURE / INJECTOR

Rail/differential pressure, injector PW/duty/deadtime-oriented analysis where supported.

### TRIGGER / SYNC

Synchronization/dropout/event analysis where available channels permit.

Each analyzer begins Experimental, then Beta, then Stable only with validation evidence.

## Phase 5 — Sessions, sharing, and reporting

- domain session orchestration as needed;
- versioned full-session persistence;
- annotations/bookmarks;
- analysis results/snapshots;
- optional explicit sharing/publishing;
- no silent upload/telemetry of local log/tune content.

Any backend/share architecture requires explicit approval before new top-level areas are created.

## Phase 6 — Web functional maturity review

Before Linux becomes primary focus:

- review feature completeness and workflow clarity;
- consolidate duplicate concepts;
- freeze/version key contracts;
- profile representative workloads;
- define Linux benchmark/hardware baselines;
- decide which Web internals are retained/replaced/ported.

## Phase 7 — Linux production implementation

Primary baseline: Debian 13 Stable.

Goals:

- approved Linux runtime architecture;
- native high-performance data path;
- low RAM;
- large-log indexing and bounded queries;
- responsive graphs/tables;
- preserve established EpicScope semantics;
- target the 1 GiB log / 2 GiB RAM requirement.

Rust remains a preferred candidate for native hot paths when justified by measurement and architecture.

## Phase 8 — Linux feature expansion

Potential later work:

- persistent native indexes/caches;
- very large logs;
- optional file-library/watching workflows;
- direct ECU logging/live analysis if separately approved;
- additional analyzers;
- packaging/update strategy.

## Phase 9 — Android / EpicHub integration

- identify reusable core components;
- approve Android integration architecture first;
- adapt proven analyzers/workflows to EpicHub;
- design tablet/mobile presentation independently where appropriate.

## Roadmap change control

New major feature groups may be added, but they must be placed deliberately in roadmap and architecture before implementation. A feature request alone does not authorize a new subsystem or architectural layer.
