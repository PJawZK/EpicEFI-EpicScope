# EpicScope ts_shim integration

## Status

**Implemented, real-ECU validated and merged to `main`.**

This document now describes the implemented architecture and its invariants. For concrete runtime evidence and current validation numbers, see [`TS_SHIM_STATUS.md`](TS_SHIM_STATUS.md).

## Product goal

EpicScope supports recorded MLG analysis and live `ts_shim` telemetry through the same Logger / Analyzer / Histogram product rather than through parallel applications.

```text
Recorded MLG ─┐
              ├─→ normalized EpicScope source → Logger / Analyzer / Histogram
Live ts_shim ─┘
```

The MLG parser remains authoritative for recorded files. Shim telemetry is a separate source adapter behind the same normalized source contracts.

## Runtime topology

Validated topology:

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
      ↓
ts_shim
      ├─ owns ECU polling / shared output snapshot
      ├─ telemetry WebSocket
      └─ read-only HTTP surfaces
            ↓
         EpicScope
         ├─ Logger
         ├─ Analyzer
         └─ Histogram
```

EpicScope does not open a second ECU polling path when Shim already owns the ECU connection.

## Source ownership model

Only one Logger source family is authoritative at a time.

```text
MLG + optional INI binding
        ↕
   INI catalog only
        ↕
Shim live / retained capture
```

Loaded INI and MSQ resources are independent application resources and survive source changes.

### Recorded → Shim

When the user connects Shim while an MLG is active:

1. the recorded MLG source is detached in-process;
2. File-backed log data, active binding and log-specific source ownership are released;
3. INI, MSQ, reusable workspace and runtime/performance history remain loaded;
4. Shim connects normally;
5. the decodable Shim schema becomes the temporary Channel Browser catalog;
6. existing stable workspace assignments map onto matching Shim runtime IDs.

No page reload is required.

### Shim → recorded

When a recorded MLG is opened:

1. Shim relinquishes temporary catalog ownership;
2. the currently loaded INI catalog becomes authoritative again;
3. the MLG is parsed/bound normally;
4. workspace assignments migrate back to canonical `ini:*` identities;
5. Logger / Analyzer / Histogram continue on the normal recorded source model.

## Channel identity rule

Stable workspace identity must survive source changes.

Recorded INI-bound example:

```text
ini:RPMValue
ini:MAPValue
ini:TPSValue
```

Shim schema example:

```text
RPMValue
MAPValue
TPSValue
```

When Shim is authoritative, an existing `ini:<logicalKey>` assignment may resolve to the raw Shim `<logicalKey>` channel when that channel exists. When an INI-bound MLG becomes authoritative again, the workspace returns to canonical `ini:*` identities.

Do not persist duplicate effective traces such as both `ini:RPMValue` and `RPMValue` for the same user assignment.

## Catalog ownership rule

The active source owns the Channel Browser catalog presentation.

- Shim connected/live: full decodable Shim schema is the temporary catalog.
- Shim capture open/stopped: full Shim schema remains visible; uncaptured channels are explicitly unavailable.
- Shim relinquished with INI loaded: restore the INI catalog.
- Recorded MLG + INI: use the normal bound channel model for active definitions while the INI remains the catalog authority.

This separation matters because an active bound MLG can have more merged definitions than the INI catalog alone.

## Logger recording workflow

The normal Logger graph/channel assignments are authoritative for the first-stage recording set.

```text
Connect Shim
→ assign channels through normal Logger Channel Browser
→ Record
→ live Logger view starts immediately
→ Follow / inspect history
→ Stop Recording
```

The old separate capture-channel chooser is no longer the primary workflow.

Initial capture mode:

- one stream;
- `mode: "series"`;
- selected/assigned channels only;
- bounded by Shim-advertised `maxChannelsPerStream`;
- `rateHz = welcome.limits.maxRateHz`;
- delivery rate may be lower/batched while preserving queued series samples.

## Protocol contract

Default same-origin endpoint:

```text
/telemetry
```

Typical direct host endpoint:

```text
ws://<host>:29002/telemetry
```

Expected control flow:

```text
server  helloRequired
client  hello
server  welcome
server  schema
server  lifecycle
client  subscribe
server  streamDefinition
server  binary telemetry frames
```

Client requirements:

- send `hello` before normal requests;
- retain `clockId`, generation, ECU signature, schema identity and advertised limits;
- rebuild streams after lifecycle/generation changes;
- reject stale stream IDs/generations;
- never hard-code acquisition rate when the server advertises limits;
- reject unusable/undecodable schema state rather than inventing channels.

## Binary telemetry

Encoding authority is `epicefi-f64-v1`.

Frames include stream/generation identity, delivery/acquisition sequence information, timestamps, values and quality bytes. Integer and Float64 fields are big-endian.

EpicScope validates frame identity/shape before accepting values.

## Time model

Shim timestamps are monotonic host timestamps, not Unix time and not ECU wall time.

Within one compatible segment:

```text
elapsedMs = (timestampNs - segmentStartTimestampNs) / 1_000_000
```

Do not subtract unrelated `clockId` origins. Reconnect/lifecycle changes create explicit source/capture segment boundaries.

## Quality model

Shim quality is preserved beyond binary validity:

| Code | Meaning | EpicScope treatment |
|---:|---|---|
| 0 | valid | usable |
| 1 | invalid | excluded from valid analysis |
| 2 | stale | retained as stale provenance |
| 3 | unavailable | retained as unavailable provenance |
| 4 | reserved/lost compatibility | handled conservatively |

Existing MLG consumers continue to use the normal validity projection. Live ranges may carry richer quality bytes additively.

## Read-only HTTP scope

EpicScope currently keeps Shim integration read-only.

Available inspection routes include:

- `/api/v1/inis`;
- `/api/v1/objects`;
- `/api/v1/triggerlog`.

No tune writes, burns, flashing, mocks, ECU commands or CAN injection belong to this baseline.

## Same-origin deployment

The browser Shim contract is same-origin.

Development uses the Vite proxy documented in [`TS_SHIM_DEVELOPMENT_PROXY.md`](TS_SHIM_DEVELOPMENT_PROXY.md).

Development shape:

```text
Browser → localhost:5173
          ├─ EpicScope assets
          ├─ /telemetry → Shim host
          └─ /api/v1/*  → Shim host
```

Final packaging can serve EpicScope static files directly from the Shim host while keeping relative browser routes unchanged.

## Firmware/native implementation guidance

The Web implementation proves behavior and contract compatibility. Firmware/native code does not need to copy its DOM/UI organization.

Preserve these architectural invariants:

1. one authoritative telemetry/catalog source at a time;
2. source transitions do not restart the client or discard unrelated state;
3. stable channel identity survives source changes;
4. live schema ownership is temporary and explicit;
5. returning to recorded analysis restores the correct catalog/binding;
6. uncaptured/unavailable channels remain explicit;
7. transport obeys negotiated rate/channel/generation limits;
8. pause of live rendering and retention of an opened capture should be modeled as separate states.

## Deferred scope

Deferred until explicitly prioritized:

- automatic all-channel/full-schema multi-stream capture and cross-stream joining;
- write-capable ECU/tune operations;
- speculative typed HTTP models without runtime evidence;
- product-specific firmware/static-file packaging details beyond the validated same-origin model.