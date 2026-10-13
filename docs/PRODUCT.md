<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Product Definition

## Purpose

EpicScope is an ECU log analysis and tuning-diagnostics application intended to help a tuner **scope a tune**: inspect recorded/live behaviour, find faults, quantify weak areas, compare changes, and identify opportunities for improvement.

It is not intended to be only a generic graph viewer. Generic log-viewing functions are the foundation for higher-level, tune-aware analysis.

## Product stages

### Stage 1 — EpicScope Web

The Web application is the functional reference and feature-validation platform.

Primary goals:

- rapid iteration across different computers/operating systems;
- establish complete workflows before expensive native optimization;
- validate analysis tools, UI behaviour, data contracts and tune-aware features;
- keep architecture compatible with later native replacement of heavy processing layers.

### Stage 2 — EpicScope Linux

The Linux application is the primary production target.

Primary goals:

- maximum practical log-reading/analysis speed;
- low memory use;
- very large log support;
- native file access/indexing;
- deterministic performance on modest hardware;
- Debian 13 Stable compatibility baseline.

### Stage 3 — EpicScope for EpicHub / Android

After Web behaviour and Linux performance mature, proven analysis concepts/core logic may be adapted for EpicHub/Android without forcing Android constraints into earlier stages.

## Current Web implementation state

EpicScope Web is a usable large-log/live-source analysis foundation with:

- MLG v1/v2 import/index/staged CRC validation;
- OPFS MLG sidecar/native-column access for large-log reuse;
- INI-backed stable channel identity and MLG binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces and pane assignments;
- exact-log viewport/cursor/A-B/marker/range persistence kept separate from reusable workspace state;
- multi-pane graph/timeline navigation;
- Logger, Analyzer and Histogram product surfaces;
- specialized Analyzer surfaces for Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel / Injector and Trigger / Sync;
- runtime-health, parser, retained-memory and performance diagnostics;
- validated `ts_shim` live/retained-source integration on the real Mega144H7 → Pi Zero 2 W → LAN → browser path;
- semantic channel-role resolution and built-in pre-populated workspace infrastructure on the current feature branch.

The earlier Web performance campaign is considered good enough unless a measured regression appears. Current active product work is semantic pre-populated workspaces and their cross-source/cross-ECU behavior.

## Primary user workflow

The approved visible workflow is:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

This is the product-level interaction order. UI controls should make this progression obvious rather than presenting every capability at the same visual priority.

### 1. Load Data

- Open Log and Load INI are grouped under **Load Data ▾**.
- INI remains optional for ordinary log analysis.
- MLG remains authoritative for recorded samples/validity.
- Shim may temporarily become the authoritative live/capture source without forcing an application reload.

### 2. Channels

- search/filter/group/sort channels;
- preserve Active/Favorites/Recent semantics;
- show current unit-aware values directly where useful;
- keep known-but-unlogged channels explicit;
- keep usable log-only channels accessible;
- preserve source identity while allowing semantic role resolution above it.

### 3. Navigate

- timeline/cursor;
- zoom/pan/Fit;
- playback/step;
- synchronized graph panes;
- previous/next view history.

### 4. Select / qualify range

- A/B boundaries;
- saved ranges;
- markers;
- sample filters/qualification criteria.

### 5. Analyze

Generic tools and reusable analysis primitives support specialized analyzers:

- range statistics;
- histogram;
- 2D histogram/heatmap/table;
- scatter;
- generic event analysis;
- specialized analyzers.

### 6. Compare / Export

Compare/export are result-stage capabilities. Empty or disabled top-level placeholders are not product value and should not consume permanent toolbar space before the capability exists.

## EpicScope modes/surfaces

The **EpicScope logo dropdown** is the approved in-product mode/surface switcher.

Current primary entries:

- Logger;
- Analyzer;
- Histogram.

Analyzer and Histogram may use compact secondary selectors for their own subviews. This mode switcher is not the full EpicHub Dashboard/Tuner/Diagnostics shell.

## Graph workspace model

Global workspace context is presented as **Graphs · <workspace>** rather than an unexplained bare name.

EpicScope now distinguishes:

- **Layout** — graph geometry only;
- **Workspace** — a tuning/diagnostic task that references a layout and channel roles.

Initial layout vocabulary:

- Single;
- Dual;
- Triple;
- Quad;
- Focus + 2;
- Focus + 3;
- Six Pane.

Workspace names describe purpose, not geometry. Initial generic targets include General, Idle, Fuel, Ignition, Boost, Transient / AE, Cooling, Fuel System, Trigger / Sync, Startup / Warmup, Electrical and Vehicle / Driveline.

The global shell communicates the active graph workspace. Active pane identity remains local to the pane so the header does not duplicate graph/pane information.

## Semantic channel roles for built-ins

Built-in task workspaces should not embed one ECU family's channel IDs.

Product model:

```text
built-in workspace
      ↓
semantic channel roles
      ↓
ECU/schema alias/capability resolution
      ↓
source-specific channel identity
```

Example:

```text
engine.rpm → RPMValue → ini:RPMValue  (MLG + INI)
engine.rpm → RPMValue → RPMValue      (ts_shim)
```

This lets the same task workspace survive source changes and makes multi-ECU support tractable.

### Naming policy

Source aliases and display names are deliberately separate.

Legacy/vendor naming may be accepted for matching, but EpicScope chooses a modern, stable user-facing name. Example:

```text
legacy alias: TP
semantic role: engine.throttle.position
EpicScope display: TPS
```

The same principle applies to historical abbreviations such as `PW`, `Batt V`, `CLT`, `ECT`, etc. Established clear abbreviations such as RPM, MAP, TPS, AFR and Lambda may remain visible.

### Required / preferred / optional roles

Each built-in workspace role is classified as:

- **required** — central to the workspace purpose;
- **preferred** — expected and materially useful;
- **optional** — enhancement when the ECU exposes it.

A workspace should remain loadable with unresolved roles. Missing data is shown explicitly rather than fabricated.

### Generic vs ECU-native workspaces

Generic workspaces should resolve across ECU families where possible.

ECU-native workspaces may also exist when a schema exposes richer capabilities. EpicEFI examples include Dual Chamber Boost, MAP Predict + Wall Wetting, ETB Control, Fuel Rail Diagnostics, Trigger + Sync Detailed, Injector / Ignition Timing and Engine Protection.

Availability should be capability-driven rather than hard-coded by board name.

Related authority:

- [`PREPOPULATED_WORKSPACES.md`](PREPOPULATED_WORKSPACES.md) — detailed workspace catalog and implementation status;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — semantic/capability layer and source-aware materialization;
- [`DATA_MODEL.md`](DATA_MODEL.md) — semantic role/template concepts;
- [`DECISIONS.md`](DECISIONS.md) — D-051–D-054 naming, identity and built-in behavior.

## First semantic workspace validation

The first validation intentionally used the simplest **Single** layout with one pane and four roles: RPM, MAP, TPS and Coolant Temp.

The same built-in workspace identity was verified across:

```text
MLG + INI → ts_shim → MLG + INI
```

with canonical recorded identities changing to raw Shim identities and back while the workspace remained stable.

That proof is the basis for the first production preset, **General · Single**, which expands the overview to RPM, MAP, TPS, Coolant Temp, Intake Air Temp, Battery Voltage, Lambda and Ignition Advance.

The expanded eight-role preset is implemented on the active feature branch but must not be considered runtime-validated until its local typecheck/test and real source round trip are completed.

## Analysis principles

### Evidence before recommendation

EpicScope should expose evidence behind findings:

- qualifying sample count;
- event/range selection;
- statistical/aggregation method;
- variance/spread where relevant;
- exact source region used.

Recommendations must not appear as unexplained conclusions.

### Tune awareness

When source/tune context exists:

- INI establishes firmware identity and stable known runtime/output-channel definitions;
- MLG remains authoritative for recorded samples and validity;
- MSQ supplies actual tune/calibration values, tables, curves and scalars.

Examples of tune-aware workflows:

- map RPM/load samples into tune-table cells;
- compare target vs actual behavior;
- show tune value, observed result, error, sample count and stability together;
- compare tune revisions against resulting behavior.

### Explicit binned-analysis semantics

Every table/histogram/heatmap must visibly state:

- X axis;
- Y axis where applicable;
- value/cell meaning;
- aggregation method;
- active filters;
- sample count.

The user must never need to guess whether a cell represents MAP, duty, error, average, maximum, or another quantity.

## Event system

EpicScope should develop reusable event detection for examples such as:

- WOT pulls;
- tip-in/acceleration events;
- gear changes;
- throttle closures;
- boost overshoot/undershoot;
- idle entry/sag/disturbance;
- DFCO entry/exit;
- transient fuel events.

Event detection must remain separate from presentation so analyzers/comparison/reporting can reuse it.

## Comparison system

Comparison is a first-class product capability.

Expected support includes:

- before/after log comparison;
- aligned comparable events/ranges;
- tune-revision comparison;
- aggregate metric deltas;
- trace overlays;
- analyzer-specific comparisons.

## Specialized analyzers

Current/planned families include:

- Boost control;
- Idle / PID;
- Acceleration enrichment / MAP Predict;
- Fueling / VE / AFR error;
- Ignition / knock;
- Fuel pressure / injector behavior;
- Trigger / sync.

Specialized analyzers must build on generic analysis/events/compare/tune services rather than privately reimplementing them.

### Boost analyzer scope

Boost analysis must remain capability-driven and support, where channels permit:

- single-solenoid/single-duty;
- dual-solenoid;
- upper/lower chamber;
- open-loop;
- closed-loop;
- target vs actual behavior;
- spool/overshoot/undershoot/steady-state metrics.

## Local-first privacy

Opening/analyzing a local log must not require upload.

EpicScope must not silently transmit log/tune contents, filenames, derived values or analysis results as telemetry/analytics. Future sharing/publishing/telemetry must be explicit and separately reviewed.

## Feature maturity

Major analyzers/capabilities use:

- **Experimental**;
- **Beta**;
- **Stable**.

Promotion requires validation evidence.

## Non-goals for current Web work

Current Web development does not need to solve:

- final native memory mapping;
- final Linux thread-pool/runtime design;
- final Linux packaging;
- direct ECU serial/CAN acquisition outside the validated Shim path;
- Android integration;
- decorative polish that conflicts with clarity/performance.

Current Web work should continue to use measured behavior and concrete tuning/diagnostic usefulness as its guide.
