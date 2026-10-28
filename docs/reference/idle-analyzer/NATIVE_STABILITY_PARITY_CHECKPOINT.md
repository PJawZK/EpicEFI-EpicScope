# Native Stability workspace — layout and reuse checkpoint

Branch: `ui/idle-analyzer-html-integration`. Starting checkpoint: `fc895f63195b365834f4debeaa01aa799679bc1d`.

The user reviewed the first slice against the accepted HTML and authorized correcting its workspace layout and interactions. EpicScope's shared application header, background/theme, navigation and bottom interface remain the shell authority. This is a bounded Stability correction, not implementation of every diagnostic mode.

## Changes

- Removed the redundant native title banner and large duplicate source/badge row from the normal workspace. Source/mapping details remain available under Channels / region and Evidence.
- The workspace fills the area between EpicScope's existing header and bottom interface. Compact mode/region controls, four metrics, two plots, assessment tabs, recorded-region card, one source timeline and a small Run Analysis band follow the prototype hierarchy.
- All surfaces use EpicScope theme variables. No standalone HTML header/footer, application picker, status menu or floating-window framework was copied. There is still one shared application header and bottom status/menu interface.
- The lower Stability plot now displays **logged base request, applied correction and final request** where those channels are available. Missing controller context is explicit, not simulated or substituted with RPM error. These traces are supporting context, not a newly implemented Base Airflow diagnostic mode.
- RPM, target and optional controller channels are loaded in **one source-bound batch** for the selected region. Native role selectors remain visible under Channels / region; mappings are not taken from rendered labels.
- Missing source units can use an explicitly declared canonical Idle-role unit for verified exact field aliases. For example the supplied INI has blank output units for `idleTarget`, while its canonical symbol and gauge establish RPM. The UI distinguishes source/catalog units from canonical-role units. Unknown fuzzy names are not sufficient, and an explicit incompatible unit is never overridden. No source metadata or numeric scale is rewritten.
- Hover snaps to a recorded RPM sample and displays its original source index/time and aligned recorded values. Invalid/missing/misaligned values are unavailable; there is no tooltip interpolation or evidence recomputation.
- Trace toggles, wheel/keyboard zoom, pan, Fit and Shift-drag display zoom consume retained numeric ranges. They do not change analysis selection or reread the log.
- Timeline dragging and handles commit through Logger's existing source-bound `setAnalysisRange`; Current A/B is selected only after acceptance. Pointer preview changes geometry only. Escape/cancel, deactivation and replacement reject obsolete gestures. Saved ranges still come from Logger; the existing bounded numeric manual-region option remains available.

## Existing owners reused or shared

| Operation | Owner / reuse |
|---|---|
| Bytes, decode, CRC, source identity, validity, columns | Existing MLG import/worker/data-source pipeline and `LoggerAnalysisContext`; unchanged |
| Role selection and missing-unit declaration | Existing `analyzer-channel-roles.ts`, extended with explicit canonical role-unit authority and exact recorded aliases |
| Stability statistics | Existing `analyzeIdleStability` / Idle core; numerical convention unchanged |
| Recorded controller plot | Existing logged role bindings and numeric ranges, not a second analytical engine |
| Timeline gestures | `analyzer-range-interaction.ts` extracted from VE's existing range gestures and used by both VE and Idle; no second Logger or persistence owner |
| Accepted A/B and range navigation | Logger callbacks; the view holds only preview geometry and its selected scope |
| Hover sample lookup | `nearestNumericSample` extracted from Logger graph lookup into existing `core/timeline/viewport-series.ts`; both Logger and Idle use it |
| Display ranges, gaps and reduction | Existing viewport state, raw-series continuity, min/max envelope and value-scale primitives |
| Shared shell and narrow sizing | Existing `app.css`, not private Idle header/footer overrides |

The small shared shell sizing correction makes the application's implicit column explicitly shrinkable and lets existing header selectors fit narrow widths. It replaces the first slice's Idle-only rules that hid header context/resized shared menus. Menu objects, callbacks, colors, source loading and bottom controls are not duplicated or replaced. Full regression validation covers the existing production domains.

## Real-browser observations

Built application, isolated Chromium, original October25 real-log prefix used by the readiness pass (14,849,557 bytes; 2,000 complete indexed records, five recovered invalid retry attempts):

- Full-region metrics: **1,995 valid RPM/target pairs**, sample σ **18.72 RPM**, target RMSE **18.76 RPM**. The previously unavailable raw `Idle: Target RPM` now resolves with declared canonical-role unit authority.
- All five recorded traces render: RPM, target, base, correction and final request.
- Native timeline drag selects Logger A/B **5.073–20.292 s**, producing **1,258 valid pairs**. Results remain unchanged during pointer preview, then update after release.
- Hover at source **12.355 s / original sample954** reports RPM919, target900, base17.10%, applied correction−2.12pp and final request14.99%.
- Native wheel zoom, pointer pan and keyboard Home/Fit operate on the display only.
- Exactly one shared `.app-header` and `.status-bar`; their observed background colors are unchanged across navigation (`rgb(10,20,29)` / `rgb(8,18,26)`).
- At390px, document scrollWidth390; no extra horizontal page width. Desktop screenshots were inspected against the accepted HTML hierarchy.

These numbers belong to that bounded recording prefix, not the HTML's embedded October20 warm-idle interval. They are not a full-log hardware benchmark or a tuning verdict. The user's October21 recording is not available here for exact replay.

Artifacts: `/workspace/epicscope-idle-native-stage2/` outside Git, including built-app desktop/selected-region/narrow screenshots and structured browser results. Private recording/INI files were not added to the repository. All HTML snapshots remain unchanged.

## Validation

- Production build/typecheck and focused numerical/role tests passed.
- Focused staged/fallback browser checks passed for native Stability, existing Analyzer activity, Logger contexts, and existing VE timeline scope/selection behavior.
- Built-production real-file smoke passed: target/controller traces, original-index hover, native graph gestures, Logger A/B preview/commit, single shared shell and390px sizing; no uncaught exceptions.
- Final full unit gate: **1,021 tests / 142 files passed** (`npm test -- --maxWorkers=1`).
- Final full staged/fallback Chromium gate: **1,505 checks / 168 result groups passed** (`CHROME_NO_SANDBOX=1 BROWSER_RESULTS_DIR=/workspace/epicscope-idle-native-stage2/full-browser-final npm run test:browser`). The existing held-Brush assertion passed unchanged in the successful full rerun.

The first cold browser validation attempt hit a DevTools transport timeout before a result; the unchanged retry completed. The first full browser run later hit the existing stationary held-Brush Shift-reversal timing assertion in fallback. That unchanged test passed in isolation in both configurations; the full gate was rerun without modifying Brush code, assertions or time limits. The first built narrow check reproduced implicit-grid overflow with the long real filename; the shared-shell sizing correction and repeated real-file check resolved it. These attempts are not represented as successful gates.

An additional built-app smoke attempt loading the supplied `mainController.ini` before the recording prefix timed out waiting for the INI loader success marker. That combined INI-plus-log browser check is **unverified**, not a passing gate; its log is `/workspace/epicscope-idle-native-stage2-with-ini.log`. The successful production smoke above used the recording metadata without this additional INI load. Canonical missing-unit role behavior has focused regression coverage. Confirm the combined supplied INI/log workflow during manual acceptance.

## Remaining boundary and manual review

Only Stability is active. Other diagnostic modes, automatic idle discovery/qualification, inclusion/region management, comparison, tune tables, plans and persisted Idle sessions remain deferred. The recorded operating-window card does not claim an automatically detected idle event. Full Log may contain driving; choose a known idle interval.

Review the native workspace with your real MLG/INI: target and context mappings, selected idle range, hover values, trace visibility, graph versus timeline selection, and navigation through Logger/VE/Histogram. Verify the shared EpicScope menus and bottom interface remain familiar. Stop for review before additional modes, broad optimization or any main merge.
