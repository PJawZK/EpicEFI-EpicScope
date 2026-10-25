# Follow-up Group 6 — Structured Cell Evidence and original-tune direction colors

Baseline: Group 5 `3d84531b194338c8a4b4daa0cb552e9d0c3d436d`. Local recovery lineage only; no main merge, push or deployment change.

## Reproduction and ownership

Two independent browser regressions were reproduced before correction in staged and fallback modes:

1. With the real app-level UI refinement installed, repeated released clicks on measured cells replaced `.ve-evidence-detail-grid` with plain tooltip text. Pointer/focus selection could restore the grid before release, explaining the held-button symptom. The legacy `installVeAnalyzerUiRefinements` handler and retained `installVeAnalyzerCellEvidence` owner were writing the same popover body.
2. Generated working values differed from original tune values but had `data-table-value-state=same`. The edit adapter passed its generated review baseline into the shared DOM comparison. This was correct for Revert/history authority but hid analysis-generated changes in number coloring.

## Corrections

VE table clicks and read-only cell keyboard activation now use the retained structured evidence owner. The legacy tooltip fallback skips the VE table while preserving separate Lambda Delay details. Tooltip text is no longer allowed to replace VE evidence. Repeated selection borrows cached detail nodes, retained primary analysis and strongest-visit evidence; it does not reload traces or recompute full-log evidence. Existing selection-following and explicit Cell Evidence actions remain.

Brush clicks, clicks inside form controls and active cell editors do not open evidence. The root-local keyboard handler honors prevented events, preserving Enter/F2 editing in Working VE. Read-only Result Views can activate the existing evidence panel with Enter/Space. New listeners use the existing owner's AbortController; no document/global listeners, observers or lifecycle wrapper were added.

The existing typed table projection now borrows original tune values for presentation comparisons. Only the snapshot passed to the DOM color/preview adapter substitutes these values as its comparison baseline, once per pass. No per-cell owner snapshots or log scans were added. Original tune, generated proposal, reviewed working values, generated Revert baseline and Undo/Redo ownership remain distinct and unchanged. A successful analysis therefore immediately colors numerical increases red and decreases blue relative to original tune. Manual edits, previews and reverted values use that same original-tune comparison. Equal/undefined/nonfinite values retain the shared neutral/absent rules and numerical tolerance.

Direction glyph styles apply to Working VE (or an unadapted base table), not unrelated read-only sample/weight/delay metrics. Existing red/blue colors, glyph halo, heatmap and pin/selection indicators remain; Lambda Delay comparison behavior is unchanged.

## Regression coverage and limitations

Six new Chromium cases cover controlled AFR 15 and 13 against target 14: structured release/repeat/keyboard detail, generated red/blue colors, edits reversing direction, original-value neutrality, generated-baseline Revert, Result View round trips, unaffected cells, and Brush/editor exclusion. They assert retained primary identity, unchanged semantic revision and no additional trace reads. The app-level refinement is installed, unlike isolated evidence-only fixtures that missed the conflicting writer.

Full gate results, exact commit, built-production native mouse checks, screenshots and handoff are recorded under `/workspace/epicscope-v50-followup-group6/`. The user's original large recording and hardware are unavailable. This presentation correction makes no large-log timing claim and does not alter numerical analysis, discovery, storage or ECU writing. Group 1 dropdown closure remains unreproduced and is not claimed fixed here.

Final gates: build/typecheck passed; 956 unit tests in 138 files passed; 1,402 Chromium checks in 156 result groups passed (701 per mode). All 32 built-production smoke checks passed, including native released/reopened changed-cell evidence, unaffected-cell evidence and 14 generated changes with correct red/blue directions in each mode. Structured labels/values and colored glyphs were visually inspected in the production screenshot. Existing delay discovery, interpolation, pins, range selection, explicit scoped analysis, navigation and Diagnostics checks passed. No tests skipped or timeouts relaxed. Existing bundle-size warning remains.
