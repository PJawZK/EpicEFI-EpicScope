# Native Idle Analyzer — Load Recovery (Group F)

Branch: `ui/idle-analyzer-html-integration`. Parent: `3d345fc82d783710c69ebc5cde8dfda625072458`. Roadmap steps 16–18: recovery contracts, native core and UI. Read-only; no push or main merge included.

## Reference reconciliation and working UI

Load Recovery is the seventh native diagnostic mode. It follows the final recorded-data HTML overrides, rather than the superseded early metric definition: sag-event count, lowest RPM, worst absolute actual−target error and valve tracking RMSE (pp). RPM extrema/error reuse the accepted Stability aggregates; position RMSE reuses the shared Valve/Bias position result. Neither is recomputed by event rendering. Missing target makes detection unavailable, not zero events, while independent RPM extrema remain available.

The existing shared plot renders actual/target above and requested/measured DC valve position below, with signed motor duty on its own percent axis, matching the final reference. Missing/incompatible actuator roles stay unavailable and do not erase independent RPM events. Recovery references open from a mode-specific toolbar button using the existing setup-panel pattern. Threshold, band, sampled dwell and maximum gap are explicit user references, not firmware limits. Defaults are 100 RPM, ±40 RPM, 500 ms and 150 ms. Validation requires sag > band ≥ 0, dwell ≥ 0 and maximum gap > 0.

Actuator mapping changes invalidate the shared position projection and its Recovery consumer at the existing owner; motor-duty reference changes remain Valve-only presentation/calculation policy and do not alter recovery events.

One numbered event detail is rendered at a time instead of a full per-event card list; this is a native bounded-DOM adaptation requiring manual UI acceptance. All retained events are reachable without building an option/card per event. View event changes only graph bounds, padded by 500 ms and clamped to the real source extent; View region restores the existing graph-region bounds. Neither operation writes Logger ranges or changes analysis scope. Diagnosis/Evidence/Next Test distinguish confirmed recovery, censored events and missing evidence. Shared header/footer, Logger ownership, region manager and graph interactions are reused. No standalone HTML, framework, global listeners, observers, lifecycle wrappers or ECU writes were added.

## Mathematical contract and differences from legacy

`core/analysis/idle-recovery.ts` consumes the accepted overlap-deduplicated original sample selection and the same captured RPM/target columns. It does not rediscover idle, densely filter observations, reread the recording or call legacy sag analysis.

- Error is actual−target. Error ≤ −sag threshold starts the observed event; original onset index is its identity within this source lifetime.
- Last below-threshold observation is separate from onset and settling.
- Inclusive ±band observations must establish the chosen dwell with aligned valid samples and no gap exceeding the maximum. Recovery is onset → first observation in the confirmed settling run. Confirmation time is reported separately.
- Leaving the band resets the tentative settling run. Another sag before confirmation remains part of that same event, not another successful recovery.
- Original-index holes, qualification exclusions, disjoint merged-region boundaries, invalid/unaligned required data, equal/backward time, excessive gaps and mapped canonical continuity-breaking markers terminate the run. No selected interval borrows recovery from another interval or outside its end.
- Broken/terminal events remain **censored**, with recovery unavailable. Invalid evidence never becomes zero recovery.
- Invalid retry attempts conservatively break runs. A matching timestamp or a recovered-retry marker alone does not prove the exact valid replacement identity, so this slice does not skip/bridge invalid attempts. This can censor more events than a future verified canonical retry-identity adapter; it cannot manufacture a confirmed recovery.

Independent reference: target 1000; RPM `[1000,850,880,1000,1000,1000,1000,1000,1000]` at 0…800 ms, 100 ms steps. Onset 100 ms; last below 200; settling starts 300; confirmed 800. Recovery is **200 ms**, confirmation is 700 ms after onset. Legacy recovery would report 100 ms from the last sag observation without establishing dwell. This intentional difference closes the recorded contract; legacy behavior elsewhere remains unchanged.

Tests additionally cover inclusive −40/+40 endpoints, interrupted/restarted dwell, incomplete terminal sag, time/alignment breaks, repeated sag before settling, qualification/index holes, disjoint boundaries even between adjacent original samples, merged overlaps, physical-loss markers, missing target, empty selection and rejected settings. The 320,459-sample continuous case retains 40,058 events with exact original identities; its last event is censored. No sample-sized spreads or repeated per-event full-log scans are used.

## Ownership, lifecycle and integrity

The existing accepted view result owns one Recovery projection keyed by the base semantic result, references and actuator mappings. The event subprojection is keyed separately from actuator mappings, so remapping motor/position does not rescan events. Valve, Bias and Recovery reuse one semantic position result; changing recovery references does not repeat position calculation. It is calculated lazily only in the active mode. The existing async mode boundary loads missing actuator columns lazily and rejects stale/hidden completions before calculation/publication. Settings reuse the accepted columns and base aggregates; unchanged settings, tabs, event focus, mode round-trips and unchanged navigation reuse evidence. Source/scope/qualification changes use the existing generation checks before base acceptance. No separate async event framework or second source store is introduced. Event calculation itself is synchronous and is not claimed cancellable mid-loop. Independent owner events distinguish mode loading, event computation and shared position computation; they extend the existing owner evidence contract rather than introducing generic instrumentation.

Logger's existing `getAnalysisContext` now exposes its canonical, source-bound integrity-marker snapshot. Core accepts structural time/continuity metadata, without importing app code. A retained context cannot acquire another recording's markers after replacement. Semantic keys use continuity-breaking marker times, not diagnostic display wording. Existing validity revision publication still owns refresh after canonical validation. Only mapped finite-time markers establish exact boundaries; untimed diagnostics cannot locate a break, and physical tail bytes never become samples.

The scan is forward over selected samples and retained events; markers are normalized/sorted once. Region/index boundaries prevent overlap double-counting. Event records scale with actual detected events; the UI remains constant-size apart from existing bounded graph paths. No new full-log trace cache is added. Broad optimization and workers remain later profiling decisions.

## Validation and actual-browser findings

- Core regression cases: 9 tests passed, including >320k continuous records.
- Full unit gate: 1,120 tests / 155 files passed.
- Targeted staged/fallback browser gate: 270 checks / 14 groups passed, including actuator parity, shared position/event reuse and readable narrow controls.
- Production build passed; existing >500 kB bundle advisory remains.
- Final production real-file replay: 15 native action checkpoints passed, including 390px layout without horizontal overflow or browser exceptions.
- Full browser gate: 1,621 checks / 168 result groups passed across staged and fallback configurations.


Production replay used the private 2,000-record prefix and supplied INI. At default references, the full prefix had no 100-RPM sag, minimum 826 RPM and retained RPM tracking RMSE 18.76 RPM. The final cards show 74.00 RPM worst target error and 1.92 pp valve tracking RMSE for the full prefix. With sag 10 RPM, band ±5 RPM, dwell 500 ms and gap 150 ms:

| Recorded scope | Events | Confirmed / censored | Valid pairs | Worst target error (RPM) | Valve RMSE (pp) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full prefix | 6 | 0 / 6 | 1,995 | 74.00 | 1.92 |
| Viewed A, 0–5 s | 1 | 0 / 1 | 337 | 27.00 | 1.82 |
| Viewed B, 15–20 s | 2 | 0 / 2 | 434 | 37.00 | 1.81 |
| Combined A+B | 3 | 0 / 3 | 771 | 37.00 | 1.81 |

These are user-reference threshold crossings, not identified external-load experiments. All six full-prefix events lack confirmed valid settling under those tighter references; they are not successful recoveries with zero duration. Synthetic independently authored data establishes the positive confirmed-dwell arithmetic. Native actions covered reference entry, event focus, tabs, mode retention, region/combined focus invariance, target removal/restoration and Logger navigation. Desktop screenshot inspection confirmed dual graphs, selected-event detail, mode controls and shared shell.

The first production replay exposed a UI defect missed by core/type checks: shared setup CSS hides closed panels, leaving new references without an opener. The mode-specific toolbar opener and semantic hidden/flex rules correct that. Regression checks verify actual panel geometry. Screenshot review also found narrow event text squeezed into columns despite no horizontal overflow; scoped responsive wrapping and a ≥250px explanatory-text check correct that. The HTML’s final recorded-data overrides supersede its early recovery-card definition; the final native cards and separate actuator axes follow those overrides, not an RPM-error-only substitute. A separate qualification test initially mutated an already-published catalog in place; correcting the fixture to publish a complete catalog established the intended immutable-source contract, without weakening qualification.

Artifacts live under `/workspace/epicscope-idle-recovery/`; validation logs are `/workspace/epicscope-idle-recovery-*.log`. Private INI/MLG bytes are not committed. This bounded replay and synthetic scale test do not establish full-1GB/hardware responsiveness, causal load identification, continuous unobserved settling, controller cadence, tune provenance or manual UI acceptance.

## Remaining boundary

Group G is next: remaining verified tune/controller authority and justified reference parity, including tune-derived bias/geometry, actuator association and limits/staging/attenuation. Comparison/independent B and persistence/plans remain later stages. No automatic Burn, ECU or tune-table editing is included. Shared tutorial/help and broad decluttering remain deferred until feature/layout completion. Stop for review after this checkpoint; do not advance automatically.
