# EpicScope research disposition

This document maps preserved external behavioral research to the current EpicScope implementation state.

The research notes in this directory remain historical evidence. Do not rewrite an observed third-party behavior merely because EpicScope later implemented a different or stronger design. Update this disposition document when EpicScope status changes instead.

Status vocabulary:

- **Implemented** — the researched behavior or requirement is present in current EpicScope.
- **Improved in EpicScope** — EpicScope intentionally implements a stronger/safer version of the reference behavior.
- **Partial** — foundations exist, but the intended behavior is not complete.
- **Planned** — retained as an explicit product direction/specification.
- **Deferred** — deliberately not current work.
- **Not applicable to EpicScope** — useful research, but primarily belongs to another EpicEFI product such as EpicHub.

## MegaLogViewer Histogram / Table Generator research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| X/Y/Z table generation with explicit geometry | Implemented | Table Generator supports tune/custom/automatic geometry and explicit breakpoint vectors. |
| Bilinear/node-weighted table evidence | Implemented | Weighted Mean uses breakpoint-node contribution rather than rectangular binning. |
| Individual/cumulative evidence concepts | Partial / improved | EpicScope preserves weighted evidence and explicit cell evidence; VE-specific authority thresholds remain for VE Analyzer. |
| Multiple per-cell statistics | Improved in EpicScope | Count, Mean, Median, Min, Max, Sum, StdDev, Variance and Weighted Mean exceed the narrow reference set. |
| Z reference/delta behavior | Implemented | Table Generator supports aligned Z/reference/delta evidence. |
| Exact source evidence per cell | Improved in EpicScope | Source sample provenance and Logger navigation are retained explicitly. |
| Saved analysis setups | Implemented | Histogram/Distribution/Scatter saved setups are present where selected for the current product scope. |
| Filter failures should remain visible | Improved in EpicScope | Missing/unavailable Qualification dependencies degrade explicitly rather than silently broadening analysis. |

Generic Histogram research parity is considered closed unless field use exposes a concrete gap.

## MegaLogViewer calculated-field / Math Channel research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Arithmetic, comparison and logical expressions | Implemented | Math Channels support arithmetic, comparisons and logic. |
| Lazy conditional evaluation | Implemented | `if()` is lazy. |
| Historical references | Implemented | Exact-name-first `[Channel-N]` historical references are supported. |
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
| Viewport-pixel aggregation with retained provenance | Deferred | Current bounded rendering is sufficient; revisit only for measured large-log need. |
| True Z mean/min/max coloring / polynomial fit | Deferred | Not part of the closed generic Scatter scope. |

## MegaLogViewer compare / navigation research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Shared central navigation state | Implemented | Logger owns cursor/timeline/range state and Analyzer/Histogram route evidence back to Logger. |
| Time should be canonical rather than record offset | Improved in EpicScope | Timestamp/range semantics are preferred throughout analysis. |
| Independent second-dataset compare model | Deferred | Current Range Compare is scope/cohort comparison within the active source; true multi-log source comparison remains future work if required. |

## MLG reliability research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Strict header validation | Implemented | MLG import validates metadata and reports source problems. |
| Partial-tail handling | Implemented | Incomplete data is not treated as complete trusted records. |
| Counter wrap / timestamp rollover | Implemented | Covered by parser behavior/tests. |
| Corruption/retry recovery | Improved in EpicScope | EpicEFI retry runs and invalid attempts are handled with source diagnostics rather than simplified away. |
| Conservative resynchronization evidence | Implemented/maintained | Parser recovery and CRC diagnostics are established regression areas. |
| Synthetic/virtual Time channel | Deferred | EpicScope has a separate timestamp model; a virtual channel is optional rather than required. |

## VE Analyze / VE-autotune research

The research contract is preserved in `../VE_ANALYZER.md`.

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Table-aware VE-node geometry | Foundation implemented | Table Generator weighted breakpoint geometry exists and should be reused. |
| Semantic qualification presets | Partial | Shared Qualification and mature Fueling state semantics exist; dedicated VE presets are not implemented. |
| Trailing-window stability and recovery | Foundation implemented | Fueling already uses a mature trailing-window stability model. |
| Observed mixture-response delay analysis | Foundation implemented | Fueling/AFR-delay analysis exists. |
| Single / RPM-curve / RPM×load lambda-delay models | Planned | Specified in `VE_ANALYZER.md`; not yet a product surface. |
| Explicit **Grab lambda delays from log** | Planned | Deliberate EpicScope improvement over MLV/EMU PRO; not yet implemented. |
| Timestamp-based delay alignment | Planned / foundation available | Time-based source model exists; VE-specific alignment is not implemented. |
| Starting-table prior / confidence authority | Planned | Preserved from MLV research, to be made more explicit than the reference UI. |
| Separate evidence authority from user apply percentage | Planned | VE Analyzer must keep recommendation and application strength separate. |
| Withhold out-of-authority proposals rather than silently clamp | Planned | Required by VE Analyzer specification. |
| Measured / Interpolated / Weak / Withheld / No-evidence states | Planned | Required result-state model. |
| Source-sample provenance per recommendation | Planned / shared foundation implemented | Logger navigation/provenance infrastructure already exists. |
| Automatic tune writes | Intentionally not part of first implementation | Any future application/write must be explicit and diff-first. |

**Current state:** VE Analyzer is researched and specified but is not yet present in the Analyzer selector. It should be treated as a planned major Analyzer feature after the thinner current analyzers reach sensible maturity.

## ECUMaster EMU PRO reference research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| Built-in RPM/load/TPS/coolant qualification | Planned for VE Analyzer | EpicScope should expose semantic presets rather than requiring formulas. |
| Separate transient detection and recovery delay | Foundation implemented / planned | Fueling stability logic provides the base; VE-specific configuration remains future. |
| Multiple VE result views | Planned | VE Analyzer specification includes proposal/change/error/evidence/confidence/delay views. |
| Explicit 50/100% apply choices | Improved target planned | EpicScope intends independent evidence recommendation plus 25/50/75/100/custom application authority. |
| Minimum samples alone is insufficient | Improved target planned | EpicScope VE design combines count, weighted evidence, spread, repeatability and delay confidence. |
| Table-edge regressions deserve explicit tests | Planned | VE spec requires breakpoint/edge/corner regression coverage. |

## MLG v3 research

| Research conclusion | EpicScope status | Current disposition |
|---|---|---|
| v3 is an extension of the v2-style container | Researched / not implemented | No parser rewrite is expected. |
| LE scalar descriptor IDs 9..14 | Researched / not implemented | Experimentally confirmed and preserved in `MLG_V3_RESEARCH.md`. |
| IDs 8 and 15 must not be guessed as F64 | Enforced as design constraint | Unknown encodings must remain unsupported until evidence exists. |
| v3 bitfield namespace needs fixture validation | Planned when needed | Not blocking current EpicEFI logs. |
| Current EpicEFI logs may still be v2 under v3-capable TunerStudio | Confirmed | v3 support is compatibility expansion, not a present blocker. |

**Current state:** EpicScope supports the established v1/v2 path. v3 must continue to be detected/reported as unsupported until the confirmed extension is implemented and regression-tested.

## Fuel / Injector analyzer research and field findings

Recent field use exposed semantic problems that have now been corrected:

- Check Engine Light (`cel_*`) channels are excluded from fuel-pressure roles;
- raw electrical pressure channels are not treated as engineering pressure measurements;
- canonical `fuelPressure_low` and `fuelPressure_high` are preferred calibrated roles;
- low-side/conventional and high-side/GDI pressure domains are explicit;
- conventional mode uses rail differential as active pressure evidence;
- GDI mode uses high-side pressure as active evidence while retaining low-side supply context;
- injector duty headroom is explicit;
- channel selectors show units in Analyzer.

Current state remains **partial maturity**. Remaining high-value work includes event-extreme RPM/load/MAP context, pressure sag/recovery, repeated-event behavior, pump/prime evidence where logged, voltage/deadtime evidence and direct review navigation comparable to mature Fueling/Ignition.

## Trigger / Sync research direction

Current state is **partial maturity**. The next useful work remains:

- sync state / trigger error / loss count / loss reason context;
- one-sample glitch versus sustained loss classification;
- pre/post evidence;
- RPM/voltage/load at the event;
- frequency by RPM band;
- direct Logger navigation and ranked areas to review.

A future dedicated waveform-style trigger logger (crank/cam/TDC/injection/ignition relationship view) is a separate capability from the statistical Trigger / Sync analyzer and should be scoped explicitly before implementation.

## TunerStudio interaction/stability research

The recent TunerStudio table-editing/persistence research primarily belongs to **EpicHub**, where live tune editing and ECU write semantics exist.

For EpicScope it is currently **not directly applicable** except for these transferable product rules:

- analysis/recommendation state must remain separate from tune/ECU state;
- closing a dialog must never imply applying or burning a change;
- future VE proposal application must be explicit and diff-first;
- table/curve interaction behavior should reuse proven shared interaction components where EpicScope eventually gains editable proposal surfaces.

Do not turn EpicScope into a live tune editor merely to mirror TunerStudio behavior.

## Current recommended product sequence

As of 2026-10-14:

1. preserve/synchronize research and documentation;
2. finish Fuel / Injector practical maturity;
3. bring Trigger / Sync to comparable evidence/navigation maturity;
4. implement VE Analyzer from the preserved specification;
5. add MLG v3 compatibility when its remaining type mapping is sufficiently verified or a real need appears;
6. address remaining AE / MAP Predict and Idle maturity gaps;
7. run the deliberate cleanup/consolidation phase;
8. perform the Web functional maturity review before Linux production work.
