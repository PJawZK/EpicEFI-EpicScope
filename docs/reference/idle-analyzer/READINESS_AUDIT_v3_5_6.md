# EpicScope Idle Analyzer — v3.5.6 Functional Maturity and Integration Readiness

**Assessment:** 26 October 2026 · Source: inspected standalone `EpicScope_Idle_Analyzer_Adaptive_Concept_v3_5_5_Comparison_Integrity.html`, extended v3.5.6, and current `main` implementations `apps/web/src/pages/specialized-analyzer-suite-view.ts`, `core/analysis/specialized-analyzers.ts`, `core/analysis/idle-control-diagnostics.ts`. No production repository modifications.

## Summary

The compact adaptive UI is ready to act as a **visual/design reference**. Recorded MLG import, mode-dependent dual plots, region scope, comparison sources, diagnostics, and local MSQ differences operate in the standalone prototype, but the core is **not yet a validated reusable production analyzer**. Distinguish recorded channel truth, mathematical derived values, diagnostic heuristics, and illustrative content explicitly.

## Functional evidence matrix

| Surface | Current state | Main remaining qualification |
|---|---|---|
| Eight adaptive modes / compact diagnostics | Implemented UX with recorded data | Test every mode's calculations against independent fixture expectations; real data missing for some perturbation cases |
| Source data | October 20 trusted embedded measurement set; second MLG loaded by local-file input | Replace bespoke HTML parser with EpicScope canonical MLG parser, CRC/retry diagnostics and channel validity authority |
| Graphs, shared viewport and peak-preserving draw | Working in standalone | Integrate EpicScope Logger-backed trace selection, true-range linking, source identity and workers for large logs |
| Region qualification | Recorded idle state, RPM, VSS; user/manual regions | More robust controller phase, transition, fan/AC/alternator state, gaps/hysteresis, purpose and sensor-validity checks |
| Comparison within same MLG | Functional as descriptive condition contrast | Explain different test purposes; match conditions and reserve 'improvement' for appropriate before/after trials |
| Before/after MLG comparison | Two sources supported, with candidate auto windows and manual interval | Robust matched intervals for **both** sources, true time/tune provenance, future reverse-source ordering, repeated trials |
| MSQ differences | Parses local MSQ XML and lists shared changed constants | Structural INI/MSQ authority, tables/axes/unit decoding, firmware definition compatibility; verified **flashed** ECU tune unknown |
| Tune Tables | DC 8-point bias and PID settings sourced from October MSQ, other examples marked demonstration | Real table resolver, interpolation/occupancy backed by actual axes and source state; editor scope deferred |
| Metrics | Real RPM RMSE, DC position error RMSE, signed H-bridge duty, PID pre/post-fade evidence | Validate timing, sensor update rate, segmentation; no universal fault cutoffs established |
| Diagnostic narrative / Next Test | Mode-specific evidence-driven draft findings | Deterministic evidence rules, conflict hypotheses, provenance and independent-log cross-validation |
| Contextual help | Large local reference library, info buttons and deep help | Check final algorithms/terminology and links; include exact source of thresholds |
| Manual baseline | UI stores a reference region | Persistent source + tune + region + hypothesis identity, cross-log comparison session; not just region ID |
| Test plan import/export | JSON prototype workflow | Versioned portable schema and source-linked result verification, schema migration and replay tests |
| Logger handoff | Placeholder dialog in standalone HTML | Wire into EpicScope Logger's actual sample/time-range API |
| Live ECU | Not implemented | Later milestone; reuse offline validated analytics, not a separate algorithm |
| ECU writes | Explicitly absent | Preserve this safety boundary in initial port |

## Verified missing / risky aspects

1. **Before/after chronological role:** The reference October 20 log is later than the imported September 30 log. v3.5.6 adds filename-derived reverse-order warning and calls the two datasets **Later reference** and **Earlier recording** instead of inferring a tuning improvement. Filename dates alone are not verified ECU timing.
2. **Candidate region is not necessarily comparable:** Previous default was approximately 12.4 seconds against an 89.3-second interval containing a deep RPM collapse. v3.5.6 adds an optional same-duration candidate finder ranked by CLT, target RPM, TPS and controller-active coverage — *not* by lower RPM error. Candidates require user inspection; mechanical/electrical loads remain unmeasured.
3. **Only candidate steady-idle auto windows are currently discovered for second logs.** Other experiment types (recovery, raised-RPM, transition) require manual selection. Initial integration should support purpose-aware discovery and independent regions in each log.
4. **Derived DC bias is not a logged H-bridge duty channel.** The October MSQ eight-point curve is an external reference and its identity as flashed calibration is not proven. Also don't confuse physical TPS caused by motor opening with accelerator-pedal input.
5. **Timing/response metrics remain investigatory.** MLG source sample rate is not a verified independent actuator/controller update rate. t63, lag, hunting frequency and causal PID recommendations need controlled evidence and bounded confidence.
6. **Some prototype text and parameter geometry remain demonstrations.** The source still contains synthetic generator scaffolding and fixed sample logic overridden at runtime; never port that code as the semantic authority.
7. **Large-source perf/validity:** Standalone parser implements its own record scan, exclusion/count and mapping instead of EpicScope's canonical flow. For production, use workers and source-validity/counter reconciliation, not this duplicate pipeline.
8. **Scope versus chart zoom:** Plot zoom is display-only; source regions and sample eligibility determine statistics. Keep distinct, explicitly labeled, and test navigation state persistence.
9. **Comparison score caution:** A lower RPM RMSE can coexist with deeper rare sags; also report worst-case and distribution, controller saturation, and comparable load context.
10. **Help content parity:** Most topics are present, but mapping and final thresholds cannot be frozen until actual algorithms and engine-specific source constraints are settled.

## v3.5.6 change set

- Kept v3.5.5 dual-graph layout and local source import unchanged.
- Added a **Comparable interval finder** in the Before/After dialog with six max candidates suggested for the October 20 warm-idle reference; candidate windows use the actual imported samples.
- Uses complete baseline duration for matching (no silent clamping); target length, CLT, TPS, RPM target, and active-state evidence are displayed. Suggestions are ranked for operating-condition comparability, never by a favorable RMSE.
- Automatically preselects the first suggested candidate range for review, retaining all manual controls and selectable alternative suggestions.
- Added reverse-filename chronology warning and appropriately neutral **Later reference / Earlier recording** labels in plots, metrics, assessment and file identity. Improvement is not qualified in reversed chronology.
- No code writes, MLG edits, ECU writes or GitHub repository changes.

## Integration preparation — start now, in a separate nonproduction workstream

1. **Freeze UX reference:** v3.5.6 standalone HTML as visual/workflow authority, not as mathematical authority. Snapshot screenshots of desktop/tablet. No wholesale copy of embedded log or demo generator into production.
2. **Define data contracts:** Source ID, sample index and validity, time, controller state, region type + intervals, joined MSQ/INI revision identity, independent-log support, metric provenance and thresholds.
3. **Extend core analysis:** Deterministic pure functions for region discovery, outer RPM correction (raw vs applied TPS fade), inner DC tracking and H-bridge duty, sag/recovery, compare quality and evidence attribution. Use existing `core/analysis/idle-control-diagnostics.ts` and `specialized-analyzers.ts` as starting points, avoiding duplicate calculators.
4. **Canonical data authority:** EpicScope `core/parsers/mlg/*`, Logger analysis context and actual MSQ/INI parsers supply values. Don't copy prototype's independent MLG parser, `.msq` regex/XML-only assumptions or fixed Oct20 fields.
5. **Automated correctness gates:** Independent expected numbers for the October 20 + September 30 logs; interval eligibility; invalid-record exclusions; reversed source chronology; same/different purposes; no data loss on zoom; missing signals; oversized recordings; retention across view switches. Include browser regression for setup and chart.
6. **Port presentation incrementally:** Mode selector + synchronized graphs, regions, evidence and help, comparison workflow, tune viewer. Keep UI staged behind separate route/flag until acceptance; VE Analyzer correction/branch work takes precedence.
7. **Only then:** Perform manual UI acceptance on integrated EpicScope, audit remaining findings, and consider production merge. Log-based analyzer first. Live ECU analyzer deferred to proven offline core.

## Test outcomes and limits

Standalone v3.5.6 Chromium replay with `2026-09-30_12.09.28.mlg`: 72,129 trusted samples, 29 rejected CRC records, 9 detected idle windows. The reference warm steady 501–513.4 s has 16.37 RPM error RMSE; the first same-duration candidate suggestion at 722.4–734.8 s has 27.38 RPM error RMSE and minimum 840 RPM. The modal provides six suggestions, reverse chronology warning and prevents a tuning improvement verdict. JavaScript syntax and browser interaction checked; responsive checks at widths 1440, 768 and 390 without page horizontal overflow or JS errors. These are **workflow checks**, not independent mathematical validation of all modes and thresholds.
