<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Roadmap

## Roadmap principles

The roadmap describes intended capability and implementation order. It does not authorize code to bypass `FILE_ARCHITECTURE.md`.

Each implementation task should identify goal, architectural owner/location, dependencies, expected validation, and completion criteria. Large features should be split into reviewable tasks before coding.

## Current execution position — 2026-10-06

EpicScope Web has completed the originally approved implementation scope through **Phase 4**.

Established foundations include:

- MLG v1/v2 import/index/staged validation and source-integrity diagnostics;
- OPFS sidecar/native-column post-index access;
- INI-backed channel catalog/binding and optional MSQ tune enrichment;
- reusable graph workspaces/presets plus separate exact-log navigation persistence;
- multi-pane fixed/freeform graphs and timeline/range/marker tooling;
- generic range statistics, qualification, Histogram/Table Generator, Distribution, Scatter, Events and Compare foundations;
- Analyzer Range Compare and Tune Table;
- Experimental Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel / Injector and Trigger / Sync analyzers;
- full analysis channel catalog with on-demand decode;
- Weighted Mean Table Generator, presets, grouped filters, Math Channels and cell-to-Logger traceability.

The active product work is now **Analyzer maturity/refinement**, not a new phase. Logger and Histogram are not frozen, but should only be reopened for concrete defects or required integration hooks.

Approved workflow:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Do **not** begin Phase 5 unless the project owner explicitly requests it.

## Phase 0 — Foundation

Status: **Complete**

Established product identity/scope, architecture/file ownership, normalized data model, performance/platform requirements, workflow/handoff/decision process and privacy/security/input rules.

## Phase 1 — Web log and navigation foundation

Status: **Complete as a functional foundation; regression maintenance continues**

Implemented:

- MLVLG v1/v2 parsing and staged validation;
- bounded/random-access source access;
- Worker import and deferred CRC validation;
- Blob caching, multi-channel decoding, OPFS column sidecar and sparse native per-channel persistence;
- synchronized timeline/cursor, zoom/pan, A/B, markers, saved ranges and view history;
- multi-pane fixed/freeform graph workspaces;
- exact-log and reusable-application persistence.

### Logger graph presets — current invariant

Named workspaces behave as real graph presets. Every available channel assigned to a visible pane must be active/rendered. The same rule applies after workspace restore/switch, Single→multi-pane layout changes and Freeform visibility changes.

Unavailable channels remain assigned but are not falsely activated. Pending loads must not be cancelled by duplicate reconciliation.

Freeform exposes five panes and safely ignores geometry for hidden/out-of-layout pane 6.

## Phase 2 — Channel catalog, UI workflow, and generic analysis foundation

Status: **Complete for the currently approved scope; refinement continues**

Implemented:

- stable INI↔MLG logical/source binding;
- known+data / known-no-data / log-only states;
- full available-log analysis catalog with on-demand decode;
- channel search/group/favorite/recent semantics;
- range statistics and qualification;
- Table Generator;
- Distribution;
- Scatter;
- Events and comparison foundations;
- saved presets/filters;
- Math Channels/calculated fields;
- linked evidence back to Logger.

### Current UI hierarchy

- EpicScope logo dropdown switches Logger / Analyzer / Histogram;
- Analyzer and Histogram use compact secondary dropdowns;
- Logger Layout menu owns layout/arrange/reset/clear;
- Undo/Redo is one compact split control;
- Settings is organized by current mode/interface/data-storage context;
- Table Generator uses **Table Size**, not a separate Size button;
- visible weighted statistic wording is **Weighted Mean**.

### Distribution

Now includes Full Log / A-B scope, shared Logger timeline, Count/%/Time modes, automatic/manual bins, Histogram/Cumulative views, percentile statistics, saved-range comparison and bin→Logger evidence navigation.

### Scatter

Now includes Full Log / A-B, Single/Dual, Dots/Lines, density heat encoding, shared Logger timeline and shared Hide/Show controls.

## Phase 3 — MSQ tune enrichment and table correlation

Status: **Complete for the currently approved scope**

Implemented:

- normalized tune values/tables/curves/scalars;
- optional tune enrichment;
- explicit table + X/Y relationship metadata;
- tune table interpolation/correlation;
- observed/tune evidence and sample population.

**Table Generator rule:** Loaded MSQ table is geometry-only. It supplies X/Y breakpoint vectors/dimensions and must not rewrite selected runtime analysis channels.

Future Analyzer work may deliberately consume tune/MSQ calibration context where required, e.g. the real Idle DC Bias curve/current operating point.

## Phase 4 — Specialized analyzers

Status: **Originally complete as Experimental foundations; active maturity/refinement now underway**

The earlier Phase-4 completion meant that each planned analyzer existed with real calculations/evidence, not that each was fully mature for tuning work.

### Shared Analyzer foundation — implemented

- semantic channel-role suggestions with manual override;
- Full Log / Current A-B / Saved Range scopes;
- event/source navigation back to Logger;
- event-aligned evidence renderer;
- median + 10–90% event envelope;
- individual event selection vs aggregate view.

### IDLE — active refinement

Implemented:

- canonical `RPMValue` preference for RPM role;
- required RPM + Idle Target;
- Idle system selector: Combined / DC Idle / IAC Valve / ETB / Ignition;
- subsystem-specific role presentation;
- explicit runtime-vs-calibration DC Bias distinction;
- sag/recovery threshold explanation;
- aligned sag/recovery evidence;
- worst sag and median recovery metrics.

Next:

- shared qualification/comparison layer;
- richer idle phases and settling/oscillation/headroom metrics;
- tune/MSQ DC Bias curve/current-point context.

### AE / MAP PREDICT — active refinement

Implemented:

- aligned transient evidence using available TPS / MAP / predicted MAP / AFR;
- event selection and Logger navigation;
- prediction mean/MAE and lean/rich excursion metrics.

Next:

- richer timing/integrated-error metrics;
- event classification by RPM/load/TPS movement;
- comparison between event sets;
- shared qualification controls.

### BOOST — next major analyzer

Foundation exists for measured/target pressure, RPM, wastegate duty, spool, steady-state and over/undershoot analysis.

Maturity target:

- RPM×TPS×upper/lower duty context;
- target-attainment and spool 10/50/90%;
- overshoot/settling and duty saturation/headroom;
- duty-change→boost response;
- upper/lower chamber contribution;
- repeated-pull comparison.

### FUELING — next major analyzer

Move from aggregate AFR summaries to stable-state error/correction analysis with RPM×MAP/TPS context, transient/AE/DFCO qualification, confidence/sample population and correction proposals.

### IGNITION / FUEL-INJECTOR / TRIGGER-SYNC / RANGE COMPARE

Continue later using the same evidence graph, qualification, comparison and Logger-navigation framework rather than separate one-off UI systems.

## Current refinement track — Analyzer maturity

This is the current active product work after PR #238 and remains inside the existing Web product.

### Shared next layer

1. comparison of two ranges/event sets;
2. reusable operating-condition filters (RPM/MAP/TPS/CLT/state/ranges);
3. stable-state qualification where appropriate;
4. coverage/confidence/repeatability indicators;
5. shared derived analysis signals;
6. analyzer presets for role mappings/thresholds/qualification;
7. deliberate tune/MSQ context where calibration data is required.

### Product principle

> **An analyzer should find the relevant operating events/conditions, show the evidence that produced the result, quantify repeatability/error, and let the user move directly between analysis and the original log.**

Tune Table's useful tune-aware capability should converge with mature Table Generator infrastructure instead of becoming a second competing cell-analysis system.

## Correctness and safety refinement — completed current batch

Accepted Codex read-only audit findings were fixed:

- dynamic external/saved text no longer executes through identified `innerHTML` paths;
- pending channel activation obeys current assignment/removal state;
- histogram persistence failure retains session state and reports the failure;
- malformed stored histogram entries are validated/skipped;
- Scatter clears stale results on unavailable/rejected selections;
- Report health is log-aware.

## Performance / retained-memory status

Retained-memory diagnostics now measure persistent decoded columns, bound full ranges, graph-active ranges and live source lifetimes.

A 295 MB log → 1.2 GB log replacement in the same page showed the previous source collected and zero previous live sources. No cross-log strong-reference leak is currently evidenced.

No LRU/byte-budget change is approved yet. Revisit only if a concrete single-log many-channel stress test shows problematic retained growth or another measured regression appears.

## Phase 5 — Sessions, sharing, and reporting

Status: **Not started — explicit owner approval required**

Potential future scope includes versioned full-session persistence, annotations/bookmarks, result snapshots and explicit sharing/publishing. No silent upload/telemetry of local log/tune content.

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

Goals include native high-performance data path, low RAM, large-log indexing/bounded queries, responsive graphs/tables and preservation of established EpicScope semantics.

## Phase 8 — Linux feature expansion

Potential later work: persistent native indexes/caches, very large logs, optional file-library/watching workflows, direct ECU logging/live analysis if separately approved, additional analyzers and packaging/update strategy.

## Phase 9 — Android / EpicHub integration

Reuse proven core concepts after Linux/Web semantics mature; design tablet/mobile presentation independently where appropriate.

## Roadmap change control

New major feature groups must be placed deliberately in roadmap and architecture before implementation. A feature request alone does not authorize a new subsystem or architectural layer.

For exact present-tense continuation, always defer to `docs/HANDOFF.md`.