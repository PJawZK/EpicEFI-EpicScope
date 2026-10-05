# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative branch: `main`

Current application baseline entering this handoff refresh:

`468dfdd34587d43bd5e6651df9834ab3996cfa57`

That commit is the merge of PR #215, **Refine Table Generator controls and filters**.

Validation on that application baseline:

- Web CI: PASS — type-check, tests and production build;
- GitHub Pages build/deploy: PASS.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

Normal owner testing is browser/GitHub-Pages based and must not require a local clone, Node.js or npm.

This file is the present-tense continuation authority. Older current-state wording in `README.md`, `ROADMAP.md` or `UI_REFERENCE.md` is historical if it conflicts with this handoff.

## Current project position

**Phases 1 through 4 are complete for the currently approved scope.**

Do not begin Phase 5 unless the project owner explicitly asks to resume it. The current work is product/UI refinement of the already-implemented Web analysis surfaces, especially Histogram/Table Generator usability.

Approved workflow remains:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

Logger/performance architecture is considered stable enough for now. Reopen it only for a concrete defect, regression, or required integration hook.

## Current real EpicScope modes

The EpicScope logo dropdown remains the mode/surface switcher.

### Logger

Recorded-log viewing/navigation and source context:

- MLG v1/v2 loading, indexing and validation;
- optional INI channel catalog/binding;
- reusable named workspaces and multi-pane graphs;
- active channel browser plus full available-channel analysis catalog;
- shared viewport/cursor/timeline;
- A/B selection, markers and saved ranges;
- Channel Details/statistics;
- contextual Analyze entry;
- exact-log persistence separated from reusable workspace state;
- session/cache/OPFS large-log architecture.

### Histogram

Histogram is a no-scroll, visualization-first analysis workspace. Current selectable surfaces are:

- **Table Generator** — primary binned/table analysis surface and default;
- **Distribution**;
- **Scatter**;
- **Math Channels**.

The former Heatmap and Dual Heatmap views are no longer user-facing Histogram modes. Their useful binned-analysis role is owned by Table Generator.

### Analyzer

Implemented real Analyzer subviews:

- Range Compare;
- Tune Table;
- Boost · Experimental;
- Idle · Experimental;
- AE / MAP Predict · Experimental;
- Fueling · Experimental;
- Ignition · Experimental;
- Fuel Pressure / Injector · Experimental;
- Trigger / Sync · Experimental.

Do not create another top-level mode when a capability naturally belongs in Logger, Histogram or Analyzer.

## Histogram / Table Generator — current state

The current Table Generator is the MLV-inspired table-analysis authority in Histogram.

### Channel/data authority

- X, Y, Z, optional Z Delta and filters can use the full available loaded-log channel catalog; channels do not need to be graphed first.
- Only channels actually requested by the current analysis are decoded/read.
- Whole log, A/B and saved-range scopes remain supported.
- Source-sample alignment and explicit invalid/unavailable/filter evidence remain authoritative.

### Cell/statistic modes

Current Cell modes include:

- **MLV weighted mean** — first item and default;
- Mean;
- Count;
- Minimum;
- Maximum;
- Sum;
- Standard deviation;
- Variance.

Weighted mode exposes MLV-style contributing-hit counts and accumulated hit weight, plus minimum individual-weight and minimum total-hit-weight controls.

### Axes and table geometry

Axis sources:

- Auto bins;
- Custom breakpoints;
- Loaded MSQ table.

Custom/MSQ breakpoints are real table nodes, not merely min/max limits.

**Loaded MSQ table is geometry-only.** The selected tune table supplies its X/Y breakpoint vectors and therefore rows/columns. It must **not** change the user's selected X, Y or Z analysis channels.

Intended workflow:

> choose scope + X/Y/Z values → choose table geometry → fit the chosen scoped values into that grid.

INI `[TableEditor]` relationships remain the source of truth for which tune `xBins`/`yBins` vectors belong to an MSQ table. Do not guess table axes from matching dimensions when explicit metadata exists.

The **Size** control applies to Auto bins only and currently offers:

- 8×8;
- 12×12;
- 16×16;
- 8×16;
- 16×8;
- 16×1.

Selecting one explicitly switches to Auto bins. Custom/MSQ geometry keeps its own dimensions.

### Presets

**Presets are saved complete Table Generator setups.** They retain the reusable analysis choices, including:

- scope;
- X/Y/Z and Z Delta;
- statistic;
- filters;
- axis/grid configuration;
- weighting options;
- calculated-channel references by stable local ID where applicable.

### Filters

Filters have moved toward a compact Math-Channels-style manager rather than the older flat row list.

Current direction/state:

- saved-filter library;
- compact condition editor;
- physical and Math/Calculated channels available;
- `!=` plus the existing comparison operators;
- A/B/C groups;
- ALL/ANY logic inside groups;
- ALL/ANY logic between groups.

Continue refining approachability and density from this implementation; do not replace the filter semantics with a new parallel system.

### Cell traceability

- generated cells retain source sample indices;
- clicking a cell opens a compact sample inspector;
- inspector supports exact sample/time evidence and copy;
- **Open in Logger** returns to Logger and frames the contributing sample span;
- Histogram reaches Logger through a narrow navigation callback rather than owning Logger internals.

### Export/help/readability

- CSV export includes table values and evidence tables;
- contextual information/help controls explain Table Generator behavior;
- small information/table typography has been increased from the earlier overly-small state;
- Diagnostics / Perf / Report use compact, visually consistent boxed controls across modes.

## MLV weighted-mean compatibility status

The established breakpoint-node weighting from PR #213 is considered sufficiently matched for current use. PR #214 aligned the visible weighted hit evidence with the weighted calculation.

Validated against supplied `2026-10-02_13.27.46.mlg` and MLV screenshots using RPM × TPS × `Boost: Open loop`:

- samples between adjacent X nodes contribute linearly to both nodes;
- samples between adjacent Y nodes contribute linearly to both nodes;
- combined cell weight is X weight × Y weight;
- values beyond an outer breakpoint clamp to that outer node;
- the visible MLV cell values reproduced to displayed precision across the inspected 8×8 table.

Representative checks:

- 1800 / 100: MLV 106 hits · 33.16 weight · 40.00; reconstructed ~106 · 33.163 · 40.000;
- 5000 / 100: MLV 30 · 8.46 · 43.51; reconstructed ~30 · 8.464 · 43.515;
- 5000 / 0: MLV 39 · 15.60 · 44.23; reconstructed ~39 · 15.601 · 44.231;
- 1800 / 0: MLV 50,748 · 33,480.82 · 38.53; EpicScope/reconstruction ~50,767 · 33,481.79 · 38.528.

The remaining 19-hit difference at 1800 / 0 is about 0.037% and is a **compatibility footnote, not an active pursuit**. `docs/DECISIONS.md` records it. If it is ever revisited, inspect MLV/EpicScope record-validity/retry handling before changing the established weighting geometry.

Important historical lesson: large earlier value differences came from comparing different Y inputs (`boostOpenLoopYAxisValue` versus actual TPS). Do not use Loaded MSQ geometry to auto-rewrite runtime analysis channels.

## Math Channels — current state

Calculated Fields are represented as a dedicated **Math Channels** surface, based on the useful interaction model from the approved EpicHub 0.0.45 reference rather than a tiny formula popover.

Current capabilities:

- saved Math Channel list/editor;
- Name, Unit and Formula;
- source-channel browser and one-click `[Channel Name]` insertion;
- arithmetic/operators and helper functions;
- safe parser/evaluator rather than JavaScript `eval`;
- validation and preview;
- calculated channels behave like normal downstream numeric choices in Table Generator axes, values and filters.

Supported helpers include `abs`, `min`, `max`, `sqrt`, `pow`, `clamp`, `round`, `floor`, `ceil`, `log` and `exp` plus normal arithmetic/powers.

## PR sequence since the Phase 4 handoff

The old Phase-4 handoff ended around PR #199. Relevant current continuation history:

- #200 — Phase 4 completion handoff;
- #201 — full-screen MLV-style Histogram workspace;
- #202 — full log channel catalog exposed to Histogram/Analyzer;
- #203 — MLV-style Table Generator foundation;
- #204 — custom/MSQ axis intelligence;
- #205 — presets, formulas/calculated fields and grouped filters;
- #206 — cell sample drill-down to Logger;
- #207 — Histogram workflow/Math Channels/readability refinement;
- #208 — startup blank-page hotfix after #207;
- #209–#211 — early MLV weighting experiments/revert;
- #212 — Loaded MSQ table made geometry-only;
- #213 — validated MLV breakpoint weighting;
- #214 — weighted evidence/count UI aligned to the calculation;
- #215 — current Table Generator UI cleanup/defaults/Size/Filters/Presets refinement.

Earlier experiments #209–#211 are historical only. Do not restore their superseded weighting models.

## Analysis provenance rules — authoritative

Analysis must not silently discard or invent evidence. Where applicable retain or expose:

- input sample count;
- valid/invalid/unavailable sample counts;
- rejected/outside-range counts;
- source sample indices;
- selected time/range scope;
- complete vs partial decoded coverage;
- explicit X/Y/Z/value/filter semantics;
- explicit aggregation method;
- weighted hit count/weight where weighted analysis is used;
- event thresholds/configuration where applicable.

If a trace does not fully cover the requested scope, do not present the result as complete.

## Large-log architecture — do not reopen without evidence

The large-log performance campaign remains done for now.

Primary architecture:

1. session RAM full-range cache;
2. OPFS MLG sidecar native-width transposed stripes;
3. sparse native OPFS per-channel cache;
4. original row-reader fallback.

Do not restart generic performance optimization without a concrete regression or feature-demonstrated bottleneck.

## Next chat — continue from here

A new chat should:

1. Read this `docs/HANDOFF.md` first and verify current `main`/CI if repository state may have moved.
2. Treat `468dfdd34587d43bd5e6651df9834ab3996cfa57` / PR #215 as the application baseline for this handoff refresh.
3. Continue the current **UI cleanup/refinement** work rather than reopening completed architecture/performance phases.
4. Use Table Generator as the binned-analysis surface; do not restore Heatmap/Dual Heatmap as separate user-facing modes without a new requirement.
5. Preserve the **MSQ geometry-only** rule.
6. Preserve **MLV weighted mean** as the first/default Table Generator statistic and the established PR #213 weighting geometry.
7. Treat the 19-hit MLV discrepancy as a footnote unless new evidence shows a real functional problem.
8. Continue refining the compact Filters/Presets/Size/help experience from PR #215; inspect hosted behavior in Brave/Chromium rather than redesigning from assumptions.
9. Keep Logger and Analyzer semantics stable unless a concrete defect or required integration justifies change.
10. Do **not** begin Phase 5 unless the project owner explicitly asks.

## Phase boundary

**Phases 1–4 are complete for the approved scope. Current work is UI refinement.**

Phase 5 remains future work only on explicit project-owner instruction.