# Histogram

Histogram is EpicScope's general-purpose statistical/relationship analysis workspace between raw Logger inspection and question-specific Analyzer surfaces.

For repository-wide current state use `HANDOFF.md`; `DOCUMENTATION_MAP.md` defines authority and `research/STATUS.md` maps research to current implementation.

## Current status — 2026-10-15

The generic Histogram research-parity track is **closed at the approved checkpoint**.

Current surfaces:

- **Table Generator**
- **Distribution**
- **Scatter**
- **Math Channels**

Further Histogram work should be correctness/regression maintenance or deliberate cleanup unless field use exposes a concrete missing behavior.

## Shared flow

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

Shared selectors show units when metadata exists (`MAP [kPa]`, `RPM [rpm]`, etc.). Non-channel selectors are not rewritten as channel labels.

## Table Generator

Current mature capability includes:

- Full Log / Current A/B / Saved Range;
- shared Qualification;
- physical channels and Math Channels;
- automatic, custom and MSQ/tune geometry;
- Count, Mean, Median, Min, Max, Sum, Std Dev, Variance and Weighted Mean;
- Z reference/subtraction;
- weighted breakpoint-node behavior;
- exact aligned cell evidence with X/Y/Z/reference/delta values;
- source/time provenance;
- Logger navigation;
- CSV/export support.

### Weighted-node invariant

Tune-table breakpoints are nodes, not rectangular buckets. A qualifying operating point may contribute to surrounding nodes according to fractional X/Y relevance.

This same geometry is a foundation used by the implemented VE Analyzer evidence model.

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
- timestamp-gap-aware Time mode;
- exact repeatable Fixed Min / Max / Width geometry;
- explicit outside-geometry provenance rather than edge clamping.

## Scatter

Current mature capability includes:

- Full Log / Current A/B / Saved Range;
- shared Qualification;
- physical + Math Channels;
- Single / Dual;
- Dots / Lines;
- density heat;
- bounded browser rendering while analysis uses the full qualified population;
- point evidence;
- box-region evidence;
- selected-region evidence summary;
- strongest contiguous selected-region visit → Logger;
- saved setups;
- qualified/region CSV export.

Research ideas such as viewport-pixel aggregation with retained provenance, true Z mean/min/max coloring and polynomial-fit-style options are deliberately deferred unless field use or measured performance creates a real need.

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

EpicScope intentionally keeps conventional operator precedence and explicit invalid/unavailable semantics rather than copying historical quirks. Nested saved Math Channel references remain deliberately unsupported at this checkpoint.

## Shared Qualification

The same saved grouped ALL/ANY Qualification sets work across Table Generator, Distribution and Scatter. Qualification occurs before analysis-specific aggregation. Unavailable required dependencies remain visible rather than silently changing meaning.

## Shared timeline/docking invariant

Logger owns the authoritative timeline component.

Table Generator, Distribution and Scatter reuse the **complete `.timeline-wrap`** intact. Do not move `.timeline-shell` and `.edge-toggle--timeline` independently; the wrapper is their positioning context.

## Research-parity milestones

The closed checkpoint includes shared scope/evidence/Qualification/Math/help, Scatter box-region evidence and strongest visit, saved Scatter setups/export, Distribution setups/export/fixed geometry, expanded Math Channels, unit-aware selectors and the timeline-wrapper docking fix.

Historical PR numbers remain available through Git history; this document records the current product contract rather than serving as a chronological changelog.

## Cleanup direction

Later cleanup may consolidate dormant editor paths, reduce DOM-derived state bridges and consolidate shared rendering/control helpers where doing so solves a concrete maintenance/correctness issue.

Do not reopen Histogram for broad feature expansion merely because internal cleanup opportunities exist.

## Histogram invariant

> Histogram should make the relationship being analyzed explicit: scope, channels, qualification, aggregation, evidence and source provenance must remain understandable and reproducible.
