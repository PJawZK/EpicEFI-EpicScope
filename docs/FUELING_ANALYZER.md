# Fueling Analyzer maturity

## Status — 2026-10-15

Fueling Analyzer is a **mature experimental checkpoint** and is frozen for broad feature expansion unless field use exposes a concrete defect/regression. The remaining ideas at the end of this document are deferred candidates, not the current active development sequence.

Fueling separates steady-state calibration evidence from transient response evidence. It must not treat every mixture deviation as a VE-table error.

## Canonical EpicEFI / JZ roles

EpicEFI/JZ works in lambda internally, so Fueling prefers fuel-independent mixture representation where possible.

Preferred runtime roles include:

- actual mixture: `lambdaValue` (`Lambda`);
- target mixture: `targetLambda` (`Fuel: target lambda`);
- current/effective VE: `veValue` (`Fuel: VE`);
- response-delay fuel command: `actualLastInjection` (`Fuel: Last inj pulse width`);
- engine speed: `RPMValue`;
- VE-table load axis: `veTableYAxis`;
- DFCO state: `dfcoActive`;
- other fuel-cut reason: `fuelCutReason` (`Fuel: Cut Code`);
- TPS AE state: `isAboveAccelThreshold` (`Fuel: TPS AE Active`);
- TPS Decel state: `isBelowDecelThreshold` (`Fuel: TPS Decel Active`);
- total fuel correction: `totalFuelCorrection` (`Fuel: Total correction`);
- STFT context: `stftCorrection1` (`STFT: Bank 1`);
- LTFT context: `ltftCorrection1` (`LTFT: Bank 1`).

`Fuel: VE` is live effective VE, not the editable VE calibration table. `Fuel: Tuned VE` is a separate learning/tuning-oriented value and must not replace current VE by default.

When lambda is unavailable, `afrGasolineScale` (`Air/Fuel Ratio (Gas Scale)`) is preferred over generic `AFRValue` where applicable. Actual and target mixture must use compatible scales.

Literal source names remain preserved in presentation; semantic roles guide selection only.

## Fuel-state qualification

`core/analysis/fueling-context.ts` separates intentional fuel-state effects from ordinary calibration evidence.

- **DFCO active** — excluded from steady calibration and response-delay evidence because injection is intentionally cut.
- **other fuel-cut reason** — excluded from steady/delay evidence.
- **TPS AE active** — excluded from steady calibration but can remain response-delay context/evidence.
- **TPS Decel active** — excluded from steady calibration but can remain response-delay context/evidence.
- invalid/unavailable selected state context conservatively excludes the affected sample rather than assuming inactive state.

TPS decel shaping is not DFCO; they remain distinct semantics.

## Steady-state operating evidence

`core/analysis/fueling-operating-map.ts` builds RPM × load operating evidence from aligned actual mixture, target mixture, RPM and load.

For EpicEFI/JZ the preferred load source is `veTableYAxis`, the Y coordinate actually used by the VE calculation after configured load-axis behavior.

### Trailing-window stability

Fueling uses a trailing-window stability model rather than brittle adjacent-sample derivative gating.

A stable sample requires contiguous valid history over the configured window, bounded RPM/load trend and span, and no source-index/validity discontinuity. Transients naturally age out of the trailing window before evidence becomes eligible again.

This stability approach is a reusable foundation for VE qualification logic.

### Evidence strength

Low-count visited regions remain visible rather than disappearing.

Evidence strength is descriptive:

- **Weak** — below configured evidence threshold;
- **Moderate** — threshold reached but less than roughly three times threshold;
- **Strong** — repeated evidence well above threshold.

Operating points retain sample/evidence counts, stable fraction, RPM/load context, actual/target mixture statistics, mixture error/spread and lean/rich/deadband summaries.

Error is `actual mixture − target mixture`; positive is lean and negative is rich for both lambda and matched AFR scales.

The map is observational evidence. It does not prove base VE is the cause.

## Correction-layer context

Fueling reports correction context where available (`totalFuelCorrection`, STFT, LTFT) but does not automatically attribute correction to VE. Injector characterization, fuel pressure, stoichiometric setup, transient models and other layers can produce similar evidence.

This distinction carries into VE Analyzer, where only correction channels with explicit supported semantics may be compensated automatically.

## Observed mixture-response delay

`core/analysis/afr-delay-analyzer.ts` estimates **observed mixture response delay** from isolated command changes. Internal historic AFR naming does not make the calculation AFR-only.

The observation may include combustion-cycle delay, exhaust transport, turbo/manifold/exhaust volume effects, wideband/controller response, filtering and logging latency; it is not labelled pure sensor delay.

The preferred EpicEFI/JZ command is `actualLastInjection`, not VE. Candidate events require contiguous source samples, meaningful command delta, valid mixture evidence and sufficient isolation from overlapping command changes.

Reported evidence includes command/response source indices/times, command delta, baseline/response mixture, onset/peak timing, optional T50/T90 and RPM/load context.

Fueling presents delay estimates with event count/spread rather than as a universal constant.

VE Analyzer has since implemented its own accepted **RPM × load lambda-delay table** workflow on top of the broader time-alignment/evidence foundations. Fueling does not need to duplicate that table editor/workbench.

## Mixture-scale-aware defaults

Useful automatic defaults remain scale-aware, with user-entered values overriding them. Lambda and AFR thresholds must not be silently mixed.

## Transferable UI patterns

Fueling reuses shared Analyzer patterns where domain-independent:

- sortable evidence/operating tables;
- retained sorting through re-render;
- inline help;
- explicit empty/unavailable states;
- scope/evidence provenance;
- visible Weak/Moderate/Strong evidence;
- event rows navigable to Logger;
- observational rather than unsupported causal wording.

## Deferred candidates — not active work

If real field use later justifies reopening Fueling, candidates include:

- DFCO exit recovery analysis;
- delay-compensated fast-changing operating evidence;
- correction-masking analysis;
- wideband plausibility/confidence;
- fuel/flex context;
- repeatability/before-after comparison;
- links to injector/pressure evidence without duplicating the Fuel Pressure / Injector analyzer.

Do not reopen these merely because they are listed here. Current priority is VE Analyzer maturity, followed by other explicitly selected Analyzer gaps.

## Interpretation guardrails

Fueling may show evidence consistent with base-fuel calibration error, transient-fueling error, pressure/injector limitation, correction masking, intentional fuel cut or measurement uncertainty. It must avoid claiming proven causation from observational log evidence alone.
