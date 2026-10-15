# EpicScope Observability Architecture

## Status

Approved architectural direction. Implementation is **not yet started**.

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
- whether the previous session ended normally;
- what anomaly pattern best explains the sequence.

The design is intentionally broader than VE, Analyzer or any current bug.

## Core invariant

> **One authoritative observability record stream. Specialized diagnostics and reports are projections of it.**

Do not keep long-lived parallel systems for the same facts.

Existing measurements/probes may remain where they naturally belong, but durable diagnostic history, operation correlation, anomalies and report assembly should converge on the shared observability model.

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
- session start/normal end.

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
operationId
parentOperationId
activeView
visibility
sourceIdentity/sourceRevision
tuneIdentity/tuneRevision
stateRevision
durationMs
outcome
reason
metadata
```

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

## State-transition recording

Record relationships and compact deltas, not entire application state.

Prefer:

```text
selection: veTable1 -> veTable2
sourceRevision: 14 -> 15
renderCountDelta: 1
stateHashBefore: ...
stateHashAfter: ...
```

Avoid serializing full channel catalogs, tune tables, log samples or entire workspaces into every record.

## Generic anomaly detection

Anomaly rules should be broad and architecture-oriented rather than tied to known bugs.

Initial rule families:

1. **Repetition/burst** — the same event or operation repeats unusually often in a short window.
2. **No-op work** — render/rebuild/analysis repeats while semantic state hash is unchanged.
3. **Feedback cycle** — event A causes B which causes A repeatedly (observer/event/render loops).
4. **Hidden work** — hidden/inactive controllers perform material work repeatedly.
5. **Stale completion** — async work completes against a superseded generation/source/tune/state revision.
6. **Unfinished work** — operation starts but has no success/failure/cancel terminal record.
7. **Persistence divergence** — storage write/delete fails but in-memory state changes as if it succeeded.
8. **Resource growth** — DOM/listener/observer/cache/retained-memory counts grow monotonically across repeated equivalent workflows.
9. **Unexpected I/O** — physical reads/cache misses spike for an operation that normally reuses resident/cache-backed data.
10. **State inconsistency** — selected value missing from available options, active count exceeds available/renderable state, or source/tune/result revisions disagree.
11. **Performance regression** — operation duration deviates strongly from its recent baseline rather than merely crossing a single universal threshold.
12. **Abnormal session end** — previous session lacks a normal end marker.

The first implementation does not need all rules at once. The recorder and operation model must make them possible without another architecture change.

## Baselines

Prefer relative/session baselines for recurring operations where enough history exists.

Examples:

- Analyzer entry normally causes N renders; a future entry causes hundreds;
- workspace restore normally takes tens/hundreds of milliseconds; one run takes several seconds;
- a cached channel activation normally performs zero physical reads; one run suddenly reads large source ranges.

Fixed thresholds may still be used for safety limits and clearly pathological values, but should not be the only detection mechanism.

## Bounded black-box retention

The observability store must be bounded.

Initial implementation target:

- current-session in-memory ring: approximately **20,000–25,000 compact records** with a rolling time cap of roughly **30 minutes**;
- persisted previous sessions: retain the final tail plus session summary for up to **3 sessions**;
- persisted previous-session tail: approximately **5,000 records per session**;
- total persisted observability payload: bounded by an implementation-level byte budget, initially around **5 MiB** for Web;
- explicit user-exported reports are separate artifacts and are not governed by the automatic ring expiry.

Exact limits should be measured and may be adjusted, but unbounded history is not allowed.

Persistence should use an appropriate versioned browser store; do not make `localStorage` the architectural contract for the event history.

## Session lifecycle

On startup:

1. open a new session record;
2. inspect the previous session summary;
3. if no normal-end marker exists, classify it as an abnormal previous-session end;
4. retain its bounded black-box tail for diagnostics.

On normal page/app shutdown where the platform permits:

- write a normal session-end marker/summary.

The system must tolerate the browser killing the page before that marker is written.

## Data minimization and privacy

Observability is local-first and must not silently transmit anything.

Default records should avoid:

- raw log samples;
- complete tune tables/files;
- full source payloads;
- huge DOM/text dumps;
- unnecessary filesystem paths;
- secrets or credentials.

Use IDs, revisions, counts, durations, hashes and compact state deltas instead.

Exports should make sensitive source naming/context obvious and should support later redaction policy if sharing becomes a product capability.

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

## Diagnostics UI target

The current separate diagnostic surfaces should converge toward one Diagnostics experience with multiple lenses:

```text
Diagnostics
├── Health
├── Session timeline
├── Anomalies
├── Performance
├── Parser / source integrity
├── Resources / caches
├── Errors
├── Previous session
└── Export report
```

The parser/source-integrity lens may keep its current compact indicator semantics where useful; the key change is that report/history ownership becomes unified.

## Migration plan

### Step 0 — freeze the baseline

Before implementation:

- finish/settle the current DOM-ownership, hidden-view and CPU cleanup work;
- choose an exact browser-validated baseline SHA;
- capture representative current Performance, Parser and Bug report outputs as parity fixtures;
- do not combine this architecture migration with unrelated Analyzer behavior changes.

Exit: stable baseline and parity fixtures exist.

### Step 1 — core record/session/operation contract

Implement:

- versioned record envelope;
- session IDs and sequence numbers;
- operation/parent-operation correlation;
- bounded in-memory recorder;
- typed metadata helpers;
- unit tests for ordering, bounds and correlation.

No current diagnostic UI is removed yet.

Exit: records can be produced/queried without changing existing behavior.

### Step 2 — runtime/lifecycle/error producer

Migrate:

- runtime `error`/`unhandledrejection` capture;
- application session start/end;
- mode/view navigation;
- active/hidden state transitions;
- source/tune/context revision events.

Keep existing bug-report output temporarily by adapting it from the new recorder where practical.

Exit: the new stream can reconstruct application lifecycle and runtime failures.

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

Exit: new Performance view/report matches or improves current evidence; old performance run arrays/report builder can be removed.

### Step 4 — parser/source-integrity bridge

Keep `ParserDiagnostic` as canonical parser evidence, but publish correlated source-integrity records and session summaries.

Migrate report ownership so Parser/source-integrity output can be generated through the unified reporting layer.

Exit: no source-integrity information is lost and diagnostics can correlate parser findings with load operations.

### Step 5 — state/render/async/storage producers

Add broad instrumentation at existing owners for:

- semantic invalidations/state revisions;
- render/rebuild boundaries;
- observer/event dispatch boundaries where relevant;
- async start/end/cancel/failure/generation;
- persistence operations and success/failure;
- resource-count snapshots at low frequency or workflow boundaries.

Do not instrument every function call. Record high-value ownership transitions.

Exit: the stream can explain repeated/no-op work, stale completions, hidden work and failed persistence.

### Step 6 — anomaly detector

Port current health rules first, then add generic rule families incrementally.

Anomalies themselves are records with evidence references/operation IDs, not opaque strings.

Exit: current bug-report health coverage is preserved and at least repetition/no-op/unfinished/stale/persistence-divergence classes have regression tests.

### Step 7 — bounded persistence and previous-session black box

Add:

- versioned local persistence adapter;
- automatic retention/byte limits;
- previous-session summary/tail restore;
- abnormal-end detection;
- schema migration/unsupported-version behavior.

Exit: forced reload/crash-like termination can be followed by a useful previous-session diagnostic view without unbounded storage growth.

### Step 8 — unified Diagnostics UI and reports

Replace separate report ownership with the shared Diagnostics lenses.

Provide:

- current health/anomalies;
- operation/session timeline;
- performance view;
- parser/source-integrity view;
- resources/cache view;
- errors;
- previous-session black box;
- one coherent export report.

Exit: users no longer need separate unrelated report systems to describe one session.

### Step 9 — delete redundant architecture

After browser/test parity is established:

- remove old performance-only stores/builders;
- remove old standalone bug-report runtime-error state;
- remove duplicate health/report assembly;
- simplify app-shell wiring;
- remove obsolete tests and replace them with observability/report projection tests where appropriate.

Exit: one authoritative observability architecture remains.

### Step 10 — baseline/regression intelligence

After enough real usage data exists locally:

- add recent-baseline comparison for recurring operations;
- surface significant regressions without noisy universal thresholds;
- add targeted workflow summaries for exported developer reports.

This step is optional for the first usable observability release; the earlier architecture must make it possible.

## Validation strategy

Each migration step must preserve normal product behavior.

Required validation layers:

- unit tests for record ordering/bounds/correlation;
- report projection fixtures;
- storage/version/retention tests;
- anomaly detector tests with synthetic event sequences;
- browser checks for session recovery, previous-session abnormal end and Diagnostics UI;
- representative large-log performance comparison to ensure observability overhead is small and bounded;
- explicit check that disabling/clearing diagnostic history does not alter source/tune/analysis state.

Instrumentation must not become a new source of feedback loops or materially change application scheduling.

## Non-goals

This work does not authorize:

- cloud telemetry;
- remote crash upload;
- raw log/tune capture inside diagnostics;
- indefinite session history;
- a new general application state store;
- replacing domain/source truth with diagnostic records;
- changing Analyzer calculations merely to make them easier to instrument.

## Implementation order relative to current work

The approved order is:

1. finish the currently active correctness/ownership/performance cleanup sequence;
2. stabilize and browser-validate the resulting baseline;
3. implement this observability migration in staged steps;
4. then resume lower-priority feature expansion.

Observability should make later work safer, but it must not be inserted mid-cleanup in a way that obscures whether behavior changes came from the cleanup or the instrumentation.