# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative branch: `main`

Current authoritative `main` baseline:

`2a5a20ac25aca74f9b200c0f5a68e2f10d3ef8f5`

That squash merge is PR #343, **Add General Single pre-populated workspace**, after reconciling the branch with the Histogram baseline from PRs #344–#346 and carrying forward the Shim HTTP default-fetch binding fix from PR #342.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the compact present-tense continuation authority. If older current-state wording elsewhere conflicts with this handoff, current `main`, this file and current CI/test/runtime evidence win.

## Current project position — 2026-10-13

EpicScope Web remains the functional reference/validation implementation for Logger, Histogram and Analyzer behavior.

The large recorded-log performance campaign remains complete unless a measured regression appears.

The validated real ECU/Pi/`ts_shim` source workflow is part of `main`.

The latest merged product-development track is now **semantic, multi-ECU pre-populated Logger workspaces**. The first production built-in is **General · Single**.

Do not restart broad Histogram redesign, reopen mature Fueling/Ignition work, or begin a new platform phase without a concrete user-visible need, measured regression, or explicit project-owner direction.

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

## Semantic pre-populated workspace architecture

Built-in task workspaces are defined in terms of **semantic channel roles**, not one ECU's raw channel names.

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
engine.rpm → RPMValue → ini:RPMValue  (recorded MLG + INI)
engine.rpm → RPMValue → RPMValue      (ts_shim)
```

Resolution order:

1. explicit user/schema override;
2. exact EpicEFI/native alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Missing channels remain explicit. Built-ins degrade gracefully rather than fabricating data or failing the entire workspace.

Compatibility aliases never dictate the visible EpicScope name. A legacy alias such as `TP` may resolve the throttle-position role, while the visible semantic name remains **TPS**.

MegaLogViewer HD `FieldMaps/*.properties` are compatibility/reference evidence, not EpicScope naming authority.

### Layout vs workspace

- **Layout** describes graph geometry only.
- **Workspace** describes a task and assigns semantic roles to a layout.

Generic workspace targets include General, Idle, Fuel, Ignition, Boost, Transient / AE, Cooling, Fuel System, Trigger / Sync, Startup / Warmup, Electrical and Vehicle / Driveline.

EpicEFI-specific workspaces may coexist where schema capabilities justify them.

Detailed authority:

- `docs/PREPOPULATED_WORKSPACES.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/DECISIONS.md`

## General · Single — merged production baseline

PR #343 merged the first production semantic built-in workspace: **General · Single**.

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

Built-ins use reserved `built-in:*` identity and do not overwrite normal user workspaces by visible name.

Rules:

- built-ins may re-resolve when the authoritative channel catalog changes;
- normal user workspaces are never automatically repopulated;
- built-in rename/delete are disabled;
- Duplicate creates a normal editable workspace;
- user/schema semantic overrides win over automatic mapping.

The existing editable workspace named `General` remains intentionally separate. The immutable preset remains visibly named **General · Single** for now.

### Validation status

The original four-role Single semantic resolver path was real-runtime validated through:

```text
MLG + INI → ts_shim live/capture → MLG + INI
```

with correct `ini:*` ↔ raw re-resolution, zero unavailable assigned channels, `0 ISSUE / 0 WARN`, and zero runtime errors.

The expanded eight-role General preset passed the reconciled Web CI before merge. The eight-role expansion should still receive one explicit real MLG + INI → Shim → MLG runtime confirmation before being described as fully runtime-validated in all roles.

## Shim HTTP fix

The default `fetch` implementation in `ShimHttpReadOnlyClient` is now bound through an arrow wrapper rather than storing a bare native `fetch` reference.

This fixes the browser-side `Illegal invocation` failure previously tracked by PR #342. PR #342 was closed after the fix was carried into and merged through PR #343.

## Logger checkpoint

Mature behavior includes:

- MLG v1/v2 staged import, CRC/source diagnostics and large-log reuse;
- INI-backed channel catalog/binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces plus exact-log navigation persistence;
- fixed/freeform multi-pane Logger;
- A/B ranges, markers and saved ranges;
- stable channel identity across recorded and Shim transitions;
- semantic built-in workspace resolution;
- explicit unavailable-channel handling;
- retained-memory, parser, performance and runtime-health diagnostics.

The long-used 1.19 GB / 320,458-record MLG remains the main large-log stress/reference file.

Do not resume broad Logger/performance micro-optimization without a concrete measured problem.

## Histogram checkpoint

Histogram coherence remains complete through the current consistency milestones:

- PR #339 — shared scope/evidence flow;
- PR #340 — shared Qualification;
- PR #344 — shared Math Channels;
- PR #345 — unified help;
- PR #346 — documentation refresh of current Analyzer/Histogram state.

Current surfaces:

- Table Generator;
- Distribution;
- Scatter;
- Math Channels.

Preserve the shared flow and contracts already documented in `docs/HISTOGRAM.md`.

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

When Analyzer work resumes, prefer practical coverage of the less-mature analyzers before deepening Fueling/Ignition again.

See `docs/ANALYZER.md` and `docs/FUELING_ANALYZER.md` for detailed semantics.

## Cleanup/consolidation policy

A broad cleanup/optimization phase remains deliberately deferred until feature coverage is broader.

Later review should include dormant duplicate editor paths, analyzer-local/shared DOM enhancement code, unnecessary MutationObservers, direct DOM state bridges, duplicated rendering/help/table logic, canvas resize ownership, CSS/runtime UI surgery, dead compatibility branches and representative large-log performance after consolidation.

Until then, do not destabilize mature behavior solely for internal tidiness.

## Current Git / workflow state

Current authoritative `main`:

`2a5a20ac25aca74f9b200c0f5a68e2f10d3ef8f5`

Recent relevant merged milestones:

- #339 — Histogram scope/evidence flow;
- #340 — shared Histogram Qualification;
- #341 — validated `ts_shim` live/recorded source workflow;
- #344 — shared Histogram Math Channels;
- #345 — unified Histogram help;
- #346 — current-state documentation refresh;
- #343 — semantic channel-role layer + **General · Single** built-in workspace, reconciled with the Histogram baseline and including the Shim HTTP binding fix.

PR #342 was closed as superseded because its fix is included in current `main` through #343.

Before starting new work from a local clone:

```bash
cd ~/EpicEFI-EpicScope
git switch main
git pull
npm run typecheck
npm test
```

Continue from current `main`, not an older Analyzer, Histogram or pre-populated-workspace feature branch.
