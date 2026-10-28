# Native Idle Stability — trace fidelity and candidate-region checkpoint

Continues `ui/idle-analyzer-html-integration` from `47bb68e5512ac816568448273c0cec953dc901ba`. Scope: the reported trace presentation/left-margin correction, followed by a bounded first region-discovery workflow. No new diagnostic modes, tune writes, main merge or standalone-HTML changes.

## Trace correction and existing owners

The user's updated preview screenshot showed the previous dense presentation's limitation. Static inspection confirmed Idle selected raw mode from **total loaded sample count ≤2,000**, otherwise drawing disconnected min/max strokes at bucket positions. Consequently a flat target could disappear into short dashes; zooming a long recording never selected raw mode even when only a few samples were visible.

Logger instead chooses raw mode using **visible valid samples ≤2 × plot pixel width**. Dense rendering connects actual first/min/max/last samples in time order and breaks between sufficiently separated buckets. Its original `rawRepresentativePoints` function was extracted unchanged in behavior into `core/timeline/viewport-series.ts`, and Logger now imports it. Idle's new `buildViewportTraceSeries` uses this same representative policy, existing envelope reduction and existing raw continuity handling. It maps original timestamps rather than fabricated bucket-center timestamps. Dense envelopes are display reduction, not analytical samples; invalidity/gaps inside a dense pixel bucket may be aggregated, as in Logger. Zoom to raw mode for individual validity gaps.

Idle's retained per-trace cache is keyed by viewport bounds and measured plot width. Legend/Fit redraws do not re-read source channels or recalculate Stability statistics. Original-sample hover remains unchanged. No new chart library, parser, source owner, observers or global listeners were added.

The previous55logical-unit SVG gutter scaled with graph width and left unnecessary desktop space. It is replaced by a40CSS-pixel layout gutter with native HTML Y-axis labels aligned to the SVG pane positions. It stays readable after live desktop-to-narrow resizing without an observer, extra global listener or redraw. These are **Y-axis** labels (RPM and position/correction); time remains the X-axis. EpicScope's header, footer and shared theme remain untouched.

Regression references:

- 320,459 constant valid samples remain one continuous dense trace, with bounded representative points; an isolated spike at original time1,710,010ms retains its value4,000RPM.
- Zooming that source to10,000–10,100ms returns all11 actual samples, despite the full recording's size.
- Sparse unrecovered invalid samples break the raw path; empty dense bucket runs break the envelope path. Valid same-timestamp retry handling remains owned by the existing raw-series helper.

## Bounded next workflow: discover, review, select

The action bar now exposes **Auto-detect ≤ RPM**, minimum duration, **Find candidates** and a recorded-candidate selector. Defaults follow the prototype's1,200RPM/8second discovery controls, with an explicitly reported maximum sample gap of250ms.

`core/analysis/idle-regions.ts` discovers chronological, RPM-only candidate intervals:

- Valid finite recorded RPM must be strictly positive and ≤ the entered ceiling. Engine-off samples are excluded; cranking/driving can still meet this rule, so these are not qualified idle regions.
- Bounds are inclusive original recorded endpoints and original sample indices. No padding, interpolation, target-derived selection, inferred warm state, throttle/load filtering or fabricated events.
- Minimum duration is elapsed last-minus-first recorded time, not sample count. Invalid unrecovered records, timestamp regression, larger gaps and rejected RPM end a run. A valid same-timestamp replacement can recover an invalid retry attempt without inventing a gap. A later retry cannot mask an earlier unrecovered timestamp.
- Example: `[0,1200,900,1000,1300,900,900,900]` at100ms cadence, minimum200ms, yields100–300ms (original indices11–13 when source starts at10) and500–700ms (15–17). Zero and1,300RPM do not contribute.
- A continuous320,459sample window is processed without sample-sized argument spreading. Stored options are capped at the first200 chronological candidates; the UI explicitly reports total count and truncation. Other bounds remain accessible through the existing manual/Logger selection workflow.

Discovery reuses accepted full-source RPM evidence when available. Otherwise it uses one captured `LoggerAnalysisContext.loadTraces` call for RPM, requires complete source coverage and preserves current analysis. An unchanged completed discovery returns the retained list without a read. Threshold changes invalidate the candidate list only, not existing Stability metrics. Pending completions are rejected after deactivation, disposal, RPM/catalog/source/revision changes or changed discovery settings.

**Discovery never automatically changes the analysis scope.** Choosing a candidate submits its real bounds through Logger's existing `setAnalysisRange`, then selects Current A/B after acceptance. It shares the timeline's commit operation, including suppression of cascading context reads. A refused commit retains previous scope/results. Equal existing bounds reuse the accepted result rather than analyzing twice. No independent saved-range store or second Logger is introduced.

## Validation

- `npm run build`: passed, including TypeScript. Existing >500kB bundle warning remains.
- `npm test -- --maxWorkers=1`: **1,031 tests /144 files passed**.
- Focused staged/fallback Chromium: **160 checks /14 groups passed**, including Idle candidate/trace, Analyzer lifecycle, Logger contexts, VE timeline scopes/selection and shared-shell/narrow behavior.
- `CHROME_NO_SANDBOX=1 BROWSER_RESULTS_DIR=/workspace/epicscope-idle-native-stage3/full-browser-final npm run test:browser`: **1,511 checks /168 groups passed**. Existing Brush behavior and assertions unchanged.
- All five standalone HTML reference hashes remain unchanged; checkpoint links and `git diff --check` verified.

The first separate built-app real-log smoke attempt hit a DevTools Runtime.evaluate transport timeout while the full browser gate was also active; that attempt is not a passing result. The final combined supplied-INI/real-prefix built-app smoke passed after the gutter correction:

- INI:2,539catalog entries, accepted with4existing diagnostic warnings (`issue` status, “loaded this session”). RPMValue and idleTarget resolve correctly, the latter with declared canonical-role RPM units.
- Recording:2,000indexed records,1,995valid RPM/target pairs; sampleσ18.72RPM, RMSE18.76RPM; all five recorded traces present.
- Discovery:one RPM-only0.000–25.365s candidate at1,200RPM/8s; full-log scope and1,995sample evidence unchanged by discovery.
- Native Logger timeline drag:5.073–20.292s,1,258valid pairs. Pointer preview leaves metrics unchanged; commit updates once.
- Native wheel zoom, pan, Home/Fit and original-index hover passed. Hover at12.795s/originalsample994:886RPM,900target,17.10%base,+6.17pp correction,23.27%final.
- Exactly one unchanged shared header/footer, no uncaught browser exceptions,390px document width and305px inner SVG after reserving the native axis gutter. Final desktop and live-resized narrow screenshots inspected: labels no longer clip.

The final full browser rerun includes an explicit regression asserting the40px gutter and uncut, nonoverlapping Y-axis labels after live resizing without graph redraw. Both worker configurations passed. Private recording/INI data and browser artifacts remain outside Git in `/workspace/epicscope-idle-native-stage3/`.

## Limits and next acceptance

This stage provides **single-region candidate review**, not the prototype's complete region manager. Multiple included/excluded regions, purpose tags, union analysis, split/merge, persistence, throttle/temperature/load qualification, comparison and further diagnostic modes remain deferred. No claims of warmed idle, tuning improvement or controller timing follow from these candidates. Stability math/sign/sample-σ conventions are unchanged.

The earlier combined supplied-INI-plus-log smoke timeout was traced to its success-only wait: a loaded INI with warnings correctly has the existing `issue` marker. The external smoke now accepts that state only when the button explicitly confirms “loaded this session”; the production INI loader is unchanged. The corrected combined real-file smoke passed on the final build, closing that earlier smoke-harness limitation. The real prefix is not the user's complete October21 recording and is not a full-large-log throughput benchmark.

Manual acceptance: verify preview commit, compare flat and spiky traces with Logger at full/zoomed scales, check left labels at desktop/narrow sizes, run discovery with different ceilings/durations, review throttle/temperature/load evidence yourself, select a candidate, and verify Logger A/B/metrics agree. Navigate through Logger/VE and back. Stop for review before completing region management or adding modes. No main merge.
