# EpicScope research disposition

This document maps preserved external behavioral research to the current EpicScope implementation state.

Research notes under `docs/research/` remain historical evidence. Do not rewrite an observed third-party behavior merely because EpicScope later implemented a different or stronger design. Current disposition belongs here and in the relevant product/subsystem authority.

Status vocabulary:

- **Implemented** — researched behavior/requirement is present in current EpicScope.
- **Improved in EpicScope** — EpicScope intentionally implements a stronger/safer version.
- **Partial** — foundations exist, but intended behavior is incomplete.
- **Planned** — retained as explicit product direction.
- **Deferred** — deliberately not current work.
- **Not applicable to EpicScope** — useful research, but primarily belongs to another EpicEFI product.

## Integrated research disposition addendum — 2026-10-26

Current `main` code and verified tests outrank this document's October 16 categories. VE v50 and reviewed follow-up corrections are integrated through PR #466; recognized MLG incomplete-tail recovery through PR #467. The existing observability document describes foundation and migration stages 2–9 as implemented; older entries describing the entire initiative as "Planned" must be read as historical design states pending individual code-evidence reconciliation. Optional baseline intelligence is not implemented. Passive diagnostic/correction analyzers remain proposals, not live autonomous correction features. Preserve original external research notes without editing their observations; use [discrepancy ledger](../DOC_DISCREPANCY_LEDGER.md) for outstanding classification questions.

## Historical project disposition — 2026-10-16

- Logger is a mature functional reference; broad optimization remains paused unless a measured regression appears.
- Generic Histogram research parity is closed for the approved scope.
- VE Analyzer is implemented, real-log/browser validated and stable at the current maturity checkpoint.
- PR #462 merged Analyzer ownership/correctness/performance points 1–11 into `main` at `2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b`.
- The exact pre-merge VE/Analyzer runtime accepted by owner browser testing was `b435702412642f039a8a7f49d33037c309bef9d8`.
- The former #449-era Result View/session defects are closed: Result View values/heat remain stable and completed VE analysis survives semantically unchanged navigation.
- Fuel / Injector and Trigger / Sync remain useful lower-priority maturity areas outside VE.
- MLG v3 remains researched but not implemented.
- `main` is the sole product authority; historical development branches/closed PRs are provenance only.
- Immediate next work is focused UI polish.
- Unified observability is an accepted architecture under D-058 / `../OBSERVABILITY.md` and is the next substantial implementation track after UI polish.
- `OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md` records performance-first implementation guidance for that system.

## Observability / diagnostics research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Observability should be a bounded flight recorder, not a normal debug logger | Planned / accepted architecture | D-058 and `../OBSERVABILITY.md` establish one bounded correlated record/session system. |
| Common hot-path records should avoid one large JS object allocation per event | Planned implementation direction | Prefer packed/hybrid bounded storage with optional payloads; exact layout remains benchmark-driven. |
| Critical evidence and high-frequency detail should not compete for the same retention space | Planned implementation direction | Separate critical/detail retention sharing one sequence domain is preferred. |
| Repeated render/observer/event storms should be coalesced before normal insertion | Planned implementation direction | Event storms should make recording cheaper per repetition, not amplify the fault. |
| Common event dimensions should use compact stable IDs internally | Planned implementation direction | Map stable numeric codes to machine/human labels at query/report/export boundaries. |
| Common records need monotonic time plus a session wall-time origin | Planned implementation direction | Reconstruct wall time for presentation rather than paying two-clock cost per event. |
| Operation correlation should use primitive explicit tokens | Planned implementation direction | Parent/child operation IDs are the causal contract. |
| Existing detailed performance structs should remain optional typed payloads | Planned implementation direction | Preserve rich measurements without bloating every common record. |
| Revisions/fingerprints must come from owning subsystems | Accepted architecture | No hot-path full-state serialization or arbitrary observability-owned hashing. |
| Snapshots should be workflow-boundary driven | Planned implementation direction | Prefer owner-maintained counters/snapshots over broad controller/DOM polling. |
| Streaming anomaly detection should be O(1) amortized | Planned implementation direction | Keep bounded maps/counters for bursts/open operations/etc.; defer graph/cycle/baseline analysis. |
| Web persistence should be batched and structured | Planned implementation direction | IndexedDB is the preferred candidate; chunk sizes/cadence remain benchmark-driven. |
| Persistent history need not mirror the entire RAM ring | Planned implementation direction | Session summaries, bounded tails, critical evidence and anomaly/error windows are sufficient first targets. |
| Diagnostics UI must not render per incoming record | Planned implementation direction | No diagnostic DOM work while closed; bounded/lazy rendering while open. |
| Observability overhead must be benchmarked against the accepted baseline | Required validation | Compare startup, large-log open, workspace restore, channel activation, Analyzer/VE workflows and deliberate event storms. |

Implementation authority remains `../OBSERVABILITY.md`.

## MegaLogViewer Histogram / Table Generator research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| X/Y/Z table generation with explicit geometry | Implemented | Table Generator supports tune/custom/automatic geometry and explicit breakpoint vectors. |
| Bilinear/node-weighted table evidence | Implemented | Weighted Mean uses breakpoint-node contribution rather than rectangular binning. |
| Multiple per-cell statistics | Improved in EpicScope | Count, Mean, Median, Min, Max, Sum, StdDev, Variance and Weighted Mean are available. |
| Z reference/delta behavior | Implemented | Aligned Z/reference/delta evidence is supported. |
| Exact source evidence per cell | Improved in EpicScope | Source-sample provenance and Logger navigation are retained explicitly. |
| Saved analysis setups | Implemented | Selected Histogram surfaces persist reusable setups. |
| Filter failures remain visible | Improved in EpicScope | Missing Qualification dependencies remain explicit instead of silently broadening analysis. |

Generic Histogram research parity is closed unless field use exposes a concrete correctness gap.

## MegaLogViewer calculated-field / Math Channel research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Arithmetic, comparison and logical expressions | Implemented | Supported. |
| Lazy conditional evaluation | Implemented | `if()` is lazy. |
| Historical references | Implemented | Exact-name-first `[Channel-N]` references are supported. |
| Temporal helpers | Improved in EpicScope | `lag()`, `delta()`, moving `avg()` and timestamp-based `rate()` use explicit sample/time semantics. |
| Conventional operator precedence | Improved in EpicScope | EpicScope intentionally does not copy historical left-to-right quirks. |
| Missing history should not fabricate zero silently | Improved in EpicScope | Explicit invalid/unavailable behavior is preferred. |
| Chained saved calculated-field dependencies | Deferred | Nested saved Math Channel references remain deliberately unsupported. |

## MegaLogViewer Scatter research

Scatter Single/Dual, Dots/Lines, density heat, source provenance, point/box-region evidence, strongest contiguous Logger navigation, saved setups and CSV export are implemented. Viewport-pixel aggregation with retained provenance and true Z mean/min/max/polynomial-fit features remain deferred until measured need exists.

## Compare / navigation research

Shared central navigation is implemented with Logger as authoritative timeline/range state. Timestamp/range semantics are preferred over record-offset identity. Independent second-dataset compare remains deferred; current Range Compare compares scopes/cohorts within the active source.

## MLG reliability / v3 research

Current parser reliability research is represented by strict header validation, partial-tail handling, counter/timestamp rollover handling, corruption diagnostics/recovery and conservative resynchronization evidence.

MLG v3 remains researched/not implemented. It is expected to extend the v2-style container rather than require a new parser architecture. LE scalar descriptor IDs 9..14 are experimentally confirmed; unknown IDs such as 8/15 must not be guessed as F64. Extended bitfield mappings still require fixtures.

## VE Analyze / VE-autotune research

Current authority is `../VE_ANALYZER.md` plus `../VE_ANALYZER_WORKBENCH.md`.

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Table-aware VE-node geometry | Implemented | Evidence maps against tune-table RPM/load geometry. |
| Semantic qualification presets | Partial | Useful visible qualification/state exclusions exist; richer presets remain future work. |
| Trailing-window stability/recovery | Implemented foundation | Reused from mature Fueling qualification behavior. |
| Observed mixture-response delay analysis | Implemented | Explicit RPM×load delay discovery and separate working-delay state. |
| Single/RPM-curve/RPM×load delay models | Deliberately narrowed | Product direction is **RPM×load table only**. |
| Explicit Grab lambda delays from log | Implemented | Expensive discovery remains explicit user action. |
| Timestamp-based delay alignment | Implemented | Mixture response maps back to earlier engine/fuel state by time. |
| Starting-table prior / confidence authority | Implemented | Proposal authority remains anchored to starting VE. |
| Evidence authority separate from user apply percentage | Partial | Evidence/proposal authority is separate; final apply-strength workflow remains future work. |
| Withhold out-of-authority proposals | Implemented | Unsafe/out-of-authority cells are withheld rather than silently clamped. |
| Measured/interpolated/weak/withheld/no-evidence states | Implemented | State/provenance are explicit enough for current review workflow. |
| Source provenance per recommendation | Implemented | Cell evidence retains source indices/visits and Logger navigation. |
| Source-authoritative Result Views | Improved in EpicScope | Views no longer consume mutable presentation state; repeated switching is browser-accepted. |
| Session retention across navigation | Implemented | Completed VE session survives semantically unchanged Logger/Analyzer navigation. |
| Duplicate cell-evidence analysis removal | Implemented | Cell detail consumes retained primary analysis. |
| Automatic tune writes | Intentionally excluded | Any future apply/write must remain explicit and diff-first; never auto Burn/write. |

Remaining VE ownership debt is narrow: the working delay surface is still partly reconstructed from rendered DOM. This is later cleanup, not the current active task.

## ECUMaster EMU PRO reference research

Built-in qualification, separate transient/recovery semantics, multiple VE result views and evidence thresholds informed EpicScope. EpicScope intentionally strengthens the evidence model with cumulative weight/spread/confidence and preserves apply strength as a separate future user-review concept.

## Fuel / Injector and Trigger / Sync research direction

Fuel / Injector is substantially improved with calibrated pressure-role separation, engineering/raw signal separation, source-continuity-correct events, exact event extremes and injector-duty headroom/saturation evidence. Later work can improve visible context, sag/recovery, repeatability, pump/prime and voltage/deadtime evidence.

Trigger / Sync remains partial. Later work may add richer sync/loss/glitch classification, pre/post context, RPM/voltage/load context, RPM-band frequency and stronger Logger navigation. A waveform Trigger Logger is a separate future capability.

## TunerStudio interaction/stability research

TunerStudio table-editing/persistence research primarily belongs to **EpicHub**, where live tune editing and ECU write semantics exist.

Transferable EpicScope rules are:

- analysis/recommendation state remains separate from tune/ECU state;
- closing a dialog never implies applying/burning a change;
- any future VE application remains explicit and diff-first;
- proven interaction components may be reused where appropriate.

Do not turn EpicScope into a live tune editor merely to mirror TunerStudio behavior.

## Current recommended product sequence

1. focused UI polish from the accepted `main` baseline;
2. browser sanity verification after interaction-affecting polish;
3. D-058 observability baseline benchmarks and record/session/operation/retention foundation;
4. staged migration of current diagnostics/performance/error/report paths and removal of redundant owners only after parity;
5. point 12 only if a controlled reproducer justifies it;
6. lower-priority Analyzer or MLG v3 work only where evidence/demand justifies it;
7. Web functional maturity review before Linux becomes primary.
