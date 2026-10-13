# Histogram

Histogram is EpicScope's general-purpose statistical/relationship analysis workspace. It sits between raw Logger inspection and question-specific Analyzer surfaces.

The current user-facing flow is intentionally shared across its analysis views:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger**

This document describes the current implemented state on `main`, the invariants established during the October 2026 consistency pass, and the remaining worthwhile work. For repository-wide continuation state, `docs/HANDOFF.md` remains authoritative.

## Current surfaces

Histogram currently contains four subviews:

- **Table Generator**
- **Distribution**
- **Scatter**
- **Math Channels**

Table Generator is the most mature individual tool. The current consistency work deliberately brought Distribution and Scatter onto the same shared scope, qualification, evidence and Math Channel contracts instead of growing independent one-off workflows.

## Current Histogram milestones

The current coherent baseline was established through four merged milestones:

### PR #339 — Scope and evidence flow

Implemented:

- consistent visible scope vocabulary across Table Generator, Distribution and Scatter:
  - **Full Log**
  - **Current A/B**
  - **Saved Range**
- shared Logger timeline under Table Generator as well as Distribution/Scatter;
- Distribution comparison using any Primary/Compare scope combination on one shared bin geometry;
- removal of redundant manual Refresh controls from auto-updating Histogram analysis views;
- Distribution comparison Auto bins derived from the combined compared population instead of only the first scope;
- Distribution **Time** mode no longer attributes discontinuous/large timestamp gaps to a value bin;
- large-array `Math.min(...values)` / `Math.max(...values)` style hazards removed from Distribution;
- Scatter directly supports Full Log / Current A/B / Saved Range;
- Scatter density is calculated from the full qualified pair population while visible point rendering remains bounded for browser performance;
- Scatter line traces break across large source-index discontinuities rather than drawing through gaps;
- rendered Scatter points can be selected and opened in Logger.

### PR #340 — Shared Qualification

Implemented one Histogram qualification contract around the existing saved analysis-filter storage:

- the same saved grouped **ALL/ANY** qualification sets work in Table Generator, Distribution and Scatter;
- qualification runs before Distribution binning/statistics and before Scatter pairing/density;
- Distribution Compare uses the same qualification on both sides;
- Scatter panes use the same qualification;
- compact Input/Eligible provenance is visible;
- filter sets with unavailable required channels remain visible but disabled instead of silently changing meaning;
- qualified evidence remains traceable to Logger.

### PR #344 — Shared Math Channels

Saved Math Channels are now first-class Histogram analysis inputs:

- Table Generator retains its mature existing formula path;
- Distribution and Scatter publish saved Math Channels as ordinary selectable logical channels;
- calculated traces are materialized on demand from physical dependencies while retaining source-sample alignment;
- qualification sets that reference Math Channels now work in Distribution and Scatter;
- the logical channel catalog refreshes when Math Channels change;
- formula references remain physical-channel based rather than silently introducing nested formulas.

The old compact calculated-field editor still exists internally in Table Generator, but it is hidden from the user. The dedicated **Math Channels** workspace is the visible editor. Do not disturb the dormant duplicate solely for tidiness until the planned consolidation/cleanup phase.

### PR #345 — Unified help

Histogram now uses the same shared anchored round-`i` help interaction as Analyzer.

Current local help covers only non-obvious semantics, including:

- Table Generator cell statistics;
- Z subtraction/reference behavior;
- shared Qualification;
- Distribution Count / % Samples / Time;
- Distribution Auto/Manual bins;
- Histogram vs Cumulative view;
- Distribution Compare;
- Scatter Dots vs Lines;
- Scatter density heat behavior.

The earlier bespoke Table Generator help surface is no longer the visible user path.

## Table Generator — current state

Table Generator is the current reference implementation for rich generic binned analysis.

Implemented behavior includes:

- Full Log / Current A/B / Saved Range scope;
- X/Y/Z channel selection;
- physical channels and saved Math Channels;
- Count, Mean, Min, Max, Sum, Standard Deviation, Variance and **Weighted Mean**;
- optional sample-by-sample Z subtraction/reference channel;
- automatic geometry, custom breakpoints and loaded-MSQ table geometry;
- saved presets;
- shared saved Qualification sets;
- MLV-style weighted hit geometry with individual/total weight thresholds;
- value- or hit-weight-based coloring;
- hit counts;
- cell hover/details;
- cell sample inspection;
- exact cell evidence → Logger navigation;
- CSV export;
- visible input/eligible/filtered/binned/outside provenance.

Current UI terminology is **Table Size** and **Weighted Mean**.

The loaded MSQ table supplies geometry/breakpoints only. It must not silently replace the user's selected runtime X/Y/Z channels.

### Table Generator later cleanup

A few mature-path implementation details are intentionally deferred:

- the dormant duplicate mini calculated-field editor can be removed/consolidated later;
- runtime refinements that rewrite older internal wording/layout should move into their owning component during cleanup;
- the cell inspector could later show X/Y/Z/reference values directly, not only source/time identity.

Do not reopen these merely for code aesthetics while broader feature coverage remains the higher priority.

## Distribution — current state

Distribution currently supports:

- Full Log / Current A/B / Saved Range;
- physical channels and saved Math Channels;
- shared Qualification;
- Count / % Samples / Time Y-axis modes;
- automatic/manual bin count;
- Histogram/Cumulative presentation;
- mean, median, standard deviation, min/max and percentile summaries;
- optional second scope comparison;
- one shared bin geometry for both compared scopes;
- bin → Logger evidence navigation;
- shared Logger timeline.

### Distribution correctness invariants

- **Time** integrates only contiguous/reasonable recorded intervals; large recording/decoding gaps are not counted as time spent at the preceding value.
- comparison Auto bins are determined from the combined compared population so the first scope is not geometrically authoritative.
- comparison scopes share the same channel, Qualification and bin boundaries.

### Distribution worthwhile future work

Useful remaining improvements include:

- saved view/setup presets;
- CSV export of bins plus summary statistics;
- explicit fixed min/max/bin-width geometry for reproducible repeated tests;
- deeper consolidation around shared histogram-core primitives where that reduces duplicate definitions without changing behavior.

## Scatter — current state

Scatter currently supports:

- Full Log / Current A/B / Saved Range;
- physical channels and saved Math Channels;
- shared Qualification;
- Single/Dual panes;
- independent X/Y selections;
- Dots/Lines presentation;
- saved Scatter setup presets retaining scope, Qualification, layout, trace mode and both panes' X/Y selections;
- optional density heat encoding;
- density calculated from the full qualified X/Y population;
- bounded visible-point rendering for large-log browser performance;
- line breaks across large source-index discontinuities;
- rendered point selection and point → Logger navigation;
- drag-box region selection evaluated against the full qualified pair population, not only rendered/downsampled points;
- prominent in-plot region summary with pair share, X/Y bounds and contiguous-visit count;
- selected-region → Logger navigation focused on the strongest contiguous visit instead of the full first-to-last hit envelope;
- shared Logger timeline.

### Scatter worthwhile future work

The initial richer evidence-selection slice is complete with box selection. Useful later additions include:

- CSV export of selected/all X/Y evidence;
- optional compact correlation/linear-fit summary where genuinely useful;
- replacement of the remaining timeline text/DOM bridge with direct shared state propagation.

The timeline-state replacement belongs with the planned cleanup/consolidation work unless it becomes a correctness problem earlier.

## Math Channels — current state

Math Channels is the dedicated visible editor for reusable calculated analysis channels.

Current behavior includes:

- saved named formulas;
- source-channel browser/search;
- formula helpers and validation;
- numeric preview;
- stable `ƒ` identity/units in Histogram channel selectors;
- use in Table Generator, Distribution and Scatter;
- use inside shared Histogram Qualification definitions.

Math formulas currently resolve physical channel dependencies. Nested saved Math Channel references are not silently introduced.

## Shared UI and interaction rules

### Scope

Histogram analysis views use the same scope vocabulary:

- **Full Log**
- **Current A/B**
- **Saved Range**

Do not reintroduce view-specific variants such as `Range A/B`, `Whole log`, or compare-only saved-range semantics where a shared scope control is sufficient.

### Qualification

Qualification is one shared analysis concept, not three separate filter implementations.

Saved grouped ALL/ANY definitions should remain reusable across Table Generator, Distribution and Scatter. Missing dependencies must remain explicit.

### Math Channels

A saved Math Channel should behave like a normal logical analysis input where the analysis contract supports numeric channels. Do not build separate per-view formula systems.

### Automatic recalculation

Current Histogram analysis views recalculate when their controls change. A redundant `Refresh` button should not return unless a future live/stale-data model makes manual recalculation meaningfully different.

### Evidence

Where a result is derived from source samples, the user should be able to move from the result back to the relevant Logger evidence when practical.

Current evidence navigation:

- Table Generator cell → Logger;
- Distribution bin → Logger;
- Scatter point → Logger;
- Scatter selected region → Logger.

Scatter region selection deliberately uses the complete qualified pair population even when visible plotting is stride-reduced.

### Help

Use the shared anchored round-`i` popup component. Add help where calculation/qualification/interpretation is non-obvious; do not put an icon beside every self-explanatory value.

## Current preferred flow

For Table Generator, Distribution and Scatter, preserve:

> **Scope → Channels → Qualification → tool-specific calculation/display → evidence → Logger / Export**

The individual tools do not need identical layouts, but shared concepts should appear in the same conceptual order and use the same names.

Math Channels is a reusable input-definition workspace rather than a result analysis flow, so it remains intentionally different.

## Current deferred cleanup policy

Do not perform a broad Histogram refactor solely because duplicate/dormant implementation details are visible internally.

The project-owner direction is:

1. establish useful feature coverage across analyzers and generic analysis tools;
2. stop feature work at sensible maturity points;
3. then run a dedicated cleanup/consolidation/optimization phase across the codebase.

That later phase is the correct place to remove dormant duplicate editors, replace runtime UI surgery with owner-component behavior, remove unnecessary DOM bridges/observers, consolidate shared rendering/helpers, simplify CSS and re-profile large-log behavior.

## Immediate remaining Histogram priorities

The broad coherence pass is complete. Remaining work is narrower and should be justified by user value:

1. **saved setups/presets for Distribution and Scatter**;
2. **exports for Distribution and Scatter**;
3. optional further Scatter selection ergonomics (for example additive or freeform/lasso selection) only if field use justifies them;
4. eventually replace the remaining Scatter timeline text bridge with direct state propagation;
5. later cleanup/consolidation of dormant duplicate/runtime-refinement code.

Do not restart a broad Histogram rewrite. The current shared analysis contract is useful and should be preserved.