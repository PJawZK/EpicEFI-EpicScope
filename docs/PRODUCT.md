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

## Primary workflows

EpicScope should support these core workflows:

1. Open a local log and inspect channels immediately.
2. Search and organize channels.
3. Navigate the timeline quickly using zoom, pan, cursor, markers, and synchronized graph panes.
4. Create derived/math channels.
5. Filter samples and build histograms, heatmaps, scatter plots, statistics, and aggregations.
6. Detect relevant tuning events automatically.
7. Load tune/firmware context and correlate logged behaviour with actual tune-table cells.
8. Use specialized analyzers for tuning systems.
9. Compare logs, events, and tune revisions.
10. Save analysis/session state.
11. Optionally share or publish a session without making upload mandatory for analysis.

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
