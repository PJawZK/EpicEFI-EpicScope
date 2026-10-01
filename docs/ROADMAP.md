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

Status: **In progress**

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
- first Web implementation tasks have approved architectural homes;
- the exact EpicHub Logger/Analyzer reference to be used for EpicScope Web has been identified/inspected before shell implementation begins.

## Phase 1 — Web log foundation

Purpose: create the smallest useful EpicScope Web application and prove the import/data/navigation path.

Planned task groups:

### WEB-REFERENCE

- inspect/identify the exact current EpicHub Logger/Analyzer layout/design reference;
- capture only the relevant Logger/Analyzer interaction rules for EpicScope;
- confirm right-side details/settings and timeline behavior against the source/reference rather than reconstructing from memory;
- document any deliberate EpicScope deviations before implementation.

### WEB-BOOT

- lightweight TypeScript project bootstrap;
- Chromium/Brave-first development target;
- application shell based on the approved EpicHub Logger/Analyzer interaction model;
- right-side details/settings panel convention;
- minimal styling focused on readability and responsiveness.

`WEB-BOOT` should not implement the reference layout before `WEB-REFERENCE` is complete.

### LOG-MLG

- MLG format investigation/specification;
- parser implementation under `core/parsers/mlg/`;
- metadata/channel discovery;
- normalized channel/time model;
- error handling for malformed/unsupported/untrusted content;
- bounded validation of file-provided sizes/counts/offsets;
- curated small MLG fixtures.

### LOG-CSV

- CSV import after MLG path is established;
- normalization through the same log model;
- malformed/untrusted-input handling equivalent in principle to MLG.

### TIMELINE

- synchronized timeline;
- cursor;
- zoom/pan;
- graph panes;
- viewport-follow behaviour: cursor moves independently until reaching the center region, then the viewport follows;
- markers/bookmarks;
- channel selection/search.

Exit criteria:

- local MLG opens without upload;
- channels can be inspected and graphed;
- timeline navigation is usable for real tuning logs;
- parser/UI boundaries conform to architecture;
- invalid input does not cause unbounded allocation or whole-app failure where graceful handling is possible.

## Phase 2 — Generic analysis toolkit

Purpose: establish reusable analysis primitives before specialized analyzers multiply.

Task groups:

### CHANNELS

- aliases/groups/favorites;
- units;
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

- generic tools can reproduce and improve common MLV-style analysis workflows;
- analyzers can depend on stable generic services rather than implementing their own copies.

## Phase 3 — Tune awareness

Purpose: connect log behaviour to the actual tune/firmware configuration.

Task groups:

### TUNE-INI

- EpicEFI/TunerStudio INI source decoding under `core/parsers/ini/` as required;
- normalization into `core/tune/` firmware/tune context;
- firmware identity and channel/table metadata.

### TUNE-MSQ

- MSQ source decoding under `core/parsers/msq/`;
- normalized tune/table model under `core/tune/`;
- compatibility/validation reporting.

### TABLE-MAP

- map log samples into actual table coordinates/cells;
- expose current table value, observed result, target/error, sample count, and stability metrics;
- reusable table-overlay API.

Exit criteria:

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
- establish `core/persistence/` schema/version/migration logic as required;
- persist local session/workspace state;
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
