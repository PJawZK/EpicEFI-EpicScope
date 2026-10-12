# Pre-populated graph workspaces

This document is the current product target for EpicScope's built-in Logger graph layouts and task-oriented workspaces.

## Core rule

Built-in workspaces bind to semantic channel roles, not hard-coded ECU channel IDs.

Resolution order is intended to be:

1. explicit user/schema override;
2. exact EpicEFI/native or ECU-family alias;
3. cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Legacy aliases are compatibility input only. They do not define EpicScope's user-facing vocabulary. In particular, MLV-style `TP` may resolve the throttle-position role, but the EpicScope display name is **TPS**.

## Layout catalog

Initial target layouts:

- **Single** — one full graph pane.
- **Dual** — two stacked panes.
- **Triple** — three stacked panes.
- **Quad** — 2×2 panes.
- **Focus + 2** — one large pane plus two smaller panes.
- **Focus + 3** — one large pane plus three smaller panes.
- **Six Pane** — six compact diagnostic panes.

Layout names describe geometry only. Workspace names describe the tuning/diagnostic task.

## Generic workspace catalog

Initial target workspaces:

- **General** — RPM, MAP, TPS, coolant temp, intake-air temp, battery voltage, AFR/Lambda and ignition advance.
- **Idle** — RPM, idle target, MAP, TPS, idle actuator command/position, ignition advance, coolant temp, intake-air temp and AFR/Lambda.
- **Fuel** — RPM, MAP, TPS, AFR/Lambda, target, injector pulse width, injector duty, fuel correction, VE and fuel pressure where available.
- **Ignition** — RPM, MAP/load, TPS, ignition advance, knock evidence where available, battery voltage, AFR/Lambda, coolant temp and intake-air temp.
- **Boost** — RPM, MAP, TPS/load, boost target, wastegate command, upper/lower wastegate duty where available, boost error, EMAP and intake-air temp where available.
- **Transient / AE** — RPM, TPS, TPS rate/change, MAP, MAP rate/prediction, AFR/Lambda, injector pulse width, acceleration-enrichment contribution and wall-wetting channels where available.
- **Cooling** — coolant temp, intake-air temp, RPM, MAP/load, vehicle speed, fan command/state, oil temp and EGT where available.
- **Fuel System** — RPM, MAP, TPS, fuel pressure, rail differential pressure, injector pulse width, injector duty, battery voltage, AFR/Lambda and fuel-pump command/state where available.
- **Trigger / Sync** — RPM, sync state, sync-loss count/reason, trigger/crank error, cam state/phase, trigger runtime channels and battery voltage where available.
- **Startup / Warmup** — RPM, coolant temp, intake-air temp, MAP, TPS, AFR/Lambda, target, warmup correction, after-start enrichment, injector pulse width, idle target and idle actuator command.
- **Electrical** — battery voltage, RPM, injector pulse width/duty, ignition dwell, fuel-pump state, ECU/sensor supply voltage and relevant electrical fault/status channels where available.
- **Vehicle / Driveline** — RPM, vehicle speed, TPS, MAP, gear, clutch/brake state, wheel speeds and longitudinal acceleration where available.

## EpicEFI-specific workspace tier

Richer built-ins may be exposed only when the active schema has the required capabilities, for example:

- **EpicEFI · Dual Chamber Boost**
- **EpicEFI · MAP Predict + Wall Wetting**
- **EpicEFI · ETB Control**
- **EpicEFI · Fuel Rail Diagnostics**
- **EpicEFI · Trigger + Sync Detailed**
- **EpicEFI · Injector / Ignition Timing**
- **EpicEFI · Engine Protection**

These are intentionally allowed to depend on EpicEFI-native capabilities and channel semantics.

## Role requirement levels

Each workspace role slot is classified as:

- **required** — central to the workspace's purpose;
- **preferred** — normally expected and materially improves the workspace;
- **optional** — useful enhancement when the ECU exposes it.

A workspace remains loadable when roles are unresolved. Missing preferred/optional roles must not invalidate the layout. Missing required roles are reported explicitly so the user can map or replace them.

## First implementation slice: Single

The first development fixture is **Single · Resolver Test**. It intentionally keeps geometry trivial while exercising all resolver states:

- required: RPM;
- preferred: MAP;
- preferred: TPS;
- optional: Coolant Temp.

Its semantic identities are:

- `engine.rpm`
- `engine.map`
- `engine.throttle.position`
- `temperature.coolant`

The fixture resolves to the currently authoritative source identity rather than embedding ECU-specific IDs. For the current EpicEFI validation path this means the same semantic workspace can resolve approximately as:

```text
MLG + INI                 ts_shim
ini:RPMValue              RPMValue
ini:MAPValue              MAPValue
ini:TPSValue              TPSValue
ini:coolant               coolant
```

The visible semantic names remain:

```text
RPM
MAP
TPS
Coolant Temp
```

### Logger integration

The development fixture is exposed through the normal Logger graph selector using the reserved runtime ID `built-in:single-resolver-test`.

The Logger refreshes only that reserved built-in when its authoritative channel set changes:

- catalog-only INI state resolves against catalog channels;
- recorded MLG + INI resolves against canonical bound `ini:*` identities;
- Shim/live capture resolves against raw Shim channel identities;
- returning to MLG resolves back to canonical `ini:*` identities.

Normal user workspaces are never name-matched or repopulated. A user workspace can therefore have the same visible name without being modified. Rename/delete actions are disabled for the development built-in, while duplication remains available so a resolved built-in can be copied into a normal editable workspace.

The fixture is development-only and can be hidden or removed once source switching, missing-role behavior and override handling have been proven. Production workspaces use the same template/resolver model.
