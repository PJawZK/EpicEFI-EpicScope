# Analyzer

EpicScope Analyzer answers specific tuning questions from log evidence. Logger remains the raw-trace/navigation authority; Histogram/Table Generator/Distribution/Scatter remain the generic statistical/relationship tools.

For present-tense continuation state, `HANDOFF.md` remains authoritative. Research-derived requirements and their current implementation status are mapped in `research/STATUS.md`.

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
- VE Analyzer · Experimental

The Analyzer selector is a compact dropdown in the global analysis header.

## Current development position — 2026-10-15

Analyzer maturity is deliberately uneven rather than falsely uniform.

- **Fueling** — mature experimental checkpoint; freeze unless bug/regression.
- **Ignition** — mature non-knock experimental checkpoint; freeze unless bug/regression.
- **Boost** — strong experimental foundation; paused unless a concrete gap appears.
- **Idle** — useful foundation; later refinement.
- **AE / MAP Predict** — useful foundation; later refinement.
- **Fuel Pressure / Injector** — substantially improved; remaining work is targeted maturity.
- **Trigger / Sync** — still thinner; later broad-coverage maturity target.
- **VE Analyzer** — implemented, real-log/browser validated, and the current highest-value Analyzer maturity target.

VE work is currently constrained by the browser-known-good runtime restored in PR #449. Browser behavior, not CI alone, is the acceptance authority for VE runtime changes.

## Shared workflow foundation

Specialized analyzers resolve semantic channel roles from the loaded INI/log where possible while keeping mappings visible and manually overridable.

Current shared scope choices:

- **Full Log**
- **Current A/B**
- **Saved Range**

Required semantic roles must not silently fall back to the first available channel. Literal source/channel names remain authoritative presentation data; semantic roles guide selection but must not rename source data.

Shared Analyzer infrastructure includes Logger ↔ Analyzer evidence navigation, saved Qualification where appropriate, grouped ALL/ANY semantics, provenance, reusable comparison/event evidence, progressive disclosure, sortable evidence tables and standardized inline help.

## Analyzer invariant

> An analyzer should not merely report channel averages. It should find the relevant operating events/conditions, show the evidence that produced the result, quantify repeatability/error, explain what can and cannot be concluded, and let the user move directly between the analysis and the original log without overstating causation.

## Fueling analyzer

Detailed semantics remain authoritative in `FUELING_ANALYZER.md`.

Fueling uses lambda-first actual-mixture semantics, VE/load context, intentional fuel-state qualification, trailing-window stability and observed mixture-response delay evidence. STFT/LTFT/total correction remain explanatory context; mixture error alone is not proof that base VE is wrong.

This is a mature experimental checkpoint and should remain frozen unless field use exposes a concrete defect/regression.

## Ignition analyzer

Ignition remains deliberately non-knock-focused until trusted knock evidence is available for validation.

Current behavior includes large-log-safe events, final timing/correction/dwell/load context, ranked **Areas to review**, optional MSQ base-table comparison and conservative source clues. It does not claim knock/detonation, judge timing safe/unsafe or recommend a specific timing change from observational data alone.

## Boost analyzer

Boost remains capability-driven and control-mode aware.

Open Loop asks:

> RPM / TPS-load / operating state → wastegate command → measured pressure response

Closed Loop adds target tracking/error/attainment/over- and undershoot/settling evidence.

Critical invariant:

> **Boost Analyzer does not assume wastegate plumbing/polarity.**

An observed duty-to-pressure association is evidence, not an instruction to increase/decrease duty.

## Idle analyzer

Idle remains subsystem-aware across Combined, DC Idle, IAC Valve, ETB and Ignition contexts.

The DC Bias calibration curve/table is tune calibration data, not a scalar runtime channel. A distinct logged DC Bias contribution/output may be analyzed as runtime evidence. Later refinement may add richer phase/settling/oscillation/headroom and MSQ curve context.

## AE / MAP Predict analyzer

Current evidence can include TPS, measured MAP, predicted/effective MAP and mixture response. Later useful work includes richer event classes, timing/integrated error metrics and event-set comparison.

## Fuel Pressure / Injector analyzer

Current architecture separates Conventional / port-injection and GDI / high-pressure behavior.

Established evidence includes:

- calibrated low-side/high-side pressure-role separation;
- CEL/raw electrical pressure exclusions from engineering pressure evidence;
- source-continuity-correct threshold events;
- exact event-extreme sample/time;
- injector duty headroom and ≥100% saturation evidence;
- core event context for RPM/load/pressure/differential/PW/duty/deadtime;
- decision-facing summaries and unit-aware presentation.

Remaining useful work:

1. expose full event-extreme context in the visible evidence view;
2. quantify pressure sag/recovery;
3. characterize repeated-event behavior;
4. add pump/prime/recovery evidence where logged;
5. add battery-voltage/deadtime and calibration-comparison evidence;
6. strengthen direct Logger navigation/ranked review.

The analyzer remains observational and must not jump from a pressure event to an unsupported causal verdict.

## Trigger / Sync analyzer

Trigger / Sync remains thinner. Useful later work includes:

- sync/error/loss counter/reason context;
- one-sample glitch versus sustained-loss classification;
- RPM/voltage/load event context;
- pre/post evidence;
- frequency by RPM band;
- direct Logger navigation and ranked review areas.

A waveform-style Trigger Logger remains a separate future product capability from the statistical Trigger / Sync analyzer.

## VE Analyzer — implemented active maturity track

`VE_ANALYZER.md` is the current algorithm/evidence/product contract. `VE_ANALYZER_WORKBENCH.md` is the current UI/workflow contract.

Implemented behavior includes:

- VE table, target mixture table and matching tune axes from MSQ/INI metadata;
- strict actual-mixture semantics and explicit AFR/Lambda scale handling;
- table-first workbench with compact setup controls;
- optional operating-range/state qualification and actionable Run readiness;
- **RPM × load lambda-delay table only** as the accepted working model;
- explicit **Grab lambda delays from log** discovery; no expensive automatic scan on app/log/analyzer open;
- measured/interpolated/insufficient delay provenance;
- recommendation state separate from the working delay table;
- direct inline delay-cell editing and versioned saved delay tables;
- timestamp-based mixture alignment;
- optional known fuel-correction compensation with explicit semantics;
- robust weighted-median VE evidence, P10/P90 spread, cumulative evidence and confidence;
- starting-table prior authority and independent absolute/percentage proposal safeguards;
- out-of-authority proposals withheld rather than silently clamped;
- Result View modes;
- cell evidence and strongest contiguous Logger-visit navigation.

The original VE table is analysis input. Running analysis must never mutate tune/ECU state.

### Browser-known-good boundary

The last explicitly browser-confirmed good VE composition before the regression investigation is the #441 cell-evidence state (`fd21e4d4a390a4f6607d0290ef273749fc7fd915`). PR #449 restored runtime files to that known-good composition while retaining later audit documentation. The project owner confirmed Analyzer entry works again after the rollback.

Do not reintroduce the post-#441 continuity/render wrappers as a batch.

### Known remaining VE issues

- Result View fallback/precision behavior is imperfect.
- VE result/session state is lost after Logger → Analyzer round-trip.
- v2 `setContext` / `setTuneModel` still rebuild destructively.
- cell-evidence review duplicates VE analysis instead of consuming retained primary result state.
- working delay state is still partly reconstructed/controlled through rendered DOM.
- Custom qualification semantics need redesign before advanced formula support so Custom does not silently disable normal safety/state exclusions.

### Preferred next sequence

1. keep the browser-known-good runtime stable;
2. fix Result View state/precision behavior with one isolated change and browser verification;
3. fix Logger → Analyzer result persistence with one isolated change and browser verification;
4. then migrate authoritative result/proposal/working-delay/session state out of rendered DOM and remove duplicate cell-evidence analysis;
5. only after ownership is stable, continue review/application-strength/export/diff refinement.

Never automatically write or Burn to the ECU. Original VE, Analyzer evidence/proposal and user-reviewed/application result remain distinct states.

## Range Compare

Range Compare remains the general before/after experiment tool. Current capabilities include Full Log / Current A/B / Saved Range independently on each side, saved Qualification filters, grouped ALL/ANY semantics, provenance, descriptive statistics and contextual Logger A/B handoff.

## Cleanup/consolidation policy

The repository branch cleanup is complete, but broad runtime refactoring remains evidence-driven. Do not destabilize mature Logger/Histogram/Analyzer behavior merely for internal tidiness.

Current cleanup priority inside VE is state ownership and removal of DOM-derived duplicated authority, performed one browser-verified structural change at a time. Broader Logger/Histogram optimization remains paused unless a measured regression appears.
