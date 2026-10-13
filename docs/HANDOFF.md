# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Current validated `main` live-source baseline entered through PR #341 / squash merge:

`ad6d6a5ed26939ce7d27e4e4a018be8b2bd88bdc`

Current in-progress pre-populated-workspace branch:

`feat/single-prepopulated-workspace`

Draft PR:

`#343 — Add General Single pre-populated workspace`

This file is the compact present-tense continuation authority. If older current-state wording elsewhere conflicts with this handoff, current `main`, this file, the active feature branch, and the latest verified tests/runtime evidence win.

Related semantic-workspace authority:

- [`PREPOPULATED_WORKSPACES.md`](PREPOPULATED_WORKSPACES.md) — product catalog, role contents and implementation status;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — semantic/capability layer and materialization boundaries;
- [`DATA_MODEL.md`](DATA_MODEL.md) — semantic role/template concepts;
- [`DECISIONS.md`](DECISIONS.md) — D-051–D-054 naming, identity and built-in workspace decisions.

These repository docs were refreshed together on the active feature branch from the validated EpicScope-specific state established during the Single semantic-workspace work.

## Current project position — 2026-10-13

EpicScope Web remains the functional reference/validation implementation for Logger, Histogram and Analyzer behavior.

The large recorded-log performance campaign is complete unless a measured regression appears.

The `ts_shim` source architecture is validated on the real ECU/Pi/LAN path and is part of `main`.

The current active product-development track is **multi-ECU pre-populated Logger workspaces** built on a semantic channel-role layer.

The first implementation deliberately used the simplest **Single** graph layout to prove the architecture before adding multi-pane geometry.

## Validated real runtime topology

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
      ↓
ts_shim
      ↓ LAN
EpicScope same-origin Vite proxy
      ↓
Logger / Analyzer / Histogram
```

Pi test endpoint used during validation:

`http://192.168.186.181:29002`

Firmware signature observed during the validated run:

`rusEFI master.2026.10.12.MEGA144H7.2957763282`

Local development command on JZ-Main:

```bash
cd ~/EpicEFI-EpicScope
EPICSCOPE_SHIM_TARGET='http://192.168.186.181:29002' npm run dev:shim
```

Browser:

`http://localhost:5173/`

## Source ownership model — current authority

One Logger source family is authoritative at a time.

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Loaded INI and MSQ are independent application resources and survive source transitions.

### MLG → Shim

- **Connect Shim** while an MLG is active detaches the recorded source in-process.
- No page reload is used.
- INI, MSQ, reusable workspace, runtime errors and performance/report history remain.
- Shim's decodable schema becomes the temporary Channel Browser catalog.
- Stable graph assignments can map onto matching raw Shim runtime IDs.

### Shim → MLG

Opening a recorded MLG makes Shim relinquish temporary catalog ownership first. The loaded INI catalog is restored, then the MLG is parsed/bound normally.

Workspace identities migrate back to canonical `ini:*` IDs.

## Stable source identity rule

Recorded INI-bound identities use canonical IDs such as:

```text
ini:coolant
ini:intake
ini:MAPValue
ini:RPMValue
ini:TPSValue
```

Shim publishes matching raw IDs:

```text
coolant
intake
MAPValue
RPMValue
TPSValue
```

Do not reintroduce raw + `ini:*` duplicate traces.

## Semantic workspace architecture — approved direction

Built-in task workspaces are defined primarily in terms of **semantic channel roles**, not EpicEFI channel names.

Identity layers:

```text
semantic role
      ↓
logical ECU channel
      ↓
current source identity
```

Example:

```text
engine.rpm
    ↓
RPMValue
    ↓
ini:RPMValue  (MLG + INI)

engine.rpm
    ↓
RPMValue
    ↓
RPMValue      (Shim)
```

Resolution order:

1. explicit user/schema override;
2. exact EpicEFI/native alias;
3. ECU-family/cross-ECU alias;
4. conservative normalized-name matching;
5. unresolved.

User override wins over automatic mapping.

Missing channels remain explicit. Built-ins degrade gracefully rather than fabricating data or failing the entire workspace.

### Display naming rule

Compatibility aliases never dictate the visible EpicScope name.

Important locked example:

```text
legacy/import alias: TP
semantic role:       engine.throttle.position
visible name:        TPS
```

`TP` may be accepted for compatibility but must not be used as the preferred display name.

## MLV FieldMaps evidence

MegaLogViewer HD's `FieldMaps/*.properties` set was inspected as compatibility evidence.

Observed dataset:

- 29 ECU/software-specific field-map files;
- 132 unique normalized keys;
- broad coverage for common RPM/MAP/TPS/temperature/fueling concepts;
- historical/awkward normalized keys such as `TP`, `coolantTemp`, `yAxisFuel`;
- semantic inconsistencies such as `egoCorrection` across ECU families;
- vendor-specific numeric keys in some maps.

Decision: use MLV FieldMaps as an alias/compatibility source and architectural precedent, **not** as EpicScope's semantic vocabulary or display-name authority.

## Layout vs workspace

- **Layout** = graph geometry only.
- **Workspace** = task-oriented configuration using a layout plus semantic channel slots.

Initial layout names:

- Single
- Dual
- Triple
- Quad
- Focus + 2
- Focus + 3
- Six Pane

Initial generic workspace catalog:

- General
- Idle
- Fuel
- Ignition
- Boost
- Transient / AE
- Cooling
- Fuel System
- Trigger / Sync
- Startup / Warmup
- Electrical
- Vehicle / Driveline

EpicEFI-specific workspaces may coexist behind capability checks, e.g. Dual Chamber Boost, MAP Predict + Wall Wetting, ETB Control, Fuel Rail Diagnostics, Trigger + Sync Detailed, Injector / Ignition Timing and Engine Protection.

## Validated first slice — Single · Resolver Test

The first development fixture intentionally used one pane and only four semantic roles:

```text
Required
- RPM

Preferred
- MAP
- TPS

Optional
- Coolant Temp
```

The same reserved built-in workspace was tested through the real browser source round trip:

```text
MLG + INI
→ Shim live/capture
→ MLG + INI
```

Recorded identities:

```text
ini:RPMValue
ini:MAPValue
ini:TPSValue
ini:coolant
```

Shim identities:

```text
RPMValue
MAPValue
TPSValue
coolant
```

Validated runtime evidence in both source states:

```text
activeWorkspace=built-in:single-resolver-test
visiblePanes=1
assignedVisibleChannels=4
renderableAssignedVisibleChannels=4
unavailableAssignedVisibleChannels=0
activeVisibleTraces=4
Health=0 ISSUE / 0 WARN
Runtime errors=0
```

This proves the central architecture: **workspace meaning/identity remains stable while source-specific channel IDs re-resolve underneath it**.

The editable `General` workspace remained independent during this test. Built-ins use reserved `built-in:*` IDs and are never name-matched onto user workspaces.

Validated automated baseline for this slice:

```text
npm run typecheck  → pass
npm test           → 71 test files passed
                     362 tests passed
                     0 failed
```

## First production preset — General · Single

The validated Single resolver path is now being promoted to **General · Single** on `feat/single-prepopulated-workspace`.

Target roles:

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

Current EpicEFI native resolution target:

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

The current INI confirms the EpicEFI runtime names used above.

### Verification status of General · Single

The eight-role expansion is implemented on the feature branch and documented in draft PR #343.

It is **not yet runtime-validated** at the time of this handoff update. Do not replace the validated four-role checkpoint with the eight-role claim until the user has run:

```bash
git pull
npm run typecheck
npm test
```

and then verified real:

```text
MLG + INI → Shim → MLG
```

with all available General roles resolving as expected.

## Built-in/user workspace behavior

Built-ins are immutable templates with reserved runtime IDs.

Rules:

- built-ins may automatically re-resolve when authoritative channel catalogs change;
- normal user workspaces are never automatically repopulated;
- rename/delete are disabled for built-ins;
- Duplicate creates a normal editable workspace;
- a user workspace may have the same visible name without collision because identity is not name-based.

The validation-era internal ID `built-in:single-resolver-test` is temporarily retained during promotion so already-persisted validation state upgrades in place rather than creating a duplicate.

The existing editable default workspace named `General` is intentionally preserved. Until explicit migration policy is chosen, the immutable preset remains visibly named **General · Single**.

## Capability-driven future work

Do not hard-code board-name conditions such as `if ECU == Mega144H7` for workspace availability.

Prefer semantic capabilities such as:

```text
engine.rpm
engine.map
engine.throttle.position
temperature.coolant
temperature.intakeAir
fuel.lambda
boost.target
boost.wg.upper
boost.wg.lower
fuel.pressure
fuel.railDifferential
idle.target
idle.command
ignition.advance
knock.level
```

Generic and ECU-native workspaces may coexist. Required/preferred/optional role levels decide how gracefully each workspace degrades on a given schema.

## Shim Logger UX — current

The normal Logger Channel Browser is authoritative for the Shim recording set.

Primary workflow:

```text
Connect Shim
→ assign channels in Logger
→ Record
→ live Logger view starts immediately
→ Follow / inspect history
→ Stop Recording
```

The Shim schema remains visible while uncaptured channels are explicitly unavailable in a selected-channel capture.

One narrow UI edge remains: **capture remains loaded** and **live refresh is paused** should eventually be modeled as separate states.

## ts_shim implementation boundaries

EpicScope's live integration is read-only.

EpicScope consumes Shim's shared output snapshot rather than polling the ECU independently.

Current HTTP inspection remains read-only for:

- `/api/v1/inis`;
- `/api/v1/objects`;
- `/api/v1/triggerlog`.

No tune writes, burns, flashing, mocks, ECU commands or CAN injection are part of this baseline.

For architecture/protocol details use:

- [`TS_SHIM_INTEGRATION.md`](TS_SHIM_INTEGRATION.md)
- [`TS_SHIM_STATUS.md`](TS_SHIM_STATUS.md)
- [`TS_SHIM_DEVELOPMENT_PROXY.md`](TS_SHIM_DEVELOPMENT_PROXY.md)

## Recorded-log performance/parser evidence

The long-used 1.19 GB / 320,458-record MLG remains the main large test log.

Known source properties:

- 291 recovered retry artifacts;
- 8 unrecovered CRC records;
- 9 counter anomalies.

Those are source-log properties, not regressions introduced by Shim or semantic-workspace work.

Do not reopen general micro-optimization without a concrete measured problem.

## Logger / Analyzer / Histogram authority

Existing mature behavior remains intact:

- MLG v1/v2 staged import/CRC/source diagnostics;
- INI-backed channel catalog/binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces and per-log navigation persistence;
- fixed/freeform multi-pane Logger;
- A/B ranges, markers and saved ranges;
- Histogram Table Generator / Distribution / Scatter / Math Channels;
- Analyzer Range Compare, Tune Table, Boost, Idle, AE/MAP Predict, Fueling, Ignition, Fuel/Injector and Trigger/Sync surfaces;
- evidence navigation back to Logger;
- retained-memory, parser, performance and runtime-health diagnostics.

Do not build parallel live-only Analyzer/Histogram logic. Live/retained Shim sources continue through the same normalized analysis contracts.

## Development guidance

Preserve these invariants:

1. one authoritative telemetry/catalog owner at a time;
2. source transitions are in-process;
3. unrelated INI/MSQ/workspace/report state survives source changes;
4. stable source identity survives source changes;
5. semantic workspace meaning is source-independent;
6. live schema ownership is explicit and temporary;
7. returning to recorded analysis restores the recorded/INI catalog and binding;
8. unavailable channels remain explicit;
9. built-ins never overwrite user workspaces by visible name;
10. user/schema semantic overrides win over automatic mapping;
11. negotiated Shim limits/generation/stream identity are obeyed.

## Git / workflow state

Validated live-source baseline is on `main` through PR #341.

Current semantic/pre-populated workspace work is on:

```text
feat/single-prepopulated-workspace
PR #343 (draft)
```

Continue that branch until the General · Single expansion passes local typecheck/tests and real runtime validation. Do not merge without explicit project-owner approval.
