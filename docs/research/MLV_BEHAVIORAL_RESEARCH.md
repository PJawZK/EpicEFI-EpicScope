# MegaLogViewer HD behavioral research

## Purpose and method

This document preserves behavioral research performed against MegaLogViewer HD 4.6.14 so EpicScope can benefit from mature user expectations and edge-case handling without copying proprietary code or architecture.

Reference specimen:

- product: MegaLogViewer HD 4.6.14 Linux package;
- archive SHA-256: `7468fd3b8fbb288b41d55fc5c7289205fa47b137361fab0d410b6854be963bce`;
- main application: `HogLogViewer.jar` (~5.1 MB, ~3719 classes);
- Linux bundle contained no native `.so`/JNI components relevant to the inspected behavior;
- implementation inspection used Java bytecode/resources only to explain observed behavior and remove ambiguity.

Research principle:

> Borrow MLV's accumulated experience, not its architecture.

Observed behavior and implementation findings are recorded separately from EpicScope conclusions where practical.

---

## Histogram / Table Generator

### Observed behavior

MLV Histogram/Table Generator supports:

- X, Y and Z channels;
- optional Z Delta channel;
- X/Y precision/digits;
- configurable rows/columns;
- generated, manual and imported axes;
- min/max axis generation;
- color/display modes;
- saved Histogram views;
- filters;
- tune-axis import;
- minimum individual hit weight;
- minimum cumulative cell hit weight.

Saved Histogram views persist rows/columns, X/Y/Z precision, X/Y/Z and Z-delta fields, explicit axis values, filter/config selection, color/display modes, auto-axis mode and weighting settings. Later-added trailing fields are optional/defaultable when loading older saved views. This is a useful persistence-compatibility pattern.

### Cell weighting

A qualified sample maps to fractional X/Y breakpoint positions. Contribution is linear on each axis and combined bilinearly, so a sample can contribute to up to four neighboring nodes.

Conceptually:

```text
weight(node) = xContribution * yContribution
```

Samples outside outer breakpoints clamp to the nearest edge node rather than extrapolating beyond the table.

Z Delta is applied first:

```text
effectiveZ = Z - ZDelta
```

and the effective Z value is then accumulated normally.

### Threshold semantics

Observed threshold behavior:

- individual hit contribution is rejected when `weight <= minimumIndividualWeight`;
- cumulative cell result is hidden when `cumulativeWeight < minimumTotalWeight`;
- equality at the cumulative threshold is accepted.

EpicScope's earlier weighted-table implementation rejected only `< minimumIndividualWeight`, making exact equality a small semantic mismatch worth explicit regression coverage.

MLV UI mapping:

- minimum individual weight slider is linear over approximately 0..1;
- cumulative hit-weight slider uses an exponential mapping approximately `2^(slider/20)`.

### Per-cell statistics

The MLV cell accumulator retains enough information to expose:

- weighted average;
- cumulative weight;
- accepted hit count;
- minimum;
- maximum;
- weighted sum;
- variance-like statistics.

Display modes include Weighted Averages, Minimum Values and Maximum Values.

EpicScope already exposes broader statistical views such as weighted mean, mean, count, min, max, sum, standard deviation and variance. This is a deliberate EpicScope improvement rather than a compatibility problem.

### Exact breakpoint behavior

MLV uses a small epsilon around exact fractional breakpoint coordinates to avoid floor/ceil degeneracy in its historical implementation. EpicScope should keep exact breakpoint semantics unless evidence shows an epsilon workaround is necessary.

### Filter failure behavior

MLV can disable an offending filter after an evaluation error and continue. This is resilient, but it can silently broaden the analyzed dataset.

EpicScope should instead surface qualification failure explicitly so the user cannot believe a filter was applied when it was not.

### Evidence navigation

Selected Histogram cells update a data-details panel with combined hit count, cumulative weight, variance, standard deviation, mean and min/max. No strong evidence was found that MLV retains exact source record IDs for every cell contribution.

EpicScope's weighted result retains source sample indices, which is a stronger evidence/navigation model and should be preserved.

---

## Calculated fields / math channels

### Observed expression capabilities

MLV supports substantially richer formulas than EpicScope's early calculated-field parser, including:

- direct references such as `[RPM]`;
- historical references such as `[RPM-1]`, `[RPM-2]`;
- arithmetic;
- comparisons and logic;
- conditional/if behavior;
- trigonometric/log functions;
- stateful functions.

Observed stateful/utility concepts include:

- `lastValue`;
- `historicalValue`;
- `accumulate`;
- `maxValue`;
- `minValue`;
- `avg`;
- `sum`;
- `selectExpression`;
- `if`;
- `isTrueFor`;
- `timeTrue`;
- `toggle`.

### History bootstrap

When a requested historical record is unavailable at the beginning of a log, MLV returns zero rather than invalid/NaN.

This enables cumulative/self-history formulas but can manufacture artificial startup values.

EpicScope should default missing history to explicit invalid/unavailable state and only offer zero-bootstrap as an intentional compatibility mode if needed.

### Dependency resolution

MLV effectively appends calculated fields into the available channel set and iteratively resolves dependencies:

```text
raw fields
  -> calculated fields whose dependencies are ready
  -> append them
  -> repeat
```

This supports chains such as `A -> B -> C`.

Self-history is intentionally allowed by ignoring a field's own name as a blocking dependency, enabling cumulative formulas such as a previous calculated value plus a delta.

True unresolved cycles eventually appear as unavailable dependencies, but diagnostics are generic.

EpicScope should distinguish:

- missing dependency;
- true cycle;
- permitted self-history.

### `smoothBasic()` implementation

The documented description suggests averaging over a number of records, but inspected behavior is recursive:

```text
out = ((previousOut * (factor - 1)) + current) / factor
```

For `factor=5`, this is equivalent to an EMA-like filter with alpha `1/5`, not a moving average.

This is an example of why behavioral verification matters more than feature names/documentation alone.

### `smoothFiltered()`

The filtered smoother maintains persistent estimator state and behaves like a more sophisticated state estimator/Kalman-style smoother. It caches output for the current record so multiple references in one expression do not advance the filter state twice.

EpicScope should keep stateful evaluation state scoped to an evaluation instance/range rather than global compiled expression state, preventing cross-range/cross-view contamination.

### Operator precedence

Evidence indicates older MLV formula evaluation may execute ordinary math left-to-right unless parentheses are used rather than conventional mathematical precedence.

EpicScope's conventional precedence is preferable and should remain the default. A compatibility mode should only be considered if importing MLV formulas becomes a real requirement.

---

## Scatter

### Observed model

MLV Scatter is a true X/Y/Z view with persisted X/Y/Z fields and independent min/max limits.

It exposes controls for:

- X/Y section counts;
- minimum/maximum dot size;
- Z gradient count;
- Z color aggregation using average/min/max;
- optional polynomial fit;
- scale overlays;
- filters;
- saved Scatter views.

### Performance strategy

A major mature behavior is screen-pixel aggregation.

Qualified samples map into viewport pixels. Per occupied pixel, MLV retains density and a Z aggregate. Rendering therefore scales more with occupied display pixels than with total source sample count.

Dot size grows with local density up to the configured maximum. Z color can represent mean/min/max of samples landing in a pixel.

This is an important alternative to simple source-data striding for very large logs.

### Point to Logger

Clicking a Scatter point maps screen coordinates back to approximate X/Y and searches source records for a nearby match within a tolerance based on axis span. Evidence suggests this is approximate lookup rather than exact retained provenance from the pixel aggregate.

EpicScope's source-index retention is a stronger model. If EpicScope adopts viewport aggregation, it should retain the contributing source indices behind each rendered aggregate so performance does not sacrifice evidence navigation.

### EpicScope opportunity

A useful future model is:

- optional true Z channel;
- color mode = Density or Z(mean/min/max);
- viewport-space aggregation benchmarked against current rendering;
- all source indices retained behind each aggregate pixel;
- richer box/lasso evidence selection.

---

## Compare, graph navigation and playback

### Second-dataset model

MLV compare uses a true second dataset rather than fabricating merged channels. Primary and comparison logs remain independent and go through the same loading/calculated-field path.

Fields are matched by name rather than by source column position.

### Alignment

Observed automatic alignment behavior can align logs using the first record where time transitions to non-negative and then maintain an integer record-index offset. Manual compare alignment is also expressed as a sample-index offset.

This works for equal-rate logs but is not robust across differing logger rates.

EpicScope should model comparison as:

```text
PrimarySource
CompareSource
AlignmentTransform
```

with time as the canonical axis and alignment modes such as timestamp, relative start, first time=0, selected event, marker and manual time offset.

### Shared cursor/playback state

MLV uses a central current-record/navigation state across graphs and playback. Playback advances that same state rather than creating a separate rendering-only timeline.

This is a useful product behavior to preserve conceptually.

---

## MLG reader reliability

### Standard record structure

Observed MLG record structure:

```text
2 bytes  block type + rolling counter
2 bytes  timestamp
N bytes  payload
1 byte   payload checksum
```

Total record block size is therefore `recordLength + 5`.

Block type `0` is a standard record and type `1` is marker/message data.

Payload checksum is the low eight bits of the byte sum.

Counter wraps naturally `255 -> 0`.

Timestamp rollover is detected and unwrapped.

### Header versus record strictness

MLV is strict about malformed header/field-definition metadata but more recoverable around individual record corruption.

A partial trailing record is not treated as complete data.

The low-level reader retries EOF a few times with short pauses, apparently supporting logs that are still growing. EpicScope static import should not copy sleep/retry behavior blindly; it should distinguish clean EOF, partial tail and explicitly growing/live sources.

### Corruption resynchronization

After corruption, MLV scans forward byte-by-byte looking for a plausible new record boundary and requires several consecutive valid CRC + sequential-counter records before accepting the new alignment.

Observed confidence is roughly three consecutive valid records.

This conservative resync rule is valuable regression-test material for EpicScope.

### Synthetic Time

MLV creates a synthetic Time field when the log lacks one. EpicScope's separate timestamp model is cleaner, but exposing a virtual built-in Time channel can still be useful to formulas and UI.

### EpicScope-specific stronger behavior

EpicScope already has more nuanced handling of EpicEFI retry runs where the same counter/timestamp may appear as bad -> bad -> valid attempts. Invalid attempts can remain visible as source evidence while being excluded from trusted samples.

That should not be simplified merely for MLV compatibility.

---

## VE Analyze

### Mature strengths

MLV VE Analyze has a sound core evidence model:

- table-aware operating-point geometry;
- spatial/bilinear contribution to neighboring VE nodes;
- qualification filters;
- lambda/AFR delay compensation;
- starting-cell prior authority;
- per-hit and cumulative evidence thresholds;
- maximum absolute/percentage correction safeguards;
- original table preserved separately from proposed results.

### Starting-cell prior

The visible Cell Change choices map to approximate starting-cell weights:

| Mode | Starting-cell weight |
|---|---:|
| Easy | 0.5 |
| Normal | 3 |
| Hard | 15 |
| Very Hard | 100 |

Conceptually:

```text
estimate =
  (startingVE * priorWeight + sum(candidateVE * evidenceWeight))
  / (priorWeight + sum(evidenceWeight))
```

This is effectively a confidence/prior model hidden behind simple tuner-facing labels.

EpicScope should preserve the concept but expose confidence/authority more explicitly.

### Evidence guards

Distinct controls/guards exist for:

- minimum individual hit weight;
- minimum cumulative evidence;
- minimum meaningful change;
- maximum absolute cell change;
- maximum percentage cell change.

These answer different questions and should not be collapsed into one sample-count threshold.

### Excessive correction behavior

When a proposed correction exceeds allowed change, MLV rejects/withholds that update path rather than silently clipping it to the limit.

This is a strong safety behavior. EpicScope should retain the raw proposal and visibly explain that it was withheld because it exceeded recommendation authority.

### Spatial geometry

VE Analyze again treats table breakpoints as nodes. Samples between axes influence neighboring nodes based on fractional position. A small epsilon-like nonzero floor is used in some exact-boundary cases; EpicScope should not copy that quirk unless tests show a need.

### Interpolated runtime VE

The correction model considers the effective/interpolated VE at the operating point rather than assuming the nearest discrete table cell is what the engine experienced. This is important because the ECU itself interpolates its calibration surface.

### Correction context

Observed correction logic considers more than raw mixture error, including current/effective VE, EGO correction, measured mixture, target mixture and delay alignment.

EpicScope should preserve the distinction between base VE error and correction layers such as STFT/EGO/total correction.

### Lambda delay limitation

MLV supports fixed delay/record offset and a Lambda Delay Table, but the user is expected to determine good values manually from logs/live data.

This is a major usability and analysis weakness because a mathematically correct VE correction can still be spatially wrong if the mixture observation is paired with the wrong earlier engine state.

EpicScope should improve this by providing explicit on-demand delay discovery from the loaded log, while still allowing user edits and manual models.

### Qualification burden

MLV exposes many built-in filters and custom expressions, but users still carry significant responsibility for excluding inappropriate states such as DFCO, AE/decel transients, warm-up/cold operation and unstable regions.

EpicScope should provide semantic presets for common qualification and reserve custom formulas for niche cases.

### Confidence presentation

MLV internally uses sophisticated confidence-like controls but presents much of the result as a final changed cell. It does not expose enough of the reason chain behind each recommendation.

EpicScope should show, per cell where possible:

- contributing samples;
- cumulative spatial weight;
- error spread;
- qualification/exclusion counts;
- delay model/value and confidence;
- raw proposal;
- prior-adjusted proposal;
- correction-authority outcome;
- source evidence navigation.

---

## Consolidated EpicScope conclusions

Behaviors worth preserving or adapting:

- bilinear node-based table weighting;
- explicit edge clamping and edge regression tests;
- separate individual and cumulative evidence thresholds;
- persistent saved-analysis setups with backward-compatible defaults;
- calculated-field dependency chaining and intentional self-history;
- viewport aggregation as an option for very large Scatter views;
- independent compare datasets with shared navigation state;
- conservative corruption resynchronization;
- VE starting-cell prior/confidence authority;
- rejection rather than silent clamping of out-of-authority tune proposals.

Behaviors EpicScope should deliberately improve:

- retain exact source-sample provenance;
- surface filter/qualification errors rather than silently disabling them;
- conventional expression precedence;
- explicit invalid historical state instead of implicit zero bootstrap;
- timestamp-based comparison/delay rather than sample-count offsets;
- semantic built-in qualification presets;
- automatic, user-triggered lambda-delay discovery;
- explicit confidence and exclusion reasoning;
- clear Measured / Interpolated / Insufficient-evidence distinctions.

## Research status

Broad MLV investigation is complete enough for product development. Additional reverse engineering should only be performed when a concrete EpicScope behavior or compatibility question requires it.
