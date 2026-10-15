# EpicScope ts_shim current status

This file is the present-tense implementation and validation authority for EpicScope's `ts_shim` support. Use it together with current `main` and `HANDOFF.md`. Older planning notes describing the live path as unimplemented or hardware-blocked are historical.

## Current status — 2026-10-15

The first-pass read-only `ts_shim` integration is implemented, real-ECU tested and merged to `main`.

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

The implementation remains read-only and consumes the Shim's shared ECU snapshot rather than opening a second ECU polling path.

## Source model

EpicScope has one authoritative Logger source family at a time:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Loaded INI and MSQ are independent application resources and survive source transitions.

## Validated Logger round trip

The tested source flow is:

```text
MLG + INI
→ Connect Shim
→ recorded MLG detached in-process
→ Shim schema becomes temporary Channel Browser catalog
→ existing graph assignments map to matching Shim channels
→ Record / live Logger view
→ Stop
→ Open Log
→ Shim relinquishes catalog ownership
→ INI catalog restored
→ MLG/INI binding restored
→ workspace IDs migrate back to canonical ini:* identities
```

No browser reload is required for MLG → Shim transition.

**Unload Log** detaches only the active recorded MLG source while retaining loaded INI, MSQ/TuneModel, reusable workspace assignments, application session and diagnostics.

## Catalog and channel identity

When Shim owns Logger, its complete decodable schema is the temporary catalog. Returning to an INI-bound recorded source restores the INI catalog.

Recorded workspaces may use stable `ini:*` identities while Shim exposes matching raw runtime IDs. EpicScope translates between those identities during source transitions so the same workspace remains usable without duplicate raw + `ini:*` traces.

Missing/unrecorded live/capture channels remain explicit rather than being fabricated.

## Real validation evidence

The real ECU round-trip validation established:

- Shim schema/catalog ownership works;
- assigned visible channels map correctly between `ini:*` and raw identities;
- the restored recorded source returns to canonical `ini:*` assignments;
- no obvious cross-source strong-reference leak was observed in the tested round trip;
- runtime health returned to clean state after the full MLG → Shim → MLG cycle.

Historical exact channel counts/firmware signatures remain in Git history/earlier revisions; the behavioral contract above is the durable authority.

## Current live recording workflow

The normal Logger Channel Browser is authoritative for the recording set:

```text
Connect Shim
→ assign channels in Logger
→ Record
→ live Logger view
→ Follow / inspect history
→ Stop Recording
```

The current first-stage capture model uses one `series` stream bounded by Shim-advertised limits. Requested rate/channel counts must obey server-advertised capabilities rather than hard-coded assumptions.

## Development/LAN networking validation

The Pi Zero 2 W deployment/network workflow is now considered operational for the current test setup.

Validated use:

```text
phone hotspot
   ├─ Pi Zero 2 W / ts_shim
   └─ laptop / EpicScope
```

With both Pi and laptop on the phone hotspot, EpicScope can reach `ts_shim`. When the hotspot is turned off, the Pi returns to its configured home network automatically without requiring the previous manual `nmcli` recovery sequence.

This network behavior is a deployment convenience, not part of the `ts_shim` protocol contract.

## Protocol/deployment boundaries

Browser integration uses same-origin telemetry. During development the Vite proxy exposes `/telemetry` and selected `/api/v1/*` paths relative to EpicScope's current origin.

Read-only HTTP inspection exists for:

- `/api/v1/inis`;
- `/api/v1/objects`;
- `/api/v1/triggerlog`.

No tune writes, burns, firmware flashing, mocks, ECU commands or CAN injection are part of this baseline.

## Reusable downstream rules

1. one telemetry/catalog owner at a time;
2. source transitions happen in-process and preserve unrelated application/tune state;
3. stable user/workspace channel identity survives source changes;
4. the live schema is authoritative while live telemetry owns Logger;
5. returning to recorded analysis restores recorded/INI catalog and binding cleanly;
6. unavailable channels remain explicit;
7. clients obey Shim-advertised rate/channel/generation/stream contracts.

## Known narrow UI edge

The core source round trip is validated. One older UI distinction still deserves explicit cleanup: **capture remains loaded** and **live refresh is paused** are separate concepts and should not be overloaded into one state flag.

## Deferred scope

Still intentionally deferred unless explicitly prioritized:

- automatic full-schema multi-stream recording/joining;
- write-capable tune/ECU operations;
- speculative typed HTTP models without real response evidence;
- broader firmware/package embedding details beyond the validated same-origin contract.
