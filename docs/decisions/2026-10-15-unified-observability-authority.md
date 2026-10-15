# 2026-10-15 — Unified observability authority

Status: **Accepted**

## Decision

### D-058 — Diagnostics, performance and report history converge on one bounded observability architecture

EpicScope will replace its fragmented long-lived diagnostics/performance/bug-report ownership with one versioned, bounded observability record/session architecture.

Specialized views such as Health, Performance, Parser / Source Integrity, Resources, Errors, Previous Session and exported reports are projections over that shared observability data rather than independent stores of the same facts.

Existing useful measurement probes and canonical domain evidence remain in their natural owners. In particular, parser diagnostics remain parser/source-model evidence and performance/cache/source probes remain owned by the code that measures them. Producers/adapters publish their compact results into observability for correlation and reporting.

The migration must remove redundant collectors, report-only state and duplicated formatter ownership after parity is demonstrated. It must not leave the old and new systems running indefinitely in parallel.

## Required properties

The observability architecture must:

- correlate causal work with operation/parent-operation IDs;
- record compact lifecycle, state-transition, async, rendering, persistence, source, performance and error evidence;
- support generic anomaly detection rather than only known-bug probes;
- preserve bounded current-session history and a small bounded tail of recent previous sessions;
- detect abnormal previous-session termination where possible;
- remain local-first with no silent upload/telemetry;
- avoid raw log samples, full tune payloads and other large/sensitive state by default;
- remain bounded in record count/time/bytes;
- keep source/domain truth separate from diagnostic history;
- keep instrumentation overhead small and avoid introducing feedback loops;
- migrate in staged, browser/test-validated steps from a stable baseline.

## Why

The current Web implementation already captures valuable evidence, including parser/source-integrity findings, load/binding/workspace/channel timings, retained-memory/cache probes, Logger runtime snapshots and browser runtime errors. However, those facts are assembled through separate stores and report builders, and most history disappears when the page/session resets.

That makes post-freeze/post-reload diagnosis harder and encourages adding one-off probes for already-known failures.

A shared causal event/session model lets EpicScope reconstruct what happened before a failure, correlate repeated work and hidden-view activity, preserve a bounded previous-session black-box tail, and detect broader classes of regressions without designing each probe around one named bug.

## Scope boundary

This decision does **not** authorize cloud telemetry, remote crash upload, unbounded history, full application-state serialization or a new general state-management system.

It also does not make observability records authoritative for parser/source/tune/analysis truth.

## Implementation authority

`../OBSERVABILITY.md` defines the approved target architecture, current-system disposition and staged implementation plan.

Implementation begins only after the active correctness/DOM-ownership/hidden-view/CPU cleanup sequence has reached a stable browser-validated baseline.