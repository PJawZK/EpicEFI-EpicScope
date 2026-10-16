# EpicScope Handoff

## Current authoritative state — 2026-10-16

This file is the continuation authority for EpicScope. Historical checkpoint detail from the previous long-form handoff remains available in Git history at merge commit `619f01c53fbea63567bf5d75bc6c02c2ad50d77f`; this version intentionally condenses that history into the current accepted baseline and remaining work.

### Main branch

Product/runtime authority before this documentation-only refresh:

- `main`: `619f01c53fbea63567bf5d75bc6c02c2ad50d77f`
- merge: PR #463, **Preserve recovered MLG retry continuity and mark source data gaps**
- previous integrated checkpoint: `213a937b2566ec165fb774db2bc9072703482ce2`
- previous cleanup baseline: `09f8e3942afde19f5bf64c9570884886d56da9bc`

The checkpoint branch `checkpoint/improvements-targets-1-5-15-20261016` remains historical/preservation state. `main` is the development authority. `browser-previews` remains preview/deployment state and must not be treated as product authority.

## Accepted completed work

### Codex improvement targets already integrated

The following targets are complete and accepted on `main`:

1. **Make input acceptance and view updates consistent**
   - accepted log/INI/MSQ changes flow through shell ownership;
   - active views update, hidden views defer;
   - Histogram stale-tune behavior addressed.

2. **Bind analysis contexts to their actual source**
   - retained analysis contexts keep source identity/channel definitions/sample extent together;
   - replacement/unload cannot silently redirect reads to a newer source.

3. **Make VE delay edits transactional and batched**
   - multi-cell edits use one owner command, one invalidation and one render cycle;
   - four-cell regression improved from 4 revisions / 12 delay-table rebuilds to 1 / 1;
   - selection, keyboard editing, preview/cancel, provenance and Delete-to-recommendation preserved.

4. **Unify formula resolution and execution**
   - Histogram formula compilation/reference resolution/loading/evaluation share one path;
   - Table Generator now accepts historical references such as `[RPM-1]` consistently with Math/Distribution/Scatter.

5. **Stop unnecessary Math Channel preview calculations**
   - metadata edits do not recalculate preview;
   - expression preview uses shared 180 ms debounce and stale-result rejection;
   - preview output is bounded to 10,000 anchor samples;
   - leaving/resetting Math cancels obsolete work.

15. **Make browser regressions reproducible and routinely executed**
   - `npm run test:browser` is the standard browser acceptance command;
   - checked-in fixtures, isolated browser sessions, cleanup/failure diagnostics and CI browser job are present;
   - stale Result View browser assertion was corrected without changing accepted production behavior.

The integrated checkpoint validation before PR #463 was:

- 256 browser checks;
- 118 automated test files / 616 tests;
- production build/typecheck passed.

## Accepted MLG source-integrity behavior — PR #463

This work was discovered from a real 1.2 GB EpicEFI MLG log (`2026-07-14_22.07.05.mlg`) after a user-visible graph-gap investigation.

### Reproduced source facts

The real log contains:

- 320,458 records;
- 299 raw CRC-invalid attempts;
- 291 retry attempts recovered by a later valid record in the same counter/timestamp run;
- 8 genuinely unrecovered CRC-invalid records.

The original suspicious high-zoom gaps around ~58:16 were **recovered retries**, not lost trusted data. The old renderer broke continuity on every invalid attempt, even when a valid same-timestamp retry followed. This was a pre-existing presentation/data-validity semantics issue; Targets 1–5/15 did not introduce it.

### Accepted semantics

- Recovered retry attempts remain retained as source evidence but **do not break trace continuity** when a valid replacement in the proven same-counter/same-timestamp retry run exists.
- Genuine unrecovered corruption still breaks the trusted solid trace.
- Unknown invalid records remain conservative; do not infer recovery merely because a later value happens to share a timestamp unless the parser classification proves the retry relationship.
- Existing abnormal timestamp-gap handling remains conservative and separate.

### Accepted presentation

For a genuine source-data interruption at useful zoom:

- the solid trace ends at the last trusted sample;
- a dotted bridge connects that endpoint to the first trusted sample after the interruption for each active trace;
- the bridge uses that trace's real value scale/row geometry;
- one fixed-size `!` warning marker is centered on the missing/untrusted interval;
- pressing/clicking the marker opens an explanation that this is imported/recorded **source-data integrity**, not a renderer failure;
- the explanation persists until the user clicks elsewhere; there is no timer-based dismissal;
- clicking inside the explanation does not dismiss it;
- detailed bridges are suppressed when zoomed too far out to remain useful;
- recovered retries have no warning marker/bridge because trusted continuity exists.

Manual acceptance was completed against the real 1.2 GB log. The user confirmed the bridge rendering and persistent click-to-explain notice work correctly.

### PR #463 validation

Accepted head before merge: `a8bc4d66c4abfcfd56bd0f2215fea61e05b62e0b`.

GitHub Web CI run #1633 passed:

- type-check: success;
- automated tests: success;
- production build: success;
- staged browser acceptance: success;
- forced fallback browser acceptance: success;
- source-integrity bridge/browser interaction regression included.

PR #463 was then merged to `main` as `619f01c53fbea63567bf5d75bc6c02c2ad50d77f`.

### Important integrity invariant

Never fabricate continuity across genuinely missing/corrupt data, but never fabricate a discontinuity when a valid classified retry already recovered the sample.

## VE Result View accepted behavior

Preserve these already accepted semantics:

- Proposed VE uses normal VE heat;
- alternate real metric views use metric heat;
- untouched/fallback cells in alternate views preserve the VE value but use **neutral heat `0.5`**;
- Lambda Delay valid interpolated delay is a real metric;
- analysis survives switching analyzers/leaving Analyzer;
- weak cells remain sensible.

Known later cleanup: `readDelaySurface()` still reconstructs the Lambda Delay surface from DOM instead of authoritative owner state. This is not a blocker and belongs with later presentation ownership work.

## D-058 observability architecture — approved, preserve

Do not create a competing diagnostics system. The approved direction is:

- one bounded authoritative observability/session stream (flight recorder);
- reports/diagnostics are projections, not parallel durable stores;
- probes stay in subsystem owners;
- packed/hybrid hot path with separate critical/detail retention;
- pre-insertion coalescing/backpressure;
- stable numeric common-field IDs and primitive operation correlation;
- monotonic timestamps plus session wall-time origin;
- owner revisions/fingerprints instead of hot-path full-state stringify/hash;
- event/boundary snapshots rather than broad polling;
- O(1)-amortized anomaly state with expensive causal analysis deferred;
- batched/chunked structured persistence; IndexedDB remains the candidate;
- bounded previous-session tail plus critical/anomaly/error windows;
- recursion/self-observation protection;
- benchmark enabled/minimal/off plus event-storm workloads;
- anomalies report evidence only initially; no automatic mutation/repair;
- local-first; no silent log/tune/telemetry upload;
- Diagnostics UI lazy/bounded refresh;
- remove redundant collectors only after parity.

Implementation sequence remains:

1. benchmark baseline/budgets;
2. record/session/operation/retention contracts + in-memory recorder;
3. lifecycle/runtime-error/operation producers;
4. bridge current performance measurements + rebuild Performance projection;
5. parser/source-integrity evidence;
6. state/render/async/storage/resource producers;
7. cheap streaming anomaly + deferred analysis;
8. bounded batched prior-session persistence/recovery;
9. converge Diagnostics UI/report;
10. delete old collectors after parity;
11. workload-relative regression intelligence if justified.

PR #463's structured source-integrity evidence should be reused by this migration rather than duplicated.

## Remaining Codex improvement backlog

Targets below remain pending unless explicitly noted otherwise. Keep them separately reviewable and evidence-driven.

6. **Make storage restrictions recoverable at startup** — NEXT
   - catch failure obtaining `window.localStorage` itself, not only read/write failures;
   - restricted-storage environments must not interrupt mount;
   - validate a throwing storage getter and healthy-storage behavior in browser.

7. **Keep active INI table definitions authoritative in memory**
   - accepted table definitions travel with active INI/context;
   - failed persistence must not leave Histogram using older axes;
   - storage preserves session state, not mediates transfer.

8. **Remove full-history copying from live graph updates**
   - profile representative recordings first;
   - separate complete recording storage from graph presentation;
   - use incremental statistics and append/chunk handling instead of repeated whole-history merge/rescan.

9. **Calculate VE readiness once**
   - one structured readiness result with blockers/explanations/action targets;
   - all UI projections consume it;
   - remove DOM-text interpretation and competing writers.

10. **Give Result View presentation one owner**
   - one structured projection for values/heat/neutral fallback/delay presentation;
   - preserve accepted Result View semantics above.

11. **Move presentation decoration into component owners**
   - replace broad help/hierarchy/VE post-render rescans with component-local rendering;
   - preserve accessibility;
   - do not replace them with another global observer.

12. **Strengthen MSQ parsing and acceptance semantics**
   - correct double XML entity decoding;
   - distinguish malformed numeric tables from legitimate text so invalid numeric payloads cannot bypass shape validation;
   - preserve transactional replacement.

13. **Address long-recording memory growth**
   - measure realistic capture arrays/acquisition sequences/graph copies;
   - define retention/export requirements before chunk/spill design;
   - never silently discard complete recording data;
   - coordinate with target 8.

14. **Perform targeted algorithmic cleanup**
   - reuse already-sorted AFR-delay data for percentiles;
   - profile Idle recovery and AE overlapping-window searches before algorithm changes.

16. **Consolidate diagnostics through D-058**
   - migrate through the approved bounded stream/projection architecture;
   - remove superseded collectors only after parity.

17. **Remove superseded UI and unreachable legacy code**
   - after parity, remove hidden Table Generator formula manager, superseded v4 bulk-edit machinery, deprecated mutation-event listener and unused legacy heatmap views/styles.

18. **Reproduce deferred telemetry completion race**
   - socket identity after async conversion and rejection handling;
   - reproduction-gated; do not change normal behavior without evidence.

### Recommended implementation order

`6 → 7 → 9 → 10 → 11 → 12 → 8/13 profiling → 14 → 16 → 17 → 18 only if reproduced`

Target 15 is already complete. The MLG source-integrity correction is a separate accepted correctness/UX change, not one of the original 18 targets.

## Evidence boundaries and working rules

- Preserve healthy decoded-channel/storage caches, retained VE evidence, generation/cancellation protections, format-specific parsers and domain calculations.
- File consolidation alone is not an optimization; changes must eliminate duplicated work or clarify ownership.
- Live-memory, observer-cost, algorithmic and telemetry changes require representative measurement or controlled reproduction before implementation.
- Do not reopen accepted Targets 1–5/15 without specific evidence.
- Do not reinterpret the PR #463 dotted bridge as estimated data. It explicitly marks an interval whose source samples cannot be trusted; the solid trace resumes only at trusted endpoints.
- Keep UI polish work separate from architecture/correctness unless it is required to express a correctness state.
- Avoid pushing/committing after every Codex target solely for bookkeeping. Keep target patch boundaries and validation evidence clear, then publish checkpoints when useful.

## Browser acceptance

Standard command:

```bash
npm run test:browser
```

Browser acceptance is part of Web CI. For changes touching lifecycle, replacement, VE Result View, formulas, graph integrity or canvas interaction, add focused browser regression coverage rather than relying only on Vitest/build.

## Immediate continuation boundary

**Start Target 6 next.**

Scope it narrowly to startup storage acquisition/restriction handling. Do not mix in Target 7 or observability migration. Preserve current MLG integrity semantics and graph presentation. After implementation, validate both restricted-storage startup and normal healthy-storage startup in a real browser, then stop for review before Target 7.
