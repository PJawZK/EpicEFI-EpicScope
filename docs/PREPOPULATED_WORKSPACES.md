# Pre-populated graph starter templates

This document is the current product/implementation authority for EpicScope Logger starter templates.

Related authority:

- [`HANDOFF.md`](HANDOFF.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`DATA_MODEL.md`](DATA_MODEL.md)
- [`DECISIONS.md`](DECISIONS.md) — D-055 is the starter/workspace ownership invariant.
- [`STARTER_SYSTEM_VALIDATION.md`](STARTER_SYSTEM_VALIDATION.md)

## Core product model

A starter template is application data, not a persistent workspace owner.

```text
starter template
      ↓ semantic resolution against current catalog
ordinary editable graph-* workspace
```

Once materialized, the workspace is user-owned. It may be renamed, edited, duplicated or deleted. Template logic must not silently restore channels, names or layout choices later.

Source transitions may normalize stable assignments between `ini:*` and matching raw Shim identities. That is identity translation only; it is not permission to reapply a starter.

## Creation flow

```text
New graph
├─ Blank graph
└─ From template   ›
                   ├─ generic starters
                   └─ capability-gated EpicEFI starters
```

The flyout is viewport-bounded and vertically scrollable. Selecting a template creates a normal workspace. No template metadata is required for ownership afterward.

## Fresh-state seeding

On a genuinely fresh EpicScope workspace state, the 12 generic starters are materialized automatically when the first usable channel catalog becomes available.

Existing/restored workspace state is never re-seeded. Deleted defaults stay deleted and user edits remain authoritative.

EpicEFI-specific starters are never auto-created.

## Semantic resolution

Starters bind to semantic channel roles rather than hard-coded ECU channel IDs.

Resolution preference:

1. explicit user/schema override;
2. exact EpicEFI/native alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Missing values remain explicit. Required/preferred/optional slots degrade gracefully; EpicScope never fabricates a channel merely to fill a template.

Compatibility aliases never define the visible EpicScope vocabulary. For example, legacy `TP` may resolve throttle position while EpicScope displays **TPS**.

## Layout model

Layout describes geometry only. Current production starter use centers on:

- **Single** — one full graph pane;
- **Dual** — two vertically stacked panes.

Single uses the normal overlay readout presentation with channel names and NOW / MIN / MAX context. The old stretched lane-label presentation is not used.

## Generic starter catalog

The portable generic catalog is complete at 12 starters.

### General
Single broad engine overview:

- RPM
- MAP
- TPS
- Coolant Temp
- Intake Air Temp
- Battery Voltage
- Lambda
- Ignition Advance

### Idle
Dual idle-speed/control overview:

Pane 1:
- RPM
- Idle Target
- MAP
- TPS

Pane 2:
- Idle Air Command
- Ignition Advance
- Coolant Temp
- Lambda

### Boost
Dual general-purpose boost response view with no closed-loop-control or special-sensor assumptions.

Pane 1:
- RPM
- MAP
- TPS
- Intake Air Temp

Pane 2:
- Ignition Advance
- Injector Pulse Width
- Injector Duty
- Battery Voltage

Generic Boost deliberately does **not** require Boost Target, Wastegate Command, Boost Error or EMAP. Those belong in capability-specific control diagnostics.

### Fuel
Pane 1:
- RPM
- MAP
- Lambda
- Lambda Target

Pane 2:
- Injector Pulse Width
- Injector Duty
- Fuel Pressure
- Fuel Correction

### Ignition
Generic ignition must not assume knock hardware.

Pane 1:
- RPM
- MAP
- TPS
- Ignition Advance

Pane 2:
- Dwell
- Battery Voltage
- Intake Air Temp
- Coolant Temp

### Cooling
Pane 1:
- Coolant Temp
- Intake Air Temp
- RPM
- Vehicle Speed

Pane 2:
- Fan Active
- Oil Temp
- Oil Pressure
- Coolant Pressure when available
- Battery Voltage

`Fan Active` is the generic binary state. PWM fan duty remains a separate controller-specific semantic and is not required here.

### Transient / AE
Pane 1:
- RPM
- TPS
- TPS Change
- MAP

Pane 2:
- Effective MAP
- Lambda
- Lambda Target
- Injector Pulse Width
- AE Fuel
- Wall Fuel Correction

### Fuel System
Pane 1:
- RPM
- Fuel Pressure
- MAP
- TPS

Pane 2:
- Fuel Pressure Delta
- Injector Pulse Width
- Injector Duty
- Fuel Pump Command
- Battery Voltage
- Lambda

### Trigger / Sync
Pane 1:
- RPM
- Trigger Sync State
- Phase Synchronized
- Trigger Error

Pane 2:
- Trigger Error Count
- Resync Count
- Engine Phase
- Battery Voltage

### Startup / Warmup
Pane 1:
- RPM
- Coolant Temp
- Intake Air Temp
- Battery Voltage
- Engine Cycles Since Start

Pane 2:
- Cranking Fuel
- After-start Correction
- Warmup Correction
- Injector Pulse Width
- Lambda
- Idle Target

### Electrical
Pane 1:
- Battery Voltage
- RPM
- Injector Pulse Width
- Dwell

Pane 2:
- Injector Duty
- Fuel Pump Command
- Fan Active
- Alternator Duty
- Sensor Supply Voltage
- Sensor Supply Fault

### Vehicle / Driveline
Pane 1:
- RPM
- Vehicle Speed
- TPS
- MAP
- Gear

Pane 2:
- Clutch State
- Brake State
- Wheel Speed FL / FR / RL / RR
- Longitudinal Acceleration

## EpicEFI-specific starter tier

These are capability-gated from runtime/schema semantics, not board names.

Current production set:

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

Capability gating affects discovery only. Once materialized, the workspace is ordinary user-owned state.

### MAP Predict + Wall Wetting current definition

This starter is intentionally more model-focused than the generic Transient / AE workspace.

Pane 1 — MAP model:
- RPM
- TPS
- MAP
- Instant MAP
- Predicted / Fallback MAP
- Effective MAP

Pane 2 — wall-film/fueling response:
- Wall Fuel Amount
- Wall Fuel Correction
- Injector Pulse Width
- Lambda
- Lambda Target
- Coolant Temp

The semantic `Wall Fuel Correction` prefers EpicEFI `wallFuelCorrectionValue` / **Fuel: wall correction** (mass-domain correction) rather than the separate `wallFuelCorrection` wall-wetting injection-time telemetry.

The specialized view deliberately no longer centers `MAP Prediction Active`, TPS Delta or generic TPS-AE fuel contribution.

## Deferred candidates

Template expansion is stopped for the validation phase.

Potential future candidates:

- Staged Injection;
- Closed-loop Fuel / STFT / LTFT.

Per-cylinder/EGT work remains deferred until the semantic layer supports indexed channel families cleanly. Do not create dozens of fixed `cyl1`, `cyl2`, etc. roles as a shortcut.

## Validation/ownership guardrails

The following must remain true:

- generic starters are portable and always discoverable;
- only generic starters seed fresh state;
- EpicEFI-specific starters appear only when their complete capability bundle resolves;
- materialized workspaces use normal `graph-*` ownership;
- user edits/deletions persist and are not re-seeded;
- MLG/INI/Shim source transitions normalize identities only;
- unavailable channels remain explicit rather than being silently substituted;
- template updates affect future materializations only.

See [`STARTER_SYSTEM_VALIDATION.md`](STARTER_SYSTEM_VALIDATION.md) for the close-out validation matrix.
