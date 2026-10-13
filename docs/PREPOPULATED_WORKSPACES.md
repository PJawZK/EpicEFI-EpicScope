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

## Current creation flow

PR #348 makes starter application explicit in the Logger graph selector:

```text
New graph
├─ Blank graph
└─ From template   ›
                   ├─ General
                   ├─ Idle
                   ├─ Boost
                   ├─ Fuel
                   ├─ Ignition
                   └─ Cooling
```

The **From template** list is generated from the starter catalog. It is not a second workspace store and it does not create protected instances.

Each selection creates a normal `graph-*` workspace. After creation there is no special rename/delete/refresh behavior attached to the starter origin.

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

Implemented production layouts relevant to starter work:

- **Single** — one full graph pane;
- **Dual** — two vertically stacked graph panes.

Existing Logger layouts also include 2×2 / 4 graphs, 2×3 / 5 graphs, 3×2 / 6 graphs and Freeform / 5 graphs.

Longer-term starter geometry vocabulary may still include Triple, Quad, Focus + 2, Focus + 3 and Six Pane where a concrete starter benefits from them. Layout names describe geometry; starter/workspace names describe diagnostic purpose.

`Dual` is a normal Logger layout, not an Idle-only rendering mode.

## Generic starter catalog

Implemented production starters:

- **General** — Single layout; RPM, MAP, TPS, coolant temp, intake-air temp, battery voltage, Lambda and ignition advance;
- **Idle** — Dual layout; RPM, idle target, MAP, TPS, idle-air command, ignition advance, coolant temp and Lambda;
- **Boost** — Dual layout; RPM, MAP, TPS, boost target, wastegate command, boost error, intake-air temp and EMAP;
- **Fuel** — Dual layout; RPM, MAP, Lambda, Lambda target, injector pulse width, injector duty, fuel pressure and fuel correction;
- **Ignition** — Dual layout; RPM, MAP, ignition advance, knock retard, dwell, knock level, Lambda and intake-air temp;
- **Cooling** — Dual layout; coolant temp, intake-air temp, RPM, vehicle speed, fan command, oil temp, oil pressure and battery voltage;
- **Transient / AE** — Dual layout; RPM, TPS, TPS change, MAP, effective/predicted MAP, Lambda, injector pulse width, AE fuel contribution and wall-fuel correction;
- **Fuel System** — Dual layout; RPM, fuel pressure, MAP, TPS, fuel-pressure delta, injector pulse width, injector duty, fuel-pump command, battery voltage and Lambda.

Planned generic starter families remain:
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

## Production starter — General

General uses a Single layout and these semantic roles:

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

## Production starter — Idle

Idle is the first multi-pane starter and the first production use of the Dual layout.

Pane 1:

```text
Required
- RPM
- Idle Target

Preferred
- MAP
- TPS
```

Pane 2:

```text
Preferred
- Idle Air Command
- Ignition Advance
- Coolant Temp

Optional
- Lambda
```

The generic semantic identities added for this starter are:

```text
idle.target
idle.airCommand
```

For the current EpicEFI schema, the preferred channel identities are:

```text
MLG + INI                    ts_shim
ini:idleTarget               idleTarget
ini:currentIdlePosition      currentIdlePosition
```

The generic Idle starter intentionally does not use `dcIdleTarget` as `idle.target` and does not use `IdlePosition` as `idle.airCommand`. Those are controller-specific target/feedback concepts and remain available to the specialized Idle analyzer or future capability-specific starters.

PR #348 added automated coverage for:

- the two new generic idle semantic roles;
- exclusion of the DC-specific target/feedback identities from those generic roles;
- the Idle two-pane template definition;
- recorded EpicEFI resolution into both panes;
- caller-owned materialization with `layout: 'dual'`;
- `dual` visible-pane count behavior.

Web CI run #1262 passed type-check, full tests and production build before merge.

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

With the reusable workspace lifecycle, INI-only editing, cascading template menu and first six generic starters now merged:

1. browser-smoke-test **Fuel**, **Ignition** and **Cooling** against the current INI catalog and representative recorded data;
2. implement the remaining generic starter families through the same semantic catalog/materialization path, starting with Transient / AE and Fuel System;
3. keep ECU-specific detail out of generic starters and add richer EpicEFI-specific starters behind capability checks;
4. add persistent user/schema semantic overrides where automatic mapping is genuinely ambiguous.

All future starter implementations must reuse the same semantic resolver/materialization path rather than creating layout-specific resolver logic.