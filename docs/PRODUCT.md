<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Product Definition

## Purpose

EpicScope is an ECU log analysis and tuning-diagnostics application intended to help a tuner **scope a tune**: inspect recorded behaviour, find faults, quantify weak areas, compare changes, and identify opportunities for improvement.

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

EpicScope Web is now a usable hosted large-log analysis foundation with:

- MLG v1/v2 import/index/staged CRC validation;
- OPFS MLG sidecar/native-column access for large-log reuse;
- INI-backed stable channel identity and MLG binding;
- reusable named graph workspaces and pane assignments;
- exact-log viewport/cursor/A-B/marker/range persistence kept separate from reusable workspace state;
- multi-pane graph/timeline navigation;
- channel search/filter/statistics and standardized live-value display;
- performance/source diagnostics and tested report formatting.

The earlier Web performance campaign and repository structural audit are considered good enough for now. The active product milestone is UI hierarchy, followed by generic analysis primitives.

## Primary user workflow

The approved visible workflow is:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

This is the product-level interaction order. UI controls should make this progression obvious rather than presenting every capability at the same visual priority.

### 1. Load Data

- Open Log and Load INI are grouped under **Load Data ▾**.
- INI remains optional for ordinary log analysis.
- MLG remains authoritative for recorded samples/validity.

### 2. Channels

- search/filter/group/sort channels;
- preserve Active/Favorites/Recent semantics;
- show current unit-aware values directly where useful;
- keep known-but-unlogged channels explicit;
- keep usable log-only channels accessible.

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
- future sample filters/qualification criteria.

### 5. Analyze

Generic tools should come before specialized analyzers:

- range statistics;
- histogram;
- 2D histogram/heatmap/table;
- scatter;
- generic event analysis;
- later specialized analyzers.

### 6. Compare / Export

Compare/export are result-stage capabilities. Empty or disabled top-level placeholders are not product value and should not consume permanent toolbar space before the capability exists.

## EpicScope modes/surfaces

The **EpicScope logo dropdown** is the approved in-product mode/surface switcher.

Current entries:

- Logger — active;
- Analyzer — planned;
- Histogram — planned.

Future real capabilities may justify Scatter, Histogram/Table, Math Channels, or specialized Analyzer surfaces. This mode switcher is not the full EpicHub Dashboard/Tuner/Diagnostics shell.

## Graph workspace model

Global workspace context is presented as **Graphs · <workspace>** rather than an unexplained bare name such as `General`.

The global shell communicates the active graph workspace. Active pane identity remains local to the pane so the header does not duplicate graph/pane information.

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
- MSQ later supplies actual tune/calibration values, tables, curves and scalars.

Examples of later tune-aware workflows:

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

Expected later support:

- before/after log comparison;
- aligned comparable events/ranges;
- tune-revision comparison;
- aggregate metric deltas;
- trace overlays;
- analyzer-specific comparisons.

## Initial specialized analyzers

Planned families:

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
- direct ECU serial/CAN acquisition;
- Android integration;
- decorative polish that conflicts with clarity/performance.

The immediate product priority is to finish the Logger navigation/range UI hierarchy, then build the first generic analysis workflow on top of it.
