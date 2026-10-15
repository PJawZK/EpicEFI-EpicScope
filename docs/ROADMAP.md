<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. `docs/DOCUMENTATION_MAP.md` defines document authority and `docs/research/STATUS.md` tracks research-to-product disposition.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Roadmap

## Roadmap principles

The roadmap describes intended capability and implementation order. It does not authorize code to bypass `FILE_ARCHITECTURE.md` or the evidence/safety rules established elsewhere.

Research documents are behavioral references, not implementation authorities. Preserve original notes under `docs/research/`; update `docs/research/STATUS.md` when EpicScope implements, improves, defers or supersedes researched behavior.

## Current execution position — 2026-10-15

EpicScope Web remains the functional reference for Logger, Histogram and Analyzer behavior.

Current product maturity:

- **Logger:** mature functional reference; broad optimization paused unless a measured regression appears.
- **Histogram:** generic research-parity checkpoint closed; maintenance/cleanup only unless field use exposes a concrete gap.
- **Analyzer:** uneven maturity; Fueling/Ignition mature checkpoints, Boost strong, Idle/AE useful but thinner, Fuel / Injector and Trigger / Sync retain targeted gaps.
- **VE Analyzer:** implemented, real-log/browser validated and the highest-value active maturity target.
- **Observability:** unified diagnostics/performance/report architecture approved in D-058 and `OBSERVABILITY.md`; implementation starts after the current correctness/ownership/CPU cleanup reaches a stable browser-validated baseline.
- **MLG v3:** researched compatibility extension, not yet implemented.
- **Repository cleanup:** remote branch cleanup completed; `main` is the only authoritative remote branch.
- **Linux production implementation:** future work after Web maturity review.

Approved product workflow:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Histogram sub-flow:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

VE sub-flow:

> **Load INI + MSQ + Log → select VE/target tables → verify mixture/RPM/load → qualify → discover/load lambda delay → activate working delay table → Run Analysis → review evidence/proposal**

## Phase 0 — Foundation

Status: **Complete**

Established product identity/scope, architecture/file ownership, normalized data model, performance/platform requirements, workflow/handoff/decision process and privacy/security/input rules.

## Phase 1 — Web log, navigation and source foundation

Status: **Complete as a functional foundation; regression maintenance continues**

Implemented MLG v1/v2 parsing/validation, source access, Worker import, decoded-channel reuse, timeline/navigation, A/B/markers/ranges, graph workspaces, persistence, read-only `ts_shim` live/capture integration, source transitions, stable channel identity, semantic starter templates and runtime/performance diagnostics.

Do not restart broad Logger/performance optimization without a measured regression.

## Phase 2 — Channel catalog, UI workflow and generic analysis

Status: **Complete for the currently approved scope**

Implemented INI↔MLG binding, explicit known/log-only availability states, channel-browser semantics, shared scopes/Qualification, Table Generator, Distribution, Scatter, saved setups/exports where selected, Math Channels, Logger evidence navigation and semantic starter resolution/capability gating.

Generic Histogram research parity is closed. Do not start another broad Histogram rewrite.

## Phase 3 — MSQ tune enrichment and table correlation

Status: **Complete for the currently approved scope**

Implemented normalized tune values/tables/curves/scalars, optional tune enrichment, table-axis metadata, interpolation/correlation and tune context in analyzers where useful.

EpicScope remains an analysis product, not a live ECU tune editor. Future tune application must remain explicit and diff-first.

## Phase 4 — Specialized analyzers

Status: **Implemented; maturity uneven; ongoing targeted maturity work**

### Fueling

Status: **Mature experimental checkpoint — freeze unless bug/regression**

### Ignition

Status: **Mature non-knock experimental checkpoint — freeze unless bug/regression**

### Boost

Status: **Strong experimental foundation — paused unless a concrete gap appears**

### Idle

Status: **Useful foundation — later refinement**

### AE / MAP Predict

Status: **Useful foundation — later refinement**

### Fuel Pressure / Injector

Status: **Substantially improved; targeted maturity work remains**

Remaining useful work is visible event-extreme context, pressure sag/recovery, repeatability, pump/prime evidence, voltage/deadtime evidence and stronger Logger navigation.

### Trigger / Sync

Status: **Thin but useful foundation; later broad-coverage maturity target**

Target work includes sync/loss context, glitch-vs-sustained classification, pre/post evidence, RPM/voltage/load context, frequency by RPM band and direct Logger navigation.

### VE Analyzer

Status: **Implemented, real-log/browser validated; current highest-value maturity target**

Authoritative behavior contract: `VE_ANALYZER.md`.

UI/workbench contract: `VE_ANALYZER_WORKBENCH.md`.

Implemented behavior includes:

- VE/target table correlation from tune metadata;
- strict actual-mixture/scale semantics;
- qualification controls and actionable Run readiness;
- **RPM × load lambda-delay table only**;
- explicit **Grab lambda delays from log** discovery;
- measured/interpolated/insufficient delay provenance;
- separate recommendation and working delay state;
- direct delay-table editing and save/load;
- timestamp-based mixture alignment;
- optional known fuel-correction compensation;
- robust weighted-median VE evidence with P10/P90 spread, cumulative evidence and confidence;
- starting-table prior authority and withheld out-of-authority proposals;
- Result View overlays;
- per-cell evidence with strongest-visit Logger navigation.

The browser-known-good runtime is the #441-era composition restored by PR #449. Do not reintroduce the later continuity/render wrapper stack wholesale.

#### Current VE maturity sequence

1. preserve the browser-known-good runtime;
2. fix Result View fallback/precision behavior with an isolated change and browser verification;
3. fix Logger → Analyzer result persistence with an isolated change and browser verification;
4. then move authoritative session/result/proposal/working-delay state out of rendered DOM;
5. remove duplicate cell-evidence analysis and synthetic/DOM-derived state bridges;
6. later refine proposal review/application strength/export/diff behavior;
7. never auto write/Burn to ECU.

## MLG v3 compatibility extension

Status: **Researched; not implemented; not a current blocker**

Extend the existing parser rather than creating a separate architecture when implementation becomes justified. Unknown/reserved mappings must remain unsupported until evidence exists.

## Cleanup/consolidation

Status: **Repository branch cleanup complete; runtime cleanup remains evidence-driven**

Completed on 2026-10-15:

- audited roughly 195 accumulated remote branches;
- removed fully merged, patch-equivalent and superseded historical branches;
- preserved useful conclusions in `main`/docs/Git history;
- reduced remote branch authority to `main` only.

Remaining runtime cleanup should be deliberate rather than broad. Current highest-value cleanup is VE state ownership and removal of duplicate/DOM-derived authority. Logger/Histogram cleanup should only proceed for concrete correctness/maintenance/performance needs.

The active cleanup sequence also includes narrowing document-wide DOM ownership, routing expensive work away from hidden views and then measured CPU cleanup before considering workers/batching.

## Unified observability consolidation

Status: **Architecture approved; implementation not started**

Authority: `OBSERVABILITY.md` and D-058.

This track replaces fragmented long-lived ownership across Performance diagnostics, runtime health/bug-report assembly, runtime error history and report generation with one bounded correlated observability/session model.

The migration preserves useful existing probes and parser/source evidence while changing where diagnostic history and report ownership live.

Approved sequence:

1. freeze a stable browser-validated baseline after current correctness/ownership/CPU cleanup;
2. add versioned event/metric/snapshot records plus session/operation correlation and bounded in-memory history;
3. migrate runtime/lifecycle/error capture;
4. bridge existing detailed performance measurements and rebuild Performance as a projection;
5. bridge parser/source-integrity evidence;
6. add state/render/async/storage/resource producers at existing owners;
7. add generic anomaly detection;
8. add bounded previous-session persistence and abnormal-end recovery;
9. converge Diagnostics UI/reports;
10. delete redundant old collectors/builders after parity;
11. later add local baseline/regression intelligence if real usage justifies it.

The first release must remain local-first, bounded and low-overhead. No cloud telemetry or raw log/tune payload recording is authorized.

## Phase 5 — Sessions, sharing and reporting

Status: **Not started — explicit owner approval required**

Potential future scope: versioned full-session persistence, annotations/bookmarks, result snapshots and explicit sharing/publishing. No silent upload/telemetry of local log/tune content.

The observability black-box/session history is **not** Phase-5 full-session persistence. It is bounded runtime diagnostic history and must not grow into a general user-session store.

## Phase 6 — Web functional maturity review

Before Linux becomes the primary focus:

- resolve current VE Analyzer state/continuity defects;
- bring remaining high-value Analyzer gaps to sensible checkpoints;
- complete the approved observability consolidation far enough that current diagnostics/performance/report ownership is coherent and redundant paths are removed;
- perform deliberate cleanup/consolidation where it reduces real maintenance risk;
- review workflow/feature completeness;
- freeze/version key contracts;
- profile representative workloads after cleanup;
- define Linux benchmark/hardware baselines;
- decide which Web internals are retained/replaced/ported.

## Phase 7 — Linux production implementation

Primary baseline: Debian 13 Stable.

Goals: native high-performance data path, low RAM, very large log support, responsive graphs/tables and preservation of established EpicScope semantics.

## Phase 8 — Linux feature expansion

Potential later work includes persistent native indexes/caches, very large logs, optional file-library/watching workflows, direct ECU logging/live analysis if separately approved, additional analyzers and packaging/update strategy.

## Phase 9 — Android / EpicHub integration

Reuse proven concepts after Web/Linux semantics mature; design tablet/mobile presentation independently where appropriate.

TunerStudio interaction/stability research primarily informs EpicHub. EpicScope inherits only transferable invariants such as explicit proposal-vs-tune state, diff-first application and no implicit Burn/write.

## Current recommended sequence

1. preserve browser-known-good VE behavior while completing the active correctness/ownership cleanup;
2. finish DOM-ownership and hidden-view routing cleanup;
3. perform measured CPU cleanup, then consider workers/batching only if still justified;
4. freeze a stable browser-validated Web baseline;
5. implement the unified observability migration from `OBSERVABILITY.md`;
6. continue targeted Fuel / Injector and Trigger / Sync maturity work as useful;
7. add MLG v3 compatibility when evidence/demand justifies it;
8. perform Web functional maturity review;
9. begin Linux production work.

## Roadmap change control

New major feature groups must be placed deliberately in roadmap and architecture before implementation. A feature request alone does not authorize a new subsystem or architectural layer.

For exact present-tense continuation, always defer to `HANDOFF.md`.
