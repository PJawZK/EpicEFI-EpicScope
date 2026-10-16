# EpicScope Handoff

## Integration target 2 — source-integrity evidence preservation (2026-10-16)

Branch: `integration/source-integrity-target1-20261016`, based on local integration commit `663e7d5`. Target 2 changes are local and unpublished; main is unchanged.

`createDiagnosticsCapture` now copies optional source-relative `timeMs` and an explicit frozen `{ kind, breaksContinuity }` metadata object. Timestamp zero, recovered-retry false, corruption true, legacy absence and existing diagnostic fields are preserved. No mutable nested alias or extra payload is retained. The existing structured export/ZIP consumes this snapshot without another authority, pass or schema-version change; fields are additive and optional. Canonical Parser text/UI and graph behavior are unchanged.

Regression evidence: before the fix, two new capture tests failed (10 passed). Afterward all 12 focused tests pass, including exact ZIP JSON metadata parity. Chromium fixture compares export with a marker derived from the same source diagnostic, then mutates source time/integrity to verify retained evidence remains independent. No global listeners/observers/instrumentation added.

Validation: 131 automated files / 800 tests, 12 focused tests, production build/typecheck, 526 Chromium checks (263/configuration), native downloaded ZIP CRC and diff checks passed. Target 2 is complete locally. Evidence will be saved to `/workspace/epicscope-integration-target2/evidence/`. Stop after target 2; targets 3–7 and optional observability stage 10 have not started. Original large MLG/affected hardware and hosted CI remain unrun. Account usage is not exposed.

## Integration target 1 — combined baseline (2026-10-16)

Branch: `integration/source-integrity-target1-20261016`. Integrates published checkpoint `b597f6d298921950c4b6862e719e9dee3f816c72` with main `8890498d96787582d59ac7ee2716bfbf8b38b2bd`. Main itself is unchanged. This integration is local and unpublished.

Parser conflict resolution retains main's source-integrity publication and the checkpoint's single prepared model, observability callback, canonical report formatter, and evidence/report APIs. Neither branch's test assertions are removed. Source-integrity annotation, rendering and recovered-retry continuity remain as on main.

Targets 2–7 remain separate: preserve new integrity metadata in captured/exported diagnostics; remove quadratic retry lookahead; bound annotation work; establish overlay lifecycle/source ownership; remove repeated graph CPU work; and final large-log/target-hardware acceptance. These known issues are not fixed by integration. Optional observability stage 10 remains skipped. Stop after target 1.

Validation: 131 automated files / 798 tests, production build/typecheck, and 524 Chromium checks (262 each staged-worker and Worker-disabled fallback) passed. Native downloaded ZIP CRC checks and diff checks passed. Target 1 is complete; stop before target 2. Evidence: `/workspace/epicscope-integration-target1/evidence/`. Original large MLG and target hardware are unavailable. Account usage is not exposed.

The sections below preserve both prior handoffs as historical snapshots. Their statements about publication, branch authority and incomplete work describe their respective checkpoint dates, not this combined integration state.

## Historical main handoff


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


## Historical published improvement checkpoint handoff


## Local checkpoint — target 18 confirmed transport-ownership race (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Target 18 is confirmed and fixed locally. Stop here.** Stage 10 remains skipped/optional. All earlier local work is preserved, uncommitted and unpushed; no GitHub operation was performed.

- Confirmed the deferred candidate before changing production: `ShimTelemetryClient` checked socket identity at message entry but `handleMessage` awaited `binaryBytes` without checking afterward, and its rejection callback emitted protocol errors/set `error` without checking the originating socket. A Blob conversion from A could therefore finish after reconnect to B, decode against B's active streams and publish when stream ID/generation were reused. Rejection/corrupt bytes from A could change B's state, or overwrite manual `disconnected` with `error`. Protocol generation is not transport identity and corrupt data throws before generation filtering.
- Deterministic unit reproduction before fix: **6 failed / 9 passed** (eight original tests plus seven new ownership cases). The valid old frame after manual disconnect was already harmless because active streams were cleared; other stale/error cases still failed. Chromium independently reproduced the supported deferred Blob path: `lateTypes=[telemetry]`, current state `ready`, values **[111,222]** after reconnect rather than only the new stream's **[222]**. Both pre-fix logs/results are retained. This promoted the reproduction-gated candidate to a confirmed correctness issue.
- Minimal production change only in `adapters/shim/shim-telemetry-client.ts`: pass the existing originating socket to the private message handler; compare `this.socket !== socket` immediately after conversion/before decode; make the same comparison before the existing rejection/error path. No new generation/token, listener, observer, timer, queue, lifecycle wrapper or instrumentation was added. Existing text handling, current-socket errors, default `binaryType='arraybuffer'`, frame generation/channel checks, desired subscriptions, backoff and reconnect ownership remain intact.
- Shared test fixtures move the existing FakeSocket/scheduler/handshake/frame helpers out of the unit file for browser reuse, adding raw message injection. Original test assertions are retained. Nine new unit scenarios cover delayed valid/rejected/corrupt conversion across reconnect/manual disconnect, reused stream ID/generation, changed-generation corrupt input before decode, current native Blob success and current conversion failure. The browser executes the same scenarios using browser-native Blob support in controlled socket/scheduler fixtures; it is **not** a live ECU/WebSocket-server test. Deliberately deferred Blob delivery exercises supported conversion behavior despite the default ArrayBuffer preference; no claim is made that the default native WebSocket ordinarily delivers Blob with that preference.
- Validation: **129 automated files / 795 tests passed**, **9 shim files / 50 focused tests**, **514 Chromium checks / 257 per staged-worker and Worker-disabled fallback configuration**, no uncaught CDP exceptions; production build/typecheck and diff checks passed. New browser checks add nine/configuration while retaining all previous 496. Actual file/VE/controller/Diagnostics/native ZIP/persistence/renderer recovery acceptance remains passing. Post-fix obsolete events are empty, state remains `ready`/`disconnected`, replacement values are only **[222]**, and current native Blob success still yields **[333]** while current conversion rejection yields one protocol error and `error` state. Existing chunk warning and intentional stage-2/stage-7 synthetic runtime-error/rejection Vite logs remain.
- Investigation note: a missing closing brace in the newly added positive-control test describe block was caught by transform/typecheck and corrected before final acceptance; its failure log is retained. No assertion was disabled. The original telemetry test body is unchanged; fixture extraction is test-only, not a client refactor.
- Limits: normal transport requests ArrayBuffer, so actual exposure to long Blob conversions is lower than the supported fallback/custom-transport scenario. No live shim/ECU/network interruption stress test was available. This does not establish a cause for original large-MLG file-load/Analyzer freezes and does not change recording/history retention or file/decode caches. Original ~1.2-GB MLG/target-hardware acceptance, hosted CI, whole-browser/OS termination and real BFCache acceptance remain pending. No performance speedup or production deployment is claimed.
- Evidence: `/workspace/epicscope-improvements-target18/evidence/` contains baseline identity/scope before snapshots, pre-fix unit/browser reproduction, final/failure logs/results, isolated `target18.patch`, complete `complete-unpublished.patch`, original-assertion/hook checks, current docs and checkpoint hashes. Earlier audits/evidence/findings are unchanged. Account quota is not exposed and no automatic usage warning was received.
- Next: review/export/publish the accumulated local changes only when instructed, and complete representative original-recording/target-machine acceptance when available. Do not start optional stage 10 or an unrelated telemetry refactor automatically.


## Local checkpoint — target 16 migration stage 9 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Stage 9 is complete locally. Required implementation stages 1–9 are complete; original-recording/target-machine acceptance remains separate and pending. Stop here; optional stage 10 baseline intelligence is not started.** All previous stages/targets and target 17 remain intact, uncommitted and unpushed. No GitHub operation was performed.

- `observability/capture.ts` now owns explicit Diagnostics report assembly. Shell supplies its existing source/workspace/application context and prepared actual-owner Perf/Parser/persistence evidence. Coordinator derives health from the same recorder, emits one compact health snapshot, checks anomalies once, obtains one report snapshot and projects Runtime/Perf/Parser/session/recovery text plus stable export capture. Runtime/session lenses reuse the supplied record snapshot; no controller wrapper, automatic hook, source read, context/tune delivery, analysis pass or new state authority was introduced. The shell no longer independently assembles those reports.
- Moved unchanged runtime formatter/types to `observability/reports/runtime-report.ts` and removed `components/bug-report-formatter.ts` without a shim. Consolidated pure current-health projection beside machine rules in `health-rules.ts`, removing `components/bug-report-health.ts`. Badge polling and explicit capture use that same policy/wording; polling stays pure. Existing badge interval is now cleared by the existing shell remount disposal boundary, avoiding an old timer continuing work after replacement; no new timer/listener/observer was added.
- Moved unchanged Perf measurement contracts to `observability/performance-types.ts`; producers/reports/test fixtures no longer import data contracts from a DOM component. Removed Parser report/type re-exports from the indicator; report consumers import the canonical module directly. Canonical Parser ownership/prepared caches and source/cache measurement owners remain intact. Earlier stages already removed the parallel runtime-error array and Perf run stores, so no duplicate replacement store was created here.
- Retained compact Perf/Parser views deliberately: they still provide useful rich presentation and clear/copy/indicator semantics. Exact frozen Perf rich UI/text and complete Parser report/UI/severity parity remain passing. They are projections of the same authorities and formatters, not independent history stores. Deleting their features was not justified merely by old component names. The unified Diagnostics remains the full report/export entry; legacy CSS/selectors remain only where actually used.
- Renamed health/runtime/Parser pure report unit files to their observability projection responsibilities and updated direct imports; all original assertions are retained. Added four coordinator tests proving one report snapshot/check, exact shared-formatter output, stable retained capture after later errors/canonical changes, and pure shared badge health. Static ownership/parity evidence confirms runtime formatter body, entire Perf UI/behavior body, and measurement contracts are byte-identical after relocation; normalized retained test assertion bodies match. Observability modules no longer import from components.
- Validation: **129 automated files / 786 tests passed**, including **13 focused capture/health/runtime/Parser tests** and four new coordinator regressions; **496 Chromium checks / 248 per staged-worker and Worker-disabled fallback configuration**, no uncaught CDP exceptions; production build/typecheck and diff checks pass. Every previous browser check remains: frozen Perf text/rich UI, canonical Parser, native Diagnostics ZIP download/cancel/Escape, source/VE/Analyzer lifecycle, storage denial and actual renderer termination/recovery. Python `zipfile.testzip()` independently validates both final native downloads and matching captured timestamp/session. Final staged/fallback captures retained 723/710 records respectively.
- Browser investigation: TypeScript/build/unit checks initially passed while a JavaScript browser fixture still imported the removed Parser formatter re-export. Chromium correctly rejected that stale import. Updated the fixture to import the canonical report module directly; its assertions/fixtures are unchanged. Failed run is retained. Final browser replay passes. This is concrete evidence that TypeScript/CI success alone does not prove browser correctness. Existing chunk warning and intentional stage-2/stage-7 synthetic error/rejection Vite logs remain; no assertion/coverage was disabled.
- Limits: original ~1.2-GB / ~320k-record MLG and target-machine latency/heap acceptance remain unavailable/unrun, as do hosted CI, whole-browser/OS termination and actual BFCache eligibility. Stage-8 explicit JSON serialization/encoding/full Parser capture can still block on very large diagnostics; CRC remains chunked. No speedup, process-heap guarantee or deployment is claimed. Original audit/findings and prior artifacts, full recording retention, domain source/tune/generation/acceptance guards, physical/decoded/source caches, Parser authority and persistence/export schemas are unchanged.
- Evidence: `/workspace/epicscope-improvements-target16-stage9/evidence/` contains baseline identity/full local delta, changed/deleted before snapshots, isolated `target16-stage9.patch`, complete `complete-unpublished.patch`, final/failure logs and browser results, native ZIPs/screenshots/independent validation, ownership/body/assertion parity and hook/timer checks, current docs and checkpoint hashes. Account quota is not exposed and no automatic usage warning was received.
- Next: review the accumulated local changes and complete the separate representative original-recording/target-hardware acceptance when available. Publication requires the user's instruction. Optional stage 10 needs appropriate real usage/baseline evidence and separate authorization; do not start automatically. Reproduction-gated target 18 remains deferred. No unrelated domain refactor/deletion should be inferred from this checkpoint.


## In-progress checkpoint — target 16 migration stage 8 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Stage 8 is complete locally. Target 16 remains incomplete; stop before stage 9 parity-gated cleanup.** All previous stages/targets and target 17 remain intact, uncommitted and unpushed. No GitHub operation was performed.

- The existing Report entry now presents **EpicScope Diagnostics** with ten lenses: Health, Timeline, Operations, Anomalies, Performance, Parser, Resources, Errors, Previous session and Export report. `observability/diagnostics.ts` defines an explicit diagnostic-only capture and pure record/relationship projections; `components/diagnostics-view.ts` owns its controls/pagination. No new global listeners/observers, automatic UI polling, generic instrumentation or domain lifecycle wrapper was introduced. Existing compact Perf/Parser controls remain compatible; all their evidence is available through Diagnostics. Their deletion/consolidation remains stage 9.
- Opening or explicit Refresh captures health, one existing Perf probe/projection, complete canonical current Parser text/list, one recorder snapshot after explicit anomaly checks, loss/tracking state and previous-session history. Runtime/session report functions can project this supplied record snapshot instead of querying/checking again. The canonical Parser indicator exposes its existing readonly list through Logger; Perf exposes its existing capture projection, with no second authority/cache/source pass. `createDiagnosticsCapture` selects explicit fields and copies canonical diagnostics for stable offset/message/recovery evidence. No raw MLG/MSQ/INI/tune/workspace objects are attached.
- View switches, AND-combined exact filters and pagination reuse the capture. Timeline/Anomalies/Errors/Operations render at most 200 list rows; matched count/page and retention loss are visible. Filters cover subsystem/component/operation/origin/severity/active-hidden/kind/outcome/source-tune revisions/anomaly code plus name/reason/operation/code search. Operations are projected lazily once per capture with linear iterative traversal: actual parent/terminal/elapsed/stale evidence is preserved, missing starts/parents and cycles are marked, deep chains cannot recurse/overflow. Filtering does not invent missing historical parents. Elapsed durations are explicitly not CPU measurements.
- Perf text/physical-cache-decode semantics and full canonical Parser text remain unchanged. Resources uses structured captured Blob/decode/memory evidence rather than parsing English text. Previous session preserves the bounded black-box and unconfirmed-end qualification. Health/current badge stays separate from historical anomalies/errors. Explicit Refresh/open are the only evidence-recollection paths; copy/text export/ZIP use the retained snapshot. Legacy full report selectors/formatter text remain compatible for parity tests.
- `observability/export.ts` builds a dependency-free standard stored-entry ZIP containing exact captured `report.txt` and version-1 `observability.json`. JSON preserves all retained current/previous record relationships, complete current Parser messages/offsets/recoverability, health, Perf/resources, retention and persistence/anomaly tracking. Filters/pages do not reduce exported evidence. It is labelled full local diagnostics and can include filenames/environment/messages/stacks, with no silent raw file contents or transmission. CRC work yields every 64 KiB/checks a job-local AbortSignal; closing/toggling/outside dismissal/remount/Refresh cancels obsolete work, and URLs/buttons are cleaned up. Local Escape restores trigger focus; clipboard denial/absence exposes/selects captured full text. There is no persistent export timer/worker.
- Validation: **128 automated files / 782 tests passed**, including **10 new Diagnostics/filter/tree/export tests**; **496 Chromium checks / 248 per staged-worker and Worker-disabled fallback configuration**, no uncaught CDP exceptions; production build/typecheck and diff checks pass. All prior 484 browser checks remain, plus 6/configuration. Browser component checks use **20001 diagnostic records**, bounded 200-row DOM, correct paging/filter counts, safe HTML-like text, deep operations, all ten lenses and no implicit recollection. Real-shell checks use actual INI/MSQ/MLG/VE state, cycle all lenses without new records/probes/context/trace reads/VE runs, download the ZIP through Chrome, verify text/JSON session/record/Parser/resource identity, cancel a second export without another download and verify local Escape/focus.
- Independent standard-tool validation: Python `zipfile` opened both final downloaded bundles and `testzip()` passed. Each contains exactly `report.txt`/`observability.json`; captured timestamp/session agree. Final staged/fallback captures retained 735/712 current records respectively. Downloaded ZIPs and inspected screenshots are saved with browser evidence. Ten unit tests independently check CRC/local/central/end records, full Unicode Parser messages, source-revision zero vs missing, all filter dimensions, 20000-deep and cyclic/missing operation histories, supplied-snapshot reuse and cancellation checkpoints. Existing Perf frozen-text/UI, complete Parser, lifecycle, state authority and native persistence/renderer recovery regressions all remain passing.
- Investigation: initial implementation passed 782 automated/494 browser checks. Typecheck caught optional resource fields needing explicit undefined support under exactOptionalPropertyTypes; corrected the DTO without weakening compiler settings. Browser visual inspection showed an overly tall export pane; reduced it and retained the actual full text/export footer in view. Final additions cover cancellation/Escape/focus; final replay passes. Existing chunk-size warning and intentional synthetic stage-2/stage-7 Vite error/rejection logs remain. No assertion/coverage was disabled.
- Limits: JSON serialization/text encoding, explicit initial capture/complete Parser copying and initial ZIP input construction are synchronous; CRC is chunked. Extremely large canonical diagnostic lists/export memory and target-hardware responsiveness still require profiling. Stored ZIP entries intentionally do not compress; output is an explicit artifact outside automatic recorder retention. Synthetic 20001-record UI checks are diagnostic records, not the original 320k-record MLG. Original ~1.2-GB recording/target hardware, hosted CI, whole-browser/OS crash and actual BFCache eligibility remain unrun. Earlier audit/evidence, full recording retention, domain source/tune/state/generation guards, cached decoded data and canonical Parser/Perf ownership are unchanged.
- Evidence: `/workspace/epicscope-improvements-target16-stage8/evidence/` contains baseline identity/full local delta, changed before snapshots, isolated `target16-stage8.patch`, complete `complete-unpublished.patch`, final/initial validation logs/results, native ZIPs/screenshots/independent validation, diagnostics measurements, global-hook/export-job ownership checks, current docs and checkpoint hashes. Account quota is not exposed and no automatic usage warning was received.
- Next only when authorized: **stage 9 parity-gated cleanup** of redundant compatibility/report ownership and app-shell wiring. Preserve frozen Perf/Parser text, compact indicator semantics, complete exports, previous-session recovery and all controller/source/cache boundaries; do not delete features just because old module names remain. Stage 10 optional intelligence remains separate. Do not proceed automatically.


## In-progress checkpoint — target 16 migration stage 7 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Stage 7 is complete locally. Target 16 remains incomplete; stop before stage 8.** Earlier stages/targets and target 17 remain intact, uncommitted and unpushed. No GitHub operation was performed.

- Added `observability/persistence.ts`: lazy version-1 IndexedDB adapter behind `SessionStore`, with separate compact summaries and evidence stores. Transactions atomically save the current session and prune retention; ordinary saves inspect compact indexes rather than reading other sessions' full bodies. Concurrent tabs use independent session keys and serialized transactions. Schema/byte-index validation prevents unsupported/corrupt data from being silently reset or rewritten. This is the first persisted format; no prior format is migrated by guesswork. Newer DB versions fail without downgrade/deletion. No localStorage key or existing workspace/INI/tune/cache schema changed.
- Added `session-persistence.ts`, owned by the existing shell session. It performs asynchronous startup recovery/initial batch, one 30-second owned interval and batches at existing visibility/pagehide/dispose boundaries. No new global listener, observer, generic lifecycle wrapper or per-record callback/write was introduced. The interval is disposed at end/remount. Overlapping requests coalesce behind one serialized writer; idle heartbeats update only the summary index without recorder snapshot reconstruction or evidence-body puts. Dirty evidence survives failed replacement writes; a later batch retries it. One bounded failure event per episode plus a recovery event avoids recursive persistence/anomaly storms. Recovery/schema denial blocks writes for that session while current memory/navigation remain usable. Close failures are contained.
- Added `retention.ts`: at most 5000 records/1 MiB UTF-8 payload per session, current plus up to three other sessions, a separate 5-MiB total payload ceiling and seven-day session/record age limits. These conservative per-session caps normally keep combined evidence below 4 MiB; limits are serialized payload bounds, not exact disk/heap budgets. Up to eight recent error/anomaly windows retain ten available records before/after each trigger. Trigger selection/materialization is bounded during selection, not after allocating every error window. Triggers and the newest 20 records precede extra context/tail when budgets compete. Windows survive tail/current-ring rollover; idle evidence still expires. A writer-local weak immutable-record size cache avoids repeated per-record sizing without retaining evicted keys.
- Compact summaries record start/lastSeen/last sequence, confirmed end, last active view/completed operation/checkpoint and observed error/anomaly/loss counts. Counts derive from retained new records visible at batch boundaries and may miss already-evicted history. Recovered evidence remains separate from the new recorder/runtime-error counts and domain state. Existing shell read-only snapshot now exposes persistence status/history, with no flush/mutation API added for tests.
- Existing Bug Report adds `reports/previous-session-report.ts`: up to three summaries, final 20 records and up to three available neighbors around each retained trigger. An observed committed end is `confirmed-normal-end`; its absence is `unconfirmed-no-end-observed`, explicitly not crash causality and possibly another active tab. Recovery is an asynchronous startup snapshot, not live cross-tab UI; an early report may show loading and can be reopened. Unified Diagnostics remains stage 8. Session reporting no longer incorrectly says persistence is absent.
- Validation: **127 automated files / 772 tests passed**, including **25 new persistence tests** and **32 focused persistence/runtime-error tests**; **484 Chromium checks / 242 per staged-worker and Worker-disabled fallback configuration**, no uncaught CDP exceptions; production build/typecheck and diff checks passed. All original 460 browser checks remain plus 12/configuration. Native tests cover real IndexedDB close/reopen, atomic quota-fault abort/recovery, summary-only heartbeat puts, session/byte/age caps, unsupported database/payload protection and a bounded 20000-event batch. CDP actually terminates the renderer after a committed visibility batch, then reloads and verifies unconfirmed recovery/tail/window/error isolation. A separately committed normal end is recovered as confirmed. Preload IndexedDB getter denial preserves navigation/current diagnostics and reports one bounded failure; healthy reload restores access/history. Whole-browser/OS termination, actual BFCache eligibility and original-recording/target-hardware acceptance remain unrun.
- Batch observations on shared Chromium for 20000 diagnostic events (not log samples): staged first flush **73.4 ms**, idle heartbeat **3.9 ms**, small-update flush **29.0 ms**; fallback **54.4 / 3.8 / 32.9 ms**. Both retained **3068 records / ~1 MiB**. These are elapsed times including transaction waits and bounded serialization/selection, not pure main-thread CPU, file-read timings, speedup, exact heap or target-hardware acceptance. They remain a performance consideration under diagnostic storms; there is no timing pass/fail assertion. Recorder loss from deliberately filling the bounded ring is visible, with zero rejected/critical-evicted/internal-failure records in those fixtures.
- Investigation: the initial count test incorrectly expected all 5000 records despite the authoritative 1-MiB byte cap; corrected it to require the count ceiling/newest tail and byte bound. An old runtime-report assertion still claimed persistence was absent and was updated to the new separate recovery lens. Full browser replay exposed an existing exact-coalescing test's real-clock assumption under CPU contention; its fixture now uses a controlled monotonic clock, retaining all exact 100000-event assertions and real elapsed observations. A later readiness poll raced DevTools document replacement; polling now retries only known context/navigation protocol errors, while assertions/application errors remain fatal. Initial/failure logs are retained; final replay passes. Existing bundle-size warning and intentional synthetic stage-2/stage-7 Vite error logs remain.
- Best effort/limits: pagehide transactions can be interrupted; committed periodic/lifecycle evidence is recoverable, uncommitted events/power-loss durability are not guaranteed. Windows are partial when ring/coalescing/byte limits have removed context. Seven-day cleanup occurs on owner load/save/batch; no extra idle cleanup timer exists. Original ~1.2-GB MLG, target-hardware latency/heap and hosted CI remain unavailable/unrun. Original audit and earlier artifacts were not altered. No domain calculation, source/tune ownership, generation guard, cache, full-recording retention policy or automatic anomaly repair changed.
- Evidence: `/workspace/epicscope-improvements-target16-stage7/evidence/` contains baseline identity/full unpublished patch, changed before snapshots, isolated `target16-stage7.patch`, complete `complete-unpublished.patch`, policy/measurements report, final/initial/failure logs and browser results, hook/timer ownership checks, current docs and checkpoint hashes. Account quota is not exposed and no automatic usage warning was received.
- Next only when authorized: **stage 8 unified Diagnostics UI/reports/export**, using shared current/anomaly/previous-session lenses while keeping canonical Parser and existing Perf read/cache distinctions. Stage 9 remains parity-gated cleanup; stage 10 optional intelligence. Preserve independent original-recording/target-machine and whole-browser/OS/BFCache acceptance follow-ups. Do not proceed automatically.


## In-progress checkpoint — target 16 migration stage 6 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Stage 6 is complete locally for the initial anomaly-rule scope. Target 16 remains incomplete; stop before stage 7.** All previous stages/targets and target 17 remain intact, uncommitted and unpushed. No GitHub operation was performed.

- Added recorder-owned `observability/anomaly-detector.ts`, enabled explicitly only at the shell session. Standalone recorders remain disabled by default. It consumes prepared accepted/coalesced inputs via direct internal calls, not a subscription/global hook or lifecycle wrapper. Derived records append internally without detector recursion. Streaming work is bounded map access; unfinished checks iterate at most 128 pending operations only on explicit session-report request. No new observer, listener, timer, worker, domain revision, state authority, full-log traversal or persistence format was introduced. Internal failures preserve the producer's accepted record.
- Ported all seven existing health predicates and their exact message wording/order into `health-rules.ts`; the former component is a compatibility projection. The existing 750-ms badge poll remains pure. Explicit report creation records ten scalar fields from its already acquired health snapshot, allowing the same predicates to produce machine-coded anomalies linked to actual evidence. Historical anomalies do not change the badge/current issues/warnings or become a second runtime-error authority.
- Initial classes: 100 matching events/1 second yields repetition evidence; three eligible same-state work boundaries/1 second requires complete owner-provided semantics and actual successful completion/rebuild; explicit rejected stale markers are informational; starts without an observed terminal after 30 seconds are informational at report time; actual failed/unavailable durable persistence with known session retention yields warning evidence. Existing operation outcomes, source-bound reads, generation guards, storage/cache authority and exact retry calls are unchanged. Duration thresholds do not become application timeouts or CPU diagnoses.
- Conservative interpretation: request/no-op/presentation/cache-hit markers, a single hidden Distribution completion and trace-read elapsed duration are not inferred to be expensive repeated work. Current VE rebuild/render evidence has no complete semantic fingerprint, so same-state inference intentionally does not fire for it; that opt-in rule capability is covered by synthetic owner sequences. Fingerprints at the recorder's truncation boundary are excluded. Informational stale evidence often confirms a healthy rejection guard. Known session-only persistence is reported without implying the application hid the failure or claimed durable success.
- Each of four detector indexes holds at most 128 entries; pending state retains only compact identity. FIFO tracking loss is exposed separately from recorder retention. Findings are limited to 16/1-second window and a 60-second per-rule/component/owner/operation cooldown, with rate suppression counted. `reports/anomaly-report.ts` adds the last 30 retained findings to existing Bug Report with evidence sequence ranges and actual operation/owner/generation references. References may be coalesced/evicted. Historical evidence remains after recovery; coverage is explicitly incomplete under loss/suppression.
- Validation: **126 automated files / 747 tests passed**, including **28 new anomaly tests** and **51 focused anomaly/legacy-health/foundation tests**; **460 Chromium checks / 230 per staged-worker and Worker-disabled fallback configuration**, no uncaught CDP exceptions; production build/typecheck and diff checks passed. All original 446 browser checks remain, plus 7/configuration covering actual VE retention/stale cancellation, persistence failure/single retry, report-time unfinished success, distinct-stale output cap, alternating overhead observations and real-shell Report without new context/read work. Existing bundle warning and intentional stage-2 synthetic runtime-error/rejection log entries remain.
- Investigation: initial implementation passed 744 automated/458 browser checks before adding the derived-output cap. The first new Chromium storm assertion incorrectly required an exact suppression count, overlooking the separate burst finding caused by the same inputs. Corrected it to require the derived-output cap and minimum suppressed-operation count; the failed run is retained in evidence. Final replay passes. No production regression was hidden or disabled.
- Overhead: alternating 5000-call recorder batches with detector disabled/enabled yielded medians **17.4 / 21.2 ms staged**, **24.3 / 38.5 ms fallback**. These compare an existing bounded recorder with/without detection, unlike stage 5's absent-emitter comparison. Raw rounds vary on shared Chromium and do not prove original-large-log/target-hardware overhead, process-heap budget or end-to-end speedup. No timing pass/fail threshold is used. The small actual VE/persistence fixture retained ~24 KB/62 records with zero rejected/evicted/internal-failure records and zero detector tracking loss/suppression.
- Limits/deferred: original ~1.2-GB MLG/target-hardware acceptance and hosted CI remain unrun. Original audit/earlier evidence are unchanged. Causal cycles, hidden material-work attribution, resource growth, unexpected physical I/O, relative CPU baselines and previous-session termination inference remain deferred; they require richer evidence/persistence. This stage records patterns and never repairs/cancels application state automatically. Full recording retention, decoded/source caches, canonical Parser data and existing Perf physical/cache distinctions are preserved.
- Evidence: `/workspace/epicscope-improvements-target16-stage6/evidence/` contains baseline identity/full local patch, isolated `target16-stage6.patch`, complete `complete-unpublished.patch`, changed before snapshots, policy/overhead report, final/initial/failure logs and browser outputs, hook-count checks, current docs and checkpoint hashes. Account quota is not exposed and no automatic usage warning was received.
- Next only when authorized: **stage 7 bounded batched persistence and previous-session black-box recovery**, using the approved retention/recovery policy in OBSERVABILITY.md. Do not introduce synchronous per-event storage writes. Stage 8 remains unified Diagnostics/export, stage 9 parity-gated cleanup, stage 10 optional intelligence. Preserve the independent original-recording acceptance follow-up.


## In-progress checkpoint — target 16 migration stage 5 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Stage 5 is complete locally for the high-value owner boundaries below; target 16 remains incomplete. Stop before stage 6.** Earlier stages/targets, including target 17, remain intact, uncommitted and unpushed. No GitHub operation was performed.

- Added passive `observability/producers/owner.ts`: explicit scalar-only event/operation calls at owners, unique diagnostic producer IDs, actual caller-provided revisions/generations and strict terminal/stale handles. It does not wrap controllers, intercept functions, hash domain state or become a domain authority. Optional recorder plumbing follows the existing VE layers and domain factories; no new controller/lifecycle layer or global recorder is installed. Diagnostic results do not drive application acceptance or cancellation.
- VE v2 records unchanged/deferred/changed context/tune delivery, actual invalidation/rebuild revisions, table render boundaries, primary listener counts and actual analysis outcomes. Existing hide, semantic invalidation and Cancel paths terminate the diagnostic handle; delayed completions at existing guards retain cancelled/superseded outcome and add stale evidence. Delay discovery/file boundaries retain their existing generations as events rather than fabricated full operation spans. Popup detail build/hit/invalidation records reference retained primary/cache state, not recomputed evidence. Existing v5 observer and v7 queued presentation boundaries are recorded; Result View origin and semantic revision remain presentation-only.
- Analyzer router/comparison and five domain controllers expose route/request/rebuild/read-start/current/failure/stale generation boundaries. Histogram router/Table/Distribution/Scatter do likewise; completion metadata records actual own-ancestor hidden/connected state without a document-wide scan. Math preview has explicit operations across its existing debounce, replacement, hide and delayed completion guards. Existing active routing, revision changes, generation guards, calculations, data extents, 180-ms debounce and 10000-sample preview cap are preserved.
- Logger records actual context construction and captured source-bound trace-read operations using existing revision/extent and a current-source flag. A captured old context remains intentionally usable for its advertised source; it is not rejected merely because Logger navigated/replaced sources. Read duration includes combined await/assembly work and is not pure file I/O; existing Perf physical/cache/decode metrics retain those distinctions. Shell workspace restore records actual start/outcome at the existing owner. Resource evidence uses existing lengths, listener/cache sizes and prior workflow-boundary memory probes, with no new polling or sample passes.
- Three storage adapters record actual load/save/remove outcomes while preserving exactly one normal storage acquisition/write and original exception identity. Exception-name extraction is guarded so a hostile name getter cannot replace the thrown object. INI table definitions record durable success/failure/unavailable after memory acceptance and the existing dispatch boundary; its cached authority, best-effort void API, write count and notification order remain unchanged. Existing visible persistence feedback records save/delete/retry results without extra retry/storage calls. Storage keys/schemas, cached hydration, serialization and domain error handling are unchanged.
- Bug Report now includes `reports/owner-report.ts`'s bounded 30-record owner tail with operation/outcome/generation/revision and coalescing details. It queries the existing stream on explicit report request and never re-records evidence. It is a retained excerpt, not complete history. Unknown origins are system; known native/programmatic selections retain their actual origin. Metadata captures no samples, decoded columns, workspaces, tunes or formula expressions.
- **Observed remaining behavior:** the component Chromium case confirms a current pending Distribution completion can proceed after an ancestor becomes hidden. The marker makes that existing behavior visible; this stage deliberately does not change acceptance or claim cancellation there. Hidden completion alone, or a wall-time trace-read span, does not establish expensive CPU work or explain the original freeze. Stage 6 must not blindly classify request markers, benign no-ops or every hidden completion as an anomaly; distinguish actual calculation/CPU from request/await boundaries.
- Validation: **125 automated files / 719 tests passed**; focused **29 tests** (17 new owner/report/storage/cache regressions and 12 existing storage-acquisition checks); **446 Chromium checks / 223 per staged-worker and Worker-disabled fallback configuration**, no uncaught CDP exceptions; production build/typecheck and diff checks passed. Ten new Chromium component/integration checks per configuration plus the hidden completion case cover real success, retained no-ops/primary results, popup reuse without reads, presentation-only Result Views, cancelled/superseded stale VE and Math work, exact failed-save/retry/recovery/deletion calls and actual shared Logger/workspace/VE/storage/owner-report evidence. Original 424 checks are retained.
- An alternating 5000-call enabled/disabled emitter benchmark records medians around **22.4 ms staged / 45.2 ms fallback enabled**, versus **0.2 / 0.3 ms disabled** near timer resolution (~4.5–9 microseconds per enabled detail call). Raw rounds and bounded/coalesced health are in overhead.json; this is a synthetic scalar-emitter cost on shared Chromium, not an end-to-end large-log or target-hardware guarantee. No timing threshold assertion, process-heap-budget proof or speedup claim is made. No per-sample/frame logging was added. Existing bundle warning and intentional stage-2 Vite synthetic errors remain.
- Investigation/limits: the first new browser test selected a non-select Result View node; it was corrected to the existing accessible select, with the failed log retained. Typecheck caught an incomplete new INI test fixture and the fixture was completed before final acceptance. Original ~1.2-GB MLG/target-hardware acceptance and hosted CI remain unavailable/unrun. Original audit and earlier artifacts are unchanged. No new listener, observer, timer, worker, persistence format, anomaly policy or domain acceptance fix was introduced.
- Evidence: `/workspace/epicscope-improvements-target16-stage5/evidence/` contains exact pre-stage baseline patch/hash, owner map, emitter measurements, passing logs/results, changed before snapshots, current docs, isolated `target16-stage5.patch`, complete `complete-unpublished.patch`, and checkpoint hashes. Quota/account usage is not exposed and no automatic usage warning was received. This is the requested clean stage boundary.
- Next only when authorized: stage 6 anomaly rules, starting with existing health-rule parity and evidence-linked anomalies. Stages 7–9 still cover batched persistence/recovery, unified Diagnostics/export and parity-gated final cleanup. Stage 10 is optional intelligence. Preserve the separate original-recording/target-machine acceptance follow-up.


## In-progress checkpoint — target 16 migration stage 4 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Stage 4 is implemented locally and browser validated. Target 16 remains incomplete; stop before stage 5.** All earlier local work, including target 17 and stage 3, is preserved, uncommitted and unpushed. No GitHub operation was performed.

- `ParserDiagnostic` remains canonical. Moved grouping, integrity calculation and full-text formatting from the indicator to `observability/reports/parser-report.ts`; retained compatibility exports/types at the old component path. The indicator owns one prepared model borrowing the complete canonical list; UI and explicit report actions reuse its groups/counters rather than regrouping/sorting the diagnostics for each copy. Its existing 40-row UI cap is unchanged; complete reports still include every diagnostic, full messages, severity, offset, recovery distinctions and the original grouping semantics. Core parser/CRC/counter/recovery algorithms and diagnostic policy are unchanged.
- Logger's optional recorder/source-context dependency publishes compact `parser.source-integrity.summary` snapshots at its existing diagnostic publication boundaries, including growing sources, validation, rebinding and explicit errors. The snapshot has total/unresolved, severity/recoverability counts and the five integrity counters. It contains no diagnostic-message arrays, source buffers, samples or second canonical parser store. Existing source revision is borrowed from Logger; no new domain revision is invented. The full current report remains available if recorder history is evicted.
- At the existing file-input owner, explicit `source.load` operations begin on actual file selection. Source-object WeakMap associations attach their IDs to Logger publications; same-named replacement loads remain distinguishable without an ambient async-operation slot or unbounded source map. Main-thread success covers parse/acceptance; staged success includes accepted CRC validation, with workspace timing remaining separately visible in Perf. Existing fallback continues within the same operation. Explicit teardown/new-file selection records cancellation/supersession, and late terminal attempts become stale-completion evidence. Instrumentation does not alter existing domain cancellation/generation/acceptance guards or fix previously possible main-thread import races.
- Unified report ownership: Bug Report now adds the complete current Parser report on explicit request, plus up to 20 latest retained correlated source summaries in the session lens. Repeated pending/validated summaries for one operation/source replace its summary rather than being added together. Source-load lifecycle duration includes elapsed work/waiting and must not be interpreted as pure I/O; Perf retains the separate CPU/read/decode/cache measurements. No raw diagnostic report is regenerated in a new background timer or polling path. Explicit full report formatting can still scale with diagnostic count, as the existing Copy report did.
- Baseline browser capture passed **420 checks** before production changes. Frozen `parser-evidence-parity.json` covers empty, pending/retry recovery, CRC/counter anomalies and a fatal/1000-character-Unicode-message case with 45 warnings. Final report text, indicator text and severity class match exactly in both configurations; the owner-cached report also matches the canonical formatter, including occurrences beyond the visible cap. Integrated real-file tests after INI/MSQ/MLG and VE require correlated source-load start/success plus canonical/current Parser and session evidence in Bug Report.
- Validation: **124 automated files / 702 tests passed**; focused **10 tests** (seven new bridge tests plus three existing integrity/report tests); **424 Chromium checks / 212 per staged-worker and Worker-disabled fallback configuration**, with no uncaught CDP exceptions; production build/typecheck and diff checks passed. New tests cover full canonical borrowing/completeness, recovery distinctions, compact owner correlation, latest-summary replacement, same-name load separation, bounded recent-source projection and report completeness after recorder eviction. Intentional stage-2 synthetic errors remain visible Vite log entries. The existing bundle-size warning remains.
- Limits: corrupt-file worker failure, overlapping real-file cancellation and late main-thread completions were inspected but not newly browser fault-injected in this stage; operation terminal/stale contracts retain their existing foundation tests. No claim of new stale-domain-completion prevention is made. Hosted CI, the original ~1.2-GB recording and target-hardware overhead acceptance remain unrun/unavailable. Original audit findings and earlier evidence are unchanged. No new global listener, observer, lifecycle wrapper, worker, timer, persistence schema, telemetry or analysis behavior was introduced.
- Evidence: `/workspace/epicscope-improvements-target16-stage4/evidence/` contains exact baseline identity/complete patch, before snapshots, baseline/final browser outputs and complete parser parity/current-report examples, focused/full/build logs, current docs, isolated `target16-stage4.patch`, complete `complete-unpublished.patch` and checkpoint hashes. Account quota remains unavailable; no automatic usage warning was received. This is the requested clean stage boundary.
- Next, when authorized: stage 5 owner state/render/async/storage producers. Later stages remain anomalies, batched persistence/recovery, unified Diagnostics/export and parity-gated cleanup. Keep original-recording/target-hardware acceptance outstanding; do not start another stage automatically.


## In-progress checkpoint — target 16 migration stage 3 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Stage 3 implementation and local synthetic/small-file acceptance are complete; original-recording/target-hardware overhead acceptance remains pending. Target 16 is incomplete. Resume at stage 4 when requested; stop here for review.** Target 17 and all earlier changes remain intact. Everything is local, uncommitted and unpushed; no GitHub operation was performed.

- Existing shell `recordLoad/recordIniLoad/recordBinding/recordWorkspaceRestore/recordValidation/recordChannel` boundaries now publish metrics into the existing session recorder. Measured durations remain owner measurements; no retrospective operation start/end or ambient async context was invented. The compatibility methods/contracts remain at the existing controller boundary. Source/tune/async causal correlation remains later owner migration work.
- Added explicit scalar schemas and `observability/producers/performance.ts`; TypeScript checks scalar field coverage, including nested resource fields. No samples, decoded columns, domain objects or full-state hashes are recorded. Known grouped diagnostics/slow reads are flattened up to 256 entries; strings are fragmented up to 65536 UTF-16 code units, with explicit truncation evidence. Four fields per part fit the shell's 8-KiB allowance even for worst-case escaped strings. Each measurement requires its commit and every part before reconstruction; incomplete/lost evidence is surfaced rather than presented as a partial valid run.
- Removed the five mutable run arrays from the Perf component. Clear is a diagnostic-lens marker; new load resets its workspace/channel/decode lens as before, while runtime/navigation evidence remains retained. Moved the old component formatter into `observability/reports/performance-report.ts`, now a pure projection over stream-derived runs/resource snapshots. The old `components/performance-diagnostics-report.ts` is removed; no parallel builder remains. Derived history limits remain 20 recent load/INI/binding/restore and 50 channel measurements, with the existing 24-row channel report/UI tail.
- Perf reconstructs only selected recent measurement tails, then caches one immutable derived read model. Sequence/count and rejection/internal-failure counters plus enforced age expiry govern validity. Three bounded resource signatures avoid duplicate snapshots only while that retained projection is valid. The cache does not become another mutable producer authority. Existing low-level channel-decode, Blob, bound-cache and persistent-cache collectors stay at their canonical owners and are sampled at explicit lens requests. Ordinary visible Perf refresh does not add Blob scope/sort work; hidden completion updates do not rebuild Perf DOM. Existing listener/observer/timer/worker boundaries are unchanged.
- Before implementation, **406 Chromium checks** passed and complete deterministic Perf text/UI were frozen in `tests/fixtures/browser/performance-parity.json`. The migrated controller matches them exactly in staged-worker and Worker-disabled fallback configurations. New integrated checks run after actual small INI/MSQ/MLG imports and VE analysis, requiring shell-owned load/INI/binding/restore metrics, Perf/Bug Report source/resource/session evidence, no context republishing on report opening and zero rejected metadata records. The sample-count value 320459 in the overhead fixture is scalar metadata, not an actual large recording.
- Browser profiling caught unnecessary full retained-history reconstruction in the first bridge: initial staged mean repeated report cost was ~35.9 ms after 1800 channel measurements. Tail selection plus revision caching/deduplicated probes reduced final first-report cost to ~11.9 ms staged / ~11.7 ms fallback, with repeated reports ~0.32 / ~0.19 ms. Median 200-call batches imply ~0.051 / ~0.059 ms per completed metric. The old array-only loop was near timer resolution (~0.3–0.4 ms total for 1800 calls), so no percentage/ratio claim is appropriate. Before/after cold/warm protocols and all raw timings are documented in external evidence; these are shared Chromium synthetic costs, not an end-to-end speedup or target-machine guarantee.
- Validation: focused **14 tests** (13 new bridge regressions plus existing formatter test); full **123 files / 695 automated tests**; reproducible **412 Chromium checks / 206 per staged-worker and fallback configuration**, no uncaught CDP exceptions; production build/typecheck and diff checks passed. Regression coverage includes exact run-category round trips, validation merge, resource/slow-read/decode detail, clear/source boundaries, partial eviction, bounded storms/shared loss, explicit Unicode/escaped-string bounds, unknown payload exclusion, throwing producers/probes, immutable read-cache expiry, probe deduplication and owner isolation. Intentional stage-2 synthetic errors remain Vite log entries. Existing bundle-size warning remains. Hosted CI was not run.
- Limit: only the small repository MLG is available; the original ~1.2-GB recording is absent. Its representative integrated overhead/target-hardware acceptance remains an explicit stage-0/3 follow-up. No original audit was rerun or altered. No parser-report migration, generic instrumentation, persistence, anomaly rule, unified UI, domain calculation, live-graph/capture change or further legacy deletion was included.
- Evidence: `/workspace/epicscope-improvements-target16-stage3/evidence/` contains exact baseline identity/complete patch, pre-migration and initial/final browser results, parity/overhead report and JSON, passing logs, before snapshots, current docs, isolated `target16-stage3.patch`, complete `complete-unpublished.patch`, and checkpoint hashes. Prior stage-2/target-17/audit artifacts remain unchanged. Account quota is not visible and no automatic usage warning was received; this is the requested clean stage boundary.
- Next: stage 4 parser/source-integrity producer/report bridge, preserving `ParserDiagnostic` as canonical evidence and its existing source ownership. Later stages still cover detailed owner state/render/async/storage producers, anomalies, batched persistence/recovery, unified Diagnostics/export and parity-gated collector cleanup. Do not proceed automatically.


## Local checkpoint — target 17 parity-gated cleanup (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. The user explicitly authorized target 17 after target 16 stage 2. **The parity-proven cleanup is complete locally; target 16 remains incomplete at stage 2.** Stop here for review. All earlier local work is preserved, uncommitted and unpushed; no GitHub operation was performed.

- Removed the Table Generator formula editor that was permanently hidden by CSS: HTML, eight queried controls/required-element guards, three handlers, duplicate save/delete and persistence feedback, repeated editor/option rebuilding at construction/context/change events, obsolete imports and formula-only styles. Math Channels remains the visible editing owner. Table Generator retains formula loading, X/Y/Z/filter/delta consumer selectors, shared logical evaluation, change-event consumption, preset/filter persistence and evidence/export behavior. No storage key/schema, accepted field IDs, analysis algorithm, observer, global listener or lifecycle contract changed.
- Before removal, the expanded visible-editor parity suite passed **378 Chromium checks** in staged-worker and Worker-disabled fallback configurations. It proved historical-expression creation, metadata save, stable-ID editing, accepted Table values/labels, rejection of invalid replacement without corrupting the saved formula, deletion propagation, and existing Distribution/Scatter/preview semantics. The previous hidden-editor-specific assertion was replaced with visible-owner parity rather than simply deleted.
- Updated the standalone persistence regression to remove its retired hidden-editor case, keeping visible Math Channels coverage. Added all remaining five visible-owner cases to the reproducible runner: both quota/security save/delete failures, session retention, actionable visible feedback, repeated failure/retry, latest-cache safety and success. An explicit check rejects reconstruction of the superseded editor. A static comparison confirms all **142 surviving CSS selectors** retain identical declarations.
- Final validation: **400 Chromium checks / 200 per staged-worker and fallback configuration**, no uncaught CDP exceptions; **122 automated test files / 682 tests** and production build/typecheck passed. Intentional stage-2 synthetic runtime error events remain visible in Vite logs. Existing build chunk-size warning remains. Hosted CI, the original 1.2-GB recording and large-log end-to-end timings were not run; this removes demonstrable hidden DOM/rebuild work without claiming a measured large-log speedup.
- Deliberately retained the specialized suite's legacy Ignition and Fuel/Injector branches. They are unreachable through normal shell routing but reachable through the exported standalone controller and existing browser regressions. Legacy Ignition groups knock events; the dedicated current view intentionally avoids knock inference. Fuel/Injector qualification/architecture behavior also differs. No semantic parity was established, so deleting those branches or their tests would discard behavior. The core analyzers remain used and are not dead code. Their retirement requires an explicit compatibility decision, not blind deletion.
- Existing Perf/parser collectors remain authoritative because target 16 has not reached their migration stages. No diagnostics store, historical fixture, versioned VE controller layer or legacy reference utility was removed solely because of its name. Target 18 remains reproduction-gated; do not start it automatically.
- Evidence: `/workspace/epicscope-improvements-target17/evidence/` includes ownership/parity decisions, pre/post browser logs/results, surviving-CSS parity, test/build logs, before snapshots, isolated `target17.patch`, complete `complete-unpublished.patch`, current docs and SHA-256 checkpoint identity. Prior audit/foundation/stage-2 evidence is unchanged. Next approved architectural work remains target 16 stage 3 when requested; no live account quota reading or automatic usage warning was available.


## In-progress checkpoint — target 16 migration stage 2 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Stage 2 is complete locally; target 16 remains in progress. Resume with stage 3, not target 17.** All earlier local targets and foundation changes remain intact, uncommitted and unpushed. No GitHub operation was performed.

- Application shell owns one bounded session. Existing runtime error/rejection handlers feed the recorder; the old separate error array is removed. The legacy Bug Report projects the chronological last 50 retained runtime errors and adds compact session/pressure evidence. Normal error fields retain parity; oversized fields are visibly truncated. Arbitrary rejection objects are not serialized. Shell record allowance is 8 KiB for bounded Unicode errors; total record/count/age budgets remain bounded.
- A bounded retained-name index keeps routine runtime-error health counts independent of snapshot/report scans. Counts update on insertion/eviction/expiry; health queries do not flush coalescing summaries. Explicit report generation still scans the bounded recorder, never log samples.
- Actual shell/Analyzer/Histogram owners publish navigation and active/hidden state. Accepted-input evidence uses Logger's existing data revision, source/tune/catalog reference identities, sample count and A/B boundaries; unchanged updates add no context event. Opaque diagnostic tags do not become domain revisions or authority. No sample reads, full-state hashes, extra setContext calls or analysis runs are added. Detailed saved-scope/qualification/invalidation and operation correlation remain stage 5 work.
- Existing error/rejection listeners are reused; three targeted pagehide/pageshow/visibilitychange listeners belong to the shell and are disposed on remount. BFCache suspension/resumption retains the session; nonpersisted pagehide records one observed end. Actual reload creates a fresh session without old runtime errors. No timer, observer, lifecycle wrapper, persistence, prior-session recovery or inferred crash/termination was introduced. Synthetic BFCache events test handler semantics, not real BFCache eligibility.
- Validation: **122 automated test files / 682 tests**, **372 Chromium checks / 186 per staged-worker and Worker-disabled fallback configuration**, and production build/typecheck passed. Seven new unit tests and eight integrated browser checks per configuration cover stream/report parity, Unicode bounds, hostile rejections, count eviction/expiry, navigation, unchanged inputs, lifecycle and reload isolation. Synthetic error events are intentional Vite log entries; uncaught CDP exceptions still fail the runner. Existing build chunk-size warning remains. Hosted CI, the original large recording and representative target-hardware integrated overhead were not run; no end-to-end speedup is claimed.
- Investigation during acceptance: corrected a Histogram producer referencing `root` instead of its owner element `page`. The reload test initially read a different Vite module instance and could observe the old document; it now waits for document replacement and reads through the canonical browser test import. Passing reload checks require a different session ID, exactly one start and no old errors. Failed reload log is retained with stage-2 evidence.
- Evidence: `/workspace/epicscope-improvements-target16-stage2/evidence/` contains logs/results, docs, isolated stage-2 patch, complete unpublished delta, and source identity/hashes. Prior foundation/audit evidence remains unchanged. The prior foundation checkpoint below is historical; its statements that production producers are not installed no longer describe this stage.
- Next: stage 3 performance evidence bridge/report projection with preserved Perf output and overhead comparison. Then parser correlation, remaining owner producers, anomaly rules, versioned batched persistence, unified Diagnostics/export, and deletion only after parity. Stage-0 original-recording/target-hardware acceptance remains outstanding. Do not start target 17 or delete unmigrated Perf/parser stores. No actual quota warning was available; this is the requested bounded stage checkpoint.


## In-progress checkpoint — target 16 foundation (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Target 16 is not complete. Baseline preparation and the passive recorder/session/operation foundation are implemented locally; resume with observability migration step 2. Do not start target 17.** Earlier targets 6/7/9/10/11/12/14 and 8/13 profiling remain intact. All changes remain uncommitted/unpushed; no GitHub operation was performed.

Why checkpoint here: the approved docs/OBSERVABILITY.md is a ten-stage architecture migration, substantially larger than recent targets. The user last reported 29% remaining before target 14. This is a clean bounded continuation point; no live quota reading or fabricated 5% warning is claimed. Existing production diagnostics are deliberately unchanged until their replacements reach parity.

- Baseline frozen before implementation: `/workspace/epicscope-improvements-target16/evidence/baseline.json` records published SHA plus exact SHA-256 of `baseline-local-delta.patch`. A SHA alone would omit the uncommitted accepted fixes; no new commit was manufactured. The pre-foundation browser run passed **350 checks**, capturing staged/fallback Bug Report text, rendered Performance lens and Parser UI text. `parser-report-parity.json` also preserves clean and synthetic CRC/recovery/counter report outputs. These are parity evidence, not yet projection tests. Representative original-recording and integrated recorder-on/off overhead acceptance remain pending before active migration claims.
- Added `apps/web/src/observability/{record,recorder,operation,session}.ts` and README. Passive factory, no import-time/global installation. Versioned envelope with IDs/sequences, wall/monotonic timestamps, event/metric/snapshot kinds, origin/severity, owner revisions/fingerprints, explicit causal operation IDs and terminal outcomes. Metadata is bounded scalar-only copied/frozen data; no domain/source/tune object traversal or independent revision authority.
- Recorder defaults: 20000 records, 30-minute monotonic age on write/query, 4-MiB estimated serialized-byte budget, 2-KiB per record, reserved bounded repetition/emergency space. Chronological and per-priority linked queues avoid shifting/scanning the full ring per eviction. Low priority cannot evict higher-priority evidence; critical-only/age pressure is counted. Consecutive equal detail events coalesce within a bounded window; summaries retain omitted sequences/count, original producer/origin and operation correlation. Interleaved storms stay bounded by retention. Fixed-size health counters expose rejection, eviction, critical eviction, coalescing, reentry and internal failure; no recursive error recording.
- Operation correlation is explicit across interleaving; no ambient current-operation slot or controller wrapper. Outcomes success/failure/cancelled/superseded/stale terminate once. Later completion is separate stale evidence. Children cannot begin from terminated parents; session end is idempotent and blocks new operations/checkpoints. Existing handles can publish late evidence; ending the recording does not cancel/mutate domain work. Final review corrected operation handles to retain only the recorder's compact copy, not original producer payloads.
- New unit coverage **19 tests**: ordering/schema/origin/revisions, immutable compact metadata, count/UTF-8-byte/age bounds, priority pressure and visible critical loss, 100k repeated and 10k alternating storms, semantic/origin/operation/window distinctions, reentry/throwing clock/getter containment, configuration validation, all five terminal outcomes, stale completions, interleaved parent/child identities, and session closure. New Chromium module **3 checks/configuration** exercises causal operations, 100k-event pressure and application-state isolation, byte/session contracts and small call-cost observations without application instrumentation.
- Evidence example (initial staged run): 100k identical details ~383.5 ms, 99999 coalesced; 20000 normal calls ~218.8 ms versus details ~66.3 ms and a minimal-off loop ~0.8 ms. These are synthetic hot-loop recorder costs on shared Chromium, not end-to-end overhead guarantees or representative production event rates. No application producers are wired, so integrated overhead has not been established. Retained memory bounds are estimated serialized payload plus reserves, not exact JS-heap or future export-container budgets.
- Validation: baseline **350 Chromium checks**; expanded suite **356 checks / 178 per staged/fallback configuration**, no unhandled exceptions; full `npm test -- --maxWorkers=1` **121 files / 675 tests passed**. Final focused **19 unit tests** and **6 staged/fallback Chromium foundation checks** reran after the last core review; build/typecheck passed. Checks ran separately. Existing chunk-size warning remains. Hosted CI and representative large-log integrated overhead were not run. Browser services/profiles were cleaned up.
- Remaining target 16: step 2 actual lifecycle/runtime error/navigation/source/tune producers and adapters; step 3 existing performance evidence/report projection and overhead comparison; step 4 parser correlation/report ownership; step 5 state/render/async/storage owner producers; step 6 anomaly rules; step 7 versioned batched persistence/previous-session evidence and failure handling; step 8 unified Diagnostics/export; step 9 remove duplicate collectors/builders only after parity. Optional baseline intelligence is later. Do not leave permanently parallel authorities. Step-0 representative large-log and target-hardware overhead evidence must accompany integration. No old diagnostic stores/UI were removed, no persistence format introduced, no global listeners/observers/wrappers added, and no live graph/capture optimization implemented.
- Evidence: `/workspace/epicscope-improvements-target16/evidence/` contains baseline identity/patch/report fixtures, initial/full/final logs/results, parser parity outputs, current docs, `target16-foundation.patch` (isolated from target 14) and `targets6-7-9-10-11-12-14-16-foundation.patch` (complete local delta from published HEAD). The standalone core is not imported by main/app-shell; production runtime remains on the existing diagnostics. Review recorder contracts and health-counter presentation needs before starting producer migration.

## Local checkpoint — updated target 14 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Targets 6/7/9/10/11/12/14 are complete locally, uncommitted and unpushed; 8/13 profiling is complete only. Stop before target 16.** No GitHub operations were performed. Earlier local changes remain intact; no live-graph/capture recommendation from the profiling report was implemented.

- Bounded target 14 changes only `core/analysis/afr-delay-analyzer.ts` in production. The onset distribution sorts a copied value array once, then reads P10/median/P90 through an internal already-sorted helper. Removed three redundant sorted-array copies/sorts per distribution. Preserved interpolation and fraction clamping, extrema, empty/single behavior, original chronological event ordering and immutable input ranges. T50/T90 are separate distributions and retain one independent sort each; no public API or owner boundary changed.
- Three new tests cover unsorted duplicate/even timing distributions with known interpolation and input immutability, empty/single-event boundaries, and **320520 continuous valid samples / 10684 isolated events** with fixed expected percentiles/T50/T90 and no rejected gaps/overlaps/responses. Existing AFR/Lambda, polarity, qualification gaps, overlap rejection and configuration checks remain intact. No global sort mocking or implementation-specific sort-count assertion was added.
- External pre/post comparison confirms identical complete analyzer result JSON for six fixtures (0/1/3/6/1000/10684 events). An alternating-order warmed Node microbenchmark records the isolated onset distribution at 100000 values around 50.3 ms before versus 40.2 ms after (medians, 21 observations/implementation). This is stage-level Node evidence, not a Chromium end-to-end speedup; adaptive sorted-array sorting means sort-count reduction is not a fourfold time claim. Exact before/after source snapshots and a replay script are retained externally.
- No rolling-window/recovery/event-search rewrite was justified by the existing profiles. The 8/13 live-graph evidence concerns another owner/path and is not evidence for changing AFR detection semantics. No listener, observer, generic wrapper, cache, worker, delay authority or lifecycle change was introduced.
- Final validation: focused AFR suite **9 tests passed**; full `npm test -- --maxWorkers=1` **120 files / 656 tests passed**; reproducible `npm run test:browser` **350 checks / 175 per staged and forced Worker-disabled fallback import configuration**, no unhandled exceptions; production build/typecheck passed. Heavy checks and the benchmark ran separately. Existing build chunk-size warning remains; hosted CI and owner's original large recording acceptance were not run.
- Evidence: `/workspace/epicscope-improvements-target14/evidence/` contains notes, six-fixture parity/microbenchmark JSON and replay/snapshots, passing focused/full/browser/build logs and browser results, docs, `target14.patch` (isolated from the post-8/13-profiling checkpoint) and `targets6-7-9-10-11-12-14.patch` (complete local delta, including profiling docs and new files, from published HEAD). Latest browser results remain under ignored `artifacts/browser/`.

## Profiling checkpoint — updated targets 8/13 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`; published HEAD remains `213a937b2566ec165fb774db2bc9072703482ce2`. **Targets 6/7/9/10/11/12 remain complete locally, uncommitted/unpushed. Targets 8/13 profiling is complete; no production/test changes were made for this pass. Stop for review before implementing its recommendations or starting target 14.** No GitHub operations were performed.

- User explicitly requires full live recording history for later analysis/export. Do not impose a ring buffer/history cap or discard quality, acquisition sequences or reconnect metadata.
- Report: `/workspace/epicscope-improvements-targets8-13/REPORT.md`; evidence includes external reproducible workloads/runners, raw Chromium CPU profiles, heap/typed-range readings, separate unprofiled paced measurements, browser metadata, logs and timing CSV. Profiling used actual ShimCaptureSession, live numeric source and GraphViewport in Chromium; already-decoded synthetic telemetry, no network/ECU/binary decoding/file I/O, 20k/80k/320k sample matrix and 8/32-channel capture retention.
- Main confirmed bottleneck: graph refresh reads only appended tail but then allocates/copies the full retained range and recomputes full statistics for each trace/pane. At roughly 320k samples, separately paced unprofiled 10-Hz-minimum cycles measured 36.5 ms median / 70.7 ms p95 for one four-trace graph, 169.5 ms median / 432.7 ms p95 for four such graphs. The sampled four-pane profile attributes ~48.1% inclusive time to merge/copy and ~26.0% to statistics. These are component measurements, excluding extra Logger/Inspector/timeline work, not target-hardware end-to-end latency guarantees.
- Capture-only added post-GC JS heap at 320k was ~43.25 MiB for eight selected channels and ~149.39 MiB for 32. Graph typed ranges add ~22 MiB for one four-trace pane or ~88 MiB for four. Existing graph memory reporting omits quality arrays (17 versus 18 bytes/sample/trace); leave diagnostic migration with its approved owner. Capture memory is full-history storage, not a demonstrated leak: after release and settling pending graph timers, follow-up heap was 0.32 MiB above baseline.
- Recommended order: graph-owner amortized append storage plus incremental full statistics with source/overlap/gap/validity guards; then packed/chunked full capture representation; shared/bounded display copies only with an explicit snapshot/history contract; then profile conditional drawing/hidden panes/Inspector/overview; workers/batching only for residual measured need. Existing binary-search time lookup, tail-only reads, unchanged-refresh skip and bounded follow-window envelope behavior are healthy. Do not create another decoder/cache or generic lifecycle/observer layer.
- Unmeasured static risks are explicitly separate: Logger refreshes all pane runtimes; Inspector scoped statistics still traverse the retained array; shell dispatch does not await the refresh. This component run does not establish actual hidden-view work, transport loss or overlap failures. Full server/target-hardware and retention/export parity remain required before claiming an implementation win.
- No functional suites/build were rerun for this read-only production pass; last implementation validation remains target 12's 653 automated tests, 350 Chromium checks and build/typecheck. Profiler runner PASS means measurements completed without unhandled exceptions (22 first-run and six follow-up observation records), not new functional test counts. Before editing only these planning documents, the complete target-12 patch reverse-check passed against the repository. No source, test or existing audit finding was changed; no new production instrumentation/listeners/observers were added. Browser/Vite services/profiles were cleaned up by the external runners.

## Local checkpoint — updated target 12 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`. Published base remains `213a937b2566ec165fb774db2bc9072703482ce2` (targets 1–5 and 15). **Targets 6, 7, 9, 10, 11 and 12 are complete locally, uncommitted and unpushed. Stop before targets 8/13 profiling**, the next step in the approved order. No GitHub operations were performed; all earlier changes remain intact.

- Fixed XML decoding in the DOM-independent MSQ parser: a single replacement pass decodes predefined/numeric references without interpreting ampersands produced by that pass. Tokenization consumes already decoded rawText rather than decoding again. Metadata, names, units, raw text and tokens retain literal entity text consistently. XML character-reference code points are checked before String.fromCodePoint, providing a descriptive error for invalid references instead of accidental RangeErrors or invalid characters.
- Explicit matching quotes now establish text authority, including numeric-looking and empty strings. The shared isQuotedMsqValue helper is used by tokenization/classification and candidate acceptance. Undimensioned finite numeric vectors and nonnumeric metadata remain supported; no entry-name inference or new decimal-only restriction is introduced.
- Candidate preparation now rejects unquoted dimensioned payloads containing nonnumeric/nonfinite values rather than silently downgrading a malformed numeric table to text. Empty numeric payloads fail the existing dimension/count check. Explicit declared dimensions must be nonblank positive safe integers. Explicitly quoted dimensioned string storage remains valid and does not use numeric element-count checking.
- Compatibility policy is deliberate: unquoted nonnumeric entries with declared rows/cols now fail; intended strings with dimensions must be quoted. Quoted numeric-looking entries now remain text. Core extraction and browser XML/candidate validation retain their existing separate roles. This does not change namespace-prefix/CDATA/DTD/custom-entity support, byte decoding, tune normalization ownership, accepted-input publication, generation tokens, analysis invalidation, caches or persistence. No observer, global listener, worker or load lifecycle was added.
- Added 11 parser unit cases (16 total): single decoding across all fields, numeric/supplementary references, invalid code points and quoted numeric/empty/text values. Expanded MSQ Chromium checks from 17 to 27 per configuration: accepted entity/text/numeric cases; mixed, NaN, infinite, blank numeric and blank-dimension rejection; plus full-shell malformed-table/invalid-entity replacement failures that preserve valid tune, working delay, result and cached popup evidence. Existing replacement overlap/generation tests remain unchanged and pass.
- Controlled replay of the exact pre-target-12 parser/candidate files failed **9 of 16** focused tests, including repeated decoding, quoted numeric/empty text, and invalid references. Accepted files were restored byte-for-byte; the focused suite then passed **16 of 16**. No assertion was relaxed to accommodate the old behavior.
- Final validation: full `npm test -- --maxWorkers=1` **120 files / 653 tests passed**; reproducible `npm run test:browser` **350 checks / 175 per staged and forced Worker-disabled fallback import configuration**, no unhandled exceptions; production build/typecheck passed. Heavy checks ran separately. Existing build chunk-size warning remains; hosted CI and the owner's original large recording/tune acceptance were not run.
- Evidence: `/workspace/epicscope-improvements-target12/evidence/` contains an explicit acceptance-policy note, passing browser/unit/focused/build/typecheck logs/results, expected baseline failures and restored pass, docs, `target12.patch` (isolated from target 11) and `targets6-7-9-10-11-12.patch` (complete local delta including new files from published HEAD). Latest full browser results remain under ignored `artifacts/browser/`. No large-log wall-time speedup is claimed.

## Local checkpoint — updated target 11 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`. Published base remains `213a937b2566ec165fb774db2bc9072703482ce2` (targets 1–5 and 15). **Targets 6, 7, 9, 10 and 11 are complete locally, uncommitted and unpushed. Stop before target 12.** No GitHub operations were performed; all earlier local changes remain intact.

- Removed eight scanning MutationObservers: application-wide help, application-wide information hierarchy, application-wide sort/feedback, Analyzer-wide VE table refinement, Idle subtree help, recursive Weighted Mean wording repair, graph-label normalization and Histogram scope-option normalization. No new observer, global listener, lifecycle subscriber/wrapper, analysis cache or worker was added. Existing narrow page-hidden/timeline routing, VE table replacement/editing and startup-only installation observers remain.
- Help belongs to constructors or actual control/summary/header rebuilds. Compare/Tune help is static; Boost section help is constructed once; suite/Idle controls and cards receive help in their existing render functions. Idle help no longer starts from canvas redraw or retains an observer. Switching away from Idle clears its retained evidence-header help/tooltip. Existing shared popover and dismissal behavior remain.
- Moved retained hierarchy/table presentation logic from app installers into `pages/analyzer-presentation.ts` and `pages/analyzer-table-presentation.ts`. Explicit owner calls preserve summary primary/secondary classification, user disclosure state, column toggles, sort state, Fueling coverage/evidence and Boost empty feedback. Sorting reuses its implementation with delegation on each component root. Removed the obsolete help installer and main bootstrap calls. Rebuilt headers/body are decorated after accepted result rendering, not in response to unrelated application mutations.
- v2 constructs VE/target/delay rows in their accepted lower-left display order while preserving original model row/column coordinates, compacts measured proposals directly, and sets detail accessibility metadata before insertion. The app VE refinement retains header selection/help visibility and existing delegated detail handlers, with no table scan. Source-authoritative Result View and working-delay behavior from target 10 remains intact.
- Table Generator creates final Weighted Mean and Current A/B / Full Log labels directly; Scatter already uses those labels. Logger renders the existing ` - Graph` display suffix without changing persisted names or IDs. Inline-help and Inspector button owners apply final icon styles/text/ARIA directly. Catalog/selector ownership from the original point 5 is preserved.
- Added 11 Chromium checks/configuration for immediate independent-controller help, icon style, Boost sort/disclosure/empty feedback, Idle control/summary help and popovers, user-expanded disclosure retention without duplicate help/toggles, domain replacement and Idle-help cleanup, Fueling mouse/keyboard sorting, final Histogram/Logger labels, synchronous VE coordinate orientation and unrelated DOM isolation without analysis. An initial test expected the label `RPM` rather than the actual `RPM · Engine`; corrected that fixture lookup. No production behavior was relaxed for the test.
- Controlled replay of all changed production files at the exact pre-target-11 checkpoint failed at `Compare help missing before mutation delivery`. Accepted files were restored byte-for-byte and the focused 11-check Chromium module passed again. This verifies the synchronous owner contract; it does not claim that the old deferred behavior always produced a visible flicker.
- Final validation: full `npm test -- --maxWorkers=1` **120 files / 642 tests passed**; reproducible `npm run test:browser` **330 checks / 165 per staged and forced Worker-disabled fallback import configuration**, no unhandled exceptions; production build/typecheck passed. Heavy unit, browser and build checks ran separately. Existing build chunk-size warning remains. Hosted CI and representative 1.2-GB recording acceptance were not run.
- Evidence: `/workspace/epicscope-improvements-target11/evidence/` contains the explicit ownership map, passing logs/browser JSON, expected baseline failure and restored focused pass, docs, `target11.patch` (isolated from target 10) and `targets6-7-9-10-11.patch` (complete local delta including new files from published HEAD). Latest full browser results remain under ignored `artifacts/browser/`.
- Limits: existing label matching and Fueling/legacy Fuel-Injector feedback still read component-local rendered data. This pass establishes owner-triggered presentation, not a full typed presentation-model rewrite or legacy-domain removal. No large-log wall-time or memory speedup is claimed; source/tune authority, analysis calculations, cache, and persistence behavior are unchanged.

## Local checkpoint — updated target 10 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`. Published base remains `213a937b2566ec165fb774db2bc9072703482ce2` (targets 1–5 and 15). **Targets 6, 7, 9 and 10 are complete locally, uncommitted and unpushed. Stop before target 11.** No GitHub operations were performed; all earlier local changes remain intact.

- v7 is now the sole Result View presentation owner: its existing table pass commits text, metadata, missing state and heat, including neutral `0.5` fallback for alternate metrics. Removed the outer installVeAnalyzerResultHeat controller wrapper, its selection listener, MutationObserver, microtask and whole-table correction scan. The small result-heat module is now a pure policy taking the already computed display; it does not reparse titles or inspect DOM. Base VE/proposal generation remains at v2 and popup evidence remains at its existing owner.
- Coalesced queued Result View requests from initialization, table rebuild notifications and changed context/tune/refresh wrappers. Explicit selection still applies synchronously and consumes a pending presentation request. The existing v7 component-scoped table observer remains to detect table replacement; no new observer, global listener, wrapper, analysis cache or worker was added. This is not a full conversion of table rendering to model notifications.
- Heat extrema now use bounded accumulation instead of temporary map/filter arrays and spread calls. This operates on table cells, not log samples; no large-log speedup is claimed. Source-authoritative coordinate lookup, reversed load rows, title metric parsing and DOM-derived delay interpolation are preserved. Broader legacy/presentation cleanup is outside this target.
- Strengthened the real Chromium controller-stack test: every alternate view commits source VE and neutral fallback heat before observer/microtask correction; repeated cycles preserve session revision, primary identity, zero primary-change notifications and no additional trace loading. Existing checks retain measured/weak/evidence-only/no-evidence values, original proposal heat, metric heat, real interpolated delay, working edits and popup detail reuse.
- Controlled browser replay with only the three production rendering files restored to their exact pre-target-10 copies failed as expected at `change requires a deferred fallback heat correction`. Accepted production files were then restored byte-for-byte and the focused Chromium check passed again. This demonstrates removal of a deferred corrective pass, not a claim that users necessarily saw a painted flicker before.
- Final validation: full `npm test -- --maxWorkers=1` **120 files / 642 tests passed**; reproducible `npm run test:browser` **308 checks / 154 per staged and forced Worker-disabled fallback import configuration**, no unhandled exceptions; production build/typecheck passed. Heavy unit, browser and build checks ran separately. Existing build chunk-size warning remains; hosted CI and representative 1.2-GB recording acceptance were not run.
- Evidence: `/workspace/epicscope-improvements-target10/evidence/` contains browser/unit/build logs, passing browser results, expected baseline failure and restored focused pass, docs, `target10.patch` (isolated from the target-9 local checkpoint) and `targets6-7-9-10.patch` (complete local delta including new test/runner files from published HEAD). Latest full browser results remain under ignored `artifacts/browser/`.

## Local checkpoint — updated target 9 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`. Published base remains `213a937b2566ec165fb774db2bc9072703482ce2` (targets 1–5 and 15). **Targets 6, 7 and 9 are complete locally, uncommitted and unpushed. Stop before target 10.** No GitHub operations were performed for target 9; earlier local changes remain intact.

- Added the structured readiness model in the existing `ve-analyzer-readiness.ts`: typed rows (explicit required/valid flags), stable blocker codes/messages/component-scoped target selectors, ready versus canRun, active/pending state, delay missing/recommendation/working state, and shared summary/title. Readiness classification does not inspect rendered labels or status wording. Legacy numeric-validation/string-help exports remain compatible; new structured blocker help is chosen by stable code.
- The existing v2 VE controller owns computation and publishes the borrowed read-only result via getReadiness/onReadinessChange, forwarded through the existing controller layers and evidence adapter. Run preflight and post-load checks, enabled state, advanced rows, compact status, workflow hints, blocker panel, information popout and Quick Fix all use that result. Changed metadata snapshots notify consumers; unchanged results retain identity and do not notify. Readiness table rows rebuild only when row metadata changes. No log-sample calculation is added by readiness.
- Removed readiness table text parsing and duplicate proposal-setting validation/replacement from v4/v6. v7/v8 no longer discover blocker decisions/actions by reading the panel DOM. Removed four readiness-specific MutationObservers and the deprecated DOMSubtreeModified readiness hook; the existing v7 Result View table observer remains unchanged for target 10. No new global listener, observer, worker, generic lifecycle wrapper or sample-data cache was added.
- Numeric qualification/proposal controls invalidate immediately on input, with the following matching change suppressed to avoid duplicate semantic invalidation. Explicit change-only signals still work for v3's existing qualification owner. The first integration attempt incorrectly suppressed unchanged-value change signals; the existing lifecycle regression caught it, and the owner preserves that signal now. Inline delay editor ownership remains with v5.
- Correctness fixes: stable/recovery duration now has its own required numeric row, blocker and Fix target rather than disabling Run behind an unexplained generic blocker; unavailable analysis scope is explicit; selected tune geometry must resolve numeric values; ready recovery clears old status titles; pending/inactive execution is distinct from missing inputs; a fresh controller starts with Run disabled. Fix actions resolve current controls from selectors instead of retaining obsolete rebuilt elements. Existing source/tune generations, primary analysis, working delay, proposal/evidence and presentation-only Result Views are preserved by regression checks.
- Added six unit cases for explicit validity versus display wording, optional inputs, pending/inactive gates, delay messages/actions, cleared/completed status and stable-code help. Ten real-browser checks/configuration cover blank stability with working Quick Fix, initial state, stable snapshot on refresh, input/change coalescing, table-text tampering, optional bounds/mixture mismatch, pending/inactive rejection, loaded missing actual mixture and successful retry, unsubscribe, and discovery versus explicit working-delay activation.
- Controlled pre-target-9 browser replay with the production VE files restored to their exact prior checkpoint failed at `Missing stable duration lacks an actionable blocker`; accepted files were restored byte-for-byte afterwards. The new browser fixture initially left the component root hidden, so it could not receive focus; corrected the fixture to display it rather than relaxing focus/visibility behavior.
- Final validation: focused readiness/help tests **12 passed**; full `npm test -- --maxWorkers=1` **120 files / 642 tests passed**; reproducible `npm run test:browser` **308 checks / 154 per staged and forced Worker-disabled fallback import configuration**, including all prior 288 checks, passed with no unhandled exceptions. Production build/typecheck passed. Full unit, browser and build ran separately. Browser services/profiles were cleaned up. Hosted CI is unverified for local targets 6–7–9.
- Evidence: `/workspace/epicscope-improvements-target9/evidence/` contains passing browser/unit/focused/build/typecheck logs and results, expected baseline failure, docs, `target9.patch` (isolated from the target-7 local checkpoint) and `targets6-7-9.patch` (complete local delta from published HEAD). Latest generated results remain under ignored `artifacts/browser/`.
- Limits: no representative large-log benchmark or wall-time speedup is claimed. Numeric/geometry/source validity is owned here; core analysis still validates and calculates actual samples. This pass does not merge Result View rendering owners, remove their remaining observers, or replace v3's qualification invalidation signal; those boundaries remain for later approved work.

## Local checkpoint — updated target 7 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`. Published base remains `213a937b2566ec165fb774db2bc9072703482ce2` (targets 1–5 and 15). **Targets 6 and 7 are complete locally, uncommitted and unpushed. Stop before target 9**, next in the approved order. No GitHub operations were performed for target 7; target 6 changes remain intact.

- `ini-table-editor-storage.ts` owns the retained definition snapshot. A legacy/persisted read hydrates at most once; subsequent reads return the stable in-memory snapshot. Accepted save updates memory before best-effort storage and the existing notification, including accepted empty definitions and unload. Failed persistence cannot revive stale on-disk axes. No schema/key change, new global listener/observer or calculated-data cache was introduced.
- `importIniFile` now only reads/parses/builds the candidate and returns its existing tableDefinitions result. Removed its eager storage/publication side effect. The shell publishes definitions at the existing INI acceptance point alongside the accepted catalog, passes the snapshot explicitly as Histogram context metadata, clears it on unload, and hydrates the legacy stored definitions when restoring an INI catalog at startup. The explicit initial/unloaded snapshot is empty, preventing unrelated fallback data from becoming current.
- Histogram retains context authority: definition or tune identity changes reset its existing table-mapping guard, so replacement on the same selected table applies the current axes. Existing fallback-change events cannot override an explicit snapshot, including explicit empty arrays. The compatibility fallback event remains at the same owner, with hidden Table mapping deferred until entry. Table aggregation, source/tune owners, selectors and manual choices when no definition applies remain intact.
- Eight unit regressions cover one-time hydration/stable identity, failed-write session authority and publication order, empty acceptance/unload, getter denial plus later accepted recovery, malformed legacy data, and side-effect-free import preparation/read failure. Nine browser checks/configuration cover actual shell delivery, speculative preparation, accepted replacement under quota failure with old durable axes retained, zero definition-key reads during repeated navigation, failed INI reads, empty replacement, unload under denied persistence, definition/tune invalidation on the same table and explicit-context precedence/manual axes.
- Controlled browser replay with only the four production files restored to the exact pre-target-7 checkpoint failed at `Import preparation published unaccepted definitions`: preparing B changed A's accepted axes before shell acceptance. Accepted files were restored byte-for-byte afterwards. The passing quota case separately verifies current B axes while durable storage still contains A.
- Final validation: focused tests **8 passed**; full `npm test -- --maxWorkers=1` **120 files / 636 tests passed**; reproducible `npm run test:browser` **288 checks / 144 per staged and forced Worker-disabled fallback import configuration**, including all prior 270 checks, passed without unhandled exceptions. Production build/typecheck passed. Browser, full unit suite and build ran separately. Temporary browser services/profiles were cleaned up. Hosted CI is unverified for local targets 6–7.
- The first browser fixture ran before MLG load and had no INI-backed analysis channels, so the existing source-eligibility guard correctly withheld axis mapping. Moved this regression to after the real MLG load; no production change was needed to relax that guard.
- Limits: this establishes current-session authority and removes repeated metadata storage reads; no wall-time/large-log benchmark is claimed. Legacy catalog and table definitions remain separate best-effort persisted artifacts, so this is not a new atomic cross-artifact persistence format. Existing INI load acceptance/race and workspace-restore policy are unchanged; this pass does not add a general transactional INI replacement subsystem. External edits to storage are not authoritative for an already accepted in-memory INI; reload/new accepted input provides a new snapshot.
- Evidence: `/workspace/epicscope-improvements-target7/evidence/` contains passing browser/unit/focused/build/typecheck logs and results, the expected pre-target-7 browser failure, docs, `target7.patch` (isolated changes from the target-6 local checkpoint) and `targets6-7.patch` (complete local delta from published HEAD). Latest generated results remain in ignored `artifacts/browser/`.

## Local checkpoint — updated target 6 (2026-10-16)

Current branch: `checkpoint/improvements-targets-1-5-15-20261016`. Published base is `213a937b2566ec165fb774db2bc9072703482ce2`, containing targets 1–5 and 15. **Target 6 is complete locally, uncommitted and unpushed. Stop before target 7.** No GitHub operations were performed for this target. Older publication/local sections below describe historical checkpoints and are superseded by this entry for continuation.

- Changed only the three existing production adapters: `workspace-local-storage.ts`, `application-workspace-local-storage.ts` and `ini-catalog-local-storage.ts`. Their `storage?: Storage` argument remains injectable; when omitted, each load/save/remove resolves `window.localStorage` inside that operation instead of eagerly evaluating a default argument during construction. Adapter creation is now safe when the browser getter throws. Existing caller try/catch and persistence feedback own the operation failure, and a later operation can recover without a permanently cached denial.
- No errors are swallowed. Native SecurityError/QuotaExceededError, method failures and malformed/versioned payload errors still reach the owner. No fallback store, new global cache/listener/observer/lifecycle wrapper, serializer/schema change or decoded-data caching change was introduced. Explicitly injected storage bypasses the browser getter entirely.
- Added 12 parameterized unit regressions across the three adapters: safe construction plus getter failures from all operations; same-adapter recovery with durable data intact; injection precedence; method/parse error propagation. Controlled pre-target-6 replay failed the six constructor/recovery checks while six injected-storage/method checks passed, reproducing the exact eager-getter defect. The three accepted source files were restored byte-for-byte afterwards.
- Added a shared synthetic persistence fixture and seven real-browser startup checks per configuration, wired into the reproducible command through `scripts/browser/storage-startup.mjs`. Tests seed all three existing formats, inject a throwing getter before real page bootstrap, verify full shell/Shim UI installation and existing restore feedback, navigate Logger/Analyzer/Histogram, load INI into memory while persistence is denied, then remove the fault and reload. Recovery asserts restored playback setting/INI source, byte-for-byte untouched durable artifacts before any successful save, normal load/save/remove behavior and healthy empty-storage startup. Healthy-save comparison excludes the expected changing savedAt timestamp while checking schema/version/payload and timestamp validity.
- Final validation: `npm test -- --maxWorkers=1`: **119 files / 628 tests passed**. `npm run test:browser`: **270 checks / 135 per staged and forced Worker-disabled fallback import configuration**, including all prior 256 checks, passed with no unhandled browser exceptions. `npm run build` including typecheck passed; unit, browser and build ran separately. Browser services and temporary profiles were cleaned up. Hosted CI remains unverified for these local changes.
- Browser test development exposed two harness assumptions, corrected only in tests: DOM predicates must tolerate transient absent elements during reload, and a healthy save intentionally changes savedAt. Neither required production changes beyond the three adapters.
- Limits: recovery does not add automatic retries or clear the shell's existing persistence-blocked flags. Adapter retry works on the same instance; full application recovery was verified through a healthy reload. Broader denial of IndexedDB/all browser storage is outside this getter-specific fix. Healthy storage keys, formats, parsing, restore priority and write blocking remain unchanged.
- Evidence: `/workspace/epicscope-improvements-target6/evidence/` contains focused/full unit logs, expected baseline failure, browser results/log, build log, docs and `target6.patch` (complete local delta from published HEAD, including new fixtures/test modules/runner helper). Current passing browser results also remain in ignored `artifacts/browser/`.

## Publication checkpoint — targets 1–5 and 15 (2026-10-16)

Continuation branch: `checkpoint/improvements-targets-1-5-15-20261016` ([GitHub branch](https://github.com/PJawZK/EpicEFI-EpicScope/tree/checkpoint/improvements-targets-1-5-15-20261016)), based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. This branch packages all previously unpublished implementation, tests, synthetic fixtures and documentation for updated targets **1, 2, 3, 15, 4 and 5**. The local-checkpoint sections below are historical; their uncommitted/unpushed statements describe the state before this publication checkpoint. Publication is verified by matching the remote branch head to the local commit; no main merge or PR is included.

Latest validation: **256 browser checks**, **118 automated test files / 616 tests**, production build including typecheck, and clean patch/whitespace checks. Source did not change after those checks; this publication adds only the continuation documentation. Hosted CI has not been verified. Ignored browser output and external audit/evidence directories are not repository files and are not included in the commit; browser fixtures, test runners and modules needed to reproduce checks are included.

**Target 6 has not started.** Next scope is recoverable localStorage acquisition at startup, followed by browser verification of a throwing storage getter and healthy-storage behavior. User last reported 11% quota before requesting publication; live quota remains unavailable to the agent. Assess the remaining quota before implementation. Preserve this checkpoint and stop between targets.

## Local checkpoint — updated target 5 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1, 2, 3, 15, 4 and 5 are local, uncommitted and unpushed. Earlier changes remain intact; no GitHub operations were performed. **Stop before target 6** (recoverable localStorage acquisition at startup). User last reported 17% quota before authorizing this target; live usage is not visible to the agent.

- `histogram-math-channels-view.ts` remains the preview owner. Removed numerical preview listeners from name/unit inputs and the extra successful-save preview. Save still validates expression/references and persists all metadata through the existing storage/notification owners; completed preview stats/status survive metadata-only typing and save.
- Formula input and source/helper insertion share a single trailing 180-ms timer. Edit selection, context updates and refresh use that same scheduler, so synchronous context+refresh entry coalesces. Scheduling increments generation immediately, clears the previous timer and stale stats, and marks waiting state; an old read cannot publish during the debounce interval. Reset/new/delete and save validation failures cancel obsolete pending work.
- Added `setActive` at the existing Math controller boundary. Histogram subview routing calls it when selecting/leaving Math; leaving cancels timers and advances generation. Timer dispatch and post-await success/error paths also require a connected element without a hidden ancestor. Hidden/removed views do not start queued preview calculation or accept obsolete completions. The existing page setContext/refresh calls schedule current inputs on entry. No new global listeners, observers, generic lifecycle wrappers or workers were added.
- Preview evaluation is explicitly limited to **the first 10000 loaded anchor samples**. A zero-copy subarray bounds only the first reference range that sizes the existing core evaluator's output; other dependency history remains available and source arrays are untouched. The UI labels the first-N-of-total limit, including no-finite-samples cases. Small previews preserve their complete statistics. Full logical analysis, saved formulas, Table/Distribution/Scatter evaluation and source/cache/storage behavior are unchanged.
- Replaced the preview's intermediate valid-values array plus second statistics pass with one validity-aware count/sum/min/max pass over the bounded result. No calculated sample-array cache is retained.
- Added eight real-browser checks in `histogram-math-preview.browser.mjs`, integrated into `npm run test:browser`: zero extra preview loads for metadata typing/save, one load for a typing burst, immediate stale-read rejection during debounce, obsolete rejection suppression/clear/reset, helper/source insertion, hidden/deferred work plus coalesced entry, 320459-sample bounded preview versus full analysis, and actual Histogram subview exit. The large historical fixture produces 9999 valid preview samples with mean 1 while full analysis retains all 320459 output positions.
- Controlled pre-target-5 replay with only the two production files restored failed the metadata-only regression (`Metadata edits/save recalculated or disturbed a completed preview`). Accepted production files were restored byte-for-byte afterwards. The baseline probe initially encountered a test-cleanup API mismatch because the old controller lacks setActive; cleanup was made optional so it reports the actual metadata-work regression. No production workaround was needed.
- Final validation: **256 browser checks / 128 per staged and forced Worker-disabled fallback import configuration**, including all previous 240 checks, passed with no unhandled exceptions. `npm test -- --maxWorkers=1`: **118 files / 616 tests passed**. `npm run build` including typecheck passed; unit tests ran with browser services stopped. CI workflow is still unpublished and GitHub execution remains unverified.
- Evidence: `/workspace/epicscope-improvements-target5/evidence/` contains final browser/unit/build/typecheck logs, browser results, the expected baseline failure, docs and patches. `targets1-3-15-4-5.patch` is the complete local delta from HEAD including untracked modules/fixtures; `target5.patch` isolates changes since the target-4 local checkpoint. Latest passing generated results also remain under ignored `artifacts/browser/`.
- Limits: debounce reduces repeated work and the cap bounds output samples, not total wall time for arbitrarily complex temporal formulas. Trace loading can still request the current available/A-B data before applying the CPU preview limit; this target does not cancel underlying I/O/decode promises or change Logger caching. Existing saved-field notifications to other Histogram owners remain unchanged. No representative 1.2-GB rerun or wall-time speedup is claimed.

## Local checkpoint — updated target 4 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1, 2, 3, 15 and 4 are local, uncommitted and unpushed. Earlier changes remain intact; no GitHub operations were performed. **Stop before target 5** (metadata-only Math edits and preview scheduling).

- Consolidated the three Histogram formula implementations at the existing `histogram-logical-context.ts` boundary. `prepareHistogramFormula` compiles against the request's catalog, resolves physical IDs/source/display names, preserves exact literal names before offset syntax, rejects ambiguous/missing/virtual references, and deduplicates physical dependencies. `evaluateHistogramFormula` binds offsets, delegates numeric/temporal evaluation to the existing core evaluator, and preserves scoped completeness, source color and missing-data behavior. Prepared plans retain only program/reference metadata, not loaded sample data.
- Distribution/Scatter continue using `createHistogramLogicalContext`. Table Generator now delegates its logical-trace materialization there instead of maintaining a separate compiler/resolver/loader/evaluator. Each batch loads unique physical dependencies once and evaluates each requested formula once; duplicate logical requests preserve first-request order. Formula IDs, metadata, scope, qualification, delta arithmetic, aggregation, selectors and persistence owners remain in their existing locations.
- Math preview and both formula-save entry points share the same preparation policy. Math retains its preview generation check immediately after load and before evaluation, its distinct `Channel ...` / `Preview data unavailable ...` errors, and its finite-sample statistics. Table retains its render-generation and user-facing failure handling. No new global listeners, observers, workers, caches of calculated sample arrays or lifecycle wrappers were added. Existing decoded-channel/storage caching was not changed.
- Correctness evidence: before this target, formulas created in Math with `[RPM-1]` worked in preview/Distribution/Scatter but Table Generator's separate resolver rejected them. A controlled replay with only the three production files restored to their exact pre-target-4 checkpoint failed with `Formula channel not found: [RPM-1]`; the accepted files were restored byte-for-byte afterwards. The same regression passes with the unified implementation. Legacy Table formula validation also accepts the shared historical-reference policy now.
- Added six unit regressions (12 logical-context tests total) for literal-offset precedence, physical-only/ambiguous/missing references, nonzero sample indices/validity/history, scoped completeness/color, multi-formula dependency deduplication/order, missing loaded dependencies and load failure propagation. Focused logical/core formula tests: 19 passed.
- Added eight real-browser regressions in `histogram-formula-pipeline.browser.mjs`, wired into the reproducible command. They cover saved historical formulas in Table, formula X/Z/filter plus physical delta, Math preview mean/count, legacy validation, page routing through Distribution/Scatter, missing-data recovery, and rejection of obsolete Math preview loads. Full `npm run test:browser`: **240 checks (120/configuration)** passed with staged and Worker-disabled fallback MLG imports and no unhandled exceptions. Existing 224 checks remain included. The first new browser-test attempt waited for a channel label in the Distribution series header, which displays the scope label; corrected the test to assert the selected channel label and displayed mean. No production change was needed for that test-fixture issue.
- `npm test -- --maxWorkers=1`: **118 files / 616 tests passed**. `npm run build` including typecheck passed. Full unit tests ran after the browser had stopped. CI workflow remains a local edit from target 15; GitHub execution is unverified.
- Evidence: `/workspace/epicscope-improvements-target4/evidence/` contains passing browser/unit/build/focused logs, all browser results, the isolated pre-target-4 expected failure, docs and patches. `targets1-3-15-4.patch` is the complete local delta from HEAD including untracked files; `target4.patch` is the text delta from the target-15 local checkpoint. Current passing generated results also remain under ignored `artifacts/browser/`.
- Limits: this removes divergent processing paths and establishes consistent behavior; no wall-time speedup or large-log benchmark is claimed. There is no new cross-request calculation cache, expanded history loading, preview debouncing, or metadata-edit optimization. Existing synchronous core evaluation and preview scheduling remain for subsequent approved targets/profiling.

## Local checkpoint — updated target 15 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1, 2, 3 and 15 are local, uncommitted and unpushed. No GitHub operations were performed. **Stop before target 4**, next in the approved order.

- Added `npm run test:browser` using the existing Vite dependency and Node's built-in WebSocket/CDP transport; no dependency or lockfile changes. The explicit WebSocket flag supports the declared Node 20 engine line as well as Node 22/24. Validated locally on Node 24 with installed Chromium; hosted CI/other Node versions have not been executed here.
- `scripts/browser/run.mjs`, `cdp.mjs` and `acceptance.mjs` replace temporary absolute-workspace replays with repository-relative modules/fixtures. The runner starts its own loopback Vite/Chrome on allocated ports, creates separate incognito staged/fallback sessions, and removes its temporary profile after cleanup. It rejects empty/malformed results, JS exceptions, readiness/DevTools timeouts and interruption; no generic application instrumentation was added.
- Checked in the small generated INI/MSQ/MLG/delay fixtures from targets 1–3 under `tests/fixtures/browser/`; no private log/tune and no large-log benchmark added. Full-shell native file inputs prepare VE analysis, followed by replacement/publication and controller regressions. Native CDP mouse/keyboard interaction complements synthetic component events.
- Corrected `ve-analyzer-result-view.browser.mjs` to assert original base heat only in Proposed VE and neutral `0.5` fallback heat in alternate views. This resolves the pre-target-3 known assertion failure documented below; production Result View code and its accepted policy are unchanged.
- Added a separate Web CI browser job using the same command and installed Ubuntu Chrome, with an always-run results upload. The workflow is edited locally, **not executed on GitHub**. `docs/BROWSER_TESTS.md` documents prerequisites, selected suites, failure artifacts and limits; README links it.
- Final validation: **224 browser checks (112/configuration)**, covering MSQ replacement 17, accepted publication 15, VE lifecycle 26, Logger context 12, Analyzer activity 25, delay editing 15, Result View 1, native pointer/keyboard 1 in each of staged and Worker-disabled fallback imports. No unhandled browser exceptions. `npm test -- --maxWorkers=1`: **118 files / 610 tests passed**. `npm run build` including typecheck passed. CPU-heavy unit tests ran separately from the browser/build.
- Negative verification: deliberately missing Chrome executable exits 1 with actionable guidance and failed summary; SIGINT during INI startup exits 1, captures a screenshot/page snapshot and blocks the following MSQ step. The first interruption probe revealed brief continuation during diagnostics; runner-local cancellation guards and closed/disposed transport rejection corrected it, and the final probe passed. Temporary profiles/services from these runs were cleaned up.
- Results: ignored `artifacts/browser/` holds the latest passing summary, 16 per-suite JSON results and Chrome log. External checkpoint `/workspace/epicscope-improvements-target15/evidence/` preserves results, passing logs, negative probes, docs and patches. `targets1-3-15.patch` is the complete local delta from HEAD, including untracked modules/fixtures; `target15-runtime-tests.patch` isolates this target's runner/test/CI/docs additions (excluding cumulative HANDOFF/FIX_PLAN edits).
- Limits: this is the selected regression suite, not every `.browser.mjs` module, an original-recording acceptance run, or a new 1.2-GB performance profile. CI success remains insufficient to establish all browser behavior. No new production runtime changes were made in target 15.

## Local checkpoint — updated target 3 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1–3 are local, uncommitted and unpushed. Earlier implementation/test changes remain intact. No GitHub operations were performed. Stop before target 15, the next item in the user-approved order; do not move directly to target 4.

- New explicit `editDelayCells(positions, edit)` contract at the existing v2 VE owner, forwarded through existing controller layers and the evidence controller. It uses `editVeDelayCells` in the existing core editing module. Core validates the entire batch (including integral coordinates and finite non-negative values), deduplicates positions, and maps the table once. Invalid batches cannot partially commit. Empty/semantic no-ops retain the original table and completed primary authority; displayed-millisecond recommendation/provenance behavior is preserved. Existing single-cell core APIs delegate to the same implementation.
- The v2 owner selects existing working/recommendation authority, publishes the new immutable model only after acceptance, then calls its existing invalidation once. Existing analysis, discovery and delay-file generations advance there. Inactive owners reject edit commands. Raw recommendations/source-event evidence, origin metadata and explicit clear/revert semantics survive. No full-log calculation is triggered by editing.
- v5 owns current inline selection and commits the whole selection through the contract rather than invoking hidden editor callbacks for each cell. Delete now reverts at this same owner; blank commit still clears working values. The superseded v4 bulk UI/selection/event machinery and v9 global Delete handler were removed because they competed with this current flow. v4's unrelated workflow presentation and v9's re-grab behavior remain. Legacy hidden single-cell controls still delegate to the owner contract for compatibility; their broader deletion is not part of target 3.
- Delay rendering was separated from `renderTuneTables`: editing invalidates once, rebuilds VE/target once, and renders the delay table once through existing readiness/discovery presentation. Redundant post-invalidation delay renders were removed from edit, activation and saved-file acceptance. This does not claim every unrelated render/observer path is consolidated; readiness/presentation targets remain later work.
- Inline preview/selection, drag rectangle, touch-tap editing, digit/decimal entry, Backspace, F2/Enter, blur commit, Escape, focus restoration and Delete-to-recommendation are retained. Session revision guards prevent a detached old input from restoring/committing into a replacement tune. Deactivation cancels a still-open preview; ordinary blur commit remains supported. No new global listeners/observers, generic lifecycle wrappers, workers or production instrumentation were added.
- Before/after evidence: the same four-cell browser edit on the target-2 checkpoint advanced revision 4 times, replaced VE/target tables 4 times each, and replaced the delay table 12 times; new behavior is 1 revision and 1 replacement of each table. A 256-cell owner command also does 1 revision/render with zero trace loads. These are operation-count checks, not a large-log latency benchmark. Local fixture-host method spies count commits and are restored afterward; no global DOM method is patched.
- New `tests/web/ve-delay-editing.browser.mjs` passes 15 real-browser checks, including application presentation refinements/reversed rows, no-op authority retention, invalid batches, explicit clear/revert, primary/popup withdrawal, pending file/analysis rejection, successful re-grab, recommendation-review activation, stale previews, Result View source values/neutral fallback heat/working delays, and a 256-cell batch. Native CDP mouse drag and keyboard input independently select/edit all four cells with one revision/render. Touch uses browser PointerEvent fixtures, not a physical-device claim.
- Full staged-worker and forced main-thread-fallback workflow runs each pass 110 checks: 95 existing publication/source-binding/activity/VE lifecycle/MSQ checks plus the 15 new checks. No unhandled browser exceptions were observed in these acceptance runs. Existing small real INI/MSQ/MLG/delay workflow fixtures are used; the 1.2-GB audit was not rerun. Three new automated core cases cover batch evidence/reference preservation, atomic rejection and no-op identity (nine editing tests total). Production build/typecheck and diff checks passed; all 118 automated files / 610 tests passed with one worker. Full-suite logs are in the evidence directory.
- Known pre-existing browser-test failure, explicitly not counted as a pass: `tests/web/ve-analyzer-result-view.browser.mjs` asserts both neutral heat in alternate fallback views and exact original base heat for the same cells. It fails with “change did not restore exact base heat level” on both the target-2 checkpoint and target 3. Unit heat-policy tests, current documentation and owner acceptance require neutral fallback heat. Production Result View behavior was not changed to satisfy this contradictory assertion. Before/after failure logs are retained; target 15 must correct the test and make the complete browser command honest. The new post-edit Result View check passes against the accepted contract.
- Evidence: `/workspace/epicscope-improvements-target3/evidence/`; replay work under `/tmp/epicscope-target3/`. `targets1-3.patch` is the complete current checkpoint relative to main; `target3-runtime-tests.patch` isolates this target's runtime/tests. `/tmp/epicscope-target3/before.patch` and earlier evidence preserve targets 1–2. Services started for target 3 were stopped before automated-suite validation. No automatic usage warning was received; quota percentages remain unavailable.

Next after review: target 15 (browser acceptance runner/CI and the documented contradictory assertion). No automatic implementation, commit or push is authorized by completing this target.

## Local checkpoint — updated target 2 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on production main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1–2 are local, uncommitted and unpushed. Target 1 implementation/test files remain intact. No GitHub operations or main-branch changes were performed for target 2. Stop before updated target 3 (batched VE delay edits); the approved order remains in FIX_PLAN.md.

- Confirmed before fixing in real Chromium: a retained Logger analysis context for source A, invoked after installing source B, returned B's values/metadata. `/tmp/epicscope-target2/context-before.log` records the failing regression against target 1's checkpoint.
- The change stays in `logger-page.ts` at `getAnalysisContext`. It captures source reference, sample extent, source revision and the already-available immutable channel definitions at context creation. A metadata-sized map indexes exactly that available catalog. Overview traces, requested-ID filtering, read bounds, post-await metadata resolution and advertised source all use those captured references. Neither the pre-read nor post-read path consults the replacement Logger source, definitions or unavailable set.
- Retained contexts remain bound to their original source, including calls after replacement/unload. A context created without a source remains empty. Live-source full/scoped reads are capped to that context's advertised extent; a fresh context sees newly appended samples. Deduplication, request order, batch reads, completeness checks, colors and original read-error propagation remain unchanged.
- This is source/metadata/extent binding, not a historical copy of sample arrays or CRC-validity masks. Existing source/cache owners may update validity in place, and existing controller revision/generation/activity guards still own invalidation and rejection of obsolete publication. No new cancellation owner, global listeners, observers, lifecycle wrappers, workers, caches or full-log passes were added. Context creation performs no sample reads or data-array copies; only catalog-sized metadata indexing is added. Immutable channel-definition contracts are preserved rather than deep-cloned.
- New `tests/web/logger-analysis-context.browser.mjs`: 12 real-browser Logger-owner checks cover retained and pending reads, single/batch paths, replacement metadata and missing/unavailable channels, new-context authority, no-source and unload cases, live growth/scoped clamping, actual completeness and original error propagation. Deferred fixture promises control replacement ordering without production hooks.
- Browser acceptance: 95 checks pass in each staged-worker and forced main-thread-fallback configuration (12 new source-context + 25 activity/generation + 26 VE lifecycle + 17 MSQ replacement + 15 target-1 publication checks). Full application workflows load the existing small real INI/MSQ/MLG/delay fixtures. No unhandled browser exceptions were observed. The 1.2-GB audit was not rerun.
- Production build/typecheck and diff checks passed; all 118 automated test files / 607 tests passed with one worker. Logs are recorded in the target-2 evidence directory. Browser services were stopped before running the suite to avoid the CPU-contention timeouts seen during target 1. Test timeouts/configuration are unchanged.
- Evidence: `/workspace/epicscope-improvements-target2/evidence/` contains before/after regression logs, staged/fallback browser logs and results, test/build logs, replay scripts, fixtures, current documentation, a target-2 runtime/test patch, and complete `targets1-2.patch` including untracked tests relative to main. `/tmp/epicscope-target2/before.patch` preserves the complete target-1 checkpoint. Earlier evidence is unchanged. Only services started for target 2 were stopped. No automatic usage-limit warning was received; account usage percentages remain unavailable.

Next after review: updated target 3 only. Then target 15 precedes targets 4–5; do not automatically continue or publish.

## Local checkpoint — updated target 1 (2026-10-16)

Production/continuation baseline was freshly fetched `main` at `09f8e3942afde19f5bf64c9570884886d56da9bc`. Current working branch is `fix/input-publication-target-1`, created from that baseline. Target 1 changes are local, uncommitted and unpushed; no GitHub publication or main-branch mutation was performed. The previous temporary branch remains untouched. This checkpoint supersedes the immediate-work ordering below: the user has approved the new sequence in FIX_PLAN.md. Stop before updated target 2 (source-bound analysis loaders).

- Shell ownership: `publishAnalysisInputs` is the common mode-entry/accepted-input publication path. MSQ acceptance publishes a tune-only update; context publications follow accepted INI load/unload and workspace remapping, recorded-log restore/validation and import failure/unload, initial reusable restore, and existing Shim catalog transitions. Existing source formats/loaders, cache tiers and controller boundaries remain separate.
- Only the active page receives new context/calculation work. Hidden pages receive current shell/Logger state on entry. Analyzer's existing inactive tune setter retains deferred tune authority. INI acceptance pauses the Analyzer during workspace remapping and resumes publication after restore. Failed candidate preparation does not publish or invalidate accepted state.
- Histogram now has an explicit tune-only setter at its existing owner. An open Table Generator receives the new tune; Distribution, Scatter and Math retain their computations and defer Table Generator setup until entry. This avoids fixing stale tune display by recalculating unrelated full-log views. Rejected MSQ candidates preserve existing state.
- Restored contexts include final saved ranges/navigation rather than only initial Logger defaults. Staged CRC validity updates publish the final revision; when validation finishes before restore, bookkeeping avoids a duplicate final publication. Restore completions check the current raw-source identity before publishing. Already-accepted unload/log state is still published if restoration fails, with local persistence feedback. The exceptional restore-failure branches were inspected but not separately fault-injected.
- Validation: new `tests/web/accepted-input-publication.browser.mjs` passes 12 full-shell checks plus three focused Histogram checks. Covers open-page MSQ and INI replacement, rejected preparation, hidden deferral, INI unload, MLG replacement while Analyzer remains open, restored saved-scope publication, source unload clearing Histogram results, and zero extra trace loads for tune-only Distribution/Scatter/Math updates. Both real staged-worker and forced main-thread-fallback import configurations pass. Existing 17 MSQ replacement and 26 VE lifecycle checks also pass in each configuration: 58 checks per configuration, with no unhandled browser exceptions observed.
- A separate archived-main browser run reproduces the original failure: the first new regression reports “Open Histogram retained previous tune”. The archive changes only development-server filesystem access for replay, not production runtime code. An early test incorrectly compared the reused Actual Mixture select's identity; it was corrected to compare the rebuilt RPM control. That timeout was a test-oracle problem, not evidence of a browser freeze.
- Automated suite: 118 files / 607 tests passed initially. A concurrent rerun with browser/build activity hit the default 5-second timeout in two existing 320k-sample tests; the final isolated rerun passed all 607 tests, and production build/typecheck passed. Logs are recorded in the evidence directory. No test timeout/configuration was changed. Small real workflow fixtures were used; the 1.2-GB audit was not rerun.
- Scope exclusions: no source-loader closure changes (target 2), delay editor consolidation, formula engine changes, general browser CI infrastructure, new global listeners/observers, worker/batching changes, storage schema changes or cache rewrites. Existing deliberate Open Log/Use Capture navigation behavior is preserved; live recording refresh is not made into a full-analysis refresh loop.
- Evidence and complete tracked/untracked patch relative to main: `/workspace/epicscope-improvements-target1/evidence/`. Temporary browser runners/fixtures are under `/tmp/epicscope-target1/`. Services started by this pass were stopped. Usage percentages are unavailable to the agent; no automatic limit warning was received.

Next only after review: updated target 2. The later target order is in FIX_PLAN.md. Do not confuse updated target 12 (MSQ parser semantics) with the original deferred telemetry point 12, now updated target 18.

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production and continuation branch: `main`.

PR #462 — **Integrate Analyzer ownership and correctness fixes through point 11** — is merged.

Merge commit:

`2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b`

The exact runtime build accepted in browser before merge was:

`b435702412642f039a8a7f49d33037c309bef9d8`

The later `7d0be605ecd11a35f46ea8552893842fbb1fedb4` commit was documentation-only. The merge commit incorporated that accepted runtime lineage. The observability architecture/research was then ported onto the accepted `main` baseline without runtime changes in `aa92d48f2671a1cd2f75f3b4fbcfb66e4dc35f19`.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older documentation conflicts, use current `main`, this handoff, the relevant subsystem authority, and current browser/runtime evidence.

## Current project position — 2026-10-16

- **Logger** — mature functional reference. Broad optimization remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint is closed for the approved scope. Table Generator, Distribution, Scatter and Math Channels are mature unless field use exposes a concrete gap.
- **Analyzer** — ownership/correctness/performance cleanup through points 1–11 is merged into `main` and browser-accepted.
- **VE Analyzer** — stable current maturity checkpoint. The Result View source-authority and heat-map regressions are closed; session retention, retained-primary evidence reuse, semantic invalidation, active-domain routing and cooperative analysis are accepted.
- **UI** — immediate next work is a focused polish/consistency pass. Keep this visual/workflow-focused and avoid reopening accepted ownership architecture without a concrete defect.
- **Diagnostics / observability** — D-058 is approved and the architecture/research now lives on `main`. This is the next substantial implementation track after UI polish.
- **Point 12 telemetry async conversion/socket identity** — still reproduction-gated and lower priority.
- **MLG v3** — researched compatibility extension, not yet implemented; v1/v2 remain production support.
- **Linux production implementation** — future work after Web functional maturity and observability consolidation.

## Accepted Analyzer / VE baseline

Points 1–11 are complete on `main`:

1. large-log correctness and >320k-sample regression coverage;
2. VE session authority and navigation retention;
3. retained-primary evidence reuse;
4. semantic cell-detail invalidation;
5. selector/DOM ownership cleanup;
6. active Analyzer routing and stale hidden-work rejection;
7. measured CPU/correctness cleanup;
8. cooperative VE batching/progress/cancel;
9. visible/recoverable persistence failures;
10. controller-owned analysis trace-load errors;
11. transactional MSQ replacement with latest-generation authority.

Do not restore older controller/wrapper stacks or redo these points from historical branches.

### Result View acceptance

The prior defect used mutable rendered cell text as the source for later Result Views. Current behavior resolves source VE from retained authoritative analysis/model state instead.

Owner browser acceptance confirmed on the exact preview runtime SHA `b435702412642f039a8a7f49d33037c309bef9d8`:

- VE values remain stable through repeated Result View switching;
- Proposed VE uses normal VE heat;
- alternate views scale cells that have a real selected metric;
- untouched/fallback cells in alternate views keep the VE value but use neutral heat;
- Lambda Delay values remain correct;
- weak/evidence-only/no-evidence presentation remains sensible;
- completed VE analysis survives switching analyzers and leaving/re-entering Analyzer;
- no additional trace loading is caused by presentation-only view changes;
- Analyzer responsiveness is substantially improved compared with the problematic pre-Codex state.

### Remaining VE ownership debt

`readDelaySurface()` still reconstructs working delay information from rendered DOM even though the VE owner has authoritative working-delay state. This is later cleanup, not a current blocker. Do not broaden UI polish into this refactor unless a concrete issue makes it worthwhile.

## Approved visible workflows

Primary:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Histogram:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

VE Analyzer:

> **Load INI + MSQ + Log → select VE/target tables → verify actual mixture/RPM/load → qualify → discover/load lambda delay → activate working delay table → Run Analysis → review evidence/proposal**

Load Data order remains:

1. Load INI
2. Load MSQ
3. Open Log
4. Unload Log
5. Connect Shim

INI and MSQ are independent application resources and survive source transitions.

## Source/runtime topology

Validated topology:

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
      ↓
ts_shim
      ↓ LAN
EpicScope same-origin Vite proxy
      ↓
Logger / Analyzer / Histogram
```

The Pi Zero 2 W phone-hotspot workflow is validated: Pi and laptop can share the phone hotspot for `ts_shim`, and the Pi returns to the configured home network when the hotspot is disabled.

Stable workspace assignments normalize between canonical `ini:*` identities and matching raw Shim identities. Source transitions must never reapply starter templates, resurrect deleted channels or create raw + `ini:*` duplicate traces.

## Observability / diagnostics authority

D-058 establishes one bounded correlated observability/session architecture. Implementation authority is `docs/OBSERVABILITY.md`; performance-first implementation research is `docs/research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md`.

Core constraints already accepted:

- one authoritative bounded observability/session stream;
- specialized diagnostics/reports are projections rather than parallel durable stores;
- existing useful probes stay in their natural owners;
- packed/efficient hot-path representation and separate critical/detail retention;
- pre-insertion coalescing/backpressure so event storms make recording cheaper rather than worse;
- stable machine IDs and explicit numeric operation correlation;
- owner-provided revisions/fingerprints, never arbitrary full-state hashing;
- event/boundary-driven snapshots, not broad polling;
- O(1)-amortized streaming anomaly state with expensive causal analysis deferred;
- batched/chunked structured persistence rather than one write per event;
- bounded previous-session tail plus anomaly/error context windows;
- recursion/self-observation protection;
- explicit minimal/off versus enabled overhead benchmarks;
- anomaly detection initially reports evidence and does not automatically mutate/repair runtime state;
- local-first behavior with no silent telemetry or raw log/tune upload.

## Repository cleanup state

PR #462 is merged and is the accepted runtime baseline. The old Codex/VE validation PRs and the stale observability PR are historical only and should be closed after their useful content is represented on `main`.

Remote branches are not knowledge stores. Git/merged PR history and current documentation preserve provenance. `browser-previews` remains an infrastructure/deployment branch; `main` is the only product authority.

The GitHub connector available in this session can close PRs and audit refs but does not expose remote-branch deletion. Any branch refs classified as superseded in `BRANCH_CLEANUP_2026-10-15.md` may be deleted manually or by normal Git tooling without losing current authority.

## Immediate continuation order

1. Complete a focused UI polish pass from current `main`: consistency, spacing, control hierarchy, visual rough edges and accessibility/interaction details. Preserve accepted runtime semantics.
2. Run normal CI and browser sanity checks after UI work, especially Logger/Analyzer/Histogram navigation and VE Result Views.
3. Begin D-058 observability implementation from the staged plan in `OBSERVABILITY.md`, starting with benchmark baseline plus record/session/operation/retention contracts rather than UI-first diagnostics work.
4. Migrate existing diagnostics/performance/runtime-error/report paths incrementally; delete old collectors/builders only after parity.
5. Keep point 12 reproduction-gated.
6. Resume lower-priority Analyzer maturity or MLG v3 only when justified after observability consolidation.
7. Perform Web functional maturity review before Linux becomes the primary implementation target.

## Acceptance and safety rules

For VE/Analyzer runtime work, CI is necessary but not sufficient; browser behavior on the integrated build remains acceptance authority.

UI polish must not silently alter analysis semantics, qualification, source/tune authority, persistence, or ECU interaction.

Never automatically write or Burn to the ECU. Original tune/VE data, Analyzer evidence/proposal and any user-reviewed application result remain distinct states.
