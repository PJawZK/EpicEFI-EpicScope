# Group 9 — Heatmap paint, presentation precision and setup typography

Development lineage `fix/ve-v50-reviewed-groups-1-7`, parent Group 8 commit `985be21ca9d99908167a4b921d2bd0393d4e2a87`. Group 8 was pushed and its exact SHA verified on `fix/ve-v50-recovered-through-group-7c-20261022` before starting. No main merge or ECU writing/Burn.

## Audit and reproduction

The checked-in frozen reference from remote documentation commit `4e6caf816ee2e723ddec5a2f88f5292d092d0d29` was inspected through the copy recorded in Group 8. Its reference provenance/hash remains documented there; its demo data and analytical authority are not production behavior.

Real Chromium reproduced different evidence-weight labels in Result View (two decimals) and Cell Evidence (three). The retained fractional-weight fixture fails before correction in both worker modes (`/workspace/epicscope-v50-next-group9-validation/reproduction.json`). Code inspection also found duplicated number formatting, signed rounded zero, and setup summaries/Advanced controls at 9px versus the reference's 10px compound-control baseline.

Uniform 16×16 heatmaps were captured at device scales 1, 1.25, 1.5 and 2. Computed cells were already opaque and borderless, contradicting the earlier stylesheet comment that this alone prevented seams. Screenshot pixels showed 80/480 dark interior edges at scale1 and112/480 at the other scales. No CI/static-style inference substitutes for this visual evidence.

## Heatmap correction

A one-pixel outward outline uses each cell's exact existing heat color to cover fractional native-table paint gaps. Selected/focus-visible cells keep their interaction-owned outlines. The heat expression is shared with the cell background through a CSS custom property. Lambda Delay is excluded so unavailable/insufficient cells cannot inherit fabricated heat. Palette values, geometry, cell/row DOM, sticky headers, layout owner and editing/Brush owners are unchanged. No per-cell layers, transforms, new observers or renderer wrapper.

Border-spacing, alternate grid tracks, sizing and clipping trials did not consistently remove the fractional-scale gaps and were discarded. The final change deliberately retains native geometry. Final screenshot checks find zero dark interior edges at all four tested scales, sampling480 edges per capture. This is a controlled uniform-heatmap raster check, not a claim about every browser/GPU/zoom combination.

## Precision contract

`ve-metric-format.ts` supplies pure display formatting used by the existing Result View, working-label and evidence owners. Retained values are never rounded or read back from labels.

- Working/source/generated VE labels respect available tune digits, otherwise two; bounds protect formatting from invalid precision metadata.
- VE change: two decimals maximum; percentages/spread: one; evidence weight: three consistently in table and evidence; counts and delay-ms policies remain integer.
- Redundant trailing decimal zeros are removed consistently.
- Rounded positive/negative zero displays `0`/`0%`, rather than `+0`/`-0%`.
- Missing/nonfinite display values stay unavailable (`—`). Numeric Result View values and heat inputs retain their full precision.

VE fallback Result Views receive the existing working-owner digit metadata; they do not reinterpret source units or evidence availability. Existing cached evidence and working-preview/commit ownership remain. The accepted delay-edit snapping rule from the numerical audit is unchanged. Legacy axis/compact metadata formatting retains its existing bounded precision policy.

## Typography and justified parity boundaries

Compact setup summaries and Advanced/Exclusions use the reference's 10px baseline and consistent weight; existing responsive disclosure/layout owners remain. No prototype window system, Visible range without Logger authority, density/sample data, fabricated ranges or ECU controls are ported. Group 8's real independently selectable range lanes remain a deliberate adaptation. Pixel-identical parity is not claimed.

## Regression coverage and performance

Four unit cases cover tune digits/zero digits, bounded invalid precision, trailing zeros, signed zero, unavailable/nonfinite values and preservation of analytical numeric values. Four browser cases cover matching fractional evidence weight, retained working precision/primary/revision/read count, setup text baseline, and preserved selection outline/pin symbol/geometry.

Four additional full-browser screenshot cases per mode capture a uniform256-cell table at the device scales above and inspect actual PNG pixels through a detached test canvas, asserting480 interior edges with no dark backing. This is test-only image analysis; no canvas, listener or instrumentation is added to the production application. Captures and counts are retained under the validation directory/browser downloads.

No additional full-log pass, decoding, analysis, storage write or cache invalidation. Shared formatting replaces duplicated small render helpers; the heat fix is CSS-only and preserves Brush geometry and hit-testing.

## Limits / next checkpoint

Manual UI, assistive-technology, real browser zoom and original user GPU/hardware acceptance remain. The original approximately1.2GB MLG was unavailable, so no original-file loading or large-log timing claim. The raster regression covers controlled device-pixel ratios, not every OS scaling/zoom matrix. Existing numerical policy questions and section-dialog background-pointer limitations remain unchanged.

Stop after validation and a local commit. Group 10 final/manual acceptance remains separate. Group 9 is not automatically pushed or merged.

## Final validation

- Production build/typecheck passed; existing bundle-size advisory remains.
- 929 unit tests across 138 files passed.
- Full real Chromium acceptance passed: 1,136 checks across 142 result groups, 568 per mode. Four new presentation and four device-scale pixel cases per mode are included in that total.
- All eight full-run raster captures report zero dark edges across480 sampled interior edges each, at device scales1/1.25/1.5/2 in staged and fallback modes. Raw before/after captures, pixel data and the standalone diagnostic script are retained in the validation directory.
- Existing retained-grid, held-Brush, live editing, history, loading, navigation, timeline, keyboard and lifecycle regressions passed. Two legacy retained-grid/Brush assertions assumed labels exposed the full raw double; updated to require the normalized label plus exact semantic retention/single publication/DOM reuse, keeping private-preview checks intact. Initial full-gate failures are retained in browser-initial/ and browser-initial-brush/. No skipped test or timeout relaxation.
- Final responsive1024px and fractional-scale heatmap screenshots were visually reviewed; no dark backing bands remain in those captures and setup controls stay within the viewport.
- `git diff --check` passed. Artifacts: `/workspace/epicscope-v50-next-group9-validation/`.
