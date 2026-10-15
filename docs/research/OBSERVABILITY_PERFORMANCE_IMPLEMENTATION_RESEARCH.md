# EpicScope observability performance implementation research

Date: 2026-10-15

Status: **Design research / pre-implementation evidence**

Current implementation authority remains `../OBSERVABILITY.md`. This note preserves the codebase-level performance/efficiency research that refined that architecture before implementation begins.

## Purpose

The observability system is intended to diagnose freezes, event loops, stale async work, persistence failures, resource growth and performance regressions. It must therefore remain cheap enough that it does not create the CPU, allocation, GC, storage or rendering problems it is trying to diagnose.

The central performance requirement is:

> **The observability hot path must be cheaper than the work it observes, predictable under event storms, and bounded in memory, CPU and persistence activity.**

The system should degrade by coalescing/loss of low-value detail under pressure rather than by slowing the product or recursively amplifying failure.

## Current codebase findings

### `app-shell.ts` is the current integration choke point

Current Web diagnostics/reporting are assembled centrally in `apps/web/src/app/app-shell.ts`:

- `createPerformanceDiagnostics()` is created there;
- a separate `runtimeErrors` array is maintained there;
- `window.error` and `unhandledrejection` are captured there;
- Logger performance callbacks are forwarded there;
- Logger runtime snapshot, runtime errors and Performance report are stitched together for the Bug Report there;
- Parser/Diagnostics/Performance/Report controls are mounted as separate footer surfaces.

This makes app-shell the practical initial composition root for observability, but it should not remain the long-term owner of subsystem evidence. Producers should publish from their natural owners/adapters.

### Existing performance measurements are valuable and should not be recomputed

Current types such as:

- `LoadPerformanceRun`;
- `IniLoadPerformanceRun`;
- `ChannelBindingPerformanceRun`;
- `WorkspaceRestorePerformanceRun`;
- `ChannelPerformanceRun`;
- retained-memory/cache diagnostics;

already contain useful detailed evidence. The first migration should adapt completed measurements into observability rather than redesign every timing source.

### Current reporting reaches into live/global diagnostic state

`performance-diagnostics-report.ts` receives stored performance arrays but also queries latest global/runtime diagnostics such as Blob-source and channel-decode measurements during report generation.

The replacement model should record relevant measurements at meaningful operation boundaries so reports become deterministic projections over captured evidence rather than late interrogation of whatever state happens to be current.

### Logger already exposes compact owner-generated snapshots

`LoggerRuntimeDiagnosticSnapshot` is a useful model for future observability snapshots: owner-generated counts/identities/resource estimates rather than DOM scraping or full-state serialization.

### Current runtime-error queue is intentionally tiny, but not a scalable recorder model

The existing `runtimeErrors` array uses `push()` plus `shift()` and is capped at 50 entries. That is acceptable at its current size, but a 20k+ observability recorder should not use moving arrays as its primary retention structure.

### Persistence patterns already exist

The repository already has:

- versioned artifact schema/version validation under `core/persistence/versioned-artifact.ts`;
- synchronous small `localStorage` adapters for workspace/catalog state;
- OPFS/file-style storage for large MLG/cache artifacts.

Observability history is structured/session-oriented rather than large binary file data. Native IndexedDB is the most natural Web persistence candidate while preserving the current no-extra-runtime-dependency posture.

## Recommended recorder representation

### Do not allocate a full JavaScript object for every common event

A normal object-per-record API is convenient but expensive for a recorder expected to hold tens of thousands of records and survive event storms.

Prefer a packed/hybrid ring representation for common fields:

```text
sequence[]
monotonicTime[]
code[]
component[]
origin[]
operationId[]
parentOperationId[]
flags[]
duration[]
payloadIndex[]
```

Where appropriate, use typed arrays such as:

```text
Uint32Array
Uint16Array
Uint8Array
Float64Array
```

Variable payloads remain separate and are allocated only when needed.

Benefits:

- fixed bounded memory;
- O(1) insertion;
- no array shifting;
- reduced GC pressure;
- lower repeated-string overhead;
- improved locality/predictability;
- cheap overwrite of oldest detail records.

Readable object materialization should happen only for query/UI/export paths.

## Timestamp strategy

Avoid storing both `Date.now()` and `performance.now()` on every record.

At session start capture:

```text
sessionWallStart
sessionMonotonicStart
```

Each record then stores only monotonic time. Wall time is reconstructed when formatting:

```text
wallTime = sessionWallStart + (recordMonotonic - sessionMonotonicStart)
```

This reduces hot-path work and per-record storage while preserving ordering and human timestamps.

## Stable numeric identities

Common record dimensions should use compact stable numeric IDs internally:

```text
record code
subsystem
component
origin
severity
outcome
```

Human-readable strings remain in one mapping used by UI/report/export.

Examples of stable machine names mapped from numeric codes:

```text
app.session.started
runtime.error
logger.workspace.restore.started
logger.workspace.restore.completed
logger.channel.activate.completed
storage.write.failed
async.completion.stale
```

Do not repeatedly store the same long strings in every hot-path record.

## Dual-ring retention

Prefer two physical bounded rings rather than one ring that must search/evict by priority.

### Critical ring

Reserved for evidence that should survive detail storms:

- errors/unhandled rejections;
- anomalies;
- session/checkpoint records;
- operation failures/stale completions;
- persistence failures;
- recorder pressure/internal-failure summaries.

### Detail ring

Used for ordinary/short-lived history:

- render/rebuild boundaries;
- observer callbacks;
- state transitions;
- normal operation events;
- performance detail.

Both share one global monotonically increasing sequence number. Query/export merges them by sequence.

This avoids expensive middle-of-buffer priority eviction and ensures a render storm cannot erase the error/anomaly that matters.

## Coalesce before insertion

Repeated high-frequency detail must be recognized before it enters the main ring.

For coalescible event types, keep a tiny active signature state:

```text
recordCode
componentId
semanticFingerprint
firstSequence
firstTime
lastTime
count
```

Repeated matching events within a short window increment the counter instead of allocating/inserting another full record.

When the run ends or crosses a reporting threshold, emit one summary such as:

```text
observability.records-coalesced
component=ve-analyzer
recordCode=render.completed
count=487
windowMs=320
```

Under a pathological loop, the recorder should become cheaper per iteration rather than more expensive.

## Operation API: numeric tokens internally

The first conceptual design used object-heavy operation handles. For hot paths, prefer a numeric operation token internally:

```ts
const op = recorder.beginOperation(ObsCode.LoggerWorkspaceRestore, parentOp);
// ...
recorder.endOperation(op, ObsOutcome.Success, durationMs);
```

The token can be propagated through promises/events/workers as a primitive integer.

A convenience wrapper API may exist for low-frequency callers, but the recorder core should not require allocating closures/classes for every operation.

Strict terminal semantics still apply:

```text
success
failure
cancelled
superseded
stale
```

Operation state can be tracked in a bounded open-operation map keyed by numeric ID.

## Optional typed metric payloads

Do not flatten large existing performance structs into generic metadata on every record.

Use a compact operation header plus an optional typed payload reference:

```text
operation header
    code
    duration
    outcome
    basic counts

payload pool
    WorkspaceRestoreMetrics
    LoadMetrics
    ChannelActivationMetrics
```

This retains current detailed instrumentation without bloating every generic record.

## Owner-provided revisions/fingerprints only

The recorder must never serialize/hash arbitrary controller/domain objects on insertion.

Owners may supply small revision tuples/fingerprints such as:

```text
sourceRevision
tuneRevision
qualificationRevision
resultRevision
```

or a precomputed compact integer fingerprint.

No hot-path `JSON.stringify(state)` or full-object hashing is acceptable.

## Snapshot strategy

Snapshots should be boundary/event driven, not timer-driven broad polling.

Good boundaries include:

- source load complete;
- workspace restore complete;
- Analyzer/domain entry complete;
- analysis complete;
- persistence transaction complete;
- navigation becomes quiescent;
- explicit low-frequency session checkpoint.

Avoid periodic whole-DOM/controller/cache inspection.

Where resource counts matter, owners should expose/maintain counters incrementally when practical instead of forcing observability to discover them by scanning.

## Streaming anomaly detection complexity

Hot anomaly rules should be O(1) amortized per record and use small bounded state maps.

Examples:

```text
last signature -> count/window
operationId -> start/terminal state
component -> recent render count
storage operation -> pending/result state
```

Do not scan the 20k+ ring for every new event.

More expensive work should be deferred to:

- Diagnostics open;
- explicit report/export;
- browser idle work;
- later Worker-based analysis if profiling justifies it.

Examples of deferred work:

- causal cycle reconstruction;
- long-term resource trends;
- complex cross-component correlation;
- workload-relative regression analysis.

## Persistence strategy

### IndexedDB over localStorage/OPFS for session history

For the Web reference implementation, native IndexedDB is the preferred candidate because observability is structured/session-oriented data.

Do not add a runtime dependency solely for IndexedDB unless native API complexity becomes a demonstrated maintenance problem.

### Never mirror the RAM ring one record at a time

The current-session in-memory recorder remains authoritative.

Persistence should batch selected evidence:

```text
session summary
latest bounded tail
new critical records
anomaly/error context windows
```

Write on low-frequency timer/lifecycle/anomaly/workflow boundaries, not on every `record()` call.

### Chunk writes

If raw records are persisted, store packed chunks rather than one IndexedDB row per record.

Candidate structure:

```text
sessions
    sessionId -> summary

chunks
    [sessionId, chunkId] -> packed records

anomalyWindows
    [sessionId, anomalyId] -> packed context
```

A few hundred records per chunk is a sensible starting range to benchmark. Exact size is not yet fixed.

An even simpler first implementation may persist only session summary + final tail + pinned anomaly/error windows rather than the entire current-session ring.

## Byte accounting

Do not `JSON.stringify(record)` merely to estimate retention size on every insertion.

Use cheap estimated cost:

```text
fixed packed header bytes
+ typed payload estimate
+ actual lengths only for variable strings/buffers
```

Exact serialized byte size is checked at persistence/export boundaries.

Retention remains bounded by byte estimate, record count and age.

## Performance baselines

Do not retain unbounded raw timing histories.

For recurring workload buckets, maintain compact online summaries such as:

```text
count
mean
variance
min
max
bounded recent sample window
```

Use an online mean/variance algorithm (for example Welford-style accumulation) so updates remain O(1).

If percentile behavior later becomes important, use a bounded estimator or small recent sample window rather than an ever-growing array.

Workload identity must include enough coarse context to avoid comparing unlike runs:

```text
operation code
build/schema family
source type
record-count bucket
channel-count bucket
cache/cold-warm state
active domain where material
```

## Diagnostics UI performance

The recorder must not push one UI update per record.

When Diagnostics is closed:

```text
no diagnostic DOM rendering work
```

When open, update on a bounded cadence (for example a few times per second) or on explicit user interaction rather than event-by-event.

Causal trees, filtered timelines and report structures should be built lazily/on demand.

Avoid maintaining a live DOM representation of the entire ring.

Small session indices may be maintained for high-value lookups:

```text
latest error sequence
latest anomaly sequence
latest critical sequence
open operations
latest operation by code
session counters
```

Do not build a general-purpose secondary database/index unless profiling demonstrates a need.

## Existing code migration order optimized for risk/performance

### 1. Runtime error capture

Replace the current 50-entry app-shell runtime error array with the critical observability ring and a compatibility projection for the existing Bug Report.

This exercises:

- session timing;
- stable codes;
- critical retention;
- report projection;
- bounded recorder behavior;

without touching Logger/Analyzer hot paths.

### 2. Lifecycle/view events

Add low-frequency app/session/mode/view records from app-shell and current owners.

### 3. Existing completed Logger performance callbacks

Adapt `onChannelPerformance` and `onWorkspaceRestorePerformance` results into typed observability payloads. These measurements have already been calculated, so this adds little hot-path computation.

### 4. Existing load/binding/validation performance objects

Publish completed measurements once at their existing completion boundaries.

### 5. Rebuild Performance report as projection

Only after captured evidence reproduces/improves the old report should the old performance-owned arrays/report path be removed.

### 6. Parser/source-integrity summary bridge

Keep `ParserDiagnostic[]` canonical. Publish correlated summaries/findings only after parsing rather than flooding the recorder with every low-level parser occurrence in the parser hot loop.

### 7. State/render/observer/async detail

Add the potentially higher-frequency instrumentation only after recorder/coalescing overhead has been measured and proven safe.

## Acceptance/performance benchmarks

Every major migration stage should compare an identical workload with observability enabled against the stable baseline/minimal path.

Important workloads include:

- application startup;
- large MLG open/index/validation;
- workspace restore;
- cached and uncached channel activation;
- Analyzer entry;
- VE analysis;
- Result View switching;
- cell evidence open;
- Histogram/Table/Scatter runs where relevant;
- repeated navigation between major modes;
- deliberate synthetic render/observer event storm.

Measure where practical:

```text
wall duration
main-thread CPU/task duration
record insertion cost
record count/coalescing ratio
allocated payload count/bytes
retained recorder bytes
GC/memory behavior
IndexedDB batch duration/bytes
Diagnostics closed vs open overhead
```

The architecture should not claim a universal acceptable percentage before measurement. The practical requirement is that normal interaction impact is difficult to perceive and that heavy/event-storm cases remain bounded/predictable.

## Research conclusion

The recommended implementation is no longer a generic object/event logger. It is a performance-oriented bounded flight recorder with:

1. packed/hybrid dual rings;
2. numeric stable machine IDs;
3. one monotonic timestamp per common record;
4. primitive numeric operation tokens internally;
5. pre-insertion event coalescing;
6. reserved critical retention;
7. optional typed performance payloads;
8. owner-provided revisions/fingerprints only;
9. boundary-driven snapshots;
10. O(1) streaming anomaly state;
11. batched/chunked IndexedDB persistence;
12. lazy Diagnostics rendering/report generation;
13. compact online workload baselines;
14. explicit observability-on/minimal-path benchmarks before deeper high-frequency instrumentation.

These points should guide implementation, but exact typed-array widths, ring capacities, chunk sizes and persistence cadence remain benchmark-driven rather than prematurely fixed.
