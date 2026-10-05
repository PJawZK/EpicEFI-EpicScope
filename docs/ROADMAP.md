<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Roadmap

## Roadmap principles

The roadmap describes intended capability and implementation order. It does not authorize code to bypass `FILE_ARCHITECTURE.md`.

Each implementation task should identify goal, architectural owner/location, dependencies, expected validation, and completion criteria. Large features should be split into reviewable tasks before coding.

## Current execution position — 2026-10-05

EpicScope Web has completed the currently approved implementation scope through **Phase 4**.

Established foundations now include:

- MLG v1/v2 import/index/staged validation;
- OPFS sidecar/native-column post-index access;
- INI-backed channel catalog/binding and optional MSQ tune enrichment;
- reusable application workspaces plus separate exact-log navigation persistence;
- multi-pane graphs and timeline/range/marker tooling;
- generic range statistics, qualification, Histogram/Table Generator, Scatter, Events and Compare foundations;
- Analyzer Range Compare and Tune Table;
- Experimental Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel Pressure / Injector and Trigger / Sync analyzers;
- full analysis channel catalog with on-demand decode;
- MLV-style weighted Table Generator, presets, grouped filters, Math Channels and cell-to-Logger traceability.

Performance and structural cleanup are **good enough for now**. Re-profile when features grow or a regression appears; do not keep optimizing/refactoring solely because more micro-work is possible.

The active work is **UI refinement of already-implemented analysis surfaces**, currently centered on Histogram/Table Generator after PR #215. This is not a new phase.

Approved workflow:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Do **not** begin Phase 5 unless the project owner explicitly requests it.

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

EpicScope remains a dedicated product; the EpicScope logo dropdown is the in-product mode/surface switcher.

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

CSV remains a future secondary import format and does not block current product work.

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

### WORKSPACE / PERSISTENCE — Implemented

- exact-log artifact retains recording-specific viewport/cursor/A-B/markers/ranges;
- reusable application workspace retains named workspaces/layouts/stable channel assignments independently of log identity;
- normalized INI catalog persists separately;
- incompatible artifacts are rejected rather than silently reinterpreted.

## Phase 2 — Channel catalog, UI workflow, and generic analysis foundation

Status: **Complete for the currently approved scope**

### TUNE-INI / CHANNEL-CATALOG — Implemented

- raw INI decoding under `core/parsers/ini/`;
- stable logical channel identity;
- INI↔MLG binding;
- known+data / known-no-data / log-only states;
- MLG remains authoritative for samples and validity.

### CHANNELS — Implemented foundation

- stable logical/source binding;
- group/search/Active/Favorites/Recent filter semantics;
- unit-aware current-value display;
- channel statistics/detail foundation;
- persistent assignments and source availability states;
- full available-log analysis catalog with on-demand decode.

### UI-HIERARCHY — Implemented foundation, refinement continues

Approved flow:

1. Load Data
2. Channels
3. Navigate
4. Select / qualify range
5. Analyze
6. Compare / Export

Current cleanup work is refinement, not missing architecture.

### GENERIC ANALYSIS — Implemented

- range statistics;
- qualification/filters;
- Histogram/Distribution;
- Table Generator;
- Scatter;
- selectable aggregations;
- sample/coverage/evidence display;
- reusable presets/filters;
- Math Channels/calculated fields;
- linked cell evidence back to Logger.

Table Generator is now the user-facing binned/table surface; separate Heatmap/Dual Heatmap Histogram modes are not part of the current UI.

### EVENTS — Implemented foundation

- event data contract;
- contiguous qualification-run detection;
- merge/minimum-duration semantics;
- explicit source evidence;
- reusable event presentation.

### COMPARE-BASE — Implemented foundation

- generic left/right numeric cohort comparison;
- evidence/coverage;
- absolute and relative deltas;
- first Analyzer Range Compare surface.

## Phase 3 — MSQ tune enrichment and table correlation

Status: **Complete for the currently approved scope**

### TUNE-MSQ — Implemented

- raw MSQ decoding under `core/parsers/msq/`;
- normalized tune values/tables/curves/scalars under `core/tune/`;
- optional enrichment, not the runtime channel catalog;
- explicit tune context in Analyzer/Histogram workflows.

### TABLE-MAP — Implemented

- explicit table + X axis + Y axis relationships;
- ascending/descending axes;
- tune table interpolation/correlation;
- observed/tune evidence and sample population;
- explicit opt-in error/delta semantics.

For Histogram Table Generator, **Loaded MSQ table is geometry-only**: it supplies the table X/Y breakpoint vectors and dimensions, while the user-selected analysis X/Y/Z channels remain unchanged.

## Phase 4 — Specialized analyzers

Status: **Complete for the currently approved scope; analyzers remain Experimental unless separately promoted**

Implemented tracks:

### BOOST

Capability-driven support for measured/target pressure, RPM, upper/lower wastegate duty, spool, steady-state and overshoot/undershoot analysis.

### IDLE

Target/error, valve duty/bias/feed-forward, PID terms where logged, sag/recovery behavior.

### AE / MAP PREDICT

Tip-in/decel events, TPS/MAP timing, predicted/measured MAP and AFR response evidence.

### FUELING

AFR target/actual error, qualification and optional VE/fuel-value context.

### IGNITION

Advance/retard/knock-oriented aggregates and events where channels permit.

### FUEL PRESSURE / INJECTOR

Pressure, rail differential, injector PW/duty/deadtime analysis and threshold events.

### TRIGGER / SYNC

Sync state, trigger error and sync-loss-counter evidence/events.

All specialized analyzers remain capability-driven, use supplied decoded data, preserve provenance/coverage and perform no hidden source reads or ECU writes.

## Current refinement track — Histogram / Table Generator

This is the current active product work after Phase 4, not Phase 5.

Established through PR #215:

- visualization-first/no-scroll Histogram workspace;
- Table Generator, Distribution, Scatter and Math Channels surfaces;
- full-channel on-demand analysis;
- custom/MSQ table geometry;
- MLV breakpoint weighted mean as first/default statistic;
- saved complete Table Generator presets;
- saved grouped filters with ALL/ANY logic;
- dedicated Math Channels editor;
- Size presets for Auto bins;
- cell source-sample drill-down and Logger navigation;
- compact cleanup of redundant labels/rows and improved readability.

MLV weighted parity is considered sufficiently matched for current use. The tiny remaining hit-count discrepancy is recorded in `docs/DECISIONS.md` as a compatibility footnote, not a current roadmap task.

## Phase 5 — Sessions, sharing, and reporting

Status: **Not started — explicit owner approval required**

Potential scope:

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

For exact present-tense continuation, always defer to `docs/HANDOFF.md`.