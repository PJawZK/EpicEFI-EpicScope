# EpicScope Observability Architecture

## Status

Approved architectural direction. **Required migration stages implemented locally: foundation and stages 2–9.** Runtime, Perf, canonical Parser reporting and high-value owner state/render/async/persistence evidence are integrated. Explicit owner producers borrow existing revisions/generations and preserve domain behavior; no generic controller wrapper or new observer/listener is installed. Initial bounded anomaly rules and batched IndexedDB previous-session recovery are integrated; unified captured Diagnostics/export is installed; parity-gated report/contract cleanup is complete locally. Optional baseline intelligence is not started. Original-recording/target-hardware acceptance remains pending; see HANDOFF.md.

This document defines the target replacement for the currently fragmented runtime diagnostics, performance diagnostics, parser/source-integrity reporting and bug-report assembly paths.

Implementation should begin only from a stable browser-validated Web baseline after the current Analyzer/DOM-ownership/hidden-view/CPU cleanup work has settled. The migration must preserve useful existing measurements while removing redundant collectors and report-only state as each replacement reaches parity.

## Goal

EpicScope needs a broad observability system that can discover and reconstruct failures we have **not already named**.

The system must answer, after a slowdown, freeze, failed load, stale result, persistence failure or inconsistent UI state:

- what happened;
- what user/system action started it;
- which work that action spawned;
- what state changed;
- what did not change even though work repeated;
- which view/controller was active or hidden;
- how long each operation took;
- whether async work completed against obsolete state;
- whether resources grew abnormally;
- whether the previous session ended cleanly or merely lacks a confirmed clean end;
- what anomaly pattern best explains the sequence.

The design is intentionally broader than VE, Analyzer or any current bug.

## Core invariants

> **One authoritative observability record stream. Specialized diagnostics and reports are projections of it.**

> **The recorder behaves like a bounded flight recorder, not a normal debug logger.**

> **Observability must not become a new source of feedback loops, runaway allocation, synchronous I/O or application state authority.**

Do not keep long-lived parallel systems for the same facts.

Existing measurements/probes may remain where they naturally belong, but durable diagnostic history, operation correlation, anomalies and report assembly should converge on the shared observability model.

Observability records evidence about application/domain state; they do not own that state. Source, tune, analysis, controller and generation/revision ownership stays with the subsystem that already owns it.

Instrumentation must be added at existing owners. Do **not** add wrapper stacks around controllers/views merely to observe them.

## Current-state assessment

The repository already contains valuable instrumentation, but ownership is fragmented.

### Keep and migrate

The following are useful and should feed the new system rather than be discarded:

- MLG/INI load timing and stage breakdowns;
- validation timing and source-read/byte counters;
- INI/MLG binding metrics;
- workspace-restore timing;
- channel selection/decode/render timing;
- Blob byte-source/cache diagnostics;
- persistent decoded-column retained-memory probes;
- bound-channel retained-memory probes;
- graph-active range memory estimates;
- parser diagnostics and source-integrity classification;
- Logger runtime-state snapshots;
- browser runtime error and unhandled-rejection capture;
- current application/source/environment context used by bug reports.

These contain useful evidence. Their storage/reporting ownership is what should change.

### Migrate/merge

Current Web components that should become views/adapters over the unified system include:

- `apps/web/src/components/performance-diagnostics.ts`;
- `apps/web/src/components/performance-diagnostics-report.ts`;
- `apps/web/src/components/bug-report-health.ts`;
- `apps/web/src/components/bug-report-formatter.ts`;
- `apps/web/src/components/parser-diagnostics-indicator.ts` where it acts as a report owner rather than a source-integrity UI;
- Logger/app-shell current-session diagnostic assembly.

### Delete after parity

Once replacement paths are validated, remove redundant ownership such as:

- separate in-memory arrays of performance runs owned only by the old performance popover;
- a second standalone runtime-error store used only for bug-report assembly;
- duplicated report text construction for the same measurements;
- bespoke health checks that have moved into generic anomaly rules;
- old formatter/input types that merely stitch together information already present in the observability session.

Do **not** delete underlying parser diagnostics or measurement probes that are still the canonical source of domain evidence. Parser diagnostics remain parser/source-model evidence; observability records their occurrence/summary and correlates them with the session.

## Flight-recorder behavior

The recorder must remain useful precisely when the application is misbehaving. Event storms must make the recorder **cheaper**, not more expensive.

### Priority tiers

Records should have retention/priority semantics so high-value evidence survives pressure.

**Critical evidence** should not be silently discarded under normal bounded operation:

- runtime errors/unhandled rejections;
- operation start/terminal records;
- anomalies;
- session start/checkpoint/end state;
- persistence failures;
- stale/superseded completion evidence;
- recorder/persistence internal failure summaries.

**Normal evidence** includes lifecycle, navigation, state changes, render boundaries and async transitions.

**High-frequency detail** such as repeated render/observer/event-dispatch records may be coalesced once repetition becomes obvious.

Example:

```text
observability.records-coalesced
component=ve-analyzer
name=render.completed
count=487
windowMs=320
firstSequence=18447
lastSequence=18933
```

Coalescing/drop activity is itself observable. Never silently hide that diagnostic pressure occurred.

### Two-tier recording

Use a two-tier model:

**Tier A — always-on core**

- session/lifecycle;
- major operations;
- errors;
- owner-provided revisions/fingerprints;
- persistence outcomes;
- major performance metrics;
- anomalies/checkpoints.

**Tier B — short-lived detailed context**

- render/rebuild boundaries;
- observer callbacks;
- programmatic/user event dispatches;
- detailed async transitions;
- low-frequency resource samples.

Tier B lives in the short current-session ring. When an anomaly/error occurs, bounded context windows around that sequence can be promoted into persisted previous-session evidence.

### Recursion guard / emergency path

Observability must not recursively observe its own recorder/persistence/reporting work.

Examples to prevent:

```text
observability persistence failure
  -> record persistence failure
    -> observability persistence failure
      -> ...
```

Provide an internal recursion/re-entry guard and a tiny emergency failure summary path that does not use the normal recorder/persistence pipeline.

Observability-internal work should normally be excluded from ordinary UI/DOM/storage instrumentation unless explicitly recorded as an internal health event.

## Target model

The system has three data shapes with a common envelope.

### Events

Something happened.

Examples:

- navigation/view activation;
- user input or programmatic control change;
- source/tune/context replacement;
- invalidation;
- render/rebuild;
- observer callback;
- persistence success/failure;
- async start/finish/cancel/failure;
- runtime error;
- parser/source-integrity finding;
- session start/checkpoint/confirmed-normal end.

### Metrics

A measured value attached to an operation/session.

Examples:

- duration;
- bytes/read counts;
- sample/channel counts;
- cache hits/misses;
- DOM-node count;
- retained ranges/bytes;
- worker count;
- queue depth;
- render/rebuild count.

### Snapshots

Occasional compact state summaries, not continuous full-state serialization.

Examples:

- current active view/domain;
- source identity/revision/sample count;
- tune identity/revision;
- selected workspace/table/channel identities;
- visible/hidden controller set;
- current cache/resource summary;
- browser/environment metadata.

## Common record envelope

The exact TypeScript shape may evolve during implementation, but the minimum conceptual fields are:

```text
schemaVersion
sequence
wallTime
monotonicTime
sessionId
recordKind
severity
subsystem
component
name
origin
operationId
parentOperationId
activeView
visibility
sourceIdentity/sourceRevision
tuneIdentity/tuneRevision
stateRevision
semanticFingerprint
durationMs
outcome
reason
metadata
```

### Stable machine identity

`subsystem`, `component`, `name`, anomaly/rule codes and outcomes should use stable machine-readable identifiers. Human wording belongs in UI/report formatters.

Prefer:

```text
analyzer.context.changed
analyzer.render.completed
storage.write.failed
source.load.started
async.completion.stale
observer.callback
```

Do not make anomaly rules depend on English report sentences.

### Origin

Record the causal origin where it materially helps reconstruction:

```text
user
programmatic
observer
async
worker
system
persistence
```

The origin should identify how the transition was triggered, not invent causality beyond what the producer actually knows.

Metadata must stay compact and typed/structured where practical. Do not use the recorder as an unrestricted debug-string dumping ground.

## Operation correlation

User/system actions that spawn work receive an `operationId`. Child work inherits a `parentOperationId`.

A causal chain should be reconstructable, for example:

```text
activate Analyzer
  -> set context
    -> resolve controls
      -> programmatic change
        -> render/rebuild
          -> DOM mutation
            -> observer callback
```

This is more useful than independent counters because it shows causality.

### Explicit operation API

Do not depend on an implicit global "current operation" across browser promises/events/workers. Browser execution does not provide a universal reliable async-local context for this use.

Use explicit operation tokens/handles conceptually like:

```ts
const operation = observability.beginOperation({
  subsystem: 'analyzer',
  component: 've-analyzer',
  name: 'analyzer.run',
});

try {
  const child = operation.child('analyzer.load-traces');
  // ...
  child.succeed();
  operation.succeed();
} catch (error) {
  operation.fail(error);
}
```

Worker requests/responses should carry the relevant operation ID explicitly when correlation matters.

### Terminal operation semantics

An operation terminates exactly once with a defined outcome such as:

```text
success
failure
cancelled
superseded
stale
```

A generation/source/tune change that intentionally invalidates pending work should produce a `superseded`/`cancelled` terminal record rather than simply disappear from history.

A later completion against obsolete state is separate stale-completion evidence.

## State-transition recording

Record relationships and compact deltas, not entire application state.

Prefer:

```text
selection: veTable1 -> veTable2
sourceRevision: 14 -> 15
renderCountDelta: 1
semanticFingerprintBefore: ...
semanticFingerprintAfter: ...
```

Avoid serializing full channel catalogs, tune tables, log samples or entire workspaces into every record.

### Revisions remain owner-controlled

Observability may record `sourceRevision`, `tuneRevision`, `analysisGeneration`, etc., but must never become their owner or independently create competing revision authority.

### Semantic fingerprints

Do not hash arbitrary large application objects inside the recorder.

Owners may expose compact stable fingerprints/revision tuples representing the semantics that matter for no-op/repetition detection, for example:

```text
sourceRevision=14
tuneRevision=6
qualificationRevision=3
delayRevision=2
resultRevision=8
```

A compact derived hash of such fields is acceptable. Hashing/serializing full tune/source/UI state is not.

## Healthy checkpoints

Record bounded high-value checkpoints where the application reaches a known coherent state.

Candidate checkpoints include:

- source load accepted and UI usable;
- workspace restore completed;
- mode/Analyzer entry completed and quiescent;
- analysis completed successfully;
- persistence transaction completed successfully;
- navigation/render activity returned to a stable idle state.

A diagnostic report should be able to show:

```text
Last confirmed healthy checkpoint:
Analyzer entered successfully
sequence 18,420
14:28:31.583

First anomaly:
Repeated observer/render cycle
sequence 18,447
+212 ms
```

A checkpoint is evidence of a coherent boundary, not proof that every subsystem is healthy.

## Generic anomaly detection

Anomaly rules should be broad and architecture-oriented rather than tied to known bugs.

Initial rule families:

1. **Repetition/burst** — the same event or operation repeats unusually often in a short window.
2. **No-op work** — render/rebuild/analysis repeats while owner-provided semantic fingerprint is unchanged.
3. **Feedback cycle** — event A causes B which causes A repeatedly (observer/event/render loops).
4. **Hidden work** — hidden/inactive controllers perform material work repeatedly.
5. **Stale completion** — async work completes against a superseded generation/source/tune/state revision.
6. **Unfinished work** — operation starts but has no success/failure/cancel/superseded terminal record.
7. **Persistence divergence** — storage write/delete fails but in-memory state changes as if it succeeded.
8. **Resource growth** — DOM/listener/observer/cache/retained-memory counts grow monotonically across repeated equivalent workflows.
9. **Unexpected I/O** — physical reads/cache misses spike for an operation that normally reuses resident/cache-backed data.
10. **State inconsistency** — selected value missing from available options, active count exceeds available/renderable state, or source/tune/result revisions disagree.
11. **Performance regression** — operation duration deviates strongly from an appropriate recent workload baseline rather than merely crossing one universal threshold.
12. **Unconfirmed session termination** — previous session lacks a confirmed normal-end marker.
13. **Recorder pressure** — excessive coalescing/dropping/queue pressure indicates a pathological event storm or insufficient recorder bounds.

The first implementation does not need all rules at once. The recorder and operation model must make them possible without another architecture change.

### Streaming vs report-time detection

Use two classes of detector.

**Cheap streaming detectors** may cover:

- repetition/burst;
- stale completion;
- unfinished-operation timeout;
- runtime errors;
- persistence divergence;
- obvious resource/queue pressure.

**Report-time/deferred analysis** may cover:

- causal cycle reconstruction;
- long-term resource trends;
- workload-relative performance regressions;
- complex cross-component patterns.

Do not run expensive graph/cycle/baseline analysis in every record insertion path.

### Detection is not automatic repair

The initial observability system records and reports anomalies. It must not automatically disconnect observers, cancel controllers, rewrite selections or mutate domain state merely because an anomaly was detected.

Any future runtime self-protection mechanism is a separate safety feature and requires its own behavioral decision/testing.

## Baselines

Prefer relative/session baselines for recurring operations where enough history exists.

Examples:

- Analyzer entry normally causes N renders; a future entry causes hundreds;
- workspace restore normally takes tens/hundreds of milliseconds; one run takes several seconds;
- a cached channel activation normally performs zero physical reads; one run suddenly reads large source ranges.

Fixed thresholds may still be used for safety limits and clearly pathological values, but should not be the only detection mechanism.

### Workload identity

Do not compare unlike workloads blindly. Baseline keys should use coarse non-sensitive workload identity such as:

```text
operation type
build/schema family
source type
record-count bucket
channel-count bucket
cache/cold-warm state
active domain/feature where material
```

Do not require filenames for baseline identity.

## Bounded black-box retention

The observability store must be bounded by **bytes, record count and age**, whichever limit is reached first.

Initial implementation target:

- current-session in-memory ring: approximately **20,000–25,000 compact records** with a rolling time cap of roughly **30 minutes**;
- persisted previous sessions: retain session summary plus final tail plus bounded anomaly/error context windows for up to **3 sessions**;
- persisted previous-session tail: approximately **5,000 records per session** before byte-budget pruning;
- anomaly/error context windows: retain bounded records before/after the event when available rather than relying only on the final tail;
- total persisted observability payload: bounded by an implementation-level byte budget, initially around **5 MiB** for Web;
- explicit user-exported reports are separate artifacts and are not governed by the automatic ring expiry.

Exact limits should be measured and may be adjusted, but unbounded history is not allowed.

The byte budget is authoritative when estimated payload size and record count disagree materially.

Persistence should use an appropriate versioned browser store; do not make `localStorage` the architectural contract for event history.

## Persistence strategy

The persistent writer should batch. Never synchronously persist one record per event.

Conceptually:

```text
bounded in-memory ring
      ↓
periodic / lifecycle / anomaly-triggered batch
      ↓
versioned persistent session summary + selected tail/windows
```

Persistence must tolerate quota/transaction failures without recursively flooding the recorder.

A persistence failure should preserve current in-memory evidence where possible and surface one bounded high-value failure record/summary.

## Session lifecycle

On startup:

1. open a new session record;
2. inspect the previous persisted session summary;
3. if no confirmed normal-end marker exists, classify it as **unconfirmed/unclean termination**, not automatically as an EpicScope crash;
4. retain/show its bounded black-box tail and anomaly/error windows for diagnostics.

A missing normal end can result from browser exit, forced refresh, OS/process termination, power loss or application failure. Reports must not overclaim the cause.

On normal page/app shutdown where the platform permits:

- write a normal session-end marker/summary.

The system must tolerate the browser killing the page before that marker is written.

### Lightweight heartbeat/checkpoint summary

Persist/update a tiny bounded session summary periodically or at major workflow boundaries rather than relying only on unload/end callbacks.

Useful fields include:

```text
lastSeen
lastSequence
lastActiveView
lastCompletedOperation
lastHealthyCheckpoint
anomalyCount
errorCount
```

This summary must remain cheap and should not cause continuous synchronous storage churn.

## Session summary

Each retained session should have a compact summary that can be shown without loading the full record tail:

```text
sessionId
buildSha/schemaVersion
start/lastSeen
terminationStatus
duration
sourceType
record/sample/channel count buckets
modes visited
operation count
error/warning/anomaly count
max DOM/resource/outstanding-async counters where available
slowest major operations
lastHealthySequence
lastRecordSequence
coalesced/dropped record counts
```

Do not include raw log/tune payloads.

## Data minimization and privacy

Observability is local-first and must not silently transmit anything.

Default records should avoid:

- raw log samples;
- complete tune tables/files;
- full source payloads;
- huge DOM/text dumps;
- unnecessary filesystem paths;
- secrets or credentials.

Use IDs, revisions, counts, durations, fingerprints and compact state deltas instead.

### Export/redaction direction

The export schema should make later redaction possible before its format freezes.

Source filenames/environment details that are useful locally may be sensitive when shared.

A later UI may support levels such as Standard / Developer / Full local, but the first implementation only needs a schema that can distinguish/redact sensitive fields cleanly.

## Proposed production structure

Target Web ownership:

```text
apps/web/src/observability/
├── record.ts
├── recorder.ts
├── session.ts
├── operation.ts
├── retention.ts
├── persistence.ts
├── anomaly-detector.ts
├── snapshots.ts
├── producers/
│   ├── lifecycle.ts
│   ├── runtime-errors.ts
│   ├── performance.ts
│   ├── parser.ts
│   ├── storage.ts
│   ├── data-source.ts
│   ├── ui-events.ts
│   ├── rendering.ts
│   └── async-work.ts
└── reports/
    ├── health-report.ts
    ├── performance-report.ts
    ├── source-integrity-report.ts
    ├── session-report.ts
    └── export.ts
```

This is an approved responsibility map, not a requirement to create every file immediately. Create files as implementation reaches each responsibility.

Underlying parser/cache/source measurement code remains in its existing core/adapter owner and publishes measurements into observability through producers/adapters.

Do not create `v2`/wrapper-style observability layers around existing controllers. Producers call the recorder from the actual ownership boundary.

## Diagnostics UI target

The current separate diagnostic surfaces should converge toward one Diagnostics experience with multiple lenses:

```text
Diagnostics
├── Health
├── Session timeline
├── Causal operations
├── Anomalies
├── Performance
├── Parser / source integrity
├── Resources / caches
├── Errors
├── Previous session
└── Export report
```

The parser/source-integrity lens may keep its current compact indicator semantics where useful; the key change is that report/history ownership becomes unified.

### Causal operation tree

The UI should use operation relationships, not only a flat event list.

Example:

```text
Analyzer activation      431 ms
├─ context update         12 ms
├─ channel decoration     91 ms
│  └─ programmatic change
│     └─ VE rebuild      214 ms
│        └─ observer callback
└─ final render           83 ms
```

The chronological timeline remains available underneath.

### Useful filters

Plan filters for:

```text
subsystem
component
operation
origin
severity
active/hidden
record kind
outcome
source/tune revision
anomaly code
```

This is important for making a 20k-record session navigable.

## Export target

Prefer one user action that can produce both human-readable and structured evidence, for example:

```text
EpicScope diagnostic bundle
├── report.txt
└── observability.json
```

A compact `session-summary.json` may be added if useful.

The structured export preserves exact record relationships for future automated analysis/regression tooling. It must not silently include raw MLG/MSQ/INI contents.

## Migration plan

### Step 0 — freeze the baseline

Before implementation:

- finish/settle the current DOM-ownership, hidden-view and CPU cleanup work;
- choose an exact browser-validated baseline SHA;
- capture representative current Performance, Parser and Bug report outputs as parity fixtures;
- capture representative observability-overhead workloads for later before/after comparison;
- do not combine this architecture migration with unrelated Analyzer behavior changes.

Exit: stable baseline, parity fixtures and benchmark workloads exist.

### Step 1 — core record/session/operation contract

Implement:

- versioned record envelope;
- stable machine record/anomaly names;
- origin field;
- session IDs and sequence numbers;
- explicit operation/parent-operation handles;
- strict terminal operation outcomes;
- bounded in-memory recorder by records/time/estimated bytes;
- priority/coalescing rules;
- recursion/re-entry guard and emergency internal-failure path;
- typed metadata helpers;
- owner-provided semantic fingerprint support;
- unit tests for ordering, bounds, coalescing, terminal semantics, recursion protection and correlation.

No current diagnostic UI is removed yet.

Exit: records can be produced/queried under normal and event-storm conditions without changing existing behavior.

### Step 2 — runtime/lifecycle/error producer

Migrate:

- runtime `error`/`unhandledrejection` capture;
- application session start/end/last-seen summary;
- mode/view navigation;
- active/hidden state transitions;
- source/tune/context revision events;
- initial healthy checkpoints.

Keep existing bug-report output temporarily by adapting it from the new recorder where practical.

Exit: the new stream can reconstruct application lifecycle and runtime failures without owning application state.

### Step 3 — performance bridge

Route existing high-value timings/counters into operations/metrics without losing detail:

- log/INI load;
- validation;
- binding;
- workspace restore;
- channel read/decode/render;
- physical reads/cache behavior;
- retained-memory/resource probes.

Rebuild the Performance report as a projection over observability records.

Measure recorder-enabled overhead against the Step-0 workloads.

Exit: new Performance view/report matches or improves current evidence; overhead is small/bounded; old performance run arrays/report builder can be removed.

### Step 4 — parser/source-integrity bridge

Keep `ParserDiagnostic` as canonical parser evidence, but publish correlated source-integrity records and session summaries.

Migrate report ownership so Parser/source-integrity output can be generated through the unified reporting layer.

Exit: no source-integrity information is lost and diagnostics can correlate parser findings with load operations.

### Step 5 — state/render/async/storage producers

Add broad instrumentation at existing owners for:

- semantic invalidations/state revisions/fingerprints;
- render/rebuild boundaries;
- observer/event-dispatch boundaries where relevant;
- user vs programmatic origin where known;
- async start/end/cancel/failure/supersede/stale generation;
- persistence operations and success/failure;
- resource-count snapshots at low frequency or workflow boundaries.

Do not instrument every function call. Record high-value ownership transitions.

Do not add controller wrapper layers merely for instrumentation.

Exit: the stream can explain repeated/no-op work, stale completions, hidden work and failed persistence.

### Step 6 — anomaly detector

Local checkpoint: implemented the existing seven health rules plus initial repetition, explicit same-state work, rejected stale completion, report-time unfinished operation and known session-only persistence classes. See the stage 6 section in `apps/web/src/observability/README.md` for thresholds, bounds, evidence interpretation and deferred families. The legacy health formatter/status retains its policy and wording; historical anomalies are an additive report lens, not current-health counts. No automatic repair or new hooks/timers are installed.

Port current health rules first, then add generic rule families incrementally.

Anomalies themselves are records with evidence references/operation IDs, not opaque strings.

Implement cheap streaming rules first; keep expensive causal/baseline analysis deferred/report-time.

Anomaly detection must not automatically mutate application state.

Exit: current bug-report health coverage is preserved and at least repetition/no-op/unfinished/stale/persistence-divergence classes have regression tests.

### Step 7 — bounded persistence and previous-session black box

Local checkpoint: implemented a version-1 IndexedDB adapter, shell-owned 30-second/lifecycle batches, compact summary-only idle heartbeats, bounded tail/error-context selection and separate previous-session reporting. Current plus up to three previous sessions are retained, with a 5000-record/1-MiB per-session cap, 5-MiB total UTF-8 payload ceiling and seven-day age limit. Missing end is unconfirmed, never crash causality. Unsupported/corrupt schemas fail closed without replacement. Existing listeners are reused; the writer owns one disposed interval. See the observability README/HANDOFF for exact contracts and validation limits.

Add:

- versioned local persistence adapter;
- batched writes;
- automatic record/time/byte retention limits;
- compact session summary/last-seen/checkpoint updates;
- previous-session final-tail restore;
- bounded anomaly/error context-window preservation;
- unconfirmed/unclean termination detection without claiming crash causality;
- schema migration/unsupported-version behavior;
- recursion-safe quota/storage failure handling.

Exit: forced reload/crash-like termination can be followed by a useful previous-session diagnostic view without unbounded storage growth or one-write-per-event behavior.

### Step 8 — unified Diagnostics UI and reports

Local checkpoint: one shell-owned captured Diagnostics surface now exposes Health, Timeline, Operations, Anomalies, Performance, Parser, Resources, Errors, Previous session and Export report. Filters/lens switches reuse the captured stream; only explicit Refresh/open captures new evidence. Timeline/operation DOM is paged at 200 rows, with iterative relationship projection for missing/cyclic/deep histories. Text/copy/ZIP export uses the same full local snapshot regardless of filters; ZIP contains `report.txt` and version-1 `observability.json`, including full canonical current Parser diagnostics and bounded current/previous records. Legacy compact Perf/Parser controls remain compatible pending stage 9 parity-gated cleanup.

Replace separate report ownership with the shared Diagnostics lenses.

Provide:

- current health/anomalies;
- chronological session timeline;
- causal operation tree;
- performance view;
- parser/source-integrity view;
- resources/cache view;
- errors;
- previous-session black box;
- filterable records;
- coherent text + structured export.

Exit: users no longer need separate unrelated report systems to describe one session.

### Step 9 — delete redundant architecture

Local checkpoint: moved runtime report formatting into `observability/reports/runtime-report.ts`, moved Perf contracts out of the DOM component into `observability/performance-types.ts`, removed the old health facade and Parser formatter re-exports, and centralized explicit capture/health/report assembly in `observability/capture.ts`. The shell supplies actual-owner evidence/context; pure badge/capture health projection shares `health-rules.ts`. The existing badge interval now clears on remount. Earlier stages already removed parallel Runtime/Perf stores. Useful compact Perf/Parser views remain projections of the same authorities, preserving complete frozen UI/report features rather than deleting non-parity presentation. No replacement compatibility shim or second evidence store was added. Original-recording/target-hardware acceptance remains separate.

After browser/test parity is established:

- remove old performance-only stores/builders;
- remove old standalone bug-report runtime-error state;
- remove duplicate health/report assembly;
- simplify app-shell wiring;
- remove obsolete tests and replace them with observability/report projection tests where appropriate.

Exit: one authoritative observability architecture remains.

### Step 10 — baseline/regression intelligence

After enough real usage data exists locally:

- add workload-keyed recent-baseline comparison for recurring operations;
- surface significant regressions without noisy universal thresholds;
- add targeted workflow summaries for exported developer reports.

This step is optional for the first usable observability release; the earlier architecture must make it possible.

## Validation strategy

Each migration step must preserve normal product behavior.

Required validation layers:

- unit tests for record ordering/bounds/correlation/coalescing/recursion protection;
- operation terminal-state/supersession/stale-completion tests;
- report projection fixtures;
- storage/version/retention/byte-budget tests;
- persistence-failure/recursion tests;
- anomaly detector tests with synthetic event sequences;
- browser checks for session recovery, previous-session unconfirmed end and Diagnostics UI;
- browser checks for causal operation correlation across user/programmatic/observer/async paths;
- representative large-log performance comparison to ensure observability overhead is small and bounded;
- explicit observability-on vs minimal/off benchmark for important workflows;
- explicit event-storm test proving coalescing/backpressure prevents diagnostic amplification;
- explicit check that disabling/clearing diagnostic history does not alter source/tune/analysis state.

Instrumentation must not become a new source of feedback loops or materially change application scheduling.

## Failure-mode requirements for observability itself

Before calling the subsystem mature, prove that it behaves sensibly when:

- the application emits a rapid render/observer/event storm;
- persistence is unavailable or quota-limited;
- the browser is killed without unload/end callbacks;
- an observability producer throws;
- structured metadata is malformed/oversized;
- a worker returns after its parent operation was superseded;
- record count/age/byte limits are all reached;
- Diagnostics UI is open while new records arrive;
- previous-session schema is unsupported/corrupt;
- report/export generation fails.

The failure mode should be bounded evidence loss or a compact internal warning, not recursive failure or product-state mutation.

## Non-goals

This work does not authorize:

- cloud telemetry;
- remote crash upload;
- raw log/tune capture inside diagnostics;
- indefinite session history;
- a new general application state store;
- replacing domain/source truth with diagnostic records;
- changing Analyzer calculations merely to make them easier to instrument;
- automatic runtime repair based solely on anomaly detection;
- controller/view wrapper layers added only for observability.

## Implementation order relative to current work

The approved order is:

1. finish the currently active correctness/ownership/performance cleanup sequence;
2. stabilize and browser-validate the resulting baseline;
3. implement this observability migration in staged steps;
4. then resume lower-priority feature expansion.

Observability should make later work safer, but it must not be inserted mid-cleanup in a way that obscures whether behavior changes came from the cleanup or the instrumentation.
