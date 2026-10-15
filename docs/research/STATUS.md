# EpicScope research disposition

This document maps preserved external behavioral research to the current EpicScope implementation state.

The research notes under `docs/research/` remain historical evidence. Do not rewrite an observed third-party behavior merely because EpicScope later implemented a different or stronger design. Update this disposition document when EpicScope status changes.

Status vocabulary:

- **Implemented** — the researched behavior or requirement is present in current EpicScope.
- **Improved in EpicScope** — EpicScope intentionally implements a stronger/safer version of the reference behavior.
- **Partial** — foundations exist, but the intended behavior is not complete.
- **Planned** — retained as explicit product direction.
- **Deferred** — deliberately not current work.
- **Not applicable to EpicScope** — useful research, but primarily belongs to another EpicEFI product.

## Current project disposition — 2026-10-15

- Logger is a mature functional reference; broad optimization remains paused unless measured regression appears.
- Generic Histogram research parity is closed for the approved scope.
- VE Analyzer is implemented and real-log/browser validated. It is no longer a planned-only feature.
- PR #449 restored the VE Analyzer runtime to the browser-known-good #441-era composition after later continuity/render wrappers caused Analyzer-entry regression. The project owner confirmed Analyzer entry works again after that rollback.
- Fuel / Injector and Trigger / Sync remain useful maturity targets outside VE.
- MLG v3 remains researched but not implemented.

## MegaLogViewer Histogram / Table Generator research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| X/Y/Z table generation with explicit geometry | Implemented | Table Generator supports tune/custom/automatic geometry and explicit breakpoint vectors. |
| Bilinear/node-weighted table evidence | Implemented | Weighted Mean uses breakpoint-node contribution rather than rectangular binning. |
| Multiple per-cell statistics | Improved in EpicScope | Count, Mean, Median, Min, Max, Sum, StdDev, Variance and Weighted Mean are available. |
| Z reference/delta behavior | Implemented | Aligned Z/reference/delta evidence is supported. |
| Exact source evidence per cell | Improved in EpicScope | Source-sample provenance and Logger navigation are retained explicitly. |
| Saved analysis setups | Implemented | Selected Histogram surfaces persist reusable setups. |
| Filter failures should remain visible | Improved in EpicScope | Missing Qualification dependencies remain explicit instead of silently broadening analysis. |

Generic Histogram research parity is considered closed unless field use exposes a concrete correctness gap.

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

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| X/Y relationship analysis | Implemented | Scatter supports Single/Dual, Dots/Lines and shared scopes/Qualification. |
| Density visualization | Implemented | Density heat is supported with bounded rendering. |
| Evidence selection | Improved in EpicScope | Point and box-region evidence retain source provenance and Logger navigation. |
| Strongest contiguous source visit | Improved in EpicScope | Region evidence can navigate to the strongest contiguous Logger visit. |
| Saved setups / export | Implemented | Saved setups and qualified/region CSV export are present. |
| Viewport-pixel aggregation with retained provenance | Deferred | Revisit only for measured large-log need. |
| True Z mean/min/max coloring / polynomial fit | Deferred | Not part of the closed generic Scatter scope. |

## Compare / navigation research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Shared central navigation state | Implemented | Logger owns cursor/timeline/range state and Analyzer/Histogram route evidence back to Logger. |
| Time should be canonical rather than record offset | Improved in EpicScope | Timestamp/range semantics are preferred throughout analysis. |
| Independent second-dataset compare model | Deferred | Current Range Compare is scope/cohort comparison within the active source. |

## MLG reliability research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Strict header validation | Implemented | MLG import validates metadata and reports source problems. |
| Partial-tail handling | Implemented | Incomplete data is not treated as complete trusted records. |
| Counter wrap / timestamp rollover | Implemented | Covered by parser behavior/tests. |
| Corruption/retry recovery | Improved in EpicScope | Retry runs and invalid attempts retain source diagnostics. |
| Conservative resynchronization evidence | Implemented/maintained | Parser recovery and CRC diagnostics remain regression areas. |
| Synthetic/virtual Time channel | Deferred | EpicScope has a separate timestamp model. |

## VE Analyze / VE-autotune research

The current product/behavior contract is preserved in `../VE_ANALYZER.md`.

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Table-aware VE-node geometry | Implemented | VE evidence maps against tune-table RPM/load geometry. |
| Semantic qualification presets | Partial | Useful qualification controls and state exclusions exist; richer preset semantics remain future work. |
| Trailing-window stability and recovery | Implemented foundation | Reused from mature Fueling qualification behavior. |
| Observed mixture-response delay analysis | Implemented | VE uses explicit RPM×load lambda-delay discovery and a separate working delay table. |
| Single / RPM-curve / RPM×load lambda-delay models | Deliberately narrowed | Current VE product uses RPM×load table only. Scalar/curve modes are not part of the accepted product direction. |
| Explicit Grab lambda delays from log | Implemented | Expensive discovery remains explicit user action. |
| Timestamp-based delay alignment | Implemented | Mixture observations are aligned back to the earlier engine/fuel state by time. |
| Starting-table prior / confidence authority | Implemented | Proposal authority remains anchored to the starting VE table. |
| Separate evidence authority from user apply percentage | Partial | Evidence/proposal authority is separated; final user apply-strength workflow remains future work. |
| Withhold out-of-authority proposals rather than silently clamp | Implemented | Out-of-authority cells are withheld. |
| Measured / Interpolated / Weak / Withheld / No-evidence states | Implemented/partial | Delay and proposal/evidence states are explicit; final review-state ownership still needs cleanup. |
| Source-sample provenance per recommendation | Implemented | Cell evidence retains source sample indices and supports strongest-visit Logger navigation. |
| Automatic tune writes | Intentionally excluded | Any future application/write must be explicit and diff-first; never auto Burn/write. |

### Current VE implementation state

Implemented behavior includes:

- VE/target table correlation from tune metadata;
- strict actual-mixture semantics and scale-aware AFR/Lambda handling;
- operating-range/state qualification;
- explicit Run readiness;
- RPM×load lambda-delay discovery, provenance, editing and save/load;
- timestamp-aligned mixture evidence;
- known fuel-correction compensation with explicit semantics;
- robust weighted-median VE evidence plus P10/P90 spread;
- cumulative evidence weight/sample count and confidence;
- starting-table prior authority and withholding safeguards;
- compact proposal/evidence states;
- Result View modes;
- cell evidence with strongest contiguous Logger visit.

### Current VE architecture debt

The browser-known-good runtime restored by PR #449 intentionally retains some older wrapper/DOM patterns because the later attempted continuity/render wrappers froze Analyzer entry. Current known debt includes:

- destructive `setContext` / `setTuneModel` rebuild semantics;
- Result View fallback/precision issues;
- Analyzer result loss after Logger round-trip;
- duplicate analysis in cell-evidence review;
- working delay reconstruction and handler coupling through rendered DOM;
- hidden one-shot qualification/load state;
- Custom qualification semantics that need redesign before advanced formula support.

Future VE work should move authoritative result/proposal/delay/session state out of rendered DOM one structural change at a time, with browser verification after each change.

## ECUMaster EMU PRO reference research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Built-in RPM/load/TPS/coolant qualification | Implemented/partial | Core semantic controls exist; richer presets remain possible. |
| Separate transient detection and recovery delay | Implemented foundation | Existing qualification/stability logic covers the foundation. |
| Multiple VE result views | Implemented | Result View supports proposal/change/error/evidence/confidence/delay perspectives. |
| Explicit 50/100% apply choices | Planned refinement | Future review/apply strength should remain separate from evidence authority. |
| Minimum samples alone is insufficient | Improved in EpicScope | Count, cumulative weight, spread, confidence and delay provenance are used. |
| Table-edge regressions deserve explicit tests | Maintained requirement | Edge/corner behavior remains a regression target. |

## MLG v3 research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| v3 is an extension of the v2-style container | Researched / not implemented | No parser rewrite is expected. |
| LE scalar descriptor IDs 9..14 | Researched / not implemented | Experimentally confirmed and preserved. |
| IDs 8 and 15 must not be guessed as F64 | Enforced as design constraint | Unknown encodings remain unsupported until evidence exists. |
| v3 bitfield namespace needs fixture validation | Planned when needed | Not blocking current EpicEFI logs. |
| Current EpicEFI logs may still be v2 under v3-capable TunerStudio | Confirmed | v3 support is compatibility expansion, not a current blocker. |

## Fuel / Injector analyzer research and field findings

Current state is partial but substantially improved:

- calibrated pressure roles are separated from raw electrical channels;
- low-side/conventional and high-side/GDI pressure domains are explicit;
- injector duty headroom and saturation evidence exist;
- threshold-event grouping respects source-sample continuity;
- exact event-extreme source sample/time are retained;
- event-context core supports pressure/PW/duty/deadtime/RPM/load evidence.

Remaining high-value work includes visible event-extreme context, pressure sag/recovery, repeated-event behavior, pump/prime evidence where logged, voltage/deadtime evidence and stronger Logger navigation.

## Trigger / Sync research direction

Current state remains partial. Useful next work includes:

- sync state / trigger error / loss count / loss reason context;
- one-sample glitch versus sustained loss classification;
- pre/post evidence;
- RPM/voltage/load context;
- frequency by RPM band;
- direct Logger navigation and ranked review areas.

A future waveform-style Trigger Logger is a separate capability from the statistical Trigger / Sync analyzer and should be scoped separately.

## TunerStudio interaction/stability research

The TunerStudio table-editing/persistence research primarily belongs to **EpicHub**, where live tune editing and ECU write semantics exist.

For EpicScope the transferable rules are:

- analysis/recommendation state must remain separate from tune/ECU state;
- closing a dialog must never imply applying or burning a change;
- future VE proposal application must be explicit and diff-first;
- table/curve interaction behavior may reuse proven shared interaction components where appropriate.

Do not turn EpicScope into a live tune editor merely to mirror TunerStudio behavior.

## Current recommended product sequence

As of 2026-10-15:

1. preserve the PR #449 browser-known-good VE runtime while cleaning state ownership;
2. expose authoritative VE session/result/proposal/working-delay state;
3. remove duplicate cell-evidence analysis and DOM-derived delay ownership;
4. fix Result View state/precision behavior and Logger round-trip persistence one verified step at a time;
5. continue remaining Fuel / Injector and Trigger / Sync maturity work as useful;
6. add MLG v3 compatibility when remaining type mapping is sufficiently verified or real need appears;
7. perform deliberate Web cleanup/consolidation without reopening closed Histogram/Logger feature tracks.
