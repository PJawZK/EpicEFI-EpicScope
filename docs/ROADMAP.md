# EpicScope Roadmap

## Roadmap principles

The roadmap describes intended capability and implementation order. It does not authorize code to bypass `FILE_ARCHITECTURE.md`.

Each implementation task should identify:

- goal;
- architectural owner/location;
- dependencies;
- expected tests/validation;
- completion criteria.

Large features should be split into reviewable tasks before coding.

## Phase 0 — Foundation

Status: **Complete**

Goals:

- establish product identity and scope;
- establish file/system architecture;
- establish normalized data model;
- establish performance/platform requirements;
- establish repository workflow and handoff system;
- establish initial decisions and roadmap;
- establish naming, approval, input-security, and privacy/network rules;
- keep repository code-free until these authorities exist.

Exit criteria:

- all foundation documents exist and agree;
- approval authority and naming rules are explicit;
- parser/tune/session/persistence ownership is unambiguous;
- initial task/branch workflow is documented;
- first Web implementation tasks have approved architectural homes.

Phase 0 does **not** require the EpicHub UI reference itself to be inspected. That inspection is the first controlled task of Phase 1.

## Phase 1 — Web log foundation

Status: **Closeout pending hosted validation of the final graph-density refinement**

Purpose: create the smallest useful EpicScope Web application and prove the import/data/navigation path.

Planned task groups:

### WEB-REFERENCE — Complete

Completed outcomes:

- authoritative `EpicHub-Tablet-Landscape-0.0.45(2).html` inspected;
- current EpicHub Logger/Analyzer semantic UI authority inspected;
- inherited interaction rules recorded in `docs/UI_REFERENCE.md`;
- deliberate EpicScope deviations recorded;
- no application implementation code introduced during the reference task.

`EpicHub-Tablet-Landscape-0.0.45(2).html` supersedes the older Tablet Landscape prototype for EpicScope reference purposes.

Approved EpicScope refinements include a dedicated EpicScope shell, consistent right-side controls/details on wide layouts, offline/imported-log focus initially, Trigger Logger deferral, and performance taking priority over exact visual reproduction.

### WEB-BOOT — Complete

Detailed historical authority: `docs/WEB_BOOT_PLAN.md`.

Validated outcomes:

- npm package management with committed lockfile;
- Vite 8.x;
- vanilla TypeScript 7.x;
- no frontend framework;
- Chromium/Brave-first target;
- GitHub Actions branch/PR type-check and production-build validation;
- GitHub Pages deployment from authoritative `main`;
- no local clone/Node/npm required for project-owner testing;
- dedicated EpicScope Logger/Analyzer shell;
- right-side Full Sensor List / inspector responsibility;
- bottom timeline/transport responsibility;
- sensor-panel and timeline edge controls;
- no parser/domain-analysis implementation leaked into the Web shell;
- no graph/chart library selected during bootstrap.

Hosted Web application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

Hosted Brave validation exposed and then verified fixes for the sensor-panel hide behavior and narrow-width object preservation. WEB-BOOT has no remaining quality gate.

### LOG-MLG — Core path complete; ongoing regression benchmarking only

Detailed format/parser authority: `docs/LOG_MLG_PLAN.md`.

Implemented and validated outcomes:

- EFI Analytics MLVLG v1/v2 parsing with explicit unsupported-version handling for unverified newer formats;
- bounded/random-access source reads rather than mandatory full-file `ArrayBuffer` materialization;
- normalized log/channel/time contracts under `core/log-model/`;
- metadata/channel discovery, standard records, markers and timestamp rollover handling;
- bounded validation of file-provided sizes/counts/offsets and malformed/untrusted input handling;
- Vitest 5.x parser/core automated test gate;
- browser-local hosted MLG import;
- real EpicEFI/TunerStudio MLG v2 validation;
- CRC-invalid source samples retained as evidence and excluded from trusted graph/analysis use;
- staged Worker import so large logs can become usable after indexing while CRC validation continues;
- bounded Web source caching with a ~96 MiB ceiling;
- batched MLG channel decoding with a bounded 32 MiB decoded-channel cache;
- automatic large-log staged channel commit so several selected channels share one sequential row-oriented source pass.

Large-log hosted evidence currently includes a 318,023,627-byte MLG with 72,158 records and 1,652 channels. A four-channel uncached selection has been validated as one `batch=4` traversal of the source rather than four independent decode passes.

LOG-MLG completion/maintenance state:

- retry/recovery diagnostic classification is hosted-validated without altering checksum semantics or repairing source data;
- the 318 MB benchmark log separates recovered CRC retries and CRC-valid jump/repeat patterns from genuinely unresolved warnings;
- benchmark capture continues as a regression discipline rather than an unfinished LOG-MLG feature;
- MLVLG v3 remains deferred until authoritative format evidence exists.

Hosted decoded-channel cache reuse is validated: removing and re-adding previously decoded channels returns from the bounded decoded cache with zero physical source reads.

### LOG-CSV — Deferred by project owner

CSV remains a supported future import path but is not on the immediate Phase 1 critical path.

When resumed:

- normalize through the same log model;
- apply malformed/untrusted-input handling equivalent in principle to MLG;
- do not let CSV work delay higher-priority analysis, persistence or tuning workflows.

### TIMELINE

Implemented/validated foundation:

- synchronized timeline;
- cursor;
- zoom/pan and draggable/resizable focus window;
- graph panes;
- viewport-follow behaviour: cursor moves independently until reaching the center region, then the viewport follows;
- whole-log overview populated from active decoded graph traces without extra source reads;
- parsed source markers rendered in the overview;
- Previous/Next source-marker navigation;
- channel selection/search;
- high-zoom raw-sample rendering with bounded zoomed-out envelope rendering;
- user markers with edit/delete and shared marker navigation;
- A/B boundaries with range shading in graph and overview;
- saved ranges with rename/delete/restore;
- per-workspace previous/next view history;
- graph workspaces with independent channel/viewport/cursor state;
- Web WorkspaceState consolidation and global Undo/Redo;
- versioned browser-local per-log workspace persistence with explicit restore/forget behavior;
- fixed multi-pane layouts (Single, 4, 5 and 6 graph panes) with an explicit active-pane context;
- independent channel assignments per pane with shared cursor/viewport/A-B/timeline navigation;
- freeform five-pane layout with Mosaic/Columns/Rows/Cascade arrangements, drag/resize/snap and minimize/maximize;
- one shared multi-pane restore decode before pane activation;
- compact fixed-pane labels and compact draggable freeform title chips instead of full-width pane bars;
- Single layout stacked-channel rendering with one trace row per channel and compact per-row Now/Min/Max;
- Logger keyboard shortcuts with the shortcut reference moved under Settings;
- compact Compare header label.

Final Phase 1 workspace validation is limited to hosted regression checks of the latest graph-density UI and persistence/performance behavior.

### WORKSPACE / PERSISTENCE v1 — Implemented and hosted-validated

Implemented:

- Web-specific WorkspaceState under `apps/web/src/state/`, separate from domain Session;
- bounded 80-state Undo/Redo history;
- versioned `epicscope.web-workspace` v1 persisted artifact;
- storage-independent versioned envelope and compatibility handling under `core/persistence/`;
- browser-local storage adapter keyed by the existing source-log identity;
- automatic save/restore for matching logs;
- malformed/unsupported artifacts rejected rather than silently partially restored;
- explicit **Forget saved workspace** control;
- no raw MLG bytes or decoded channel arrays persisted.

Hosted validation confirmed exact-log restore across page reload/open and explicit Forget behavior. This v1 model remains valid current behavior until the approved INI-backed application-workspace migration lands.

Exit criteria:

- local MLG opens without upload;
- channels can be inspected and graphed;
- timeline navigation is usable for real tuning logs;
- parser/UI boundaries conform to architecture;
- invalid input does not cause unbounded allocation or whole-app failure where graceful handling is possible.

## Phase 2 — Channel catalog and generic analysis foundation

Purpose: decouple the persistent analysis workspace from any one opened log, establish stable source/channel identity, then build reusable analysis primitives before specialized analyzers multiply.

Implementation order begins with source context because persistent graph/channel layouts should exist before a log supplies samples.

Task groups:

### TUNE-INI / CHANNEL-CATALOG

- decode EpicEFI/TunerStudio INI source syntax under `core/parsers/ini/`;
- normalize firmware identity and known runtime/output-channel metadata without requiring an MLG to be open;
- establish stable logical channel keys suitable for persistence;
- merge INI-known channels with channels discovered from an opened MLG;
- bind each logical channel to the matching MLG channel/data source when present;
- represent at least: **known + data**, **known but unavailable in this log**, and **log-only channel**;
- never hide or discard a usable MLG-only channel simply because the loaded INI does not know it;
- keep the MLG authoritative for recorded samples and sample validity.

### WORKSPACE-PERSISTENCE v2

- split persistent application workspace state from log-specific analysis state;
- persist named workspaces, pane layouts/geometry, channel assignments, favorites and display preferences independently of a specific log identity;
- allow EpicScope to reopen with its workspace/channel structure present before any log is loaded;
- keep viewport/cursor/A-B/log annotations and other recording-specific state associated with the relevant log/session;
- migrate/extend the current versioned Web persistence format without silently reinterpreting existing v1 artifacts.

### CHANNELS

- aliases/groups/favorites;
- units;
- stable logical/source bindings;
- derived/math channels;
- channel statistics.

### ANALYSIS

- filters and qualification;
- range statistics;
- histogram;
- 2D histogram/heatmap;
- scatter;
- selectable aggregation methods;
- sample count/variance display;
- explicit X/Y/value/filter semantics.

### EVENTS

- event data contract;
- detector framework;
- initial generic detectors;
- event rail and event navigation.

### COMPARE-BASE

- load/relate multiple logs;
- trace overlays;
- range/event alignment primitives;
- metric delta presentation.

Exit criteria:

- EpicScope can start with named workspace/pane/channel structure present before any log is loaded;
- a supported INI can establish stable logical channels and bind them safely to supported MLG data when available;
- known-but-unlogged and log-only channel states remain explicit;
- generic tools can reproduce and improve common MLV-style analysis workflows;
- analyzers can depend on stable generic services rather than implementing their own copies.

## Phase 3 — MSQ tune enrichment and table correlation

Purpose: add actual tune/calibration values after the INI-backed channel/catalog foundation exists, then connect logged behaviour to tune tables and curves.

Task groups:

### TUNE-MSQ

- decode MSQ source syntax under `core/parsers/msq/`;
- normalize tune values, tables, curves and scalar settings under `core/tune/`;
- treat MSQ as optional tune-value enrichment rather than the primary runtime-channel catalog;
- combine MSQ tune values with INI metadata/definitions through normalized tune context;
- provide compatibility/validation reporting when INI/MSQ/log identities do not align.

### TABLE-MAP

- map log samples into actual table coordinates/cells;
- expose current table value, observed result, target/error, sample count, and stability metrics;
- reusable table-overlay API.

Exit criteria:

- supported MSQ tune values can enrich the existing INI/log source context;
- supported logs can be correlated with supported tune tables without UI-specific or source-format-specific interpretation leaking into analyzers.

## Phase 4 — Specialized analyzers

Purpose: turn EpicScope from a generic viewer into a tuning-diagnostics system.

Initial analyzer tracks:

### BOOST

Capability-driven boost analysis supporting, where available:

- single duty/solenoid systems;
- dual-solenoid systems;
- upper/lower chamber control;
- open-loop control;
- closed-loop control;
- target vs MAP error;
- spool/steady-state segmentation;
- overshoot/undershoot detection;
- table-aware cell statistics;
- comparable-pull analysis.

### IDLE

- target/error;
- idle valve duty and bias/feed-forward;
- P/I/D term decomposition where logged;
- load/clutch disturbance segmentation;
- sag, overshoot, recovery, settling metrics.

### AE / MAP PREDICT

- tip-in/decel event segmentation;
- TPS/MAP timing;
- predicted vs measured MAP;
- AFR response;
- lean/rich peak and recovery metrics;
- before/after comparison.

### FUELING

- VE/AFR error analysis;
- target/actual error qualification;
- tune-cell population and stability.

### IGNITION

- ignition advance/retard/knock-oriented analysis based on available channels and evidence.

### FUEL PRESSURE / INJECTOR

- rail/differential pressure behaviour;
- injector PW/duty/deadtime-related analysis where supported.

### TRIGGER / SYNC

- synchronization/dropout/event analysis where logged channels permit.

Each analyzer begins as **Experimental**, advances to **Beta**, then **Stable** only after validation.

## Phase 5 — Sessions, sharing, and reporting

- establish `core/session/` orchestration as required;
- extend the already-established `core/persistence/` version/migration infrastructure from workspace artifacts into full session artifacts;
- persist local session/workspace state with domain session and UI workspace state kept conceptually separate;
- annotations/bookmarks;
- analysis snapshots/results;
- optional publish/share flow inspired by EpicEFI Tune Viewer;
- explicit local-vs-shared privacy boundary;
- no silent transmission of log/tune/analysis content;
- schema/version/migration support.

Any backend/share service architecture must be approved before a new top-level service/backend area is created.

## Phase 6 — Web functional maturity review

Before Linux implementation becomes the main focus:

- review feature completeness;
- identify missing high-value workflows;
- consolidate duplicate concepts;
- freeze or version key data/analyzer contracts;
- profile representative workloads;
- define Linux performance benchmark suite and hardware baselines;
- decide which Web internals are retained, replaced, or ported.

## Phase 7 — Linux production implementation

Primary target: Debian 13 Stable.

Goals:

- approve the Linux application/runtime file architecture before implementation;
- native high-performance data path;
- low RAM;
- large-log indexing;
- fast bounded queries;
- responsive graphs/tables;
- preserve established EpicScope semantics;
- meet or approach the 1 GiB log / 2 GiB RAM requirement on representative hardware.

Likely areas for native implementation include parser/data storage/analysis hot paths. Rust is a preferred candidate but must still be justified by actual architecture and measurements.

## Phase 8 — Linux feature expansion

After core production performance is stable:

- native file watching/library features if useful;
- very large logs;
- persistent indexes/caches;
- optional direct ECU logging/live analysis;
- additional analyzers;
- packaging/update strategy.

## Phase 9 — Android / EpicHub integration

- identify reusable core components;
- approve Android/EpicHub integration architecture before adding platform directories;
- adapt proven analyzer workflows to EpicHub;
- design tablet/mobile presentation separately where needed;
- avoid importing Linux desktop assumptions unchanged.

## Roadmap change control

New major feature groups may be added, but they must be placed deliberately in the roadmap and architecture before implementation.

A feature request is not itself approval for a new subsystem or architectural layer.
