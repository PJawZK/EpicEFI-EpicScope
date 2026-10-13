# Histogram

Histogram is EpicScope's general-purpose statistical/relationship analysis workspace. It sits between raw Logger inspection and question-specific Analyzer surfaces.

The current user-facing flow is intentionally shared across its analysis views:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

This document describes the implemented state on `main`, the invariants established during the October 2026 consistency/research-parity passes, and the remaining maintenance direction. For repository-wide continuation state, `docs/HANDOFF.md` remains authoritative.

## Current surfaces

Histogram contains four subviews:

- **Table Generator**
- **Distribution**
- **Scatter**
- **Math Channels**

The generic Histogram research-parity track is closed at the current checkpoint. Table Generator, Distribution, Scatter and Math Channels have been brought onto the same shared scope, Qualification, evidence and reusable calculated-channel contracts rather than growing separate one-off workflows.

## Current Histogram milestones

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

Saved Math Channels became first-class Histogram analysis inputs:

- Table Generator retains its mature formula path;
- Distribution and Scatter publish saved Math Channels as ordinary selectable logical channels;
- calculated traces are materialized on demand from physical dependencies while retaining source-sample alignment;
- qualification sets that reference Math Channels work across Histogram;
- the logical channel catalog refreshes when Math Channels change;
- formula references remain physical-channel based rather than silently introducing nested formulas.

The old compact calculated-field editor still exists internally in Table Generator, but it is hidden from the user. The dedicated **Math Channels** workspace is the visible editor. Do not disturb the dormant duplicate solely for tidiness until the planned consolidation/cleanup phase.

### PR #345 — Unified help

Histogram uses the same shared anchored round-`i` help interaction as Analyzer. Help is intentionally limited to non-obvious calculations/semantics.

### PRs #372–#381 — maturity close-out

- #372 — Scatter box-region evidence selection.
- #373 — prominent region evidence and strongest contiguous Logger visit.
- #374 — saved Scatter setups.
- #375 — Scatter qualified/region CSV export.
- #376 — Distribution saved setups + CSV bins/summary export.
- #377 — Table Generator exact Median + aligned X/Y/Z/reference/delta cell evidence.
- #378 — Distribution fixed min/max/bin-width geometry + outside-geometry provenance.
- #379 — Math Channels historical references, comparisons/logical expressions, lazy conditionals and temporal helpers.
- #381 — shared timeline-wrapper docking fix so Logger, Table Generator, Distribution and Scatter present the Hide/Show controls edge tab in the same position.

## Table Generator — current state

Table Generator is the reference implementation for rich generic binned analysis.

Implemented behavior includes:

- Full Log / Current A/B / Saved Range scope;
- X/Y/Z channel selection;
- physical channels and saved Math Channels;
- Count, Mean, **Median**, Min, Max, Sum, Standard Deviation, Variance and **Weighted Mean**;
- optional sample-by-sample Z subtraction/reference channel;
- automatic geometry, custom breakpoints and loaded-MSQ table geometry;
- saved presets;
- shared saved Qualification sets;
- MLV-style weighted hit geometry with individual/total weight thresholds;
- value- or hit-weight-based coloring;
- hit counts;
- cell hover/details;
- cell sample inspection with aligned source/time plus actual X/Y/Z/reference/delta values;
- exact cell evidence → Logger navigation;
- CSV export;
- visible input/eligible/filtered/binned/outside provenance.

Current UI terminology is **Table Size** and **Weighted Mean**.

The loaded MSQ table supplies geometry/breakpoints only. It must not silently replace the user's selected runtime X/Y/Z channels.

### Table Generator later cleanup

A few mature-path implementation details are intentionally deferred:

- the dormant duplicate mini calculated-field editor can be removed/consolidated later;
- runtime refinements that rewrite older internal wording/layout should move into their owning component during cleanup.

Do not reopen these merely for code aesthetics while broader feature coverage remains the higher priority.

## Distribution — current state

Distribution supports:

- Full Log / Current A/B / Saved Range;
- physical channels and saved Math Channels;
- shared Qualification;
- Count / % Samples / Time Y-axis modes;
- automatic/manual bin count plus explicit **Fixed Min / Max / Width** geometry for reproducible repeated tests;
- Histogram/Cumulative presentation;
- mean, median, standard deviation, min/max and percentile summaries;
- optional second scope comparison;
- one shared bin geometry for both compared scopes;
- saved Distribution setup presets retaining channel, scope, Qualification, metric, bins/geometry, view and compare scope;
- CSV export of shared bin geometry/values plus per-series summary statistics and eligibility/outside-geometry provenance;
- bin → Logger evidence navigation;
- shared Logger timeline.

### Distribution correctness invariants

- **Time** integrates only contiguous/reasonable recorded intervals; large recording/decoding gaps are not counted as time spent at the preceding value.
- comparison Auto bins are determined from the combined compared population so the first scope is not geometrically authoritative.
- comparison scopes share the same channel, Qualification and bin boundaries.
- fixed geometry is exact and repeatable; values below Min or above Max are **outside geometry**, not edge-clamped into the first/last bin.
- fixed geometry remains bounded to the supported bin-count limit and invalid Min/Max/Width combinations must fail explicitly.

### Distribution future work

The research-driven Distribution maturity pass is complete. Remaining work is implementation cleanup only, such as deeper consolidation around shared histogram-core primitives where that reduces duplicate definitions without changing behavior.

## Scatter — current state

Scatter supports:

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
- CSV export of all qualified pairs or the complete selected-region evidence, including source sample/time provenance;
- shared Logger timeline.

### Scatter maturity checkpoint

The planned Scatter maturity track is complete at this checkpoint. Further statistical overlays such as correlation/linear-fit summaries are intentionally not part of the active plan. Additive/lasso region selection is also not planned unless real field use shows a concrete need.

## Math Channels — current state

Math Channels is the dedicated visible editor for reusable calculated analysis channels.

Current behavior includes:

- saved named formulas;
- source-channel browser/search;
- arithmetic plus comparison/logical expressions (`>`, `<`, `>=`, `<=`, `==`, `!=`, `AND`, `OR`, `NOT`), including symbolic logical forms where supported;
- lazy `if(condition, true, false)` conditionals;
- MLV-style historical sample references such as `[RPM-1]`;
- sample-aware `lag()`, `delta()`, moving `avg()` and timestamp-based `rate()` helpers;
- formula helpers and validation;
- numeric preview;
- stable `ƒ` identity/units in Histogram channel selectors;
- use in Table Generator, Distribution and Scatter;
- use inside shared Histogram Qualification definitions.

Historical suffixes are resolved exact-name first: a real physical channel literally named `RPM-1` wins; otherwise `[RPM-1]` means one source sample before `[RPM]`. Temporal history is evaluated within the loaded source range, so the first lookback/window samples are intentionally invalid rather than fabricated. `rate([Channel], N)` uses recorded timestamps and returns change per second. Temporal sample/window counts are bounded to 4096.

Math formulas continue to resolve physical channel dependencies. Nested saved Math Channel references are not silently introduced; composition remains explicit and cycle-free.

Manual testing after PR #379 confirmed the expanded expression paths work in practice, including historical references, window functions, rate calculations and conditional/logical expressions.

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
- Scatter selected region → strongest contiguous Logger visit.

Scatter region selection deliberately uses the complete qualified pair population even when visible plotting is stride-reduced.

### Shared timeline and Hide/Show controls docking

Logger owns the authoritative timeline implementation. Table Generator, Distribution and Scatter reuse it.

The invariant established by PR #381 is:

> Re-parent the complete Logger `.timeline-wrap` intact.

Do **not** move `.timeline-shell` and `.edge-toggle--timeline` independently. `.timeline-wrap` is the positioning context for the centered Hide/Show controls edge tab. Splitting the wrapper recreates the bug where Table Generator places the control in the wrong area and Scatter/Distribution can hide it behind the plot.

Expected visible behavior is the same on all four timeline-backed surfaces:

- Logger;
- Table Generator;
- Distribution;
- Scatter.

The Hide/Show controls tab sits centered on the upper edge of the timeline/control panel.

### Help

Use the shared anchored round-`i` popup component. Add help where calculation/qualification/interpretation is non-obvious; do not put an icon beside every self-explanatory value.

## Current preferred flow

For Table Generator, Distribution and Scatter, preserve:

> **Scope → Channels → Qualification → tool-specific calculation/display → evidence → Logger / Export**

The individual tools do not need identical layouts, but shared concepts should appear in the same conceptual order and use the same names.

Math Channels is a reusable input-definition workspace rather than a result analysis flow, so it remains intentionally different.

## Validation checkpoint

The generic Histogram parity work has practical browser validation in addition to automated tests:

- Table Generator parity behavior passed manual testing;
- Distribution fixed geometry and related behavior passed manual testing;
- the expanded Math Channel expression language passed manual testing;
- Scatter box selection, region summary and strongest-visit Logger navigation were manually confirmed useful;
- after PR #381 the Hide/Show controls tab placement was confirmed fixed across the timeline-backed Histogram views.

The representative large-log workload remains the ~1.19 GB / 320,458-record MLG with `mainController.ini` used throughout the project performance/runtime validation.

## Current deferred cleanup policy

Do not perform a broad Histogram refactor solely because duplicate/dormant implementation details are visible internally.

The project-owner direction is:

1. establish useful feature coverage across analyzers and generic analysis tools;
2. stop feature work at sensible maturity points;
3. then run a dedicated cleanup/consolidation/optimization phase across the codebase.

That later phase is the correct place to remove dormant duplicate editors, replace runtime UI surgery with owner-component behavior, remove unnecessary DOM bridges/observers, consolidate shared rendering/helpers, simplify CSS and re-profile large-log behavior.

## Remaining Histogram priorities

There is no active Histogram feature-expansion queue at this checkpoint.

Only do Histogram work for:

1. a concrete correctness or field-use regression;
2. maintenance of the shared Scope / Qualification / Math / evidence contracts;
3. preservation of the shared `.timeline-wrap` docking invariant;
4. later cleanup/consolidation after broader analyzer maturity work.

Do not restart a broad Histogram rewrite.
