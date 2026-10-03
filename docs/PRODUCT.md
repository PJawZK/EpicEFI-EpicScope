<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. If a status statement in this document describes an older milestone, use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Product Definition

## Purpose

EpicScope is an ECU log analysis and tuning-diagnostics application intended to help a tuner **scope a tune**: inspect recorded behaviour, find faults, quantify weak areas, compare changes, and identify opportunities for improvement.

It is not intended to be only a generic graph viewer. Generic log-viewing functions are the foundation for higher-level, tune-aware analysis.

## Product stages

### Stage 1 — EpicScope Web

The Web application is the functional reference and feature-validation platform.

Primary goals:

- rapid iteration across the user's different computers and operating systems;
- establish complete workflows before expensive native optimization;
- validate analysis tools, UI behaviour, data contracts, and tune-aware features;
- keep architecture compatible with later native replacement of heavy processing layers.

The Web stage should avoid obviously wasteful architecture, but final low-RAM and large-file performance is not its primary acceptance criterion.

### Stage 2 — EpicScope Linux

The Linux application is the primary production target.

Primary goals:

- maximum practical log-reading and analysis speed;
- very low memory use;
- large-log support;
- native file access and indexing;
- deterministic performance on modest hardware;
- compatibility with Debian 13 Stable and suitably compatible newer Linux systems.

Visual polish may be reduced whenever it conflicts materially with speed, memory use, clarity, or responsiveness.

### Stage 3 — EpicScope for EpicHub / Android

After Web behaviour and Linux performance are mature, proven analysis concepts and reusable core logic may be adapted for EpicHub / Android.

Android requirements must not distort the Web or Linux architecture prematurely.

<!-- CURRENT_STATE:current-web-implementation:START -->
## Current Web implementation state

The Web product is now a usable hosted large-log analyzer foundation rather than an early shell. Current capabilities include MLG v1/v2 import/index/validation, INI-backed channel identity and log binding, persisted named workspaces and pane assignments, multi-pane graph/timeline navigation, annotations/ranges, channel statistics/search, diagnostics, and large-log source/decode caching.

For arbitrary newly selected channels, the current interaction model is **fast visible subset first, then one-time full resident channel**. This lets the UI become useful before an expensive row-oriented full-file scan, while still making later zoom/pan independent of source I/O after materialization. Hardware-adaptive scheduling is permitted where measured evidence shows a clear low-spec benefit, provided product semantics remain the same.

The Web stage remains the functional reference. The current optimization work is not intended to turn browser-specific Blob/cache behavior into a Linux architecture requirement.
<!-- CURRENT_STATE:current-web-implementation:END -->

## Primary workflows

EpicScope should support these core workflows:

1. Reopen the application with named workspaces, pane layouts, and channel assignments still present even when no log is loaded.
2. Load an EpicEFI/TunerStudio INI definition to establish stable known-channel/firmware context where available.
3. Open a local log and bind recorded channels/data into that existing workspace immediately.
4. Keep known-but-unlogged channels visible as unavailable and keep usable log-only channels accessible.
5. Search and organize channels.
6. Navigate the timeline quickly using zoom, pan, cursor, markers, and synchronized graph panes.
7. Create derived/math channels.
8. Filter samples and build histograms, heatmaps, scatter plots, statistics, and aggregations.
9. Detect relevant tuning events automatically.
10. Optionally load MSQ tune values/tables and correlate logged behaviour with actual tune-table cells.
11. Use specialized analyzers for tuning systems.
12. Compare logs, events, and tune revisions.
13. Save analysis/session state.
14. Optionally share or publish a session without making upload mandatory for analysis.

## Initial specialized analyzers

The initial planned specialized analyzer families are:

- Boost control
- Idle / PID
- Acceleration enrichment / MAP Predict
- Fueling / VE / AFR error
- Ignition / knock
- Fuel pressure / injector behaviour
- Trigger / sync

Analyzer availability may evolve through explicit roadmap and architecture decisions.

### Boost analyzer scope

Boost analysis must be capability-driven rather than tied to one wastegate plumbing strategy.

The analyzer should be able to support, where channels/context permit:

- single-solenoid / single-duty systems;
- dual-solenoid systems;
- upper/lower chamber control;
- open-loop control;
- closed-loop control;
- target vs actual boost behavior;
- spool, overshoot, undershoot, and steady-state behavior.

The user's current upper/lower chamber setup is an important first-class use case, but must not define the analyzer so narrowly that other EpicEFI boost-control arrangements require a separate architecture.

## Analysis principles

### Evidence before recommendation

EpicScope should expose the evidence behind findings: qualifying sample count, event selection, statistical method, variance or spread where relevant, and the exact data region used.

Recommendations must not be presented as unexplained conclusions.

### Tune awareness

When firmware/tune information is available, EpicScope should understand the relationship between logged samples and tune structures rather than treating every channel as an isolated signal.

INI and MSQ serve different product roles:

- INI can establish firmware identity and a stable known runtime/output-channel catalog before any log is opened;
- MLG remains authoritative for recorded samples and sample validity;
- MSQ later supplies actual tune/calibration values, tables, curves, and scalar settings.

A persistent workspace should therefore be able to show its configured channels while waiting for log data rather than requiring channel-layout recreation for every recording.

Examples include:

- mapping RPM/load samples into actual tune-table cells;
- comparing target vs actual behaviour;
- showing current table value, observed value, error, sample count, and stability together;
- comparing table revisions against resulting behaviour.

### Explicit histogram semantics

Every table/histogram/heatmap must make its meaning visible:

- X axis
- Y axis
- cell value
- aggregation method
- active filters
- sample count

The user should never have to infer whether a cell represents MAP, duty, error, average, maximum, or another quantity.

## Event system

EpicScope should develop a reusable event-detection layer capable of identifying and navigating events such as:

- WOT pulls
- tip-in / acceleration events
- gear changes
- throttle closures
- boost overshoot / undershoot
- idle entry
- idle sag / disturbance
- DFCO entry/exit
- transient fuel events

Event detection must be separated from presentation so events can be reused by analyzers, comparisons, and reports.

## Comparison system

Comparison is a first-class product capability.

EpicScope should support:

- before/after log comparison;
- aligned comparable events;
- tune-revision comparisons;
- aggregate metric deltas;
- overlayed traces;
- analyzer-specific comparisons such as boost spool/overshoot or idle recovery/settling.

## Local-first privacy

Opening and analyzing a local log must not require upload.

Local-first also means EpicScope must not silently transmit log contents, tune contents, filenames, derived values, or analysis results as telemetry/analytics.

Any future sharing, publishing, or telemetry function must be explicit, separately reviewed, and clearly distinguished from ordinary local analysis.

## Feature maturity

Major analyzers and user-facing capabilities use one of these maturity labels:

- **Experimental** — behaviour/API may change substantially; results require extra scrutiny.
- **Beta** — intended workflow is established but validation and edge-case coverage are incomplete.
- **Stable** — behaviour is considered suitable for normal use and compatibility should be preserved.

Promotion between levels requires evidence appropriate to the feature.

## Non-goals for early Web development

The early Web phase does not need to solve:

- final native memory mapping;
- native thread-pool design;
- final Linux binary packaging;
- direct ECU serial/CAN acquisition;
- Android integration;
- extreme visual polish.

Those concerns remain part of the long-term map but must not slow functional discovery prematurely.
