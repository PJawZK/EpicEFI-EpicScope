# EpicScope ts_shim current status

This file is the present-tense implementation/status companion to [`TS_SHIM_INTEGRATION.md`](TS_SHIM_INTEGRATION.md). The integration-design document remains useful for architecture and protocol rationale, but its early planning/status wording is historical. Use this file plus current `main` for the implemented state.

## Current implementation state

EpicScope now contains a complete first-pass read-only `ts_shim` telemetry path through the existing normalized Logger/Analyzer/Histogram architecture.

Implemented sequence:

- **PR #249** — integration design documented;
- **PR #250 / SHIM-1** — protocol-v1 JSON types and `epicefi-f64-v1` binary decoder with synthetic tests;
- **PR #251 / SHIM-2** — WebSocket telemetry client/session state machine, reconnect ladder and subscription ownership;
- **PR #252 / SHIM-3** — shim schema adapter plus additive rich quality states (`valid`, `invalid`, `stale`, `unavailable`, reserved/lost compatibility);
- **PR #253 / SHIM-4** — live capture/session buffer and `NumericChannelDataSource` implementation;
- **PR #254 / SHIM-5** — live recording/session coordinator connecting telemetry, reconnect segments and capture state;
- **PR #255 / SHIM-6** — first Logger UI integration: Connect Shim, channel selection, Record/Stop and status;
- **PR #256 / SHIM-7** — retained captures become normal EpicScope sources for Logger/Analyzer/Histogram;
- **PR #257 / SHIM-8** — live Logger viewing and Follow mode while recording;
- **PR #258 / SHIM-9 slice 1** — strict read-only HTTP inspector for `/api/v1/inis`, `/api/v1/objects` and `/api/v1/triggerlog`;
- **PR #259** — same-origin Vite development proxy for testing a real Windows `ts_shim` without first embedding EpicScope into the shim package.

The working data path is now:

```text
ECU
  ↓
ts_shim
  ↓ WebSocket /telemetry
ShimTelemetryClient
  ↓
ShimLiveSession / ShimCaptureSession
  ↓
ShimLiveNumericChannelDataSource
  ↓
Logger / Analyzer / Histogram
```

The recorded MLG path remains intact and separate. Connecting to a shim does not silently replace an already loaded recorded log.

## Live Logger behavior

Current live workflow:

```text
Connect Shim… → choose channels → Record → View Live → Follow / inspect history → Stop
```

Current post-capture workflow:

```text
Connect Shim… → Record → Stop → Open Capture → Logger / Analyzer / Histogram
```

Important behavior:

- selected-channel capture is currently the supported first-stage mode;
- one stream is used, bounded by the shim-advertised `maxChannelsPerStream`;
- `series` mode is used for logging;
- `rateHz` is taken from the shim `welcome.limits.maxRateHz`, never assumed;
- delivery is batched conservatively while retaining series samples;
- reconnect/lifecycle changes invalidate old streams and create explicit capture segments;
- unrelated `clockId` timestamp origins are never subtracted directly;
- delivery-loss and rich per-sample quality are preserved as provenance;
- Analyzer/Histogram operate through normal normalized-source reads, not a separate shim-only analysis stack;
- live Logger refresh appends newly arrived samples; Follow keeps a rolling ~10 s latest-data viewport;
- turning Follow off keeps incoming recording active while allowing historical inspection;
- stopping a live-viewed session turns it into a retained `CAPTURE · SHIM` source.

## Rich quality model

Shim telemetry quality is preserved additively instead of being collapsed permanently into binary validity:

- `0` — valid;
- `1` — invalid;
- `2` — stale;
- `3` — unavailable;
- `4` — reserved/lost compatibility value (the current server reports queue loss separately rather than emitting this quality value).

Existing MLG consumers continue to use the established `validity` projection. Shim/live ranges may additionally expose a `quality` byte array.

## HTTP enrichment status

The current HTTP integration is deliberately read-only.

EpicScope can inspect:

- `GET /api/v1/inis`;
- `GET /api/v1/objects`;
- `GET /api/v1/triggerlog`.

The inspector reports HTTP status, timing, content type, JSON parse state, transport errors and a bounded payload preview. It intentionally does not invent response schemas that have not yet been observed from a real running shim.

Next typed HTTP work depends on real runtime responses from the installed shim. Once captured, these may be promoted into proper read-only features for:

- matching/staged INI inspection;
- live tune-object lookup for Analyzer/Table context;
- shared trigger/composite-log data for Trigger / Sync analysis.

No tune writes, burns, firmware flashing, sensor mocks, ECU commands or CAN injection are part of the current EpicScope shim integration.

## Development proxy

The browser shim contract requires same-origin WebSocket access. Until EpicScope is served directly by the shim, development/testing uses the Vite proxy described in [`TS_SHIM_DEVELOPMENT_PROXY.md`](TS_SHIM_DEVELOPMENT_PROXY.md).

Development layout:

```text
Browser → http://localhost:5173
           ├─ EpicScope dev assets
           ├─ /telemetry  → proxy → http://127.0.0.1:29002/telemetry
           └─ /api/v1/*   → proxy → http://127.0.0.1:29002/api/v1/*
```

Final intended deployment:

```text
Browser → shim-host:29002
           ├─ EpicScope static files
           ├─ /telemetry
           └─ /api/v1/*
```

EpicScope addresses these routes relative to the current origin, so moving from the development proxy to shim-hosted deployment should not require a networking rewrite.

## Current runtime-test position

The next work is not another speculative protocol layer. It is real Windows runtime validation against the current native `ts_shim`.

Expected test order:

1. run `ts_shim` and verify TCP port `29002` is listening;
2. run the current EpicScope `main` using `npm.cmd run dev:shim` on Windows;
3. open `http://localhost:5173/` in Brave/Chromium;
4. verify **Load Data → Connect Shim…** is present;
5. connect and inspect `welcome`/schema/lifecycle behavior;
6. select channels, Record and View Live;
7. test Follow, Stop and Open Capture;
8. open **Shim HTTP…** and capture real responses for INIs, Objects and Trigger Log;
9. use those responses to define the next typed read-only HTTP slice.

If **Connect Shim…** is absent, the local ZIP/source copy is stale. Download a fresh current `main` ZIP before continuing.

## Scope still intentionally deferred

Not yet implemented/approved as the next automatic step:

- multi-stream full-schema capture/joining;
- automatic logging of every schema channel;
- shim-host packaging/static-file embedding;
- typed tune-object/INI/trigger-log HTTP integration before runtime responses are observed;
- any ECU/tune write path.
