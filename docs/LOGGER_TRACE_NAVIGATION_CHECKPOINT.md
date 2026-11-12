# Logger trace continuity and navigation presentation checkpoint

2026-11-05. Branch: `ui/idle-analyzer-html-integration`. Starting checkpoint: `91b5ef31ed758b5dcf249734c78ffe627483a521`. Bounded visual correction; no decoding, numerical analysis, source-index/CRC/retry, ECU, file-save or workspace-persistence changes. Idle implementation remains paused.

## Reproduced findings

1. **Dense trace continuity depended on pixel occupancy.** Logger and the shared trace helper started a new path when envelope column positions differed by more than two pixels. An independently generated fixture with 400 closely spaced valid samples followed by valid observations at 20/40 ms reproduced disconnected/vanishing portions as the viewport changed, despite no invalid values or source cadence gap. The failing-before unit case and actual canvas-pixel regression establish a rendering issue, not a source-integrity diagnosis.
2. **Sparse gap decisions depended on visible-window cadence.** The same 100 ms spacing event following a 10 ms reference cadence was broken in a broad viewport but connected in a narrow overlapping viewport: the visible pair alone became its own normal cadence. A failing-before test reproduces this without changing source arrays.
3. **Highly zoomed panning could leave no in-range sample.** The raw path then had nothing to draw even between consecutive valid observations. Logger now requests the immediate original boundary neighbors for drawing only, and clips each trace to its plot rectangle. The default shared raw helper remains strictly scoped; readouts/statistics never gain interpolated or outside-window samples. A new unit/browser regression pans wholly between observations and retains genuine nonfinite interruptions.
4. **Changing timestamps resized the navigation row.** Flex layout reserved only a minimum for one readout and intrinsic widths for Cursor/Visible. Real Chromium geometry assertions failed at desktop width when digits changed; the bar surrendered space and controls moved. Fixed-width values are needed even when the display crosses minute-digit boundaries.

The supplied images show TunerStudio gauges rather than the reported EpicScope trace comparison. They do not establish the user's exact channel/zoom case. Corrections here are based on independently reproduced current-code defects and native replay of the actual November recording; this checkpoint does not claim every possible zoom-render symptom is resolved.

## Corrections and ownership

### Recorded continuity shared by Logger and Analyzer presentation

`core/timeline/viewport-series.ts` now provides `buildViewportEnvelopeBreaks`. Adjacent envelope columns are joined according to the original observations between their trusted endpoints, not empty pixel distance. Intervening unusable measurements still break continuity. Bad attempts at an already represented timestamp, and valid same-time replacements, preserve existing retry continuity. No synthetic source samples, smoothing, zero fill or numerical interpolation were introduced.

Raw and dense boundary decisions use the same **bounded source-local cadence reference**: up to 129 preceding adjacent source intervals; following context is used only when no preceding positive cadence exists. The 50 ms floor / five-times-median rule remains a presentation heuristic. With no reference cadence, two observations alone do not establish an outlier. This removes the visible-window median pass and sort. It does not add a parser diagnostic, missing-time estimate or global gap marker.

The shared trace helper and actual Logger renderer consume this common envelope-continuity implementation. `graph-viewport.ts` retains the resulting flags alongside its existing viewport/width envelope cache, so cursor redraws do not repeat continuity work. Source/channel/validity changes continue to use existing cache invalidation. Fixed-block envelope acceleration and retained full-range statistics remain in use; no new global cache, observer, listener or lifecycle wrapper was added.

A >320k-sample regression verifies that checking an already built envelope uses bounded column-level source lookups rather than another full-log pass. Long invalid spans short-circuit on an unusable observation. Existing 320k retry and continuous-sample tests still apply.

### Stable navigation geometry

At the existing `timeline-shell.ts` owner, reserve a duration-character width based on the loaded source extent. Cursor changes, pan and zoom do not alter that reservation. Live extent updates adjust it only if the required digit capacity changes; replacing/unloading a source can also change layout capacity. This is not a promise of identical geometry across different source extents or browser resizing.

`app.css` assigns explicit widths and tabular numerals to the elapsed/full time and Cursor/Visible fields. Transport, zoom and history groups do not shrink. The timeline progress bar flexes with available viewport space, with a stable minimum; changing time text no longer takes space from it. On narrow displays, horizontal overflow remains scrollable instead of squeezing controls or wrapping the row. Complete timestamps are retained.

No event/gesture routing, playback, view history, source time formatting, graph arrangement or saved-layout choices changed.

## Actual browser/source checks

- New real-browser regression checks navigation element rectangles at **1680, 1024 and 480 px** widths while crossing seconds/minutes and large minute counts in a long source. Button/bar x positions, widths and heights remain unchanged within each width. Narrow overflow is accessible by horizontal scrolling.
- Actual Logger canvas pixel checks verify valid continuous data remains connected over sparse pixel columns at multiple zoom levels, while a recorded nonfinite interruption remains blank. The fixture uses retained canonical ranges and rejects any unexpected data read.
- The complete `2026-11-01_11.57.38.mlg` was loaded into a production preview in fresh worker and fallback contexts. Both retain **93,759 records**, the **three unrecovered CRC count**, full-source integrity icons/overview marks and the correct source-CRC click explanation, with zero captured runtime exceptions.
- Native seek/zoom replay confirms the checksum-valid **103.73 ms** source-spacing event remains a visible close-view gap. The **08:20.881 CRC** event retains its source icon and dotted bridges. The long recorded Hybrid NaN interval remains absent while Engine traces continue. These source-backed gaps were not “repaired” into fabricated lines.
- Inspected `native-original/cadence-103ms.png`, `unrecovered-crc.png` and full-source captures. Progress bar rectangle is exactly the same at the two zoom positions: x≈374.609 px, width≈870.563 px at 1680 px browser width; zoom group x≈1252.172 px and history group x≈1358.172 px also match.

The earlier November audit's viewport-dependent raw-break table and pixel-reduction observations describe the earlier runtime. This checkpoint intentionally changes those **presentation** rules; source diagnostics/classification remain authoritative and unchanged.

## Remaining limits / manual acceptance

- Raw samples and ordered first/min/max/last envelope representatives naturally look different at different densities. This retains actual extrema and chronology; it does not promise an identical pixel curve at every zoom or subpixel visibility of every short interruption.
- A gap within one envelope bucket can remain below display resolution. Source CRC icons and exact samples/readouts remain separate evidence. No per-channel availability UI was added.
- Cadence context is the currently loaded source range. At partial/progressive range edges, missing context cannot be invented. No change was made to acquisition windows or retention policy. The separately demonstrated October nonmonotonic timestamp lookup problem is not addressed by this visual task.
- Boundary context is intentionally conservative: only the immediate original neighbors are requested for drawing, and an invalid neighbor is not skipped to a healthier distant value. It does not reconstruct missing observations or reach outside the loaded range.
- The global taskbar/menu and unsupported TunerStudio UI shown in the supplied images are not modified. Test the actual reported EpicScope channel/view after loading this checkpoint.

## Validation

- **1,165 unit tests passed in 161 files**, including overlapping-viewport cadence, source-based dense continuity, same-time recovered/invalid-suffix cases, >320k bounded lookups and opt-in boundary neighbors with unchanged scoped samples/statistics.
- **1,721 browser checks passed in 180 groups**, staged and fallback, after the final clipping/boundary change. Includes five new checks per mode for fixed geometry, narrow overflow, actual canvas connectivity/nonfinite gaps and panning between source observations.
- **Production build/typecheck passed** after the final runtime change; existing >500 kB bundle advisory remains.
- Focused presentation browser checks: **10 passed in two mode groups**, following the recorded failing-before geometry check. The two initial unit reproductions failed before their corrections.
- Complete original-file production replay passed worker/fallback, source/marker count assertions, native seek/zoom and exact navigation-geometry comparisons; zero captured runtime exceptions. Final screenshots inspected after clipping changes. Original MLG SHA-256 remains `4282efddcd4386e5abc94002caa198aba02c76824ce6e71343d79db524867481`.
- `git diff --check` passed. Manual acceptance of the user's exact channel/zoom case remains required.

Evidence root: `/workspace/epicscope-logger-trace-navigation/`, including failing-before unit/browser logs, passing-after checks, full regression results, production original-file screenshots/native geometry and the external replay harness. No private recording bytes are committed.

Stop for manual UI acceptance. Local checkpoint only; no push or main merge. Source/firmware audit and Idle implementation remain separate work.
