# Idle integration — regression gate investigation

Branch: `ui/idle-analyzer-html-integration`. Baseline: `8c81235455d3b057f814b3066243bd9e42bb90c8`. Scope: investigate the blocked full browser gate before adding another feature. Production application/core code and frozen HTML remain unchanged. No push or merge.

## What was reproduced

1. The neighboring VE lifecycle/edit-retention/numerical/interpolation/replacement sequence passed **372 checks across ten groups** in both configurations. Interpolation took 29.2s in staged and 57.4s in fallback in this focused sequence, below the existing 120s evaluation limit. The prior timeout was not reproduced there.
2. A production-style active VE workspace plus external DevTools profiling passed all 58 interpolation checks in 41.5s. CPU samples included the existing `fitRows` presentation owner and table interaction/render work. DevTools measured 377 layouts (5.12s), 606 style recalculations (4.18s), 17.72s script and 40.65s task duration. Interpolation itself asserts zero log reads; these are calculation/DOM costs, not large-file I/O or decoding.
3. A viewport-contained fixture-host experiment did not improve this case: 46.3s elapsed, with higher layout duration. It was reverted. No production row-fitting/observer change was justified by that experiment. These single-run profiles are observations, not a general hardware benchmark or proof of the original timeout's cause.
4. The clean full run passed staged interpolation (58) checks, then stopped later at the shared Brush Shift-reversal assertion. This is a different failure; passing interpolation did not establish a full-suite pass.
5. Repeating the shared interaction fixture exposed deterministic test-state leakage: the first run passed, the second failed its expected+5 adjustment because the preceding run saved step7 and did not restore it. The fixture also removed its normal and large view DOM without disposing their controllers.

The exact original full-run DevTools timeout remains unproven. No claim is made that a production interpolation bug or large-log freeze was fixed.

## Focused test correction

Only `tests/web/ve-shared-table-interaction.browser.mjs` changes:

- Capture existing tool preferences and raw preference/result-view/layout storage values.
- Seed the defaults and display state that its hard-coded expected values require before creating the fixture view.
- In `finally`, dispose the normal and large controllers through their existing owner APIs, remove fixture nodes and restore both cached preferences and exact original storage values.
- Add failure diagnostics for the existing Shift-reversal assertion: original/preview/final values, elapsed phase times, cell connectivity and semantic revision delta.

No assertion was removed or weakened. The 125ms/100ms live-preview waits and 120ms/320ms reversal waits are unchanged. Browser evaluation limits, suite deadline, production Brush behavior, timer interval, source owners and persistence behavior are unchanged. No application listeners, MutationObservers, lifecycle wrappers or generic instrumentation were introduced; profiling uses external DevTools only.

After correction, the same fixture passed **six consecutive runs /114 checks** (three per configuration). This confirms repeatability under that replay and preserves the original timed Brush checks. It does not by itself prove the original Shift failure's cause; the preference leak/controller cleanup defect and the timing assertion are reported separately.

## Validation status

- Production diff against the baseline: empty; the fixture-host experiment was fully reverted.
- Focused neighboring VE sequence:372 checks passed.
- Shared-interaction repeat gate:114 checks passed across six groups.
- Final complete browser gate: **1,545 checks across 168 result groups passed** in worker and fallback configurations, with the existing evaluation limits and suite deadline. Both interpolation (58) and shared-interaction (19) checks passed in each configuration. The current full-gate block is cleared; the earlier interpolation timeout's exact cause remains unproven.
- Existing production build/unit/native validation belongs to the unchanged baseline: 1,078 unit tests and targeted/native checks documented in [the Base Airflow checkpoint](NATIVE_AIRFLOW_UI_CHECKPOINT.md). They are not presented as newly rerun gates in this test-only investigation.

Artifacts remain outside Git in `/workspace/epicscope-idle-gate-investigation/` and adjacent named scripts/logs. `active-ve` and `active-ve-fixed` preserve the negative A/B experiment; `live-full` captured an external profile after the run had already advanced to CPU-reuse checks, so it is not misattributed to interpolation. `full-browser` records the later Brush failure. `brush` preserves the repeated replay after correction. No private source bytes are committed.

## Stage completion

The original seven-stage definitions still apply. This is validation work, not another diagnostic mode: stages 1, 3, 4 and 6 remain partial; stage 2 is complete for the current primary-source Stability/Base Airflow boundary; stage 5 has not started; stage 7 remains open for manual acceptance, justified full-log/hardware validation and final audit; its full-browser gate has now passed. No main merge is authorized.
