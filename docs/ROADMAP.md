<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. `docs/DOCUMENTATION_MAP.md` defines document authority and `docs/research/STATUS.md` tracks research-to-product disposition.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Roadmap

## Roadmap principles

The roadmap describes intended capability and implementation order. It does not authorize code to bypass `FILE_ARCHITECTURE.md`, subsystem ownership, browser acceptance requirements or ECU safety rules.

Research documents are behavioral references, not implementation authorities. Preserve original research under `docs/research/`; current disposition belongs in `research/STATUS.md`, subsystem authorities and this roadmap.

## Current execution position — 2026-10-16

EpicScope Web remains the functional reference for Logger, Histogram and Analyzer behavior.

Current maturity:

- **Logger:** mature functional reference; broad optimization paused unless a measured regression appears.
- **Histogram:** generic research-parity checkpoint closed for the approved scope.
- **Analyzer:** points 1–11 ownership/correctness/performance cleanup merged into `main` through PR #462 and browser-accepted.
- **VE Analyzer:** stable maturity checkpoint. Result View value authority, heat-map behavior and session/navigation retention are accepted; no current blocker remains.
- **UI:** immediate next task is a focused visual/workflow polish pass from the accepted baseline.
- **Observability / diagnostics:** D-058 architecture is approved and documented on `main`; implementation is the next substantial engineering track after UI polish.
- **Point 12 telemetry async conversion/socket identity:** reproduction-gated; not active work.
- **MLG v3:** researched compatibility extension; not implemented and not a current blocker.
- **Linux production implementation:** future work after Web functional maturity and observability consolidation.

Approved primary workflow:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Histogram sub-flow:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

VE sub-flow:

> **Load INI + MSQ + Log → select VE/target tables → verify mixture/RPM/load → qualify → discover/load lambda delay → activate working delay table → Run Analysis → review evidence/proposal**

## Phase 0 — Foundation

Status: **Complete**

Product identity/scope, architecture/file ownership, normalized data model, performance/platform requirements, workflow/handoff/decision process and privacy/security/input rules are established.

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

Status: **Implemented; maturity uneven; targeted work only**

- **Fueling:** mature experimental checkpoint — freeze unless bug/regression.
- **Ignition:** mature non-knock experimental checkpoint — freeze unless bug/regression.
- **Boost:** strong experimental foundation — paused unless a concrete gap appears.
- **Idle:** useful foundation — later refinement.
- **AE / MAP Predict:** useful foundation — later refinement.
- **Fuel Pressure / Injector:** substantially improved; targeted maturity remains around visible extreme context, sag/recovery, repeatability, pump/prime and voltage/deadtime evidence.
- **Trigger / Sync:** thin but useful foundation; later broad-coverage maturity target.

### VE Analyzer

Status: **Implemented, real-log/browser validated and stable at the current maturity checkpoint**

Authority: `VE_ANALYZER.md` and `VE_ANALYZER_WORKBENCH.md`.

Implemented behavior includes:

- VE/target table correlation from tune metadata;
- strict actual-mixture/scale semantics;
- qualification controls and actionable Run readiness;
- RPM × load lambda-delay table with explicit discovery, provenance, editing and save/load;
- timestamp-based mixture alignment;
- optional known fuel-correction compensation;
- robust weighted-median VE evidence with P10/P90 spread, cumulative evidence and confidence;
- starting-table prior authority and withheld out-of-authority proposals;
- Result View overlays;
- per-cell evidence with strongest-visit Logger navigation;
- source-authoritative Result View switching that does not consume mutable presentation text;
- retained completed analysis across semantically unchanged Analyzer/navigation transitions;
- cooperative analysis batches with progress/cancel;
- retained-primary evidence reuse without duplicate full-log analysis.

PR #462 merged the accepted points 1–11 cleanup into `main`. The exact pre-merge runtime accepted by the owner was `b435702412642f039a8a7f49d33037c309bef9d8`; the merge commit is `2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b`.

Remaining VE debt is no longer a blocker. In particular, working lambda-delay reconstruction remains partly DOM-derived and can be cleaned up later if justified.

Never auto write/Burn to the ECU.

## Current UI polish pass

Status: **Next active task**

Purpose: improve visual coherence and interaction quality without reopening accepted runtime architecture.

Focus areas should include:

- spacing, alignment and density consistency;
- control hierarchy and grouping;
- consistent table/heat-map/header treatment across Logger, Histogram and Analyzer surfaces;
- responsive sizing/overflow rough edges;
- typography, emphasis and status/error presentation;
- keyboard/focus/hover/disabled states and obvious accessibility issues;
- removal of duplicated cosmetic overrides where consolidation is safe.

Constraints:

- no semantic analysis changes hidden inside visual cleanup;
- no broad controller/lifecycle rewrite;
- preserve current Result View/session behavior;
- keep browser verification proportional to any interaction-affecting UI change.

## Unified observability consolidation

Status: **Architecture approved; implementation queued immediately after UI polish**

Authority: `OBSERVABILITY.md`, D-058 and `research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md`.

The track replaces fragmented durable ownership across Performance diagnostics, runtime health/bug-report assembly, runtime-error history and report generation with one bounded correlated observability/session model. Existing useful probes remain in their current owners and feed the shared model.

Implementation sequence:

1. record the stable baseline and benchmark workloads/overhead budgets;
2. add versioned record, session, operation and retention contracts plus bounded in-memory storage;
3. add lifecycle/runtime-error/operation producers at existing owners;
4. bridge current detailed performance measurements and rebuild Performance as a projection;
5. bridge parser/source-integrity evidence;
6. add compact state/render/async/storage/resource producers only where they provide diagnostic value;
7. add cheap streaming anomaly rules and deferred report-time analysis;
8. add bounded batched previous-session persistence and abnormal-end recovery;
9. converge Diagnostics UI/report generation onto the shared record/session authority;
10. remove redundant old collectors/builders only after parity is demonstrated;
11. add local workload-relative baseline/regression intelligence only if real usage justifies it.

First-release constraints: local-first, bounded, low-overhead, no silent telemetry/upload, no raw log/tune payload recording, and no automatic runtime self-repair from anomaly detection.

## MLG v3 compatibility extension

Status: **Researched; not implemented; not a current blocker**

Extend the existing parser rather than creating a separate architecture when implementation becomes justified. Unknown/reserved mappings must remain unsupported until evidence exists.

## Repository cleanup / consolidation

Status: **Product authority consolidated; historical remote refs remain removable**

PR #462 is merged and accepted. The observability documentation from former PR #460 has been ported onto current `main` rather than merging its stale divergent runtime ancestry.

Historical VE/Codex validation branches and PRs are not product authorities. Git/PR history plus current docs preserve their useful evidence. `browser-previews` remains infrastructure/deployment state; `main` is the only product authority.

The available GitHub connector does not expose remote branch deletion, so refs classified as superseded in `BRANCH_CLEANUP_2026-10-15.md` may still physically exist until removed with ordinary Git/GitHub branch controls.

## Phase 5 — Sessions, sharing and reporting

Status: **Not started — explicit owner approval required**

Potential future scope: versioned full-session persistence, annotations/bookmarks, result snapshots and explicit sharing/publishing. Observability black-box history is bounded diagnostics and must not grow into a general user-session store.

## Phase 6 — Web functional maturity review

Before Linux becomes the primary focus:

- complete the current UI polish pass;
- implement observability far enough that diagnostics/performance/report ownership is coherent and redundant paths are removed;
- bring any remaining high-value Analyzer gaps to sensible checkpoints only where justified;
- review workflow/feature completeness and accessibility;
- freeze/version key contracts;
- profile representative workloads;
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

1. focused UI polish from the accepted `main` baseline;
2. CI plus browser sanity acceptance for interaction-affecting polish;
3. observability baseline benchmarks and record/session/operation/retention foundation;
4. staged diagnostics/performance/error/report migration and old-owner removal after parity;
5. reproduction-gated point 12 only if a concrete reproducer appears;
6. targeted remaining Analyzer or MLG v3 work only where demand/evidence justifies it;
7. Web functional maturity review;
8. Linux production work.

## Roadmap change control

New major feature groups must be placed deliberately in roadmap and architecture before implementation. A feature request alone does not authorize a new subsystem or architectural layer.

For exact present-tense continuation, always defer to `HANDOFF.md`.
