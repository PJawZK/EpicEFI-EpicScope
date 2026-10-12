# EpicScope ts_shim current status

This file is the present-tense implementation and validation authority for EpicScope's `ts_shim` support. Use it together with current `main`. Older planning notes that describe the live path as unimplemented or hardware-blocked are historical.

## Current status — 2026-10-12

The first-pass read-only `ts_shim` integration is implemented, real-ECU tested and merged to `main`.

Authoritative merge:

`ad6d6a5ed26939ce7d27e4e4a018be8b2bd88bdc` — **Integrate ts_shim live source with Logger workflow**

The validated physical/runtime path is:

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
      ↓
ts_shim
      ↓ LAN / WebSocket telemetry
EpicScope Vite same-origin proxy
      ↓
Logger / Analyzer / Histogram
```

Real test firmware signature used during validation:

`rusEFI master.2026.10.12.MEGA144H7.2957763282`

## Source model

EpicScope has one authoritative Logger source family at a time:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

The implementation intentionally does not run the MLG parser and live Shim source as competing active data sources.

The loaded INI and MSQ are application resources, not disposable source-session state. Source transitions must not restart the application or discard them.

## Validated Logger workflow

The tested round trip is:

```text
MLG + INI
→ Connect Shim
→ recorded MLG detached in-process
→ Shim schema becomes the temporary Channel Browser catalog
→ existing graph assignments map to matching Shim channels
→ Record / live Logger view
→ Stop
→ Open Log
→ Shim relinquishes catalog ownership
→ INI catalog restored
→ MLG/INI binding restored
→ workspace IDs migrate back to canonical ini:* identities
```

No browser reload is used for the MLG → Shim transition.

### Recorded-source unload

**Unload Log** detaches only the active recorded MLG source. It retains:

- loaded INI;
- loaded MSQ / TuneModel;
- reusable graph/workspace assignments;
- application session;
- runtime errors;
- performance/report history.

It releases the File-backed recorded source, active binding, traces and log-specific navigation/source ownership.

### Shim catalog ownership

When Shim connects, its complete decodable schema becomes the temporary Logger catalog.

Validated schema size on the tested ECU/INI:

`2,493 channels`

When Shim disconnects or a recorded MLG becomes authoritative again, the temporary Shim catalog is released and the current INI catalog is restored.

Validated INI catalog size:

`2,519 channels`

### Workspace channel identity

Recorded INI-bound sessions use stable identities such as:

```text
ini:coolant
ini:intake
ini:MAPValue
ini:RPMValue
ini:TPSValue
```

Shim publishes the corresponding runtime IDs without the `ini:` prefix.

EpicScope maps stable `ini:*` workspace assignments to matching raw Shim IDs while Shim is authoritative, then migrates them back to canonical `ini:*` identities when an INI-bound MLG becomes authoritative again.

This prevents duplicate raw + `ini:*` traces and keeps graph presets reusable across source families.

## Real validation evidence

### Final MLG + INI state after full MLG → Shim → MLG round trip

Observed runtime:

```text
Health: 0 ISSUE / 0 WARN
logLoaded=yes
iniLoaded=yes
bindingActive=yes
channelDefinitions=2544
catalogChannels=2519
assignedVisibleChannels=5
renderableAssignedVisibleChannels=5
unavailableAssignedVisibleChannels=0
activeVisibleTraces=5
```

The five active workspace channels were restored as canonical `ini:*` identities.

### Shim capture state

Observed runtime:

```text
Health: 0 ISSUE / 0 WARN
logName=Shim capture
logChannels=2493
catalogChannels=2493
assignedVisibleChannels=5
renderableAssignedVisibleChannels=5
unavailableAssignedVisibleChannels=0
activeVisibleTraces=5
```

The same five graph assignments became raw Shim channel IDs without duplicate unavailable `ini:*` entries.

### Source lifetime

The source-lifetime diagnostics showed old recorded/bound sources becoming collected when replaced. No obvious cross-source strong-reference leak was observed in the tested round trip.

### Automated verification

Local verification after the real runtime test:

```text
npm run typecheck  → pass
npm test           → 67 test files passed
                     344 tests passed
                     0 failed
```

Relevant regression suites include Shim protocol/client/live session/capture/UI tests, workspace identity tests, Shim workspace alias tests, channel binding tests, bug-report health tests and application-workspace persistence tests.

## Current live recording behavior

The normal Logger Channel Browser is authoritative for the recording set. The old separate capture-channel picker is not part of the primary workflow.

Primary workflow:

```text
Connect Shim
→ assign channels in normal Logger graph
→ Record
→ live Logger view is armed immediately
→ Follow / inspect history
→ Stop Recording
```

The Shim schema remains visible while a capture contains only selected channels; uncaptured schema channels are represented as unavailable for that capture rather than disappearing from the catalog.

The current first-stage capture model uses one `series` stream bounded by the Shim-advertised `maxChannelsPerStream`. `rateHz` comes from `welcome.limits.maxRateHz`; it is not hard-coded.

## Protocol / deployment boundaries

The integration remains read-only.

EpicScope consumes the Shim's shared ECU snapshot and does not open a second ECU polling path.

The browser integration uses same-origin telemetry. During development the Vite proxy exposes `/telemetry` and selected `/api/v1/*` paths relative to EpicScope's current origin. Final Shim-hosted deployment can serve EpicScope static assets from the Shim host without changing the browser networking model.

Read-only HTTP inspection currently exists for:

- `/api/v1/inis`;
- `/api/v1/objects`;
- `/api/v1/triggerlog`.

No tune writes, burns, firmware flashing, mocks, ECU commands or CAN injection are part of this baseline.

## Downstream / firmware implementation guidance

The browser code is a validated reference implementation, not a requirement that firmware reproduce its UI architecture.

The important reusable rules are:

1. one telemetry/catalog owner at a time;
2. source transitions are in-process and must preserve unrelated tune/catalog/session state;
3. stable user/workspace channel identity must survive source changes;
4. the live schema is authoritative while live telemetry owns Logger;
5. returning to recorded analysis restores the recorded/INI catalog and binding cleanly;
6. unavailable live/capture channels remain explicit rather than being fabricated;
7. client code must obey Shim-advertised rate/channel limits and generation/stream identity.

These rules are the useful baseline for firmware/native implementations that can implement the same behavior more directly.

## Remaining narrow UI edge

The core MLG ↔ Shim source round trip is validated.

One older review finding remains worth treating explicitly in future cleanup: **"capture remains loaded"** and **"live refresh is paused"** should be separate UI states. A native/firmware implementation should not overload those concepts into one flag. This does not invalidate the validated source-ownership/identity round trip above.

## Deferred scope

Still intentionally deferred unless explicitly prioritized:

- automatic full-schema multi-stream recording/joining;
- write-capable tune/ECU operations;
- speculative typed HTTP models without real response evidence;
- broader firmware/package embedding details beyond the validated same-origin contract.