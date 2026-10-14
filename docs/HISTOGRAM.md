# Histogram

Histogram is EpicScope's general-purpose statistical/relationship analysis workspace. It sits between raw Logger inspection and question-specific Analyzer surfaces.

The shared user-facing flow is:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

For repository-wide continuation state, `docs/HANDOFF.md` remains authoritative. Research-derived behavior and current implementation disposition are tracked in `docs/research/STATUS.md`.

## Current status — 2026-10-14

The generic Histogram research-parity track is **closed at the current checkpoint**.

Histogram currently contains:

- **Table Generator**
- **Distribution**
- **Scatter**
- **Math Channels**

These surfaces share scope, Qualification, evidence and reusable calculated-channel concepts rather than maintaining unrelated workflows.

Further Histogram work should be correctness/regression maintenance or deliberate cleanup unless field use exposes a concrete missing behavior.

## Shared channel-selector convention

Histogram channel selectors show unit metadata when available:

```text
MAP [kPa]
RPM [rpm]
Injector duty [%]
ƒ Rail Differential [kPa]
```

This applies across Table Generator, Distribution and Scatter and includes Math Channels when they carry unit metadata.

Non-channel selectors such as Scope, Qualification, metric, mode and saved setup choices are not rewritten as channel labels.

## Table Generator

Current mature capability includes:

- Full Log / Current A/B / Saved Range;
- shared Qualification;
- physical channels and Math Channels;
- automatic, custom and MSQ/tune geometry;
- Count;
- Mean;
- Median;
- Min;
- Max;
- Sum;
- Std Dev;
- Variance;
- Weighted Mean;
- Z reference/subtraction;
- weighted breakpoint-node behavior matching the useful mature MegaLogViewer model;
- exact aligned cell evidence with X/Y/Z/reference/delta values;
- source/time provenance;
- Logger navigation;
- CSV/export support.

### Weighted-node invariant

Tune-table breakpoints are nodes, not rectangular buckets. A qualifying operating point may contribute to surrounding nodes according to fractional X/Y relevance.

This weighting model is also an important reusable foundation for the planned VE Analyzer.

### Evidence advantage over the reference research

MegaLogViewer demonstrated useful weighting and cell-statistic behavior, but EpicScope retains exact source-sample provenance behind evidence where practical. That is considered an intentional EpicScope improvement, not a compatibility mismatch.

## Distribution

Current mature capability includes:

- Full Log / Current A/B / Saved Range;
- shared Qualification;
- physical + Math Channels;
- Count / % Samples / Time;
- Histogram / Cumulative;
- descriptive statistics;
- Primary/Compare scope comparison on shared geometry;
- saved setups;
- CSV bins/summary export;
- bin → Logger evidence;
- correct treatment of timestamp gaps in Time mode;
- exact repeatable Fixed Min / Max / Width geometry;
- explicit outside-geometry provenance rather than silent edge clamping.

## Scatter

Current targeted maturity includes:

- Full Log / Current A/B / Saved Range;
- shared Qualification;
- physical + Math Channels;
- Single / Dual;
- Dots / Lines;
- density heat;
- bounded browser rendering while analysis uses the full qualified population;
- point evidence;
- box-region evidence;
- prominent selected-region evidence summary;
- strongest contiguous selected-region visit → Logger;
- saved setups;
- qualified/region CSV export.

### Research ideas deliberately deferred

MegaLogViewer research also exposed viewport-pixel aggregation, true Z mean/min/max coloring and polynomial-fit-style options.

These are **deferred**, not forgotten. The current Scatter track is closed because existing evidence/navigation/export behavior is sufficient for the approved scope. Revisit only if field use or measured performance demonstrates a real need.

## Math Channels

Current expression language includes:

- arithmetic;
- comparisons;
- logical expressions;
- lazy `if()`;
- exact-name-first MLV-style `[Channel-N]` historical references;
- `lag()`;
- `delta()`;
- moving `avg()`;
- timestamp-based `rate()`.

Math Channels can be reused as Histogram numeric inputs and Qualification dependencies.

### Deliberate differences from MegaLogViewer

EpicScope intentionally improves on several historical behaviors observed in the reference tool:

- conventional operator precedence remains the default;
- missing history should not silently fabricate a zero unless an explicit compatibility mode is ever introduced;
- qualification/filter failures remain visible rather than silently disabling the filter and broadening the analyzed population.

Nested saved Math Channel references remain deliberately unsupported at this checkpoint.

## Shared Qualification

The same saved grouped ALL/ANY Qualification sets work across Table Generator, Distribution and Scatter.

Qualification occurs before the analysis-specific aggregation step.

Unavailable required dependencies remain visible/disabled rather than silently changing meaning.

## Shared timeline/docking invariant

Logger owns the authoritative timeline component.

Table Generator, Distribution and Scatter reuse the **complete `.timeline-wrap`** intact.

Do not move `.timeline-shell` and `.edge-toggle--timeline` independently. The wrapper is the positioning context for the centered Hide/Show-controls edge tab. Splitting them recreates the placement/overlap regression fixed in PR #381.

## Research-parity milestones

Important maturity milestones include:

- #339 — shared scope/evidence flow;
- #340 — shared Qualification;
- #344 — shared Math Channels;
- #345 — unified help;
- #372 — Scatter box-region evidence;
- #373 — strongest contiguous Logger visit;
- #374 — saved Scatter setups;
- #375 — Scatter qualified/region CSV export;
- #376 — Distribution saved setups + CSV;
- #377 — Table Generator exact Median + aligned evidence;
- #378 — Distribution exact fixed geometry;
- #379 — expanded Math Channels;
- #380 — research-parity closeout documentation;
- #381 — shared timeline-wrapper docking fix;
- #392 — unit-aware Histogram channel selectors.

## Cleanup direction

Later cleanup may:

- consolidate dormant/duplicate editor paths;
- replace remaining text/DOM state bridges where they become a maintenance problem;
- reduce runtime UI surgery;
- consolidate shared rendering/control helpers.

Do not reopen Histogram for broad feature expansion merely because cleanup opportunities exist.

## Histogram invariant

> Histogram should make the relationship being analyzed explicit: scope, channels, qualification, aggregation, evidence and source provenance must remain understandable and reproducible.
