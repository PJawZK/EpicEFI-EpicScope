# Pre-populated graph starter templates

This document is the current product and implementation target for EpicScope's pre-populated Logger layouts and task-oriented starter templates.

Related authority:

- [`HANDOFF.md`](HANDOFF.md) — present-tense continuation/runtime status;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — semantic/capability layer and materialization boundaries;
- [`DATA_MODEL.md`](DATA_MODEL.md) — semantic role/template concepts;
- [`DECISIONS.md`](DECISIONS.md) — approved semantic workspace/naming/lifecycle decisions.

## Core product model

A starter template is **not** a permanent workspace object.

Applying a starter follows this lifecycle:

```text
starter template
      ↓ semantic role resolution against the current source/ECU catalog
ordinary editable workspace
```

After materialization, the resulting workspace is fully user-owned. It may be edited, renamed, duplicated or deleted. Template logic does not continue to own it and must not silently restore channels or layout choices later.

Template definitions remain reusable application data so a user can create another fresh workspace from the same starting point at any time.

## Semantic resolution

Starter templates bind to **semantic channel roles**, not hard-coded ECU channel IDs.

```text
semantic role
      ↓
logical ECU channel
      ↓
current source identity
```

Example:

```text
engine.rpm → RPMValue → ini:RPMValue  (recorded MLG + INI)
engine.rpm → RPMValue → RPMValue      (ts_shim)
```

Resolution preference is:

1. explicit user/schema override;
2. exact EpicEFI/native alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Missing data remains explicit. EpicScope must never fabricate a value merely to fill a starter slot.

### Resolution is one-time template materialization

The semantic resolver chooses the initial channel assignments when a starter is created. Once that workspace exists, it behaves like any other workspace.

Source changes may still normalize the user's selected stable identities between forms such as `ini:RPMValue` and `RPMValue`. That is source-identity translation and **not** permission to reapply the starter template.

If a user removes TPS from a workspace created from the General starter, TPS stays removed. Loading another log, connecting Shim, or returning to an MLG must not put it back.

## Display names and aliases

Compatibility aliases do not define EpicScope's user-facing vocabulary.

```text
legacy/vendor/import alias
          ↓
EpicScope semantic role
          ↓
preferred EpicScope display name
```

Examples:

- legacy/MLV `TP` may resolve `engine.throttle.position`, while EpicScope displays **TPS**;
- `PW` may resolve injector pulse width, while EpicScope displays **Injector Pulse Width**;
- `VBatt` may resolve battery voltage, while EpicScope displays **Battery Voltage**;
- `CLT`/`ECT` may resolve coolant temperature, while EpicScope displays **Coolant Temp**.

Established technical abbreviations such as RPM, MAP, TPS, AFR and Lambda may remain visible where clearer than expanded wording.

MegaLogViewer HD `FieldMaps/*.properties` remain compatibility/reference evidence rather than EpicScope naming authority.

## Layout vs starter vs workspace

These are three distinct concepts:

- **Layout** — graph geometry only.
- **Starter template** — task-oriented recipe containing a layout plus semantic role slots.
- **Workspace** — the user's editable materialized graph configuration.

Conceptually:

```text
Starter template
 ├─ name
 ├─ category
 ├─ layout
 ├─ pane definitions
 │    └─ semantic channel slots
 └─ optional ECU-family specialization

        materialize once
              ↓

User workspace
 ├─ name
 ├─ layout
 ├─ pane geometry
 └─ concrete channel assignments
```

The template catalog is controlled application data. The generated workspace is not immutable.

## Layout catalog

Initial target layouts:

- **Single** — one full graph pane;
- **Dual** — two stacked panes;
- **Triple** — three stacked panes;
- **Quad** — 2×2 panes;
- **Focus + 2** — one large pane plus two smaller panes;
- **Focus + 3** — one large pane plus three smaller panes;
- **Six Pane** — six compact diagnostic panes.

Layout names describe geometry. Starter/workspace names describe diagnostic purpose.

## Generic starter catalog

Initial targets:

- **General** — RPM, MAP, TPS, coolant temp, intake-air temp, battery voltage, AFR/Lambda and ignition advance;
- **Idle** — RPM, idle target, MAP, TPS, idle actuator command/position, ignition advance, coolant temp, intake-air temp and AFR/Lambda;
- **Fuel** — RPM, MAP, TPS, AFR/Lambda, target, injector pulse width, injector duty, fuel correction, VE and fuel pressure where available;
- **Ignition** — RPM, MAP/load, TPS, ignition advance, knock evidence where available, battery voltage, AFR/Lambda, coolant temp and intake-air temp;
- **Boost** — RPM, MAP, TPS/load, boost target, wastegate command, upper/lower wastegate duty where available, boost error, EMAP and intake-air temp where available;
- **Transient / AE** — RPM, TPS, TPS rate/change, MAP, MAP rate/prediction, AFR/Lambda, injector pulse width, acceleration-enrichment contribution and wall-wetting channels where available;
- **Cooling** — coolant temp, intake-air temp, RPM, MAP/load, vehicle speed, fan command/state, oil temp and EGT where available;
- **Fuel System** — RPM, MAP, TPS, fuel pressure, rail differential pressure, injector pulse width, injector duty, battery voltage, AFR/Lambda and fuel-pump command/state where available;
- **Trigger / Sync** — RPM, sync state, sync-loss count/reason, trigger/crank error, cam state/phase, trigger runtime channels and battery voltage where available;
- **Startup / Warmup** — RPM, coolant temp, intake-air temp, MAP, TPS, AFR/Lambda, target, warmup correction, after-start enrichment, injector pulse width, idle target and idle actuator command;
- **Electrical** — battery voltage, RPM, injector pulse width/duty, ignition dwell, fuel-pump state, ECU/sensor supply voltage and relevant electrical fault/status channels where available;
- **Vehicle / Driveline** — RPM, vehicle speed, TPS, MAP, gear, clutch/brake state, wheel speeds and longitudinal acceleration where available.

## EpicEFI-specific starter tier

Generic starters should remain portable across ECU families. Richer starters may be exposed only where the active schema provides the required capabilities, for example:

- **EpicEFI · Dual Chamber Boost**;
- **EpicEFI · MAP Predict + Wall Wetting**;
- **EpicEFI · ETB Control**;
- **EpicEFI · Fuel Rail Diagnostics**;
- **EpicEFI · Trigger + Sync Detailed**;
- **EpicEFI · Injector / Ignition Timing**;
- **EpicEFI · Engine Protection**.

Capability detection should use semantic roles/schema capabilities rather than hard-coded board names such as `if ECU == Mega144H7`.

## Role requirement levels

Each starter role is classified as:

- **required** — central to the starter's purpose;
- **preferred** — normally expected and materially useful;
- **optional** — useful enhancement when available.

Missing preferred/optional roles do not invalidate starter creation. Missing required roles are reported explicitly so the user can map or replace them; the workspace still remains usable.

Example Boost requirement model:

```text
Required
- RPM
- MAP

Preferred
- TPS / load
- Wastegate command

Optional
- Boost target
- Boost error
- Upper wastegate duty
- Lower wastegate duty
- EMAP
- Intake Air Temp
- Turbo speed
```

## Validated resolver architecture

The first development slice used a one-pane **Single · Resolver Test** fixture to prove semantic matching independently of multi-pane geometry.

That path was real-runtime validated through:

```text
MLG + INI → ts_shim live/capture → MLG + INI
```

Recorded identities included:

```text
ini:RPMValue
ini:MAPValue
ini:TPSValue
ini:coolant
```

Shim identities included:

```text
RPMValue
MAPValue
TPSValue
coolant
```

The historical validation implementation used `built-in:single-resolver-test` as a protected runtime identity. That prefix is now compatibility data only; it is not part of the current product lifecycle.

The validated result still proves the useful architectural point: semantic roles can resolve correctly against recorded and live source families. What no longer follows from that proof is that a template must remain attached to a protected workspace instance.

## First production starter — General

The first production starter uses a Single layout and these semantic roles:

```text
Required
- RPM
- MAP

Preferred
- TPS
- Coolant Temp

Optional
- Intake Air Temp
- Battery Voltage
- Lambda
- Ignition Advance
```

Current EpicEFI mapping target:

```text
MLG + INI                          ts_shim
ini:RPMValue                       RPMValue
ini:MAPValue                       MAPValue
ini:TPSValue                       TPSValue
ini:coolant                        coolant
ini:intake                         intake
ini:VBatt                          VBatt
ini:lambdaValue                    lambdaValue
ini:correctedIgnitionAdvance       correctedIgnitionAdvance
```

The visible starter/workspace name is simply **General**. `Single` describes its initial geometry rather than a permanent product identity.

The expanded eight-role General resolver has automated coverage. One explicit real MLG + INI → Shim → MLG confirmation with all eight roles remains useful before describing all eight roles as runtime-validated.

## Ownership and persistence rules

Once a starter has produced a workspace:

- channels can be added, removed, reordered or replaced;
- layout and pane geometry can be changed;
- the workspace can be renamed;
- it can be duplicated;
- it can be deleted;
- template updates do not mutate it;
- source changes do not silently restore starter content.

Applying a starter again creates another ordinary workspace rather than resetting an existing one.

If the final workspace is deleted, Logger may create a blank ordinary workspace to remain immediately usable. It must not resurrect the General starter automatically.

Existing persisted workspaces using a historical `built-in:*` ID are retained without destructive migration. The ID no longer grants special UI behavior; such a workspace is editable and deletable like every other workspace. A historical `General · Single` label may be normalized to `General` when restored.

## Next implementation direction

After this lifecycle correction is merged and green:

1. expose a deliberate **New graph/workspace → From template…** path;
2. keep **Blank** as an ordinary creation option;
3. extend semantic roles only as needed for the next starter;
4. define the first multi-pane starter, with **Idle** the preferred architecture test;
5. add further generic starters;
6. add EpicEFI-specific starters behind capability checks;
7. add persistent user/schema semantic overrides where automatic mapping is ambiguous.

All future starter implementations must reuse the same semantic resolver/materialization path rather than creating layout-specific resolver logic.
