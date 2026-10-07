# EpicScope ts_shim Integration Design

## Status

**Design approved for implementation planning. No live-shim code is implemented by this document.**

This document defines how EpicScope should integrate with the epicEFI `ts_shim` telemetry and HTTP surfaces without disturbing the established recorded-MLG path.

The wire-contract authority for the first implementation is the developer-supplied **Shim WebSocket API (port 29002)** document written against `epicEFI/shim` commit `ae5e4c8a82986538a8ed681b8099e9eb070f0668` (merge of PR #20), with `telemetry_server.cpp` as the final protocol authority when shorter shim documents disagree.

## Product goal

EpicScope should become a first-class logger/analyzer client for `ts_shim`, while remaining the same EpicScope application used for recorded MLG analysis.

The intended relationship is:

```text
ECU
 ↓
ts_shim
 ├─ TunerStudio relay / ECU ownership
 ├─ shared output-channel snapshot
 ├─ telemetry WebSocket
 └─ HTTP API
      ↓
   EpicScope
   ├─ Logger
   ├─ Analyzer
   └─ Histogram
```

EpicScope must **not** open another ECU polling path when the shim already owns the ECU connection. Live telemetry should consume the shim's shared snapshot.

## Core architectural decision

EpicScope should support two source families through the same normalized analysis model:

```text
Recorded MLG source ─┐
                     ├─→ normalized EpicScope channel/sample model → Logger / Analyzer / Histogram
Shim live source ────┘
```

The existing MLG path remains authoritative for recorded MLG sessions. The new shim path is an additional source adapter, not a replacement parser and not a second analyzer stack.

### Distribution model

Keep one EpicScope codebase with two normal deployments:

1. **GitHub Pages / standalone Web**
   - recorded MLG analysis;
   - manual INI/MSQ enrichment;
   - no requirement for a shim.

2. **Shim-hosted EpicScope**
   - same recorded analysis features;
   - same-origin live connection to `ws://<host>:29002/telemetry`;
   - optional use of the shim HTTP API later.

The live browser build should be served from the shim host rather than relying on the GitHub Pages origin. The shim contract rejects browser cross-site WebSocket upgrades when `Origin` does not match the request `Host`; same-origin serving avoids changing that security boundary.

## Integration boundaries

### EpicScope owns

- live-session UI and state;
- telemetry protocol client state machine;
- telemetry binary decoding;
- conversion of shim schema channels into EpicScope `ChannelDefinition` entries;
- live sample accumulation;
- capture/replay semantics inside EpicScope;
- timeline markers for reconnect/schema/lifecycle events;
- normalization of shim quality state into EpicScope validity/provenance;
- Logger / Analyzer / Histogram use of the resulting source;
- live recording presets and selected-channel/full-schema capture policy.

### ts_shim owns

- the ECU connection;
- polling the output-channel block;
- signature matching and matched-INI selection;
- output-channel decoding/scaling;
- live channel registry;
- acquisition timestamps/counters;
- WebSocket stream rate limits and queueing;
- lifecycle notification;
- tune/INI/trigger-log HTTP APIs;
- LAN trust boundary and same-origin enforcement.

EpicScope must not duplicate those responsibilities.

## Protocol contract EpicScope must obey

### Connection

Default endpoint:

```text
ws://<host>:29002/telemetry
```

Protocol version is currently `1`.

Expected control flow:

```text
server  helloRequired
client  hello
server  welcome
server  schema        (when ECU link/schema are available)
server  lifecycle
client  subscribe
server  streamDefinition
server  binary telemetry frames
```

`hello` must be sent before other JSON requests.

### Welcome fields that must be retained

EpicScope must retain at least:

- `clockId`;
- `generation`;
- `ecu.signature`;
- `simulator`;
- `schema.id`;
- `schema.iniHash`;
- `capabilities`;
- `limits.maxStreams`;
- `limits.maxChannelsPerStream`;
- `limits.maxRateHz`;
- `limits.maxDeliveryHz`.

Do not hard-code the usual 50 Hz acquisition ceiling. Read `limits.maxRateHz` from `welcome`.

### Lifecycle

Every new `lifecycle` message clears all streams on that connection. EpicScope must treat these as stream-invalidating events.

On lifecycle change:

1. drop local stream definitions;
2. stop accepting binary frames for those stream IDs;
3. update connection/schema state;
4. if state is `up` and `schemaCompatible` is true, rebuild subscriptions;
5. write a visible timeline/session marker describing the transition.

A schema change while the ECU remains connected is treated the same way as a firmware/link generation change.

### Schema

The schema is the live channel registry for the matched INI.

For each published channel EpicScope may receive:

- `id` / `name`;
- `unit`;
- numeric type;
- `enumValues` for bit/enum channels;
- `displayHints` including gauge names, ranges, precision and category;
- gauge-page hints;
- indicator hints.

The logger does not need gauge pages/indicator presets for initial integration, but the metadata should not be discarded if the normalized channel model can retain it safely later.

Important constraints:

- channel names are exact INI output-channel names;
- there is no partial registry;
- skipped arrays/strings/expressions/unsupported conditional definitions are absent, not hidden;
- `decodable: false` means there is no usable matched INI and subscriptions must not proceed.

### Subscription

Initial live logging uses `mode: "series"`.

EpicScope must always send explicit legal values for:

- `rateHz`;
- `deliveryHz`.

Do not omit `rateHz`: the server's omitted default is 60 and is rejected by a normal 50 Hz shim.

For a normal full-rate logging stream:

```text
rateHz = welcome.limits.maxRateHz
```

A lower `deliveryHz` may be used so samples arrive in batches while preserving every copied series sample that remains in the shim queue.

Example target for a 50 Hz shim:

```json
{
  "type": "subscribe",
  "channels": ["RPMValue", "coolant", "VBatt"],
  "mode": "series",
  "rateHz": 50,
  "deliveryHz": 10
}
```

### Stream identity

Binary frames are accepted only when both match the active subscription:

- `streamId`;
- `generation`.

Ignore stale/unknown stream IDs and frames from an older generation.

### Binary telemetry

Encoding is `epicefi-f64-v1`.

Every integer and Float64 is big-endian.

Frame header authority:

- magic `ETLM`;
- binary version 1;
- flags;
- stream ID;
- generation;
- delivery sequence;
- sample count;
- channel count;
- queue delivery-loss count.

Each sample carries:

- acquisition sequence;
- monotonic receive-completion timestamp in nanoseconds;
- first-sample queue-loss count;
- Float64 values in `streamDefinition.channels` order;
- one quality byte per channel.

EpicScope must validate exact frame length, supported flags/version, channel count and stream/generation before accepting values.

### Timestamps

Shim timestamps are:

- monotonic host timestamps;
- not Unix time;
- not ECU time;
- scoped by `clockId`.

For one connection/capture segment, EpicScope should normalize the first accepted timestamp to elapsed time zero:

```text
elapsedMs = (timestampNs - segmentStartTimestampNs) / 1_000_000
```

Do not subtract timestamps belonging to different `clockId` values.

On reconnect/new clock origin, create a new capture segment and an explicit timeline marker/gap boundary.

### Quality

Shim quality codes are richer than current EpicScope binary validity:

| Code | Shim meaning | Initial EpicScope treatment |
|---:|---|---|
| 0 | valid | usable numeric sample |
| 1 | invalid | exclude from valid analysis |
| 2 | stale | preserve as stale provenance; exclude from control/quality-sensitive analysis by default |
| 3 | unavailable | preserve as unavailable provenance; exclude from valid analysis |
| 4 | lost | reserved/documented elsewhere; current server does not emit it |

The current `NumericChannelRange.validity` remains usable as the compatibility projection (`1` only for valid samples), but live integration should add an optional richer quality/provenance representation rather than permanently collapsing stale and unavailable into one generic invalid state.

A proposed normalized addition is:

```ts
readonly quality?: Uint8Array
```

with stable EpicScope meanings defined in `core/log-model/` before the shim adapter depends on them.

This change must be additive so existing MLG consumers continue to work unchanged.

## Proposed source architecture

### Existing authority

`NumericChannelDataSource` is the neutral consumer boundary for channel ranges. The shim should integrate behind that boundary rather than teaching graph/analyzer code about WebSockets.

### Proposed shim modules

Initial Web ownership:

```text
apps/web/src/adapters/shim/
  shim-telemetry-client.ts
  shim-protocol.ts
  shim-binary-decoder.ts
  shim-schema-adapter.ts
  shim-live-data-source.ts
  shim-capture-session.ts
```

Responsibilities:

#### `shim-protocol.ts`

- protocol JSON types;
- constants/version/limits helpers;
- stream/lifecycle/schema types;
- no DOM/UI behavior.

#### `shim-binary-decoder.ts`

- `epicefi-f64-v1` parsing;
- bounds/exact-length validation;
- safe 64-bit timestamp handling without converting the full nanosecond integer through an imprecise JS integer first;
- immutable decoded frame/sample output suitable for tests.

#### `shim-telemetry-client.ts`

- WebSocket lifecycle;
- hello/welcome/schema/lifecycle state machine;
- request IDs;
- subscribe/unsubscribe;
- reconnect backoff;
- stream-definition ownership;
- emits decoded protocol events, not Logger UI changes.

The reconnect ladder should follow the shim dashboard behavior: back off and cap around 15 seconds, resetting after a healthy welcome. A close code 1013 is client-quota pressure and must not trigger an immediate reconnect loop.

#### `shim-schema-adapter.ts`

- maps shim registry entries to EpicScope `ChannelDefinition`;
- preserves exact source/output-channel names;
- maps units/category/precision where available;
- maps enum/bitfield semantics only where the normalized model supports them safely.

#### `shim-live-data-source.ts`

- implements the normalized numeric source surface used by Logger/Analyzer/Histogram;
- exposes accumulated bounded ranges by channel;
- projects rich shim quality to existing validity while retaining optional quality detail;
- does not own connection/reconnect UI.

#### `shim-capture-session.ts`

- receives series samples;
- stores ordered capture segments;
- joins samples/streams by acquisition sequence when multi-stream capture is enabled;
- produces timeline markers and source metadata;
- defines start/stop/freeze semantics;
- owns delivery-loss/gap counters as capture provenance.

## Capture modes

Implementation should be staged.

### Stage A — selected/active channels

One stream, up to the server's `maxChannelsPerStream`.

Use for the first real-car implementation because it avoids cross-stream alignment complexity.

Possible presets:

- Active graph channels;
- Idle diagnostics;
- Boost;
- AE / MAP Predict;
- Trigger / Sync runtime channels;
- Custom selected set.

### Stage B — explicit logging set

User selects a persistent logging preset independent of currently visible graph traces.

Still prefer one stream while the selection is within the server limit.

### Stage C — full-schema capture

Split registry channels across multiple streams, each at the negotiated rate.

Because each sample contains the shim acquisition sequence, EpicScope can join stream fragments by:

```text
(generation, acquisitionSequence)
```

The implementation must not assume that separate streams deliver every acquisition at exactly the same wall-clock instant. Missing stream fragments must remain explicit rather than fabricating values.

The connection limit is 16 streams and the normal channel limit is 256 per stream, so the protocol has room for large INI registries. The actual full-schema policy should still remain bounded by memory/performance testing.

## Live source/session model

A live capture is not just an endlessly growing array. Define explicit capture/session state:

```text
Disconnected
Connecting
WaitingForSchema
Ready
Recording
Paused/Stopped
Reconnecting
IncompatibleSchema
Error
```

A capture contains one or more connection segments:

```text
Capture
 ├─ Segment 1
 │   ├─ clockId A
 │   ├─ generation 4
 │   └─ samples
 ├─ disconnect marker/gap
 └─ Segment 2
     ├─ clockId B or new generation
     └─ samples
```

For initial implementation, continuing through a reconnect is preferred to silently ending the user's log, provided the segment/gap is clearly represented.

## Logger UI design

### Source context

The current `RECORDED` context becomes source-aware.

Proposed states:

```text
RECORDED
LIVE · SHIM
LIVE · SHIM · RECORDING
LIVE · SHIM · RECONNECTING
```

### Load Data / Connect behavior

Standalone/GitHub Pages build:

- Open Log…
- Load INI…
- Load MSQ…
- optional future "Connect to Shim…" only if a supported same-origin/proxy deployment exists.

Shim-hosted build:

- detect same-origin shim capability;
- offer or automatically establish the telemetry connection;
- retain normal Open Log… behavior.

Do not silently discard a currently loaded recorded session when a shim appears.

### Live status information

At minimum show:

- connection state;
- ECU up/down;
- firmware signature summary;
- simulator flag;
- schema compatible/incompatible;
- acquisition rate target;
- active stream/channel counts;
- delivery-loss count;
- stale/invalid sample health.

Do not overwhelm the primary header. Detailed diagnostics belong in the existing diagnostics/report surfaces or a contextual live-source panel.

### Recording controls

Initial minimum:

- Start recording;
- Stop recording;
- logging-set selector;
- rate display (negotiated, not assumed);
- clear indication whether a live connection is merely observing or actively accumulating a capture.

Graphing current live samples and recording them are separate concepts; the UI should not imply that hiding a trace necessarily stops its configured logging preset.

## Analyzer and Histogram behavior

Analyzer/Histogram must consume the same normalized source contracts rather than separate live-only APIs.

Initial safe behavior:

- allow analysis of accumulated samples while recording;
- queries should operate on a stable sample-count snapshot so a calculation does not change underneath itself;
- new incoming samples become available on the next analysis run/refresh;
- saved ranges and evidence navigation reference capture-relative time/sample identity.

A later optimization may freeze a lightweight view/snapshot rather than copy full arrays.

## Channel catalog behavior

For a live shim source:

- shim schema is authoritative for available runtime channels;
- exact shim/INI channel names become `sourceName`;
- manual INI loading is not required to decode live telemetry;
- no EpicScope fallback should pretend absent schema channels exist.

For recorded MLG:

- current INI↔MLG binding behavior remains unchanged.

The two modes should converge at normalized channel identity, not by forcing shim telemetry through the MLG parser/binding path.

## Tune and HTTP integration — later stage

The telemetry WebSocket is read-only. Keep the first EpicScope shim integration read-only as well.

The same shim process exposes HTTP families that may later enrich EpicScope:

- `/api/v1/inis` — matching/staged INI files;
- `/api/v1/objects` — live tune objects;
- `/api/v1/tunes` — tune snapshot handling;
- `/api/v1/triggerlog` — shared composite/tooth logging;
- other system/firmware/Lua/mocking routes.

Initial EpicScope integration should **not** add tune writes, burns, firmware flashing, mocks, ECU commands or CAN injection.

Potential read-only follow-on:

1. retrieve live tune objects for Analyzer/Table context;
2. use shim INI identity instead of manual INI selection;
3. read shared trigger-log data through HTTP;
4. explicitly design write safety separately if tune editing is ever requested.

## Trigger/Sync integration

Do not consume the ECU's draining composite-logger TCP command directly from EpicScope.

The shim HTTP `/api/v1/triggerlog` surface is the shared-reader route and is the appropriate future source for Trigger/Sync-specific capture.

Normal scalar trigger/sync status output channels that already appear in `schema.channels` remain ordinary telemetry channels.

## Security and deployment

The shim telemetry/HTTP service has no authentication and treats the LAN as the trust boundary.

EpicScope integration must therefore:

- assume local/trusted vehicle/workshop LAN deployment;
- not recommend public Internet exposure of port 29002;
- preserve same-origin browser rules rather than bypassing them casually;
- keep current local-first privacy rules;
- make any later HTTP write capability explicit and separately approved.

## Persistence/export

Initial live integration should not invent a new public file format prematurely.

First milestone:

- live capture exists in session memory;
- normal EpicScope analysis operates on it;
- capture can be stopped/frozen safely.

Before long captures become production-useful, define one of:

- export to an established compatible log format if semantics can be preserved correctly; or
- a versioned EpicScope capture artifact with explicit channel schema, quality, segment, acquisition and provenance fields.

That decision is separate from the WebSocket client and should be made only after real live captures validate the model.

## Performance/memory requirements

Live capture introduces different pressure than large recorded files.

Initial implementation must measure:

- sample ingestion CPU;
- render responsiveness at 20/50 Hz;
- memory growth per channel/minute;
- multi-channel batch decode cost;
- analysis while recording;
- reconnect behavior;
- delivery loss under UI load.

Do not allow an unbounded all-channel capture to grow forever in browser RAM without an explicit retention/export strategy.

For the first implementation, selected-channel capture is the deliberate constraint.

## Diagnostics / provenance

The bug/performance report should eventually include a `[Shim live]` section with:

- endpoint origin (host may be redacted from export if privacy rules require it);
- protocol version;
- connection state;
- clock ID presence/change count;
- generation;
- schema ID/INI hash;
- ECU signature;
- simulator flag;
- max/current rates;
- active streams/channels;
- received frame/sample counts;
- delivery loss;
- acquisition-sequence gaps;
- valid/invalid/stale/unavailable counts;
- reconnect count and last close code/reason.

This is required for real-car debugging; telemetry bugs must be distinguishable from ECU/shim link loss and from rendering/analysis bugs.

## Implementation sequence

### SHIM-1 — protocol decoder + tests

Goal: prove wire compatibility without UI integration.

Implement:

- JSON protocol types;
- binary frame decoder;
- exact bounds/version/flags/length checks;
- safe timestamp conversion;
- quality decoding;
- synthetic frame tests.

Completion:

- known-good frames decode exactly;
- malformed/truncated/wrong-version frames reject explicitly;
- no WebSocket/Logger changes yet.

### SHIM-2 — telemetry client + schema adapter

Implement:

- hello/welcome/schema/lifecycle state machine;
- subscribe/unsubscribe;
- negotiated-rate validation;
- stream/generation filtering;
- reconnect/backoff;
- schema → `ChannelDefinition` mapping.

Completion:

- simulator or controlled shim session can enumerate channels and receive decoded series samples;
- no Analyzer changes.

### SHIM-3 — selected-channel live data source

Implement:

- bounded live capture buffer;
- one series stream;
- optional richer quality representation;
- normalized `NumericChannelDataSource` access;
- capture-relative time.

Completion:

- existing graph viewport can display selected live channels through normalized contracts;
- recorded MLG regression suite remains green.

### SHIM-4 — Logger live UI

Implement:

- Live source state;
- connection/record controls;
- rate/loss/quality health;
- lifecycle markers;
- active/custom logging-set selection.

Completion:

- real user can connect, record, stop and inspect a live selected-channel session.

### SHIM-5 — Analyzer/Histogram use of capture

Implement:

- stable analysis snapshots while recording;
- ranges/markers/navigation for live captures;
- Analyzer/Histogram source compatibility.

Completion:

- the same Idle/Boost/etc calculations run against a stopped or growing shim capture without live-specific analyzer forks.

### SHIM-6 — reconnect/session hardening

Implement:

- reconnect segment/gap handling;
- auto-resubscribe after valid lifecycle/schema;
- explicit incompatible-schema state;
- report diagnostics.

### SHIM-7 — full-schema/multi-stream capture

Implement only after selected-channel real-car validation.

- split channels across streams;
- join by generation + acquisition sequence;
- preserve missing fragments;
- benchmark memory/CPU/loss.

### SHIM-8 — shim-hosted distribution

Coordinate with `epicEFI/shim` so a built EpicScope static bundle can be packaged/served by the shim under a stable route.

EpicScope remains maintained in its own repository; the shim should consume a release/build artifact rather than duplicating the source tree.

### SHIM-9 — optional read-only HTTP enrichment

After telemetry is stable:

- live tune objects;
- matching INI inspection;
- trigger-log integration.

Writes remain out of scope until separately approved.

## Explicit non-goals for first implementation

- no tune writes/burns;
- no firmware flashing;
- no Lua command execution;
- no sensor mocking;
- no CAN injection;
- no public-Internet shim access;
- no hand-rolled TunerStudio TCP session when HTTP/WebSocket already exposes the required data;
- no replacement/removal of recorded MLG support;
- no full-schema capture before one-stream selected-channel capture is proven.

## Open questions to resolve with shim developer

These do not block SHIM-1 protocol-decoder work, but should be settled before packaging/live release:

1. Preferred stable URL for bundled EpicScope (`/epicscope/`, dashboard entry, or another route).
2. Preferred build/release handoff between `EpicEFI-EpicScope` and `epicEFI/shim`.
3. Whether shim wants to advertise available bundled applications in an existing UI/navigation surface.
4. Whether there is an intended browser discovery mechanism for finding a local shim when EpicScope is not already served by it.
5. Whether `schema` metadata is expected to grow new fields that EpicScope should preserve generically.
6. Whether an official test fixture/captured WebSocket session can be provided for protocol regression testing in addition to synthetic frames.
7. Whether long-term live logging is expected to remain browser-memory based, or whether shim-side/file-side recording support is planned and should be preferred for very long sessions.

## Acceptance criteria for the integration direction

The integration is considered architecturally successful when:

- EpicScope can be served by the shim and connect same-origin;
- one shim poll continues to serve TunerStudio and EpicScope simultaneously;
- live schema drives the runtime channel catalog;
- selected-channel `series` logging works at the negotiated shim rate;
- valid/invalid/stale/unavailable semantics remain distinguishable;
- lifecycle/schema changes do not silently corrupt an active capture;
- live samples flow through normalized EpicScope data-source contracts;
- Logger/Analyzer/Histogram do not contain duplicate shim-specific analysis logic;
- recorded MLG behavior remains unchanged;
- no write-capable shim API is added by accident during telemetry integration.
