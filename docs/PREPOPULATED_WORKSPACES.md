# Pre-populated graph workspaces

This document is the current product and implementation target for EpicScope's built-in Logger graph layouts and task-oriented workspaces.

Related authority:

- [`HANDOFF.md`](HANDOFF.md) — present-tense continuation/runtime status;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — semantic/capability layer and materialization boundaries;
- [`DATA_MODEL.md`](DATA_MODEL.md) — semantic role/template concepts;
- [`DECISIONS.md`](DECISIONS.md) — approved semantic workspace/naming/identity decisions.

## Core architecture

Built-in workspaces bind to **semantic channel roles**, not hard-coded ECU channel IDs.

The intended identity stack is:

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
ini:RPMValue  (recorded MLG + INI)

engine.rpm
    ↓
RPMValue
    ↓
RPMValue      (ts_shim)
```

This keeps workspace meaning independent of whether the current source is a recorded log, an INI catalog, or live/retained Shim data.

### Resolution order

Current intended resolution order:

1. explicit user/schema override;
2. exact EpicEFI/native alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

User/schema overrides always win over automatic guessing.

Missing channels remain explicit. EpicScope must never fabricate values merely to satisfy a built-in workspace.

## Display names and aliases

Source aliases are compatibility input. They do not define EpicScope's user-facing vocabulary.

The naming pipeline is:

```text
legacy/vendor/import alias
          ↓
EpicScope semantic role
          ↓
preferred EpicScope display name
```

Examples:

- MLV/legacy `TP` may resolve `engine.throttle.position`, but the visible name is **TPS**.
- `PW` may be accepted as an injector-pulse-width alias, while the user-facing name is **Injector Pulse Width**.
- `Batt V`/`VBatt` may resolve battery voltage, while the user-facing name is **Battery Voltage**.
- `CLT`/`ECT` may resolve coolant temperature, while the user-facing name is **Coolant Temp**.

Established technical abbreviations such as RPM, MAP, TPS, AFR and Lambda may remain visible where they are clearer than expanded wording.

## MLV FieldMaps as compatibility evidence

MegaLogViewer HD's `FieldMaps/*.properties` files were inspected as a cross-ECU compatibility reference.

The installation contained 29 ECU/software-specific field maps and 132 unique normalized keys. Examples include mappings such as:

```text
Normalized key    rusEFI/EpicEFI-like source    MegaSquirt-like source
RPM               RPM                           RPM
MAP               MAP                           MAP
TP                TPS                           TP
coolantTemp       CLT                           CLT
pulseWidth        Fuel: Last inj pulse width    PW
```

EpicScope uses that evidence as an **alias/compatibility dataset and architectural precedent**, not as naming authority.

Reasons not to copy the MLV normalized vocabulary directly include:

- historical abbreviations such as `TP`;
- convenience/table-axis keys such as `yAxisFuel`;
- semantically inconsistent keys such as `egoCorrection` across ECU families;
- vendor-specific numeric keys in some maps;
- lack of richer role metadata such as requirement level, capability class and preferred display terminology.

The EpicScope semantic-role layer therefore sits above source/MLV aliases.

## Layout vs workspace

EpicScope treats these as separate concepts:

- **Layout** — graph geometry only.
- **Workspace** — task-oriented configuration that references a layout and semantic channel assignments.

Conceptually:

```text
Workspace
 ├─ name
 ├─ category
 ├─ layout
 ├─ pane definitions
 │    └─ semantic channel slots
 ├─ optional ECU-family specialization
 └─ user/schema overrides
```

Built-in layouts and workspaces are immutable templates. A duplicated built-in becomes a normal editable user workspace.

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

Generic workspaces should remain portable across ECU families. Richer built-ins may be exposed only when the active schema has the required capabilities, for example:

- **EpicEFI · Dual Chamber Boost**
- **EpicEFI · MAP Predict + Wall Wetting**
- **EpicEFI · ETB Control**
- **EpicEFI · Fuel Rail Diagnostics**
- **EpicEFI · Trigger + Sync Detailed**
- **EpicEFI · Injector / Ignition Timing**
- **EpicEFI · Engine Protection**

These are intentionally allowed to depend on EpicEFI-native capabilities and channel semantics.

Capability detection should be based on available semantic roles/schema capabilities rather than board-name conditionals such as `if ECU == Mega144H7`.

## Role requirement levels

Each workspace role slot is classified as:

- **required** — central to the workspace's purpose;
- **preferred** — normally expected and materially improves the workspace;
- **optional** — useful enhancement when the ECU exposes it.

A workspace remains loadable when roles are unresolved. Missing preferred/optional roles must not invalidate the layout. Missing required roles are reported explicitly so the user can map or replace them.

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

## Validated first slice — Single resolver fixture

The first implementation deliberately used a one-pane development fixture, **Single · Resolver Test**, to prove the semantic resolver without multi-pane geometry complexity.

Fixture roles:

- required: RPM;
- preferred: MAP;
- preferred: TPS;
- optional: Coolant Temp.

Semantic identities:

- `engine.rpm`
- `engine.map`
- `engine.throttle.position`
- `temperature.coolant`

The real browser/ECU validation confirmed the same built-in workspace identity survived this round trip:

```text
MLG + INI
→ ts_shim live/capture
→ MLG + INI
```

Observed recorded identities:

```text
ini:RPMValue
ini:MAPValue
ini:TPSValue
ini:coolant
```

Observed Shim identities:

```text
RPMValue
MAPValue
TPSValue
coolant
```

In both source states:

- `activeWorkspace=built-in:single-resolver-test`;
- one pane was visible;
- four channels were assigned;
- all four assigned channels were renderable;
- zero assigned channels were unavailable;
- four traces were active;
- runtime health was `0 ISSUE / 0 WARN`;
- runtime errors were zero.

This validates the central architecture: **semantic workspace identity remains stable while source-specific channel identities change underneath it**.

The validation also confirmed that an ordinary editable `General` workspace remained independent while the built-in re-resolved, and that the reserved `built-in:*` identity prevented name collisions with user workspaces.

Automated verification for the validated resolver/UI slice reached:

```text
npm run typecheck  → pass
npm test           → 71 test files / 362 tests passed
```

## First production implementation — General · Single

The validated resolver path is now being promoted to the first production preset, **General · Single**. It uses one full-width pane and up to the Logger's eight active traces:

- required: RPM;
- required: MAP;
- preferred: TPS;
- preferred: Coolant Temp;
- optional: Intake Air Temp;
- optional: Battery Voltage;
- optional: Lambda;
- optional: Ignition Advance.

Its semantic identities are:

- `engine.rpm`
- `engine.map`
- `engine.throttle.position`
- `temperature.coolant`
- `temperature.intakeAir`
- `electrical.batteryVoltage`
- `fuel.lambda`
- `ignition.advance`

For the current EpicEFI schema these resolve to:

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

The EpicEFI names above are backed by the current INI/channel catalog. Cross-ECU aliases remain resolver inputs rather than user-facing naming authority.

### Current verification status

The eight-role **General · Single** expansion is implemented on `feat/single-prepopulated-workspace` / draft PR #343.

It has **not yet superseded the validated four-role runtime checkpoint** until the expanded branch is pulled locally and passes:

```text
npm run typecheck
npm test
real MLG + INI → Shim → MLG runtime check
```

Do not describe the eight-role production preset as runtime-validated until that pass is completed.

## Logger integration and migration

Logger uses a reserved built-in runtime identity so automatic refresh never name-matches or rewrites user workspaces.

The validation-era internal id `built-in:single-resolver-test` is temporarily retained while the production preset is introduced. This allows already-persisted validation state to upgrade in place rather than leaving a stale duplicate.

The existing editable workspace named **General** is intentionally preserved. It is not silently converted, renamed or overwritten. Until an explicit migration policy for that legacy default is chosen, the immutable production preset is shown as **General · Single** to keep the two entries unambiguous.

When the authoritative channel set changes, only the reserved built-in is refreshed:

- catalog-only INI state resolves against catalog channels;
- recorded MLG + INI resolves against canonical bound `ini:*` identities;
- Shim/live capture resolves against raw Shim channel identities;
- returning to MLG resolves back to canonical `ini:*` identities.

Rename/delete remain disabled for built-ins. Duplication remains available so a resolved built-in can be copied into a normal editable workspace.

## Implementation direction after Single

Once **General · Single** is locally verified, the hard architectural part is considered proven for production use. The next work should reuse the same semantic/template/runtime path rather than inventing layout-specific resolver logic.

Recommended progression:

1. finalize the `General · Single` migration/name behavior;
2. extend the semantic-role catalog only as needed by the next agreed workspace;
3. define exact pane grouping for Dual/Triple/Quad/etc.;
4. materialize additional generic workspaces;
5. add EpicEFI-specific workspaces behind capability checks;
6. add persistent user/schema role overrides where automatic mapping is ambiguous.
