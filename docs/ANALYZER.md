# Analyzer

EpicScope Analyzer answers specific tuning questions from log evidence. Logger remains the raw-trace/navigation authority; Histogram/Table Generator/Distribution/Scatter remain the generic statistical/relationship tools.

An analyzer should identify relevant events/conditions, quantify the result, show the evidence, explain what can and cannot be concluded, and preserve a route back to the original log.

For present-tense continuation state, `docs/HANDOFF.md` remains authoritative. Research-derived requirements and their current implementation status are mapped in `docs/research/STATUS.md`.

## Current surfaces

- Range Compare
- Tune Table
- Boost · Experimental
- Idle · Experimental
- AE / MAP Predict · Experimental
- Fueling · Experimental
- Ignition · Experimental
- Fuel Pressure / Injector · Experimental
- Trigger / Sync · Experimental

The Analyzer selector is a compact dropdown in the global analysis header.

**VE Analyzer is not yet a selectable surface.** It is researched and specified in `docs/VE_ANALYZER.md` and remains a planned major Analyzer feature.

## Current development position — 2026-10-14

Analyzer maturity is deliberately uneven rather than falsely uniform.

- **Fueling** — mature experimental checkpoint; freeze unless bug/regression.
- **Ignition** — mature non-knock experimental checkpoint; freeze unless bug/regression.
- **Boost** — strong experimental foundation; paused.
- **Idle** — useful foundation; later refinement.
- **AE / MAP Predict** — useful foundation; later refinement.
- **Fuel Pressure / Injector** — active maturity track.
- **Trigger / Sync** — next broad-coverage target after Fuel / Injector.
- **VE Analyzer** — researched/specified; not implemented.

The preferred sequence is to bring the thinner analyzers toward the same evidence/navigation usefulness as Fueling/Ignition before beginning the dedicated cleanup/consolidation phase.

## Shared workflow foundation

Specialized analyzers resolve semantic channel roles from the loaded INI/log where possible while keeping mappings visible and manually overridable.

Current shared scope choices:

- **Full Log**
- **Current A/B**
- **Saved Range**

Required semantic roles must not silently fall back to the first available channel. Role matching should prefer canonical runtime identifiers where known, then increasingly fuzzy name/display matching.

Channel selectors should show the source/display name plus unit when unit metadata exists:

```text
MAP [kPa]
RPM [rpm]
Injector duty cycle [%]
```

Shared Analyzer infrastructure includes:

- contextual Logger → Analyzer handoff for Current A/B;
- Analyzer → Logger source/event navigation;
- shared saved Qualification storage where appropriate;
- grouped ALL/ANY Qualification semantics;
- qualification provenance;
- shared numeric range/cohort comparison;
- reusable event-aligned evidence rendering;
- progressive disclosure of decision-facing vs secondary diagnostics;
- sortable evidence tables where useful;
- standardized anchored round-`i` help.

Do not build analyzer-local replacements for shared concepts unless the domain genuinely requires different semantics.

## Presentation rules

### Progressive disclosure

Calculate the evidence needed for correctness, but do not show every available metric at once.

Default presentation should expose a small number of decision-facing results. Secondary provenance, distributions, raw diagnostic counts and supporting metrics belong behind **More details**, expandable sections, optional columns or evidence drill-down.

### Information buttons

Use the standardized small round `i` button with an anchored popup near the invoking control/result.

### Event evidence graphs

Aligned-event canvases must render at their actual displayed dimensions. Do not render hidden canvases at a fallback size and then allow CSS to stretch the bitmap.

Default aggregate evidence should be restrained. Decision-facing signals should be on by default; context signals/envelopes may be enabled deliberately.

### Large-log event presentation

Analysis should use all relevant data. Browser rendering may be bounded.

Do not confuse a display cap with an analysis cap. Event tables may use pagination, and aggregate graph evidence may use representative sampling across the whole scope, but statistics/detection should remain full-scope unless explicitly documented otherwise.

## Analyzer invariant

> **An analyzer should not merely report channel averages. It should find the relevant operating events/conditions, show the evidence that produced the result, quantify repeatability/error, explain the likely tuning layer when evidence supports it, and let the user move directly between the analysis and the original log without overstating causation.**

## Idle analyzer

Idle remains subsystem-aware:

- Combined
- DC Idle
- IAC Valve
- ETB
- Ignition

Common required roles include RPM and Idle Target. Canonical EpicEFI `RPMValue` remains preferred for RPM.

The **DC Bias calibration curve/table is tune calibration data**, not a scalar runtime channel. A distinct logged runtime DC Bias contribution/output may be analyzed as runtime evidence. Future curve/current-operating-point analysis should come from MSQ/tune context.

Current maturity includes target tracking, sag/recovery evidence, subsystem-specific controller/actuator context and shared help.

Later work may add richer idle phases, settling/oscillation/headroom and real tune-curve context.

## AE / MAP Predict analyzer

Current aligned evidence can include TPS, measured MAP, predicted MAP and mixture evidence.

Current metrics include prediction mean/error/MAE and lean/rich excursion context.

Actual-mixture role matching prefers Lambda before AFR for the same fuel-independent reason as Fueling.

Later maturity may add richer event classes, integrated/timing error metrics and comparison between event sets.

## Boost analyzer

Boost remains capability-driven and control-mode aware.

Open Loop asks:

> **RPM / TPS-load / operating state → wastegate command → measured pressure response**

Closed Loop adds:

> **Boost Target → pressure tracking / error / attainment / over/undershoot / settling**

Implemented maturity includes explicit Open/Closed Loop mode, target-independent pressure-rise timing, peak pressure with context, operating-point evidence, matched-scope comparison, upper/lower chamber summaries and sortable evidence.

### Critical Boost invariant

> **Boost Analyzer does not assume wastegate plumbing/polarity.**

An observed duty-to-pressure association is evidence, not an instruction to increase/decrease duty.

## Fueling analyzer — mature checkpoint

Detailed semantics remain authoritative in `docs/FUELING_ANALYZER.md`.

Preferred EpicEFI/JZ roles include:

- actual mixture: `lambdaValue`;
- target mixture: `targetLambda`;
- current effective VE: `veValue`;
- fuel command for response timing: `actualLastInjection`;
- RPM: `RPMValue`;
- VE/load coordinate: `veTableYAxis`;
- DFCO: `dfcoActive`;
- hard fuel-cut reason: `fuelCutReason`;
- AE/decel state where available;
- total/STFT/LTFT correction context where available.

Fueling explicitly separates intentional fuel-state effects from ordinary steady calibration evidence and uses trailing-window stability rather than brittle adjacent-sample derivative gating.

It can estimate observed mixture response delay from isolated injector-pulse changes and deliberately describes that as observed response delay rather than pure sensor delay.

STFT/LTFT/total correction are explanatory context. The analyzer must not automatically claim VE is the cause of a mixture error.

A previous DOM-heavy Fueling heatmap experiment was rolled back after page-load/graph-stretch regressions. Do not reintroduce a similar overview without a safer architecture and measured validation.

## Ignition analyzer — mature non-knock checkpoint

Ignition is deliberately non-knock-focused until trusted knock evidence is available for validation.

Preferred EpicEFI roles prioritize:

- final timing: `correctedIgnitionAdvance`;
- correction context: `ignitionAdvanceCorrections`, then `ignitionCorrections`;
- dwell: `sparkDwell`;
- RPM: `RPMValue`;
- ignition-table load: `loadForIgnitionTableDot`, then `ignitionLoad`.

Current behavior includes large-log-safe events, restrained aggregate evidence, ranked **Areas to review**, optional MSQ base-ignition-table comparison and conservative source clues.

The analyzer does not claim knock/detonation, judge timing safe/unsafe, or recommend a specific timing change from observational data alone.

## Fuel Pressure / Injector analyzer — current active maturity track

This analyzer changed substantially during PRs #382–#390.

### Current semantic model

Fuel systems are explicitly separated by architecture:

- **Conventional / port injection** — active pressure evidence is rail differential; low-side calibrated pressure is supply/context; GDI high-side pressure cannot create conventional pressure events.
- **GDI / high-pressure** — active pressure evidence is high-side/GDI rail pressure; low-side calibrated pressure remains supply-side context; conventional rail differential cannot substitute for high-side evidence.

Calibrated pressure roles prefer canonical engineering channels:

- `fuelPressure_low` — low-side/conventional pressure;
- `fuelPressure_high` — high-side/GDI pressure.

The following are explicitly not normal pressure evidence:

- `cel_*` / Check Engine Light channels;
- `rawLowFuelPressure` / `rawHighFuelPressure` electrical-domain channels;
- MAP/manifold pressure as a substitute for rail differential.

When available, unit metadata is shown directly in channel selectors and summaries.

### Current implemented evidence

- threshold events respect true source-sample continuity;
- event extremes retain exact source sample/time;
- injector duty mean/max and minimum duty headroom;
- sample counts above the selected duty threshold;
- samples at/above 100% duty;
- negative headroom is preserved when duty exceeds 100% rather than hidden;
- core event context can retain RPM/load/pressure/differential/PW/duty/deadtime at the actual event extreme;
- decision-facing summary cards;
- explicit no-review-event state rather than an empty-looking table.

### Remaining maturity work

Highest-value next steps:

1. expose the existing event-extreme operating context in the visible evidence table/detail view;
2. quantify pressure sag magnitude and recovery time;
3. characterize repeated pressure/high-duty events and operating regions;
4. add pump/prime/recovery evidence where logged;
5. add battery-voltage/deadtime evidence and deadtime-calibration comparison;
6. strengthen Logger navigation and ranked Areas to review.

The analyzer should remain observational. It may say pressure fell during a high-demand event; it must not jump directly to a causal verdict such as “bad fuel pump.”

## Trigger / Sync analyzer — next broad-coverage target

Current useful direction:

- sync state / trigger error / loss counter/reason;
- RPM/voltage/load at events;
- pre/post evidence;
- frequency by RPM band;
- distinguish one-sample glitches from sustained loss;
- direct Logger navigation;
- ranked review areas.

A future waveform-style Trigger Logger for crank/cam/TDC/injection/ignition pulse relationships is a separate product capability from the statistical Trigger / Sync analyzer and should be scoped deliberately before implementation.

## VE Analyzer — researched and specified, not implemented

`docs/VE_ANALYZER.md` is the current behavior contract derived from MegaLogViewer and ECUMaster EMU PRO research.

Important planned behavior:

- semantic Recommended VE Analysis and Lambda Delay Discovery qualification presets;
- separate state exclusions from stability/recovery requirements;
- single / RPM-curve / RPM×load lambda-delay working models;
- explicit **Grab lambda delays from log** action;
- no expensive delay scan on startup/log load/analyzer open;
- timestamp-based delay alignment rather than record-count offsets;
- bilinear VE-node evidence geometry;
- effective/interpolated runtime VE awareness;
- starting-table prior/confidence authority;
- independent evidence authority and user apply percentage;
- absolute/percentage correction limits that withhold rather than silently clamp;
- Measured / Interpolated / Weak / Withheld / No-evidence result states;
- exact source provenance and Logger navigation;
- immutable original tune until explicit review/export/apply.

Existing reusable foundations already include Fueling state semantics, trailing-window stability, AFR-delay analysis, shared scopes/Qualification, Table Generator weighting, semantic channel roles and loaded MSQ tune tables.

Do not implement VE Analyzer as a parallel mini-application; reuse those foundations.

## Range Compare

Range Compare remains the general before/after experiment tool.

Current capabilities include Full Log / Current A/B / Saved Range independently on each side, saved Qualification filters, grouped ALL/ANY semantics, provenance, descriptive statistics and contextual Logger A/B handoff.

Future work should extend the common comparison model rather than fork analyzer-local equivalents.

## Cleanup/consolidation policy

Do not start a broad Analyzer refactor merely because duplicate or awkward implementation details are visible.

Current direction:

1. finish useful coverage across the analyzer family;
2. stop mature analyzers at sensible checkpoints;
3. implement VE Analyzer if retained as planned;
4. then run the dedicated cleanup/consolidation/optimization phase.

That later phase should review duplicated DOM enhancement logic, unnecessary MutationObservers, direct DOM state bridges/lookups, duplicated table/event/help/rendering code, canvas resize ownership, CSS/runtime UI surgery, dead/unreachable branches and representative large-log performance.
