# 2026-10-15 — Unified observability authority

Status: **Accepted**

## Decision

### D-058 — Diagnostics, performance and report history converge on one bounded observability architecture

EpicScope will replace its fragmented long-lived diagnostics/performance/bug-report ownership with one versioned, bounded observability record/session architecture.

Specialized views such as Health, Performance, Parser / Source Integrity, Resources, Errors, Previous Session and exported reports are projections over that shared observability data rather than independent stores of the same facts.

Existing useful measurement probes and canonical domain evidence remain in their natural owners. In particular, parser diagnostics remain parser/source-model evidence and performance/cache/source probes remain owned by the code that measures them. Producers/adapters publish their compact results into observability for correlation and reporting.

The migration must remove redundant collectors, report-only state and duplicated formatter ownership after parity is demonstrated. It must not leave the old and new systems running indefinitely in parallel.

The observability subsystem is a **bounded flight recorder**, not a general debug log and not an application state store.

## Required properties

The observability architecture must:

- correlate causal work with explicit operation/parent-operation IDs;
- avoid dependence on implicit global async-current-operation state;
- give operations one terminal outcome such as success/failure/cancelled/superseded/stale;
- record stable machine-readable event/anomaly identities separately from human wording;
- record event origin where useful, including user/programmatic/observer/async/worker/system/persistence origins;
- record compact lifecycle, state-transition, async, rendering, persistence, source, performance and error evidence;
- consume owner-provided revisions/semantic fingerprints rather than invent competing state authority or hashing full application objects;
- support generic anomaly detection rather than only known-bug probes;
- separate cheap streaming anomaly rules from more expensive deferred/report-time analysis;
- preserve bounded current-session history and a small bounded tail/context set of recent previous sessions;
- preserve bounded anomaly/error context windows where they are more useful than a simple final tail;
- treat missing clean session-end evidence as unconfirmed/unclean termination, not automatically as an EpicScope crash;
- support compact last-seen/session/checkpoint summaries so diagnosis does not depend solely on unload callbacks;
- remain local-first with no silent upload/telemetry;
- avoid raw log samples, full tune payloads and other large/sensitive state by default;
- remain bounded by record count, age and byte budget;
- batch persistence rather than writing synchronously per event;
- use priority/coalescing/backpressure so event storms do not amplify freezes or memory growth;
- record/coarsely summarize coalesced/dropped diagnostic pressure rather than hiding it;
- protect against observability recursion/re-entry and provide a bounded emergency internal-failure path;
- keep source/domain truth separate from diagnostic history;
- add instrumentation at existing owners rather than creating diagnostic controller/view wrapper stacks;
- keep instrumentation overhead small and avoid introducing feedback loops;
- never automatically mutate application/domain state merely because an anomaly was detected;
- support human-readable and structured exports while preserving a path to redaction of sensitive local context;
- migrate in staged, browser/test-validated steps from a stable baseline.

## Why

The current Web implementation already captures valuable evidence, including parser/source-integrity findings, load/binding/workspace/channel timings, retained-memory/cache probes, Logger runtime snapshots and browser runtime errors. However, those facts are assembled through separate stores and report builders, and most history disappears when the page/session resets.

That makes post-freeze/post-reload diagnosis harder and encourages adding one-off probes for already-known failures.

A shared causal event/session model lets EpicScope reconstruct what happened before a failure, correlate repeated work and hidden-view activity, preserve a bounded previous-session black-box tail, and detect broader classes of regressions without designing each probe around one named bug.

The flight-recorder/backpressure requirements exist because the most valuable diagnostic moment may also be the highest event-rate moment. A render/observer loop must not cause the diagnostics system itself to allocate, persist or render without bound.

## Scope boundary

This decision does **not** authorize cloud telemetry, remote crash upload, unbounded history, full application-state serialization or a new general state-management system.

It also does not make observability records authoritative for parser/source/tune/analysis truth and does not authorize automatic repair of runtime state based on anomaly detection.

## Implementation authority

`../OBSERVABILITY.md` defines the approved target architecture, current-system disposition, failure-mode requirements and staged implementation plan.

Implementation begins only after the active correctness/DOM-ownership/hidden-view/CPU cleanup sequence has reached a stable browser-validated baseline.
