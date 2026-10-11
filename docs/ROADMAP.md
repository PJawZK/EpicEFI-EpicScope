<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Roadmap

## Roadmap principles

The roadmap describes intended capability and implementation order. It does not authorize code to bypass `FILE_ARCHITECTURE.md`.

Each implementation task should identify goal, architectural owner/location, dependencies, expected validation, and completion criteria. Large features should be split into reviewable tasks before coding.

## Current execution position — 2026-10-11

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
- Weighted Mean Table Generator, presets, grouped filters, Math Channels and cell-to-Logger traceability;
- shared Analyzer scope / qualification / comparison / inline-help infrastructure;
- contextual Logger A/B → Analyzer workflow.

The broad recorded-log performance campaign is now complete. The active product work is **Analyzer maturity/refinement**, currently centered on Boost repeated-event/repeatability analysis.

Logger and Histogram are not frozen, but should only be reopened for concrete defects or required integration hooks.

Approved workflow:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Do **not** begin Phase 5 unless the project owner explicitly requests it.

The Pi Zero 2 W / real-ECU `ts_shim` validation path remains paused until the required USB adapter is available.

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

Out-of-layout panes preserve assignments but do not retain/reacquire active graph traces. Freeform maximize/hide behavior must not be confused with leaving the layout.

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
- linked evidence back to Logger;
- shared saved analysis-filter storage;
- grouped ALL/ANY qualification semantics;
- shared Analyzer scopes and numeric cohort comparison.

### Current UI hierarchy

- EpicScope logo dropdown switches Logger / Analyzer / Histogram;
- Analyzer and Histogram use compact secondary dropdowns;
- Logger Layout menu owns layout/arrange/reset/clear;
- Undo/Redo is one compact split control;
- Settings is organized by current mode/interface/data-storage context;
- Table Generator uses **Table Size**, not a separate Size button;
- visible weighted statistic wording is **Weighted Mean**;
- transient menus/popovers close on outside interaction or when another transient control opens;
- Diag / Perf / Report use the same anchored footer-popout interaction style;
- reusable inline `i` help is the standard pattern for non-obvious controls/results.

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

Status: **Originally complete as Experimental foundations; active maturity/refinement underway**

The earlier Phase-4 completion meant that each planned analyzer existed with real calculations/evidence, not that each was fully mature for tuning work.

### Shared Analyzer foundation — implemented

- semantic channel-role suggestions with manual override;
- Full Log / Current A-B / Saved Range scopes;
- contextual Logger A/B → Analyzer handoff;
- event/source navigation back to Logger;
- event-aligned evidence renderer;
- median + 10–90% event envelope;
- individual event selection vs aggregate view;
- shared saved qualification filters;
- grouped ALL/ANY qualification;
- per-scope provenance counts;
- shared numeric comparison with P10 / Median / P90;
- shared inline information/help component.

### IDLE — mature foundation, further refinement later

Implemented:

- canonical `RPMValue` preference for RPM role;
- required RPM + Idle Target;
- Idle system selector: Combined / DC Idle / IAC Valve / ETB / Ignition;
- subsystem-specific role presentation;
- explicit runtime-vs-calibration DC Bias distinction;
- sag/recovery threshold explanation;
- aligned sag/recovery evidence;
- worst sag and median recovery metrics;
- rich controller/actuator evidence and shared inline help.

Later:

- richer idle phases and settling/oscillation/headroom metrics;
- tune/MSQ DC Bias curve/current-point context;
- shared comparison/repeatability work where useful.

### AE / MAP PREDICT — active refinement later

Implemented:

- aligned transient evidence using available TPS / MAP / predicted MAP / AFR;
- event selection and Logger navigation;
- prediction mean/MAE and lean/rich excursion metrics.

Next maturity when resumed:

- richer timing/integrated-error metrics;
- event classification by RPM/load/TPS movement;
- comparison between event sets;
- shared qualification controls.

### BOOST — current active analyzer

Boost is now explicitly **control-mode aware**.

Open Loop:

> RPM / TPS-load / operating state → WG command → measured pressure response

Closed Loop adds:

> Boost Target → tracking / error / attainment / over/undershoot / settling

Implemented maturity slices through PR #317:

- explicit Open Loop / Closed Loop mode with Open Loop default;
- target-only settings/results restricted to Closed Loop;
- target-relative T10/T50/T90 and target attainment for Closed Loop;
- TPS/load as first-class Boost context;
- target-independent Open Loop measured-pressure-rise spool T10/T50/T90;
- peak pressure with RPM/TPS/upper/lower duty context;
- qualified RPM × TPS/load operating points;
- pressure mean/min/max/SD and upper/lower duty means;
- evidence strength + pressure consistency + compact assessment;
- adjacent RPM and load trend comparisons;
- optional high-load quick gate layered on shared Qualification;
- conservative `What this suggests` evidence interpretation;
- matched Primary vs Compare scopes using Full Log / Current A/B / Saved Range;
- matched-bin pressure + duty deltas;
- upper/lower chamber response summaries that attempt to isolate one chamber while holding the other steady;
- explicit opposite-chamber-unavailable accounting;
- minimum two usable comparisons before a directional association;
- inline help for controls and result interpretation.

**Critical rule:** Boost interpretation remains descriptive and polarity-agnostic. Do not infer that increasing a duty value must increase/decrease boost, and do not emit automatic duty-direction recommendations from the current evidence layer.

Immediate next Boost target:

1. automatic repeated-pull/event grouping from existing qualification/high-load evidence;
2. inspectable detected-pull list with source ranges and Logger navigation;
3. compare only pulls with overlapping trustworthy RPM × TPS/load regions;
4. quantify pull-to-pull repeatability/spread and observed duty→pressure response;
5. then revisit duty saturation/headroom;
6. then Closed Loop settling/controller-quality maturity.

### FUELING — next major analyzer after Boost repeated-pull maturity

Move from aggregate AFR summaries to stable-state error/correction analysis with RPM×MAP/TPS context, transient/AE/DFCO qualification, confidence/sample population and correction proposals.

### IGNITION / FUEL-INJECTOR / TRIGGER-SYNC / RANGE COMPARE

Continue later using the same evidence graph, qualification, comparison and Logger-navigation framework rather than separate one-off UI systems.

Range Compare already supports shared scopes, shared qualification filters and P10/Median/P90 statistics; future work should extend that common model rather than fork it.

## Current refinement track — Analyzer maturity

### Shared remaining layer

Much of the earlier shared comparison/qualification work is now implemented. Remaining common maturity should focus on:

1. reusable contiguous-event/cohort grouping where appropriate;
2. independent event counts and repeatability/confidence warnings;
3. shared derived analysis signals;
4. analyzer presets for role mappings/thresholds/qualification;
5. deliberate tune/MSQ context where calibration data is required.

### Product principle

> **An analyzer should find the relevant operating events/conditions, show the evidence that produced the result, quantify repeatability/error, and let the user move directly between analysis and the original log.**

Tune Table's useful tune-aware capability should converge with mature Table Generator infrastructure instead of becoming a second competing cell-analysis system.

## Correctness and safety refinement — completed current batches

Accepted audit findings and follow-up maturity issues now include fixes for:

- dynamic external/saved text execution through identified `innerHTML` paths;
- pending channel activation obeying current assignment/removal state;
- histogram persistence failure retaining session state and reporting failure;
- malformed stored histogram entries being validated/skipped;
- Scatter clearing stale results on unavailable/rejected selections;
- Report health being log-aware;
- unrecovered CRC status being reported truthfully;
- out-of-layout panes not staying graph-active;
- Report/Diag/Perf transient interaction consistency.

## Performance / retained-memory status

The dedicated recorded-log performance campaign is **complete for the current architecture**.

Implemented recent improvements include captured viewport slices, batched deferred graph materialization, detailed render instrumentation, authoritative post-CRC statistics refresh and hidden-pane graph lifecycle cleanup.

Representative controlled 1.19 GB-log results on the test PC were approximately:

- 1.27–1.30 s initial import;
- 56–59 ms controlled eight-channel viewport workspace restore;
- zero physical reads on the captured viewport restore path;
- roughly 30 ms deferred full materialization after removal of redundant statistics work.

Remaining graph time is mainly legitimate envelope + trace rendering. Do not resume broad micro-optimization unless a concrete regression or new workload justifies it.

Retained-memory diagnostics continue to measure persistent decoded columns, bound full ranges, graph-active ranges and live source lifetimes. No cross-log strong-reference leak is currently evidenced.

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
