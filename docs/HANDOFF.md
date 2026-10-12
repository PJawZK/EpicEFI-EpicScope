# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative branch: `main`

Current authoritative main baseline:

`ad6d6a5ed26939ce7d27e4e4a018be8b2bd88bdc`

That squash merge promoted the validated `ts_shim` live-source/recorded-source workflow into `main`.

Hosted recorded-log application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the compact present-tense continuation authority. If older current-state wording elsewhere conflicts with this handoff, current `main`, this file and the current CI/test state win.

## Current project position — 2026-10-12

EpicScope Web remains the functional reference/validation implementation for Logger, Histogram and Analyzer behavior.

The large recorded-log performance campaign is complete unless a measured regression appears.

The `ts_shim` track is no longer blocked on hardware. The real ECU/Pi/shim/browser chain has been exercised successfully and the validated source workflow is now part of `main`.

Do not begin a new product phase automatically. Continue from concrete Logger/Analyzer/Histogram usefulness, firmware-integration needs, or measured runtime issues.

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

Local development command used on JZ-Main:

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
- Existing stable graph assignments map onto matching raw Shim runtime IDs.

### Unload Log

**Unload Log** releases only the active recorded MLG source/binding/log-specific source ownership. It does not reset the application.

### Shim → MLG

Opening a recorded MLG makes Shim relinquish temporary catalog ownership first. The loaded INI catalog is restored, then the MLG is parsed/bound normally.

Workspace identities migrate back to canonical `ini:*` IDs.

## Stable channel identity rule

Recorded INI-bound workspaces use canonical stable IDs such as:

```text
ini:coolant
ini:intake
ini:MAPValue
ini:RPMValue
ini:TPSValue
```

Shim publishes the matching raw IDs:

```text
coolant
intake
MAPValue
RPMValue
TPSValue
```

While Shim is authoritative, the stable assignments resolve to the raw Shim channels. When an INI-bound MLG returns, the workspace returns to canonical `ini:*` identities.

Do not reintroduce raw + `ini:*` duplicate traces.

## Real validation checkpoint

The full round trip was tested:

```text
MLG + INI
→ Connect Shim
→ live schema
→ Record / live Logger view
→ Stop Recording
→ Open MLG
→ INI catalog restored
→ MLG/INI binding restored
→ canonical workspace identities restored
```

Final recorded state after the round trip:

```text
Health: 0 ISSUE / 0 WARN
channelDefinitions=2544
catalogChannels=2519
assignedVisibleChannels=5
renderableAssignedVisibleChannels=5
unavailableAssignedVisibleChannels=0
activeVisibleTraces=5
```

Shim capture state:

```text
Health: 0 ISSUE / 0 WARN
logChannels=2493
catalogChannels=2493
assignedVisibleChannels=5
renderableAssignedVisibleChannels=5
unavailableAssignedVisibleChannels=0
activeVisibleTraces=5
```

Source-lifetime diagnostics showed replaced recorded/bound sources becoming collected; no obvious cross-source strong-reference leak was observed.

## Verification status

After the real runtime validation:

```text
npm run typecheck  → pass
npm test           → 67 test files passed
                     344 tests passed
                     0 failed
```

Treat this as the current regression baseline.

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

One narrow UI review edge remains: **capture remains loaded** and **live refresh is paused** should be modeled as separate states. The core MLG ↔ Shim source ownership/identity round trip is validated; do not conflate this remaining UI cleanup with failure of the source architecture.

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

## Recorded-log performance/current parser evidence

The long-used 1.19 GB / 320,458-record MLG remains the main large test log.

Known source properties:

- 291 recovered retry artifacts;
- 8 unrecovered CRC records;
- 9 counter anomalies.

Those are properties of the source log, not regressions introduced by Shim work.

Representative current large-log behavior remains around ~1 second for staged indexing on the test PC, with OPFS/column-sidecar reuse available for later channel reads.

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

The Web implementation is a reference implementation for behavior and source-contract validation. It is not a requirement that firmware/native integrations duplicate its DOM/UI structure.

For downstream implementation, preserve these invariants:

1. one authoritative telemetry/catalog owner at a time;
2. source transitions are in-process;
3. unrelated INI/MSQ/workspace/report state survives source changes;
4. stable channel identity survives source changes;
5. live schema ownership is explicit and temporary;
6. returning to recorded analysis restores the recorded/INI catalog and binding;
7. unavailable channels remain explicit;
8. negotiated Shim limits/generation/stream identity are obeyed.

## Git / workflow state

PR #341 was squash-merged into `main` as:

`ad6d6a5ed26939ce7d27e4e4a018be8b2bd88bdc`

The experimental branch history is not the architectural authority; current `main` is.

If continuing from a local clone:

```bash
cd ~/EpicEFI-EpicScope
git switch main
git pull
npm run typecheck
npm test
```

Do not continue development from the old `fix/shim-live-view-toggle` branch.