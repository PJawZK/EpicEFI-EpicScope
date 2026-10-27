# Native Idle Analyzer — Base Airflow recorded-context integration

Branch: `ui/idle-analyzer-html-integration`. Parent: `43588f40c6353f6437ae5bffd0674e7ab9dd5ea0`. Scope: one native mode integration using the tested Base Airflow core. Stop for review; no push, merge, additional diagnostic mode, tune editing or ECU writing.

**Historical validation block:** this checkpoint initially stopped on the full-browser VE-section failures documented below. The subsequent [regression gate investigation](NATIVE_REGRESSION_GATE_CHECKPOINT.md) records a complete 1,545-check pass. Manual/hardware acceptance remains open; the original interpolation timeout is not claimed permanently explained or fixed.

## Working native behavior

The shared Analyzer entry is now labeled **Idle Analyzer**, retaining its existing route identity. The local mode picker enables **Stability** and **Base Airflow**; the other six reference modes remain explicitly disabled. Existing Idle Control Diagnostics remains available separately and unchanged.

Base Airflow shows mean base request (%), signed mean applied correction (pp), mean final request (%) and applied-correction RMS (pp). The fourth card intentionally reports measured applied-correction RMS instead of pretending that the prototype's raw I-term evidence is integrated. Raw PID diagnostics and tune-table context remain future work. Numeric values are formatted at presentation only; source facts are not rounded before analysis.

Both modes share the existing upper RPM/target graph, lower logged-request graph, trace toggles, hover, viewport, qualification controls, source/channel selection, region manager, original-time Logger timeline and existing Logger handoff. Switching mode does not rebuild the graph data or change scope/focus. EpicScope's header, footer and theme remain shared; no standalone HTML or copied application shell is embedded.

Diagnosis, Evidence and Next Test now project retained request statistics. They show per-role valid/invalid/unavailable denominators, mapping/unit authority, source and RPM context. Missing/unsupported roles show Unavailable, never zero; other available roles remain useful. No compatible target is required for request statistics, although an explicitly selected target read failure retains the existing actionable load-error policy until the user clears/replaces that mapping.

Purpose and qualification remain separate authorities. Raised/recovery/transition/mixed purposes receive the existing purpose-specific limits/guidance; purpose is not a measured operating-state filter. Invalid/empty qualification and source/coverage problems take priority over ordinary repeat guidance. All guidance remains descriptive: requested position is not measured physical airflow, raw PID is not applied correction, and correction magnitude does not diagnose a tune-table defect.

## Ownership, reuse and invalidation

The existing `idle-analyzer-view.ts` remains the session/result owner. It captures the accepted request-role IDs with the accepted traces. First entry into Base Airflow lazily calls `analyzeIdleAirflow` using the accepted original-index scope and canonical RPM; the resulting small aggregate object is retained on that accepted result. No extra source read is required for mode entry because those context traces already support the existing graph.

Mode, tab, graph presentation and purpose-only changes reuse that aggregate. Source identity/revision, unit/catalog mapping, real region scope and qualification changes retire the accepted result through the existing controller key/generation. Pending work renders the current mode on acceptance; an older source completion cannot install stale cards. Hidden Idle controls do not perform source/calculation work. No new observer, global listener, wrapper lifecycle, worker boundary, parser or parallel storage owner is added.

`idle-airflow-presentation.ts` is a constant-size projection of retained statistics, not another analysis owner. The local mode event uses the view's existing abortable event boundary. Existing numeric/quality arrays remain read-only. First-entry calculation is still synchronous selected-scope CPU work; scale safety is tested, but whole-log responsiveness/hardware acceptance is not claimed.

### Reproduced cached-CPU defect corrected

A new single-manual-scope regression changed only the region purpose and returned to Analyzer. Existing owner events showed **analysis requests2→3 while source reads stayed1**. The manual scope returned the whole region object as bounds, so purpose/label metadata entered the numerical cache key despite unchanged times. The same full region object could enter the plot key and reset a retained viewport.

At the current owner, selected/manual and focused region bounds now project only `{startMs,endMs}`. Real bounds changes still invalidate. The regression uses existing owner events in the test harness, not added application instrumentation, and checks calculation count, read count, purpose retention, numeric scope and zoomed viewport preservation. This is distinct from file I/O or decoding cost.

### Feedback correction found in native use

The initial screenshot showed available channels with five excluded recovered attempts receiving remapping advice because overall context was limited. Advice now distinguishes missing/incompatible mappings, nonfinite derived measurements, and coverage/invalid evidence. Available retry-limited channels point to Diagnostics/coverage review; missing roles still point to compatible mapping. Invalid counts explicitly do not establish unrecovered physical loss. The correction has an independent presentation regression and a fresh native replay.

## Native browser observations

Production preview used the supplied private INI and canonical 2,000-record October25 MLG prefix through actual file input and native mouse/keyboard actions. No application handler invocation or generic instrumentation was added.

| Scope/action | Valid RPM samples | Base mean % | Applied mean pp | Final mean % | Applied RMS pp |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full prefix | 1995 | 17.10 | −0.86 | 16.24 | 3.30 |
| Stability→Base Airflow round-trip | 1995 | 17.10 | −0.86 | 16.24 | 3.30 |
| Included 0–5s and 15–20s | 771 | 17.11 | −1.27 | 15.85 | 3.00 |
| Same scope, warm condition enabled | 572 | 17.10 | −1.43 | 15.67 | 3.04 |
| Qualification off, correction unmapped | 771 | 17.11 | Unavailable | 15.85 | Unavailable |
| Generated replacement with no request channels | 5 | Unavailable | Unavailable | Unavailable | Unavailable |

All nine action checkpoints passed with zero uncaught exceptions. Evidence/Next Test tabs, restored mapping, source replacement and 390px layout were exercised; document width equaled viewport width. Desktop and narrow screenshots were inspected. A final real-file replay verifies corrected retry-coverage guidance, also with zero exceptions.

Existing Performance/owner Diagnostics were opened before/after the mode round-trip. Reported physical-read counters and retained attempts were unchanged (main source lifetime physicalReads1; retainAttempts13 in both snapshots). These layered counters overlap and are not summed as unique reads. Component browser tests separately verify that later mode/tab changes do not access the request sample arrays, distinguishing retained CPU results from cached byte reads.

## Validation gate

- Final production build and TypeScript check passed; existing large-bundle warning remains.
- Full unit suite: **1,078 tests across 150 files passed**, including three presentation regressions. This includes the final feedback correction. The subsequent bounds-only cache-key projection is exercised by the final browser gate.
- Focused browser gate after the numerical cache-key fix: **194 checks across 14 groups passed** in worker/fallback configurations. The final browser gate additionally covers the focused-bound/viewport projection and browser-scale native mode.
- Isolated VE replacement replay: **24 checks across two configurations passed** after reusing its existing primary-completion helper.
- Full browser gate: **not completed**. The first attempt stopped on the reproduced VE replacement fixture readiness assumption. After its test-only synchronization correction, the rerun stopped on a DevTools Runtime.evaluate timeout at the VE interpolation-strength section (after36 current Idle checks passed). The unchanged interpolation module passed **116 isolated checks across both configurations**. This does not prove the cause of the full-run timeout or establish integration-wide acceptance. Do not describe this checkpoint as a full browser pass.
- Final targeted Idle/Logger/lifecycle browser gate on the final code: **194 checks across 14 groups passed**, including both configurations and the final focused-bound/viewport cache-key correction.
- Browser-scale coverage includes 320,459 records through the enabled mode, explicit absent correction, retained source reads, mode round-trip and bounded SVG nodes.

The first full browser gate stopped in the pre-existing VE delay replacement test because it assumed a primary analysis was ready after two timer ticks. An isolated replay reproduced the same readiness failure. That test now reuses `completed` from the existing VE lifecycle fixture (exported as `waitForVePrimaryAnalysis`); production VE code, all replacement assertions and timeout constants are unchanged. The isolated replay passed before the final full gate. This small test-only correction is included because it blocked trustworthy regression validation.

Artifacts: `/workspace/epicscope-idle-airflow-ui/` and adjacent named logs. The intentional before-fix failure is `manual-key-before`; final native feedback evidence is `native-final-feedback`. Earlier native screenshots remain useful interaction evidence, while the final replay verifies corrected copy. No private source bytes are committed. All five frozen HTML snapshots remain unchanged.

## Completion and limits

[Stage status](NATIVE_STAGE_STATUS.md) now records two working native recorded-data modes. Base Airflow's request-context slice is integrated; it is not complete calibration parity. The native selector reuses existing percentage/canonical-role unit authority; other firmware-specific request representations remain unavailable until explicitly supported. There are no tune tables, raw PID/controller-limit judgements, inner valve tracking, recovery events, independent B, persistence or test plans added here.

Stage 1 remains partial overall; Stability/Base Airflow contracts have executable coverage. Stage 2 remains complete for the current primary-source foundation, extended here at the same owner. Stage 3 and 4 remain partial, stage 5 not started, stage 6 partial and stage 7 open. Full 1 GB hardware acceptance and unavailable original prototype/tune provenance remain unresolved. Stop for manual review and budget reassessment. The subsequent regression checkpoint records the full gate passing; manual acceptance and hardware validation still remain before merge consideration.
