# Native Idle Analyzer — first vertical slice

Date: 2026-10-26. Branch: `ui/idle-analyzer-html-integration`.

This checkpoint implements the user's first native boundary after the readiness assessment. The later instruction supersedes the earlier documentation-only boundary and the proposed tests-first stage numbering. It authorizes a useful stability slice, not all seven proposed stages. No main merge, framework, embedded HTML, firmware, ECU write or Burn is included.

## What works

- **Analyzer → Idle Analyzer · Stability** opens a native TypeScript/CSS view in the existing Vite application. **Idle Control Diagnostics · Experimental** remains available through its existing entry and owner.
- Load recorded MLG through the existing **Open Log** workflow. No Idle-specific file picker, decoder, worker or competing source store is introduced. Logger supplies a source-bound loader, lifetime/revision, original index grid, catalog and time extent. An additive captured source descriptor provides the actual filename/format rather than reconstructing identity from DOM text.
- RPM and optional idle target use existing role suggestions, visible user selection and compatible RPM units (`rpm` / `rev/min`). Missing target permits RPM variability while target-dependent metrics are explicitly unavailable. Unknown/incompatible units are not silently treated as RPM. A selected role removed from the catalog becomes unmapped; catalog label updates preserve an explicit no-target selection.
- Full Log, actual Logger A/B, saved Logger ranges and an explicit bounded manual region work. Saved range reordering uses the existing conservative bounds/label retention. Invalid manual replacement bounds leave the previous accepted region intact.
- Metric strip: production **sample σ (n−1)**, actual−target RMSE, ±40 RPM paired coverage and valid RPM count. Evidence reports original-index invalid/unavailable coverage, selected source times and completeness of the returned requested range.
- Two source-time graphs show actual/target on a common RPM axis and error on a separate axis. They share display zoom/pan, wheel, keyboard arrows/+/-/Home, Fit and native pointer capture. Display navigation never changes region selection or triggers source reads/analysis. Sparse plotting reuses production raw continuity handling; dense display uses production min/max envelope columns and does not connect missing columns. Graph rendering is a focused SVG projection; it is not another Logger or analysis engine.
- Diagnosis/Evidence/Next Test follow the accepted interface hierarchy. Conclusions remain descriptive; no tuning instruction or automatically qualified idle state is inferred. A Logger action hands off the selected original-time region through the existing context callback.
- Results are retained for unchanged semantic inputs/navigation. Real source, validity revision, catalog mapping, channel or region changes invalidate them. Async requests are generation-checked; hidden/disposed/retired completions cannot publish. Identical metadata on a different source object does not make a stale completion current. Hidden inputs defer reading and control actions are inactive.

## Numerical contract and reuse

`core/analysis/idle-stability.ts` selects original source indices inside inclusive time bounds and delegates existing aggregates/tracking to `analyzeIdle`. A new optional `includeSagEvents:false` explicitly excludes sag/recovery work; default behavior for existing callers is unchanged. No recovery semantics are imported into this slice.

All RPM-valid samples contribute equally to RPM statistics. Target/error metrics require finite, validity=1 values at the same original index and timestamp. Invalid or unavailable pairs are counted, not interpolated or replaced by zero. Derived error validity is a separate projection; canonical input arrays are not mutated. Missing/nonfinite timestamps do not enter the selected evidence.

Reference case: RPM900/1000/1100, target1000,100 ms cadence gives sample σ100, RMSE81.649658 and in-band33.3333%. This deliberately differs from the HTML's population σ81.649658. The three-point standard-deviation difference is documented, not hidden as rounding. Scope gaps are not interpreted as settling or recovery; there is no event/t63/frequency claim.

First-slice result freshness has one owner in `idle-analyzer-view.ts`; graph paths and narrative text are consumers, never semantic inputs. Production rendering primitives (`viewport-state`, `viewport-series`, `value-scale`) are reused. The existing event-aligned renderer was not misused with fabricated events, and the Logger's independently scaled channel plots were not used to imply a common actual/target RPM axis.

## Deliberately incomplete / prototype deviations

- Only Stability is integrated; the seven other prototype mode choices are visible but disabled. Existing Idle Control Diagnostics remains separate and unchanged.
- The second plot is direct RPM error, providing a truthful stability slice. Base/outer PID/actuator context, tune tables, comparison and auxiliary evidence await their own supported roles/results.
- Region choice uses actual Logger ranges or numeric manual bounds. Prototype region discovery, inclusion manager, draggable overview timeline and multi-region purpose union are not yet integrated. The view labels this as **recorded-region statistics**, not automatically idle-qualified diagnosis. Full Log may include driving/non-idle data; select a known idle interval for interpretation.
- Graph point tooltips/trace toggles, shift-drag zoom and all prototype utilities are not claimed complete. Current graph cursor shows original source time; sparse/dense plotting intentionally uses different bounded representations. Narrow rendering is not comprehensive accessibility/touch acceptance.
- Automatic fan/state exclusions, configurable qualification/evidence/watch thresholds, sag/recovery, bias/PID conclusions, A/B source retention, plan import/export and persisted Idle session descriptors remain deferred. They are not exposed as apparently working controls.
- No MSQ/tune requirement for stability and no tune editing/writing. VE original/proposal/working state and save sessions are not touched.
- Same-session retention is implemented; page reload/session persistence is not. No raw log data is placed in localStorage.
- Full-size original-log responsiveness, exact October tune/firmware provenance and manual user acceptance remain open. Browser-scale synthetic regression and real prefix replay do not close hardware/full-log acceptance.

## Validation gate

Validation sequence:

- Production build/typecheck passed, including the final role/layout corrections (existing >500 kB bundle warning).
- Full pre-smoke unit gate: **1,018 tests / 142 files passed** with one worker. Full Chromium gate: **1,495 checks / 166 groups passed**, including 13 native Idle component checks and three real-shell checks in each import configuration.
- The subsequent real-file production smoke exposed an ambiguous raw-RPM suggestion and 390px application-grid overflow. Corrections add exact recorded RPM/target aliases to the existing resolver, reject diagnostic drop/error candidates, and constrain only the active Idle layout/header at narrow width. Plot labels were enlarged and endpoint labels anchored inside their bounds.
- After those corrections: **28 focused unit tests passed**, including the new recorded-label regression; **114 focused browser checks / 10 groups passed** across staged/fallback, covering native Idle, existing Analyzer lifecycle, Logger source-context ownership, real shell import and the durable 390px regression. The earlier 1,495-check run is not represented as a second full run after these final corrections.
- Final built-bundle Chromium smoke: **six checks passed** using the unchanged real October25 prefix. The native view selected `RPM [RPM]`, reported 1,995 valid samples and sample σ18.72 RPM, exercised native wheel/pointer pan/Home fit, and had scrollWidth390 at viewport390 with no uncaught exceptions. This prefix's raw `Idle: Target RPM` descriptor has no unit, so it was correctly left unavailable; matching authoritative INI/catalog units are needed for that optional role. The small public INI/MLG fixture exercises the working target/RMSE path.

Existing browser/VE assertions and unit time limits remain unchanged. Final narrow regression is now registered in the normal browser acceptance runner, adding one check per import configuration on future full runs.

```sh
npm run build
npm test -- --maxWorkers=1
CHROME_NO_SANDBOX=1 BROWSER_RESULTS_DIR=/workspace/epicscope-idle-native-stage1/browser npm run test:browser
```

Focused final unit command: `npm test -- tests/analyzer-channel-roles.test.ts tests/analysis/idle-stability.test.ts tests/analysis/specialized-analyzers.test.ts`. The final focused Chromium runner invokes the committed native Idle, narrow-layout, Analyzer activity and Logger-context modules through the existing CDP/Vite transport.

Validation artifacts are outside Git at `/workspace/epicscope-idle-native-stage1/`; logs have the corresponding prefix under `/workspace/`. The production-preview smoke script additionally exercises the built bundle against the same bounded real October25 prefix used by the assessment. The private real recording/prefix is not committed.

Initial validation attempts: concurrent unit/browser work hit existing large-data test deadlines; an isolated two-worker unit run still crossed one unchanged 5-second deadline. The final gate uses one worker. An initial new shell test matched the word “evidence” in the loading status prematurely; its wait was corrected to terminal analysis states. These attempts are not represented as passed gates or as analytical defects.

## Manual review and continuation

1. Update/check out this branch, install dependencies through the existing setup, run `npm run dev`.
2. Open a real MLG, choose **Analyzer → Idle Analyzer · Stability**, verify filename/channels, and select a known idle A/B or manual interval.
3. Verify sample σ/RMSE, target-unavailable behavior, Evidence coverage, tabs, zoom/pan/Fit and Logger return. Confirm navigation to VE and existing Idle Control Diagnostics still works.
4. Review the accepted layout and the deliberate first-slice deviations before selecting another mode or integration stage.

**Stop at this checkpoint for review.** No additional diagnostic mode, optimization program or merge consideration begins automatically.
