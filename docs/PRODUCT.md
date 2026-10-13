<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Product Definition

## Purpose

EpicScope is an ECU log analysis and tuning-diagnostics application intended to help a tuner **scope a tune**: inspect recorded behaviour, find faults, quantify weak areas, compare changes, and identify opportunities for improvement.

It is not intended to be only a generic graph viewer. Generic log-viewing/statistical functions are the foundation for higher-level, tune-aware analysis.

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

EpicScope Web is now a usable hosted large-log analysis reference with three active top-level surfaces:

- **Logger**
- **Analyzer**
- **Histogram**

Current implemented foundations include:

- MLG v1/v2 import/index/staged CRC validation;
- OPFS MLG sidecar/native-column access for large-log reuse;
- INI-backed stable channel identity and MLG binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces and pane assignments;
- exact-log viewport/cursor/A-B/marker/range persistence kept separate from reusable workspace state;
- multi-pane graph/timeline navigation;
- shared A/B and saved-range analysis scopes;
- shared Qualification/filter semantics;
- Histogram Table Generator, Distribution, Scatter and Math Channels;
- Analyzer Range Compare, Tune Table and specialized analyzer surfaces;
- direct evidence navigation back to Logger;
- read-only validated real-ECU/Pi/`ts_shim` source workflow;
- performance/source/retained-memory diagnostics.

The earlier broad Web performance campaign is considered complete unless a measured regression appears.

The most recent product work has focused on:

- maturing Fueling and non-knock Ignition analyzers to useful checkpoints;
- making Analyzer presentation less dense through progressive disclosure and anchored local help;
- making Histogram's Scope/Qualification/Math Channel/evidence flow consistent across Table Generator, Distribution and Scatter.

Analyzer feature work is currently paused. Histogram's broad consistency pass is also substantially complete. The next work should be driven by concrete user value, remaining coverage gaps or measured defects rather than continuous deepening of already-mature paths.

## Primary user workflow

The approved visible workflow is:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

This is the product-level interaction order. UI controls should make this progression obvious rather than presenting every capability at the same visual priority.

### 1. Load Data

- open recorded log or connect an approved read-only live source;
- load INI when available;
- load MSQ when tune/calibration context is useful;
- preserve source ownership and stable channel identity explicitly.

INI remains optional for ordinary log analysis. MLG remains authoritative for recorded samples/validity. MSQ supplies calibration/tune context rather than runtime samples.

### 2. Channels

- search/filter/group/sort channels;
- preserve Active/Favorites/Recent semantics;
- show current unit-aware values directly where useful;
- keep known-but-unlogged channels explicit;
- keep usable log-only channels accessible;
- reuse stable channel identity across source transitions.

### 3. Navigate

- timeline/cursor;
- zoom/pan/Fit;
- playback/step;
- synchronized graph panes;
- previous/next view history;
- shared Logger timeline where analysis views need A/B editing.

### 4. Select / qualify range

- A/B boundaries;
- saved ranges;
- markers;
- shared saved Qualification/filter sets;
- grouped ALL/ANY qualification semantics.

### 5. Analyze

Generic analysis comes before specialized interpretation:

- range statistics;
- Table Generator / 2D binned analysis;
- Distribution;
- Scatter;
- Math Channels;
- Range Compare / Tune Table;
- specialized analyzers.

Histogram's current preferred sub-flow is:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

Analyzer's current preferred model is:

> **Scope/roles → qualification → relevant events/conditions → decision-facing result → supporting evidence → Logger**

### 6. Compare / Export

Compare/export are result-stage capabilities. Empty or disabled top-level placeholders are not product value and should not consume permanent toolbar space before the capability exists.

## EpicScope modes/surfaces

The **EpicScope logo dropdown** is the approved in-product mode/surface switcher.

Current real entries:

- Logger;
- Analyzer;
- Histogram.

Analyzer and Histogram each use compact secondary selectors for their own subviews. This mode switcher is not the broader EpicHub Dashboard/Tuner/Diagnostics shell.

## Information hierarchy

EpicScope should calculate enough evidence for correctness without forcing every value onto the first screen.

Current UI principle:

- keep a small set of decision-facing results visible;
- move provenance, distributions and supporting diagnostics behind **More details**, expandable sections or optional columns;
- preserve source evidence and drill-down;
- use one consistent anchored round-`i` help interaction for non-obvious semantics;
- avoid help-icon/value clutter on self-explanatory controls.

## Graph workspace model

Global workspace context is presented as graph preset/workspace selection. Active pane identity remains local to the pane so the global header does not duplicate graph/pane information.

Visible assigned channels that are available/renderable must remain active after restore/switch/layout changes.

## Analysis principles

### Evidence before recommendation

EpicScope should expose evidence behind findings:

- qualifying sample/event count;
- event/range selection;
- statistical/aggregation method;
- variance/spread where relevant;
- exact source region used;
- calibration/context layer when tune-aware attribution is possible.

Recommendations must not appear as unexplained conclusions.

### Do not overstate causation

Observed association is not automatically causal proof.

Examples:

- wastegate duty/pressure association is not an automatic duty-direction instruction;
- Fueling mixture error is not automatically a VE-table error;
- Ignition timing movement does not prove knock/detonation or safe/unsafe timing;
- base-table/correction attribution is a clue to inspect a tuning layer, not proof of engine preference.

### Tune awareness

When source/tune context exists:

- INI establishes firmware identity and stable runtime/output-channel definitions;
- MLG remains authoritative for recorded samples and validity;
- MSQ supplies actual tune/calibration values, tables, curves and scalars.

Current tune-aware workflows include loaded table geometry/correlation and Ignition base-table attribution. Future tune-aware work should reuse normalized tune services rather than parse source formats inside UI/analyzers.

### Explicit binned-analysis semantics

Every table/histogram/heatmap must visibly state or make discoverable:

- scope;
- axes/channels;
- value/cell meaning;
- aggregation method;
- active Qualification;
- sample/evidence count.

The user must never need to guess whether a cell represents MAP, duty, error, average, maximum or another quantity.

## Generic Histogram analysis model

Table Generator, Distribution and Scatter now share:

- Full Log / Current A/B / Saved Range scope vocabulary;
- shared Logger timeline where useful;
- shared saved Qualification;
- first-class saved Math Channels;
- anchored round-`i` help for non-obvious calculations;
- evidence navigation toward Logger where implemented.

Table Generator remains the most feature-rich individual generic analysis tool. Distribution/Scatter should continue converging through shared concepts rather than private parallel systems.

See `docs/HISTOGRAM.md` for current detail.

## Specialized Analyzer model

Specialized analyzers must build on generic scope/Qualification/evidence/tune services rather than privately reimplementing them.

Current families:

- Boost control;
- Idle / PID;
- Acceleration enrichment / MAP Predict;
- Fueling / VE / mixture error;
- Ignition behavior/context;
- Fuel pressure / injector behavior;
- Trigger / sync.

Fueling and non-knock Ignition have reached current maturity checkpoints and are intentionally paused unless defects appear. Other analyzers should later be brought toward similar practical coverage before a broad code-consolidation phase.

## Cleanup/consolidation strategy

Do not destabilize mature user-facing paths solely to make implementation code prettier while major coverage remains uneven.

The approved direction is:

1. establish useful feature coverage across generic analysis and analyzers;
2. stop mature surfaces at sensible checkpoints;
3. then run a deliberate cleanup/consolidation/optimization phase.

That later phase should remove dormant duplicate editors, reduce unnecessary DOM enhancement/MutationObserver layers, replace DOM state bridges with explicit state/contracts, consolidate shared table/event/help/rendering code, simplify CSS/runtime UI surgery and re-profile representative large logs.

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
- arbitrary write/control access to the ECU;
- Android integration;
- decorative polish that conflicts with clarity/performance;
- premature deep refactoring of mature paths before the planned consolidation phase.

The immediate product priority is no longer first-time Logger/Histogram/Analyzer construction. It is selective maturity: close concrete high-value gaps, broaden analyzer usefulness where still thin, then consolidate the Web reference implementation before Linux becomes the primary engineering focus.