# VE Analyzer entry stall — controlled investigation

Investigation date: 2026-10-15. Local changes only; no GitHub push/pull, commit or remote branch operation. Point 3 has not started.

## Finding

Point 2 exposed a latent non-terminating selector-decoration loop. The freeze is real, caused by repeated synchronous CPU/DOM work after file loading, and is not explained by file I/O or decoding.

`analyzer-channel-roles.ts` stores the most recently suggested catalog globally. Its document-wide observer responds to DOM child-list changes by decorating Analyzer options and calling `enforceVeActualMixtureSelection`. The hidden VE view can still have an empty or older selector catalog: its tune is loaded before its first log context, and Analyzer initially opens the comparison domain.

The enforcer chose a preferred AFR channel from the global catalog even when the VE selector had no corresponding option. Assigning that missing value leaves the select empty, but the old code dispatched a bubbling `change` anyway. The existing VE owner invalidated and rebuilt the tables. Those DOM mutations scheduled the same decorator again. The preferred value remained unavailable, so the loop continued without user input. Table rendering, Result View formatting, option decoration and other existing DOM observers amplified the loop.

The old unconditional tune update rebuilt hidden VE controls and, through channel suggestions on the empty VE context, reset the shared global catalog. Point 2 correctly stopped that destructive unchanged-tune rebuild, removing the accidental escape from the loop. Forcing only that rebuild back in the temporary comparison copy prevented the stall, but would also discard the VE state that point 2 must preserve; that experimental change was discarded.

## Evidence

Two ordinary local copies were used, sharing the installed dependencies. The point-1 copy restored the point-2 application files from local HEAD and retained the bounded visit-extrema fix. The point-2 copy initially matched the working application sources, then received only the selector fix. No worktree or GitHub operation was needed. Browser runs used fresh isolated contexts in Chromium 154.0.8037.57, 1366 × 645, DPR 1, and the same file order: INI → MSQ → MLG → Analyzer comparison → VE.

Short-log fixture: 2,000 records, 16 channels, derived from the existing synthetic MLG. The large fixture is 1,193,829,695 bytes, 320,458 records and 1,389 channels. These are synthetic fixtures, not the owner's original recording.

| Variant, short-log fixture | Analyzer entry | VE entry |
| --- | --- | --- |
| Point 1 | Completed, 85 ms | Completed, 49 ms |
| Point 2 before fix | Browser evaluation did not return within 20 seconds | Not reached |
| Point 2, experimental forced tune rebuild | Completed, 74 ms | Completed, 68 ms |
| Point 2 with selector fix | Completed, 33 ms | Completed, 52 ms |

These individual observations establish the regression and the effect of the fix; they are not a hardware-independent performance benchmark. Profile collection and separate test runs affect timings.

The browser trace captured the repeating stack:

```text
queueAnalyzerChannelDecoration / observer callback
  → decorateAnalyzerChannelOptions
  → enforceVeActualMixtureSelection
  → dispatchEvent(change)
  → v2 control.onchange
  → invalidate
  → renderTables
  → renderTable
  → DOM mutations → observer callback again
```

Result View formatting (`v7 applyResultView`) also repeatedly appeared in the trace. No additional application instrumentation, event listener, MutationObserver or lifecycle wrapper was installed for this investigation. Browser DevTools CPU profiling/tracing supplied the evidence.

A direct browser comparison used the same empty VE selector and an AFR catalog with an unavailable preferred option. Original decorator: session revision 1 → 3 → 5 after two decoration attempts, with the selector still empty. Fixed decorator: 1 → 1 → 1. This isolates spurious invalidation from decoding, calculation and source size.

## Narrow fix

`apps/web/src/pages/analyzer-channel-roles.ts`, existing `enforceVeActualMixtureSelection`:

- Choose fallback mixture channels only from IDs present in this selector's options.
- Dispatch change only when the selector's actual value changed after assignment.
- Preserve the existing actual-mixture eligibility rules and the non-destructive point-2 owner behavior.

No global observer was added or removed. The broader removal of document-wide option scans and global catalog ownership remains point 5. Popup reuse, presentation invalidation, hidden-domain routing and CPU/worker changes remain points 3–8.

## Validation and limitations

- 116 Vitest files / 592 tests passed; production build, typecheck and diff whitespace checks passed.
- 15 real-browser lifecycle checks passed. Two new cases cover an empty hidden VE selector receiving a newer catalog and a local eligible fallback when the global preferred channel is absent. The suite is `tests/web/ve-analyzer-lifecycle.browser.mjs`, loaded through Vite and executed with `runVeAnalyzerLifecycleChecks()`; it is separate from Node Vitest.
- Full-shell short-log flow passed: edited working delay 125 ms, VE proposal generation, three Logger → Analyzer round trips, comparison-domain → VE return and Histogram → Analyzer return. Summary, delay and all proposal-cell titles stayed identical. Report: 0 ISSUE / 0 WARN.
- Full-shell large-log flow passed: 320,458 input samples, 320,418 contributing samples, 56 measured proposal cells, edited working delay 125 ms. Three Logger round trips, comparison-domain return and Histogram return preserved the complete summary and all proposal titles; Report showed 0 ISSUE / 0 WARN. MLG loading/CRC readiness took 36.4 seconds before the navigation test. Analyzer entry took 757 ms, VE entry 774 ms, explicit analysis 3.17 seconds, and Logger round trips 2.20–3.63 seconds including the script's two 150-ms settling waits. These observations separate file-load cost from the remaining cached-data/lifecycle costs; they do not claim those remaining pauses are resolved.
- The first large-log attempt used an inadequate 10-second browser-harness readiness budget and ended before CRC readiness. Only the subsequent completed run, with a 120-second file-readiness budget, is counted as passing. Application/test timeouts were not relaxed.


Local evidence, scripts, profiles and screenshots are under `/tmp/epicscope-investigation/`; exported copies are under `/workspace/epicscope-investigation/evidence/`. Key files: `point1-short.log`, `point2-short.log`, `point2-stall.trace.json`, `point2-force-tune.log`, `point2-fixed-short.log`, `selector-proof.json`, `lifecycle-result.json`, `point2-fixed-flow-short.log`, `point2-fixed-flow-large.log`, reports and screenshots. Comparison source trees/browser profiles are not export artifacts.

Stop here for review before point 3. The fix addresses the identified infinite loop, not every previously audited responsiveness problem. Global decoration still does unnecessary work; large-log analysis and popup computation can still block the main thread and require their planned passes.
