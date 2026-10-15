# EpicEFI specialized workspace coverage audit

Status: **closed current catalog audit, 2026-10-15**.

This document records why the current EpicEFI capability-gated starter catalog stops where it does. `PREPOPULATED_WORKSPACES.md` is the current product authority and `STARTER_SYSTEM_VALIDATION.md` records the close-out validation boundary.

## Current production coverage

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

Together with 12 generic starters, the production catalog has 24 starter definitions.

The starter track is closed for broad feature expansion. The previous Tier A implementation/validation sequence is complete and should not remain as a to-do list.

## Specialized-starter decision rule

A new specialized starter is justified only when all are true:

1. runtime schema exposes a coherent live capability bundle, not only tune/config values;
2. bundle has enough state/command/feedback or condition/action evidence for a useful graph workflow;
3. workflow is materially different from existing generic/specialized starters or dedicated Analyzer behavior;
4. capability detection is conservative and does not unlock from lookalike config channels;
5. materialization still creates an ordinary user-owned workspace with no new lifecycle logic.

More channels alone are not sufficient.

## Deferred candidates

### Staged Injection

Runtime support is rich enough to justify future consideration if field use demands a dedicated transition/load-sharing view. It should remain capability-gated and must not replace generic Fuel/Fuel System workflows.

### Closed-loop Fuel / STFT / LTFT

Bank-specific STFT/LTFT correction/learning state is a legitimate future diagnostic workflow, but it overlaps generic Fuel and dedicated Fueling analysis enough that no new starter is currently justified.

### Detailed Idle Controller

EpicEFI exposes rich idle/DC-idle controller terms, but the generic Idle starter plus Idle Analyzer already cover the ordinary workflow. Add a specialized starter only if repeated real use demonstrates a persistent graphing need not served by Analyzer.

## Do not add as ordinary starters yet

### Per-cylinder / EGT / cylinder balance

The schema has rich indexed cylinder/EGT families. Do **not** solve this by adding dozens of fixed `cyl1`, `cyl2`, etc. semantic roles.

Prerequisite: clean indexed/channel-family semantics, conceptually such as:

```text
ignition.advance.cylinder[n]
knock.cylinder[n]
engine.cylinderRpmDelta[n]
exhaust.egt[n]
```

Only then should Cylinder Balance / Per-Cylinder Combustion workspace design be reconsidered.

### Alternator controller detail

Generic Electrical already covers ordinary electrical context. PID-detail channels alone do not justify another starter.

### ECU / ADC runtime health

CPU/ADC/runtime-health signals belong primarily in diagnostics/developer surfaces unless a concrete field-debugging workflow warrants a starter.

### MAF / airflow-model diagnostics

This is not inherently EpicEFI-specific. If a recurring workflow emerges, prefer a portable Airflow/MAF starter/analyzer rather than an EpicEFI-branded duplicate.

### Flex fuel

Flex percentage/frequency/fault state are useful context but not a sufficiently independent control workflow by themselves.

### Nitrous

Eligibility/condition booleans without a coherent runtime command/output/enrichment bundle are insufficient to justify a starter.

## Guardrails

For any future starter:

- availability comes from live runtime telemetry/capabilities, not board name or tune constants;
- use semantic roles and one-time materialization;
- add negative tests for lookalike/configuration channels;
- do not require every optional bank/cylinder/device instance;
- prefer a focused diagnostic story over channel dumping;
- once materialized, the workspace is ordinary user-owned state;
- adding a starter requires evidence of a real workflow gap, not merely catalog completeness.

## Reopen criteria

Reopen this audit only if:

- field feedback exposes a concrete missing workflow;
- a new ECU family reveals a portability gap;
- indexed semantic channel-family support unlocks a high-value per-cylinder/EGT workflow;
- an existing starter proves too broad and a specialized workflow materially improves diagnosis.

Otherwise, leave the production catalog stable and spend development effort on Analyzer maturity or other higher-value product work.
