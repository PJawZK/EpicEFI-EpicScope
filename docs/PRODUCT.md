<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. `docs/DOCUMENTATION_MAP.md` defines document authority, and `docs/research/STATUS.md` tracks research-to-product disposition.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Product Definition

## Purpose

EpicScope is an ECU log analysis and tuning-diagnostics application intended to help a tuner **scope a tune**: inspect recorded/live behaviour, find faults, quantify weak areas, compare changes, and identify opportunities for improvement.

It is not only a graph viewer and it is not a live ECU tune editor. Tune/MSQ data may enrich analysis and VE proposals may be reviewed, but analysis/proposal state remains separate from tune/ECU state unless a future explicitly approved apply/write workflow is invoked.

## Product stages

1. **EpicScope Web** — functional reference and feature-validation platform.
2. **EpicScope Linux** — primary production target after Web maturity review.
3. **EpicScope for EpicHub / Android** — later reuse of proven analysis concepts without forcing Android constraints into earlier stages.

## Current Web implementation state — 2026-10-15

EpicScope Web is a usable large-log/live-source analysis reference with:

- MLG v1/v2 import/index/staged CRC validation;
- INI-backed stable channel identity and MLG binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces and exact-log navigation persistence;
- multi-pane graph/timeline navigation;
- Logger, Analyzer and Histogram product surfaces;
- 12 generic semantic starter workspaces plus 12 capability-gated EpicEFI-specific starters;
- mature generic Histogram surfaces for Table Generator, Distribution, Scatter and Math Channels;
- Analyzer surfaces for Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel Pressure / Injector, Trigger / Sync and VE Analyzer;
- runtime-health, parser, retained-memory and performance diagnostics;
- validated `ts_shim` live-source integration on the Mega144H7 → Pi Zero 2 W → LAN → browser path;
- unit-aware channel selectors in Analyzer and Histogram;
- explicit source/load ordering under Load Data: INI → MSQ → LOG → UNLOAD → TS-SHIM.

Current maturity:

- Logger: mature functional reference.
- Histogram: generic research-parity checkpoint closed for approved scope.
- Fueling/Ignition: mature experimental Analyzer checkpoints.
- Boost: strong experimental foundation.
- Idle/AE: useful but thinner.
- Fuel Pressure / Injector and Trigger / Sync: targeted maturity gaps remain.
- VE Analyzer: implemented, real-log/browser validated and the highest-value active maturity target.
- Unified observability: architecture approved, implementation not yet started.
- MLG v3: researched compatibility extension, not yet implemented.

The browser-known-good VE runtime is the #441-era composition restored by PR #449. Browser behavior is the acceptance authority for VE runtime changes; CI is necessary but not sufficient.

## Primary user workflow

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

### Load Data

1. Load INI;
2. Load MSQ;
3. Open Log;
4. Unload Log;
5. Connect Shim.

INI and MSQ are independent application resources. Recorded MLG or Shim is the active sample source family.

### Channels

Search/filter/group/sort channels, preserve Active/Favorites/Recent semantics, show units where practical, keep known-no-data/log-only channels explicit and preserve literal source identity while allowing semantic role resolution above it.

### Navigate

Timeline/cursor, zoom/pan/Fit, playback/step, synchronized graph panes and view history.

### Select / qualify range

A/B boundaries, saved ranges, markers and Qualification criteria.

### Analyze

Generic statistical tools and question-specific Analyzer surfaces consume the normalized source/tune model.

### Compare / Export

Compare/export are result-stage capabilities. Empty top-level placeholders should not consume permanent UI space before capability exists.

## Product surfaces

The EpicScope logo dropdown is the in-product mode/surface switcher.

Current primary entries:

- Logger;
- Analyzer;
- Histogram.

Analyzer and Histogram use compact secondary selectors for their own subviews.

Diagnostics remains a supporting utility surface rather than a new primary analysis mode.

## Graph workspace model

- **Layout** — graph geometry only.
- **Starter template** — task-oriented semantic recipe.
- **Workspace** — ordinary user-owned materialized state.

A starter resolves once against the current channel catalog and becomes an ordinary editable workspace. Source changes normalize channel identity; they do not reapply template ownership.

The generic fresh-state starter set remains General, Idle, Boost, Fuel, Ignition, Cooling, Transient / AE, Fuel System, Trigger / Sync, Startup / Warmup, Electrical and Vehicle / Driveline.

## Semantic channel roles

Starter templates and analyzers resolve semantic roles rather than hard-code one ECU family’s raw IDs. Resolution prefers explicit/native aliases and conservative compatibility matching. Missing roles remain explicit rather than fabricated.

Compatibility aliases do not rename source data. Literal INI/MSQ/channel/table names remain user-facing authority.

## Generic Histogram product contract

Histogram is the reusable relationship/statistical layer between Logger and question-specific Analyzer surfaces.

Shared flow:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

The current generic research-parity track is closed. Table Generator, Distribution, Scatter and Math Channels should receive correctness/regression maintenance or deliberate cleanup unless field use exposes a concrete gap.

## Specialized Analyzer product contract

An analyzer should find relevant operating events/conditions, quantify results, show evidence/provenance, distinguish observation from causation, expose missing inputs and navigate back to Logger.

Fueling and non-knock Ignition are mature checkpoints. Boost is strong. Fuel / Injector and Trigger / Sync retain targeted maturity work. VE Analyzer is the current highest-value maturity target.

## VE Analyzer product contract

`docs/VE_ANALYZER.md` is the current algorithm/evidence contract; `docs/VE_ANALYZER_WORKBENCH.md` is the current UI/workflow contract.

Current accepted behavior includes:

- table-first VE + target-mixture workflow;
- strict actual-mixture and scale semantics;
- explicit qualification and Run readiness;
- **RPM × load lambda-delay table only**;
- explicit user-triggered delay discovery;
- timestamp-based delay alignment;
- measured/interpolated/insufficient delay provenance;
- robust weighted VE-node evidence with spread/confidence;
- starting-table prior authority;
- separate original VE, analysis proposal and user-reviewed result;
- independent proposal safeguards that withhold rather than silently clamp;
- Result View overlays and per-cell evidence/Logger navigation;
- no automatic tune/ECU writes.

Known remaining VE issues are Result View fallback/precision and Logger → Analyzer result persistence. State ownership cleanup should proceed one browser-verified structural change at a time.

## Diagnostics / observability product contract

`docs/OBSERVABILITY.md` defines the approved consolidation direction.

The current diagnostic capabilities are useful but fragmented. The target product behavior is one coherent local Diagnostics experience that can show:

- current health/anomalies;
- causal session/operation timeline;
- Performance;
- Parser / Source Integrity;
- Resources / caches;
- runtime errors;
- a bounded previous-session black-box tail;
- one coherent export report.

The system should discover broad failure patterns rather than only collect probes for already-known bugs. It must remain bounded, low-overhead and local-first. It must not silently upload telemetry, record raw log/tune payloads, or become a second application/domain state store.

Existing detailed performance/source/parser measurements should be migrated into the new architecture where useful, not thrown away.

## Fuel Pressure / Injector product semantics

Current architecture separates calibrated low-side pressure, high-side/GDI pressure, rail differential, raw electrical pressure channels and CEL/status channels. Raw electrical/CEL signals must not masquerade as engineering pressure evidence.

Conventional / port-injection mode uses rail differential as active pressure evidence. GDI / high-pressure mode uses high-side rail pressure while retaining low-side supply context.

## MLG compatibility direction

Production support remains v1/v2. `docs/research/MLG_V3_RESEARCH.md` shows that v3 is a bounded compatibility extension of the v2-style container, not a new parser architecture. Unknown mappings must not be guessed.

## Research preservation

Historical third-party research under `docs/research/` is evidence, not current implementation authority. `docs/research/STATUS.md` records current disposition. Later EpicScope improvements should not rewrite the historical observation itself.

## Shared timeline UI contract

Logger owns the authoritative timeline. Table Generator, Distribution and Scatter reuse the complete `.timeline-wrap` intact so docking/edge controls retain correct positioning.

## Analysis principles

### Evidence before recommendation

Expose qualifying sample count, selection/scope, aggregation method, spread/consistency where relevant and source evidence. Recommendations must not appear as unexplained conclusions.

### Tune awareness

INI establishes known runtime/output-channel definitions; MLG/Shim remains authoritative for measured samples; MSQ supplies calibration values/tables/curves/scalars.

### Explicit binned-analysis semantics

Every table/histogram/heatmap should make axes, cell meaning, aggregation method, active Qualification and sample/provenance context understandable.

## Local-first privacy

Opening/analyzing a local log must not require upload. EpicScope must not silently transmit log/tune contents, filenames, derived values or analysis results.

The same applies to diagnostics/observability. Automatic diagnostic retention is local and bounded; explicit export is a user action.

## Current non-goals

Current Web work does not need to solve final native Linux runtime design/packaging, Android integration, direct ECU acquisition outside the validated Shim path, live tune editing/Burn semantics, cloud telemetry, or decorative polish that conflicts with clarity/performance.

## Repository authority

Remote branch cleanup completed on 2026-10-15. `main` is the only authoritative remote branch. Git/PR history preserves implementation provenance; historical branch refs are not product authorities.
