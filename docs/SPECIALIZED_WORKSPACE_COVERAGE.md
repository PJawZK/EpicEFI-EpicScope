# EpicEFI specialized workspace coverage audit

Status: 2026-10-13, catalog expansion complete through Launch, Traction and Transmission Control.

This document audits the current EpicEFI runtime channel catalog against EpicScope's existing generic and capability-gated Logger starters. Its purpose is to prevent the specialized starter catalog from growing mechanically: a new starter should exist only when the ECU exposes a coherent live diagnostic/control bundle that adds a materially different workflow.

## Decision rule

A specialized starter is justified when all of the following are true:

1. the active schema exposes a coherent **runtime** capability bundle, not only tune/configuration values;
2. the bundle contains enough state/command/feedback or condition/action evidence to tell a useful story in graphs;
3. the workflow is materially more specific than an existing generic starter;
4. capability detection can be conservative and avoid unlocking from similarly named configuration channels;
5. the starter can still materialize into an ordinary user-owned workspace with no new lifecycle logic.

A large number of channels alone is not sufficient.

## Current specialized coverage

Twelve EpicEFI-specific starters are implemented:

- **EpicEFI · MAP Predict + Wall Wetting**
- **EpicEFI · Fuel Rail Diagnostics**
- **EpicEFI · ETB Control**
- **EpicEFI · Dual Chamber Boost**
- **EpicEFI · Trigger + Sync Detailed**
- **EpicEFI · Injector + Ignition Timing**
- **EpicEFI · Engine Protection**
- **EpicEFI · VVT Control**
- **EpicEFI · Anti-Lag**
- **EpicEFI · Launch Control**
- **EpicEFI · Traction Control**
- **EpicEFI · Transmission Control**

Together with the twelve generic starters, these already cover most ordinary engine-state, fuel, ignition, cooling, transient, electrical, driveline, trigger and startup workflows.

## Tier A — implementation complete; validation cutoff reached

The evidence-ranked Tier A candidates are now implemented. No further ordinary specialized starters should be added before product validation.

The next phase is deliberately:

```text
INI-only catalog/discovery smoke test
→ materialize every generic and supported EpicEFI starter
→ refresh/persistence test
→ MLG + INI resolution test
→ source transition test
→ ts_shim/live schema test when available
→ fix resolver or lifecycle defects exposed by evidence
```

Only after that validation pass should Tier B be reconsidered.

## Tier B — valid candidates after Tier A

### Staged Injection

Runtime support is strong:

```text
fuelPulsePrimary
fuelPulseSecondary
fuelDutyPrimary
fuelDutySecondary
injectionStage2Percent
actualLastInjectionStage2
actualLastInjectionRatioStage2
injectorDutyCycleStage2
stage1InjSmallPwActive
stage2InjSmallPwActive
```

A dedicated starter would be useful for staged-injection transition and load sharing. It should not replace the generic Fuel or Fuel System starters; availability should require live secondary-stage evidence.

### Closed-loop Fuel / STFT / LTFT

The runtime catalog exposes bank-specific STFT/LTFT corrections, lambda input errors, learning/correcting state and LTFT persistence state.

Representative channels:

```text
stftCorrection1 / stftCorrection2
stftInputError1 / stftInputError2
stftCorrectionState
stftLearningState1 / stftLearningState2
ltftCorrection1 / ltftCorrection2
ltftAccummulatedCorrection1 / ltftAccummulatedCorrection2
ltftLearning
ltftCorrecting
ltftLoadError
```

This is a legitimate future starter, but it overlaps the generic Fuel view enough that VVT/ALS/Launch/Traction are higher-value additions first.

### Detailed Idle Controller

EpicEFI exposes both generic idle PID telemetry and DC-idle position-controller telemetry:

```text
idleStatus_pTerm / iTerm / dTerm / output / error / resetCounter
dcIdleTarget
dcIdleDutyCycle
dcIdleFaultCode
dcIdlePositionStatus_pTerm / iTerm / dTerm / output / error / resetCounter
```

The data is sufficient, but EpicScope already has a mature Idle analyzer plus a generic Idle starter. Add an EpicEFI-specific idle starter only if browser use shows a real need to keep this controller detail continuously graphed; otherwise it would duplicate existing analysis functionality.

## Tier C — do not add as ordinary starters yet

### Per-cylinder / EGT / cylinder balance

The schema is extremely rich: up to 12 per-cylinder ignition channels, MAP/MAF-per-cylinder values, cylinder RPM/delta families, knock-per-cylinder families, and up to eight EGT channels.

This is **not** a reason to add dozens of fixed semantic role IDs. The correct prerequisite is indexed/channel-family support such as conceptually:

```text
ignition.advance.cylinder[n]
knock.cylinder[n]
engine.cylinderRpmDelta[n]
exhaust.egt[n]
```

Once EpicScope can resolve indexed channel families cleanly, a Cylinder Balance / Per-Cylinder Combustion workspace becomes a strong candidate.

### Alternator controller detail

EpicEFI exposes alternator PID terms, target voltage and duty. The generic Electrical starter already covers battery voltage, alternator duty and electrical load context. Controller PID detail alone does not currently justify another starter.

### ECU / ADC runtime health

Channels such as CPU temperature/usage, ADC error/overrun counters and conversion timing are useful developer diagnostics, but they are not primarily a tuning graph workflow. They belong in runtime-health/diagnostic surfaces unless a concrete field-debugging use case requires a starter.

### MAF / airflow-model diagnostics

There are raw/frequency/measured/modelled MAF channels, airflow estimates and cylinder-airmass values. This is useful data, but the concept is not EpicEFI-specific. If a recurring workflow emerges, prefer a portable **Airflow / MAF** generic starter or analyzer rather than an `EpicEFI · MAF` starter.

### Flex fuel

`flexPercent`, raw flex frequency and flex-fault state are useful context but do not form a sufficiently rich independent control workflow. They fit better as optional channels in Fuel/Fuel System workspaces.

### Nitrous

The INI exposes arm/eligibility condition state (`isNitrousArmed`, speed/TPS/CLT/MAP/AFR/RPM conditions and `isNitrousCondition`) but the audited runtime set does not show a similarly coherent command/output/enrichment bundle. Do not add a Nitrous starter from condition booleans alone.

### Generic-system duplicates

Do not add EpicEFI-branded variants merely because extra native channels exist for systems already covered by Boost / Dual Chamber Boost, Fuel / Fuel System / Fuel Rail Diagnostics, Ignition / Injector + Ignition Timing, Cooling, Trigger / Sync / Trigger + Sync Detailed, Startup / Warmup, Electrical, Vehicle / Driveline, ETB Control, Engine Protection, and MAP Predict + Wall Wetting.

A specialized variant needs a distinct diagnostic question, not just more channels.

## Recommended implementation order

```text
1. EpicEFI · Launch Control
2. EpicEFI · Traction Control
3. EpicEFI · Transmission Control
4. Staged Injection
5. Closed-loop Fuel / STFT / LTFT
```

Per-cylinder/EGT work should wait for indexed semantic channel families.

This order is not a promise to implement every item. After each starter, re-check whether the catalog still has a clear user-visible gap before adding the next one.

## Implementation guardrails

For every future specialized starter:

- availability must be based on **live runtime telemetry**, not tune/config constants;
- use semantic roles and the existing one-time materialization path;
- add negative tests for configuration/lookalike channels that must not unlock the starter;
- avoid requiring every optional bank/cylinder/device instance just to expose the starter;
- prefer a focused two-pane diagnostic story over dumping all available channels into one workspace;
- do not add board-name conditionals;
- once materialized, the workspace remains ordinary user-owned state.
