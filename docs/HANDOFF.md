# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Current authoritative `main` baseline:

`df5641895c05476c01e578e7bf94cee8d8bfc4f4`

That squash merge is PR #347, **Make pre-populated graph workspaces editable starters**. It replaces PR #343's protected built-in workspace lifecycle while retaining the semantic resolver/source-identity architecture.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older wording elsewhere conflicts, use current `main`, this handoff and current CI/runtime evidence.

## Current project position — 2026-10-13

EpicScope Web remains the functional reference/validation implementation for Logger, Histogram and Analyzer behavior.

The large recorded-log performance campaign remains complete unless a measured regression appears.

The validated real ECU/Pi/`ts_shim` source workflow is part of `main`.

The active product-development track is **semantic, multi-ECU Logger starter templates**. The first production starter is **General** using a Single layout.

Do not restart broad Histogram redesign, reopen mature Fueling/Ignition work, or begin a new platform phase without a concrete user-visible need, measured regression or explicit project-owner direction.

## Product/workflow invariant

The approved visible workflow remains:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

For generic Histogram analysis:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

Shared concepts should keep shared names and semantics.

## Validated runtime topology

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

Local development command used on JZ-Main:

```bash
cd ~/EpicEFI-EpicScope
EPICSCOPE_SHIM_TARGET='http://192.168.186.181:29002' npm run dev:shim
```

Browser:

`http://localhost:5173/`

## Source ownership model

One Logger source family is authoritative at a time:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Loaded INI and MSQ are independent application resources and survive source transitions.

### MLG → Shim

- **Connect Shim** detaches the recorded source in-process.
- No page reload is used.
- INI, MSQ, reusable workspace, runtime errors and performance/report history remain.
- Shim's decodable schema becomes the temporary Channel Browser catalog.
- Stable workspace assignments resolve onto matching raw Shim runtime IDs.

### Shim → MLG

Opening a recorded MLG makes Shim relinquish temporary catalog ownership first. The loaded INI catalog is restored, then the MLG is parsed/bound normally.

Workspace assignments return to canonical `ini:*` identities.

Do not reintroduce raw + `ini:*` duplicate traces.

## Semantic starter-template architecture

Starter templates are defined in terms of **semantic channel roles**, not one ECU's raw channel names.

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

Resolution order:

1. explicit user/schema override;
2. exact EpicEFI/native alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Missing channels remain explicit. Required/preferred/optional roles degrade gracefully rather than fabricating data.

Compatibility aliases never dictate the visible EpicScope name. Legacy `TP` may resolve throttle position while EpicScope displays **TPS**.

MegaLogViewer HD `FieldMaps/*.properties` remain compatibility/reference evidence, not naming authority.

### Layout, starter and workspace are separate

- **Layout** describes graph geometry only.
- **Starter template** describes a task using a layout plus semantic role slots.
- **Workspace** is the user's ordinary editable materialized configuration.

Lifecycle:

```text
starter template
      ↓ resolve once against current ECU/source catalog
ordinary editable workspace
```

Once created, the workspace can be edited, renamed, duplicated or deleted. Template logic does **not** continue to own it and must not silently repopulate removed channels or reset layout changes.

Source transitions may translate the user's chosen stable assignments between `ini:*` and raw Shim identities. That is source-identity normalization, not template reapplication.

Template updates affect future materializations only.

Historical persisted `built-in:*` IDs are compatibility data only and no longer imply protected rename/delete behavior.

If the final workspace is deleted, Logger creates a blank ordinary workspace rather than resurrecting a starter automatically.

Detailed authority:

- `docs/PREPOPULATED_WORKSPACES.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/DECISIONS.md` — D-055 supersedes the protected-instance lifecycle from D-054.

## General starter

The first production starter is **General**. `Single` describes its initial geometry, not its permanent workspace name.

Roles:

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

### Validation status

The original four-role Single resolver path was real-runtime validated through:

```text
MLG + INI → ts_shim live/capture → MLG + INI
```

with correct source-specific resolution, zero unavailable assigned channels, `0 ISSUE / 0 WARN`, and zero runtime errors.

The expanded eight-role General resolver has automated coverage. One explicit real MLG + INI → Shim → MLG confirmation with all eight roles remains useful before describing all eight roles as fully runtime-validated.

PR #347's editable-starter lifecycle correction passed Web CI with type-check, full tests and production build before merge.

## Shim HTTP fix

The default `fetch` implementation in `ShimHttpReadOnlyClient` is bound through an arrow wrapper rather than storing a bare native `fetch` reference.

This fixes the browser-side `Illegal invocation` failure previously tracked by PR #342. PR #342 was closed after the fix was carried through PR #343.

## Logger checkpoint

Mature behavior includes:

- MLG v1/v2 staged import, CRC/source diagnostics and large-log reuse;
- INI-backed channel catalog/binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces plus exact-log navigation persistence;
- fixed/freeform multi-pane Logger;
- A/B ranges, markers and saved ranges;
- stable channel identity across recorded and Shim transitions;
- semantic starter-template resolution;
- fully editable/deletable materialized starter workspaces;
- explicit unavailable-channel handling;
- retained-memory, parser, performance and runtime-health diagnostics.

The long-used 1.19 GB / 320,458-record MLG remains the main large-log stress/reference file.

Do not resume broad Logger/performance micro-optimization without a concrete measured problem.

## Histogram checkpoint

Histogram coherence remains complete through:

- PR #339 — shared scope/evidence flow;
- PR #340 — shared Qualification;
- PR #344 — shared Math Channels;
- PR #345 — unified Histogram help;
- PR #346 — documentation refresh.

Current surfaces:

- Table Generator;
- Distribution;
- Scatter;
- Math Channels.

Remaining useful Histogram work is narrower:

1. saved setups/presets for Distribution and Scatter;
2. exports for Distribution and Scatter;
3. richer Scatter region selection/evidence navigation;
4. eventually replace the remaining Scatter timeline text/DOM bridge with direct shared state propagation;
5. later cleanup/consolidation of dormant duplicate/runtime-refinement code.

Do not restart a broad Histogram rewrite.

## Analyzer checkpoint

Analyzer feature expansion remains paused after useful maturity checkpoints in Fueling and non-knock Ignition.

Current surfaces:

- Range Compare;
- Tune Table;
- Boost;
- Idle;
- AE / MAP Predict;
- Fueling;
- Ignition;
- Fuel / Injector;
- Trigger / Sync.

When Analyzer work resumes, prefer practical coverage of less-mature analyzers before deepening Fueling/Ignition again.

## Cleanup/consolidation policy

Broad cleanup/optimization remains deliberately deferred until feature coverage is broader. Do not destabilize mature behavior solely for internal tidiness.

## Current Git / workflow state

Current authoritative `main` merge baseline:

`df5641895c05476c01e578e7bf94cee8d8bfc4f4`

Relevant milestones:

- #339 — Histogram scope/evidence flow;
- #340 — shared Histogram Qualification;
- #341 — validated `ts_shim` live/recorded source workflow;
- #344 — shared Histogram Math Channels;
- #345 — unified Histogram help;
- #346 — current-state documentation refresh;
- #343 — semantic channel-role layer and first General pre-populated implementation, including Shim HTTP binding fix;
- #347 — editable one-time starter materialization; protected built-in lifecycle removed.

Before new work from a local clone:

```bash
cd ~/EpicEFI-EpicScope
git switch main
git pull
npm run typecheck
npm test
```

Next product work should be a deliberate **New graph/workspace → From template…** path, followed by the first multi-pane starter (Idle is the preferred architecture test).
