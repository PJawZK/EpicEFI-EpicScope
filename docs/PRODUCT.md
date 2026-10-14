<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Research-to-product disposition is tracked in `docs/research/STATUS.md`.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Product Definition

## Purpose

EpicScope is an ECU log analysis and tuning-diagnostics application intended to help a tuner **scope a tune**: inspect recorded/live behaviour, find faults, quantify weak areas, compare changes, and identify opportunities for improvement.

It is not intended to be only a generic graph viewer. Generic log-viewing functions are the foundation for higher-level, tune-aware analysis.

EpicScope is also not a live ECU tune editor. Tune/MSQ data may enrich analysis and future VE proposals may be reviewable/applicable, but tune/ECU state must remain separate from analysis state unless the user explicitly performs a future approved apply/write workflow.

## Product stages

### Stage 1 — EpicScope Web

The Web application is the functional reference and feature-validation platform.

Primary goals:

- rapid iteration across different computers/operating systems;
- establish complete workflows before expensive native optimization;
- validate analysis tools, UI behaviour, data contracts and tune-aware features;
- keep architecture compatible with later native replacement of heavy processing layers.

### Stage 2 — EpicScope Linux

The Linux application is the primary production target after the Web maturity review.

Primary goals:

- maximum practical log-reading/analysis speed;
- low memory use;
- very large log support;
- native file access/indexing;
- deterministic performance on modest hardware;
- Debian 13 Stable compatibility baseline.

### Stage 3 — EpicScope for EpicHub / Android

After Web behaviour and Linux performance mature, proven analysis concepts/core logic may be adapted for EpicHub/Android without forcing Android constraints into earlier stages.

## Current Web implementation state — 2026-10-14

EpicScope Web is a usable large-log/live-source analysis reference with:

- MLG v1/v2 import/index/staged CRC validation;
- INI-backed stable channel identity and MLG binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces and exact-log navigation persistence;
- multi-pane graph/timeline navigation;
- Logger, Analyzer and Histogram product surfaces;
- 12 generic semantic starter workspaces plus 12 capability-gated EpicEFI-specific starters;
- specialized Analyzer surfaces for Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel Pressure / Injector and Trigger / Sync;
- mature generic Histogram surfaces for Table Generator, Distribution, Scatter and Math Channels;
- runtime-health, parser, retained-memory and performance diagnostics;
- validated `ts_shim` live-source integration on the real Mega144H7 → Pi Zero 2 W → LAN → browser path;
- unit-aware channel selectors in Analyzer and Histogram;
- explicit source/load ordering under Load Data: INI → MSQ → LOG → UNLOAD → TS-SHIM.

Current maturity summary:

- Logger: mature functional reference.
- Histogram: research-parity checkpoint reached for the approved generic scope.
- Fueling/Ignition: mature experimental Analyzer checkpoints.
- Boost: strong experimental Analyzer foundation.
- Idle/AE: useful but thinner.
- Fuel Pressure / Injector: active maturity track.
- Trigger / Sync: next broad-coverage Analyzer target.
- VE Analyzer: researched and specified, not yet implemented.
- MLG v3: researched compatibility extension, not yet implemented.

The earlier Web performance campaign remains good enough unless a measured regression appears.

## Primary user workflow

The approved visible workflow is:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

UI controls should make this progression obvious rather than presenting every capability at the same visual priority.

### Load Data

The order is intentionally:

1. Load INI;
2. Load MSQ;
3. Open Log;
4. Unload Log;
5. Connect Shim.

INI and MSQ are independent application resources. Recorded MLG or Shim is the active sample source family.

### Channels

- search/filter/group/sort channels;
- preserve Active/Favorites/Recent semantics;
- show unit-aware channel labels where practical;
- keep known-but-unlogged channels explicit;
- keep usable log-only channels accessible;
- preserve source identity while allowing semantic role resolution above it.

### Navigate

- timeline/cursor;
- zoom/pan/Fit;
- playback/step;
- synchronized graph panes;
- previous/next view history.

### Select / qualify range

- A/B boundaries;
- saved ranges;
- markers;
- Qualification criteria.

### Analyze

Generic tools support question-specific analyzers:

- range statistics;
- Table Generator;
- Distribution;
- Scatter;
- Math Channels;
- generic event analysis;
- specialized analyzers.

### Compare / Export

Compare/export are result-stage capabilities. Empty top-level placeholders should not consume permanent UI space before the capability exists.

## EpicScope modes/surfaces

The **EpicScope logo dropdown** is the approved in-product mode/surface switcher.

Current primary entries:

- Logger;
- Analyzer;
- Histogram.

Analyzer and Histogram use compact secondary selectors for their own subviews.

## Graph workspace model

EpicScope distinguishes:

- **Layout** — graph geometry only;
- **Starter template** — task-oriented semantic recipe;
- **Workspace** — ordinary user-owned materialized state.

A starter resolves once against the current channel catalog and becomes an ordinary editable workspace. Source changes normalize channel identity; they do not reapply template ownership.

### Fresh-state generic workspace set

```text
General
Idle
Boost
Fuel
Ignition
Cooling
Transient / AE
Fuel System
Trigger / Sync
Startup / Warmup
Electrical
Vehicle / Driveline
```

These are editable/deletable user workspaces after materialization.

### Semantic channel roles

Starter templates and analyzers resolve semantic roles rather than hard-code one ECU family’s raw IDs.

Resolution prefers canonical/native identities, then compatible aliases, then conservative fuzzy fallback. Missing roles remain explicit rather than fabricated.

## Generic Histogram product contract

Histogram is the reusable relationship/statistical layer between Logger and question-specific Analyzer surfaces.

Shared flow:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

### Table Generator

Current mature capability includes shared scopes/Qualification, physical + Math Channel inputs, automatic/custom/MSQ geometry, Count/Mean/Median/Min/Max/Sum/StdDev/Variance/Weighted Mean, reference/delta evidence, weighted breakpoint-node behavior, exact cell evidence, Logger navigation and CSV/provenance.

### Distribution

Current mature capability includes shared scopes/Qualification/Math Channels, Count/% Samples/Time, Histogram/Cumulative, comparison on shared geometry, saved setups, CSV, exact Fixed Min/Max/Width geometry, explicit outside-geometry provenance and Logger evidence.

### Scatter

Current targeted maturity includes shared scopes/Qualification/Math Channels, Single/Dual, Dots/Lines, density heat, bounded rendering, point and box-region evidence, strongest contiguous Logger visit, saved setups and qualified/region CSV export.

### Math Channels

Current expression language includes arithmetic, comparison/logical expressions, lazy `if()`, exact-name-first historical references and temporal helpers including `lag()`, `delta()`, moving `avg()` and timestamp-based `rate()`.

Nested saved Math Channel references remain deliberately unsupported.

Research-derived generic Histogram gaps selected from MegaLogViewer are closed at this checkpoint. See `docs/research/STATUS.md` for the full disposition.

## Specialized Analyzer product contract

Analyzer is evidence-first and question-specific.

An analyzer should:

- find relevant operating events/conditions;
- quantify the result;
- show evidence/provenance;
- distinguish observation from causation;
- expose unavailable/missing inputs;
- navigate back to Logger;
- avoid unexplained tune recommendations.

Current active sequencing is:

1. finish Fuel Pressure / Injector;
2. mature Trigger / Sync;
3. implement VE Analyzer from `docs/VE_ANALYZER.md`;
4. then address remaining AE / MAP Predict and Idle gaps.

## Fuel Pressure / Injector product semantics

Current architecture explicitly separates:

- calibrated low-side pressure (`fuelPressure_low`);
- calibrated high-side/GDI pressure (`fuelPressure_high`);
- rail differential;
- raw electrical pressure channels;
- CEL/check-engine status channels.

Raw electrical and CEL channels must not masquerade as engineering pressure evidence.

Conventional / port-injection mode uses rail differential as active pressure evidence. GDI / high-pressure mode uses high-side rail pressure while retaining low-side supply context.

Current injector evidence includes duty/headroom and saturation context. Remaining work is deeper event context, pressure sag/recovery, repeatability, pump/prime evidence and voltage/deadtime evidence.

## VE Analyzer product direction

`docs/VE_ANALYZER.md` is the planned behavior contract derived from MLV/EMU PRO research.

Key target behavior:

- semantic VE-analysis qualification presets;
- separate delay-discovery qualification;
- explicit user-triggered lambda-delay discovery;
- single / RPM-curve / RPM×load delay models;
- timestamp-based delay alignment;
- table-aware/bilinear VE-node evidence;
- prior/confidence authority;
- result states that distinguish measured/interpolated/weak/withheld/no-evidence;
- exact source provenance;
- separate evidence recommendation from user apply percentage;
- explicit diff-first application only if/when tune-write integration is later approved.

EpicScope should improve on the mature references where its architecture supports stronger provenance, clearer qualification and more transparent confidence.

## MLG compatibility direction

Production support remains v1/v2.

`docs/research/MLG_V3_RESEARCH.md` shows that v3 is a compatibility extension of the v2-style container with additional type/endianness semantics, not a new parser architecture. Confirmed LE scalar IDs 9..14 must be implemented only with regression coverage; unknown/reserved mappings must not be guessed.

## Research preservation and interpretation

Historical third-party behavior research lives under `docs/research/`.

- research documents record what was observed and why it mattered;
- `docs/research/STATUS.md` records what EpicScope has implemented, improved, partially implemented, planned, deferred or assigned to another product;
- later EpicScope improvements should not erase the historical reference note.

TunerStudio table-interaction/stability research mainly belongs to EpicHub because EpicHub owns live tuning/write semantics. EpicScope should carry only the transferable invariants: proposal state separate from tune state, explicit apply/write, diff-first review, and no implicit Burn semantics.

## Shared timeline UI contract

Logger owns the authoritative timeline. Table Generator, Distribution and Scatter reuse the complete `.timeline-wrap` intact so the Hide/Show-controls edge tab retains correct positioning.

## Analysis principles

### Evidence before recommendation

EpicScope should expose qualifying sample count, selection/scope, aggregation method, spread/consistency where relevant, and exact source evidence.

Recommendations must not appear as unexplained conclusions.

### Tune awareness

When context exists:

- INI establishes stable known runtime/output-channel definitions;
- MLG/ Shim remains authoritative for measured samples;
- MSQ supplies calibration values, tables, curves and scalars.

### Explicit binned-analysis semantics

Every table/histogram/heatmap must visibly state axes, cell meaning, aggregation method, active Qualification and sample/provenance context.

## Local-first privacy

Opening/analyzing a local log must not require upload.

EpicScope must not silently transmit log/tune contents, filenames, derived values or analysis results as telemetry/analytics. Future sharing/publishing/telemetry must be explicit and separately reviewed.

## Feature maturity vocabulary

Major analyzers/capabilities use:

- **Experimental**;
- **Beta**;
- **Stable**.

Promotion requires validation evidence.

## Current non-goals

Current Web development does not need to solve:

- final native Linux memory/runtime design;
- final Linux packaging;
- direct ECU acquisition outside the validated Shim path;
- Android integration;
- live tune editing/Burn semantics;
- decorative polish that conflicts with clarity/performance.

Current Web work should continue to use measured behavior and concrete tuning/diagnostic usefulness as its guide.
