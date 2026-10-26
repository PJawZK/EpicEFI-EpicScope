# Analyzer

EpicScope Analyzer answers specific tuning questions from log evidence. Logger remains the raw-trace/navigation authority; Histogram/Table Generator/Distribution/Scatter remain the generic statistical/relationship tools.

For present-tense continuation state, `HANDOFF.md` remains authoritative. Research-derived requirements and current disposition are mapped in `research/STATUS.md`.

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

## Current Analyzer addendum — 2026-10-26

VE v50 and subsequent corrections are integrated into `main`; the PR #462 maturity paragraph below is historical. Logger is the source/selection authority; VE range editing uses existing Logger A–B state and saved ranges, not independently fabricated boundaries. Other analyzer maturity remains uneven: Fueling and non-knock Ignition comparatively mature experimental, Boost strong foundation, Idle/AE and Fuel Pressure/Injector/Trigger/Sync candidates for targeted evidence-driven improvement. Do not infer the scientific quality of analysis merely from green automation.

## Historical development position — 2026-10-16

Analyzer maturity is deliberately uneven rather than falsely uniform.

- **Fueling** — mature experimental checkpoint; freeze unless bug/regression.
- **Ignition** — mature non-knock experimental checkpoint; freeze unless bug/regression.
- **Boost** — strong experimental foundation; paused unless a concrete gap appears.
- **Idle** — useful foundation; later refinement.
- **AE / MAP Predict** — useful foundation; later refinement.
- **Fuel Pressure / Injector** — substantially improved; remaining work is targeted maturity.
- **Trigger / Sync** — thinner; later broad-coverage maturity target.
- **VE Analyzer** — implemented, real-log/browser validated and stable at the current maturity checkpoint.

PR #462 merged the ownership/correctness/performance cleanup through points 1–11 into `main`. The exact pre-merge runtime accepted by owner browser testing was `b435702412642f039a8a7f49d33037c309bef9d8`; merge commit `2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b` carries that accepted lineage.

Browser behavior remains acceptance authority for VE lifecycle/render/state changes; CI is necessary but not sufficient.

## Shared workflow foundation

Specialized analyzers resolve semantic channel roles from the loaded INI/log where possible while keeping mappings visible and manually overridable.

Current shared scope choices:

- **Full Log**
- **Current A/B**
- **Saved Range**

Required semantic roles must not silently fall back to the first available channel. Literal source/channel names remain authoritative presentation data; semantic roles guide selection but must not rename source data.

Shared Analyzer infrastructure includes Logger ↔ Analyzer evidence navigation, saved Qualification where appropriate, grouped ALL/ANY semantics, provenance, reusable comparison/event evidence, progressive disclosure, sortable evidence tables and standardized inline help.

## Analyzer invariant

> An analyzer should not merely report channel averages. It should find the relevant operating events/conditions, show the evidence that produced the result, quantify repeatability/error, explain what can and cannot be concluded, and let the user move directly between analysis and original log without overstating causation.

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

Established evidence includes calibrated low-side/high-side pressure-role separation, CEL/raw-electrical exclusions from engineering pressure evidence, source-continuity-correct threshold events, exact event-extreme sample/time, injector-duty headroom/saturation evidence and core RPM/load/pressure/PW/duty/deadtime context.

Remaining useful work is targeted: visible full extreme context, sag/recovery, repeated-event behavior, pump/prime/recovery evidence where logged, battery-voltage/deadtime calibration evidence and stronger Logger navigation/ranked review.

The analyzer remains observational and must not jump from a pressure event to an unsupported causal verdict.

## Trigger / Sync analyzer

Trigger / Sync remains thinner. Useful later work includes sync/error/loss context, glitch-versus-sustained classification, RPM/voltage/load context, pre/post evidence, frequency by RPM band and direct Logger navigation/ranked review.

A waveform-style Trigger Logger remains a separate future capability from the statistical Trigger / Sync analyzer.

## VE Analyzer — stable current checkpoint

`VE_ANALYZER.md` is the current algorithm/evidence/product contract. `VE_ANALYZER_WORKBENCH.md` is the current UI/workflow contract.

Implemented and accepted behavior includes:

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
- source-authoritative Result View modes;
- cell evidence and strongest contiguous Logger-visit navigation;
- completed-session retention across semantically unchanged navigation;
- retained-primary evidence reuse rather than duplicate full-log analysis;
- active-domain routing/stale-completion rejection;
- cooperative bounded analysis with progress and Cancel;
- recoverable persistence/load failures and transactional MSQ replacement.

The original VE table is analysis input. Running analysis must never mutate tune/ECU state.

### Accepted Result View/session behavior

The earlier #449-era known defects are closed. Owner browser acceptance confirms:

- switching Result Views repeatedly does not consume mutable rendered text or lose original VE values;
- Proposed VE restores normal VE heat;
- alternate Result Views scale real metrics while untouched/fallback cells use neutral heat;
- Lambda Delay retains real interpolated delay values;
- weak/evidence-only/no-evidence cells remain stable;
- Logger/other-Analyzer round trips retain the completed VE session when semantics are unchanged;
- presentation-only changes do not trigger extra trace loading.

Do not restore the old pre-integration wrapper/controller stacks from historical branches.

### Remaining VE ownership debt

Working delay state is still partly reconstructed from rendered DOM (`readDelaySurface()`). This is later cleanup rather than a current blocker. Custom qualification semantics can also be revisited later before advanced formula support.

The immediate project task is UI polish, not another VE lifecycle refactor.

Never automatically write or Burn to the ECU. Original VE, Analyzer evidence/proposal and user-reviewed/application result remain distinct states.

## Range Compare

Range Compare remains the general before/after experiment tool. Current capabilities include Full Log / Current A/B / Saved Range independently on each side, saved Qualification filters, grouped ALL/ANY semantics, provenance, descriptive statistics and contextual Logger A/B handoff.

## Cleanup/consolidation policy

The points 1–11 cleanup is complete and merged. Do not destabilize mature Logger/Histogram/Analyzer behavior merely for internal tidiness.

The next broad architecture track is D-058 observability after focused UI polish. Any further Analyzer refactor should be driven by a concrete correctness, performance or maintainability need and browser-verified when it touches lifecycle/render/state semantics.
