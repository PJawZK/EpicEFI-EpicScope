# VE Analyzer specification

## Purpose

VE Analyzer turns recorded fueling evidence into a reviewable VE-table recommendation without silently treating every mixture deviation as a VE error.

The feature is deliberately **evidence-first**. Analysis output is a proposal, not tune state. The analyzer must preserve source provenance, expose why samples were accepted/rejected, separate measured evidence from interpolation, and keep user authority explicit.

Research inputs for this specification include mature behavior observed in MegaLogViewer HD VE Analyze and ECUMaster EMU PRO VE Tuner. Those products are behavioral references, not implementation authorities. EpicScope should preserve useful mature safeguards while using its existing qualification, source-evidence, timestamp and semantic-channel architecture.

Detailed supporting research is preserved in:

- `research/MLV_BEHAVIORAL_RESEARCH.md`;
- `research/VE_AUTOTUNE_REFERENCE_RESEARCH.md`;
- `research/MLG_V3_RESEARCH.md` for the related MLG compatibility side-track.

## Product workflow

Visible workflow:

```text
Load Data
  -> choose VE table / axes
  -> choose scope
  -> Qualification
  -> Lambda Delay
  -> Analyze
  -> inspect evidence/confidence
  -> review proposed VE
  -> compare/export/apply explicitly
```

Opening EpicScope, loading a log, or opening VE Analyzer must not automatically launch expensive lambda-delay discovery.

## Required inputs

The analyzer should resolve semantic roles rather than hard-code one ECU's raw names.

Primary calculation roles:

- RPM;
- VE-table load axis;
- actual mixture, preferring lambda;
- target mixture on the same scale;
- current/effective VE at the operating point where available;
- editable VE table and its RPM/load breakpoints.

Important qualification/context roles where available:

- DFCO state;
- fuel-cut reason;
- AE state;
- decel enrichment/enleanment state;
- coolant temperature;
- warm-up enrichment / coolant fuel correction;
- TPS;
- fuel command / final injector pulse width;
- total fuel correction;
- STFT/EGO correction;
- LTFT correction;
- injector duty/headroom;
- fuel pressure / rail differential;
- sync/engine-running validity;
- limiter/protection state;
- lambda validity/heater/fault state.

Missing optional roles must degrade visibly. A preset must not silently pretend an unresolved exclusion is active.

## Scope

VE Analyzer uses the shared scope model:

- Full Log;
- current A/B range;
- Saved Range.

All recommendations, delay discovery and evidence counts are tied to the selected scope.

## Qualification architecture

Basic functionality must not require users to write formulas.

VE Analyzer uses reusable semantic qualification modules. Built-in presets compose those modules, while custom formulas remain available for niche or ECU-specific conditions.

### Recommended VE Analysis preset

Default intent: steady-state base-fueling evidence from a fully warmed, normally operating engine.

When the required semantic signals exist, the preset should exclude:

- DFCO;
- other fuel cuts;
- AE-active samples;
- decel enrichment/enleanment-active samples;
- cold engine operation;
- active warm-up enrichment/coolant correction outside neutral bounds;
- strong RPM transients;
- strong load transients;
- strong TPS transients where available;
- lambda invalid/not-ready/faulted state;
- limiter/protection events;
- sync-loss/not-running regions;
- injector/fuel-pressure limitation when sufficient evidence exists to identify it safely.

It should require a configurable settling/recovery window after a transient before samples become eligible again.

### Other predefined modes

Initial useful modes:

- Recommended VE Analysis;
- Steady-state only;
- Warm engine only;
- Cruise / light load;
- Boost / high load;
- Custom.

Presets are editable compositions, not opaque hard-coded modes.

### Two layers of qualification

The UI separates:

1. **State exclusions** — e.g. DFCO, fuel cut, AE, cold/warm-up, limiter/protection, invalid lambda.
2. **Stability requirements** — e.g. RPM/load/TPS stability and recovery/settling time.

This avoids conflating "not in a forbidden state" with "stable enough to use for VE correction."

### Custom conditions

Advanced users can add custom formulas on top of a preset or switch to full Custom mode.

The UI should always expose the resolved logic and unresolved semantic roles.

Example:

```text
Recommended VE Analysis

Resolved:
✓ Fuel cut == inactive
✓ TPS AE == inactive
✓ TPS Decel == inactive
✓ Coolant >= 70 C
✓ |RPM trend| <= configured limit
✓ |Load trend| <= configured limit
✓ settled >= configured recovery

Unavailable:
! Lambda heater state not exposed by this ECU

Custom additions:
[ expression ]
```

## Stability and recovery

Reuse the Fueling Analyzer's mature trailing-window approach rather than brittle adjacent-sample derivatives.

A sample becomes VE-eligible only when:

- the required trailing window is contiguous and valid;
- RPM trend remains inside the configured limit;
- load trend remains inside the configured limit;
- optional TPS trend remains inside the configured limit;
- broader span guards do not show oscillation hidden by a near-zero net trend;
- the configured post-transient recovery interval has elapsed.

A transient restarts eligibility recovery; it must not merely reject one isolated record and immediately resume tuning evidence.

## Lambda delay model

Lambda delay is expressed in **time**, not record count.

Supported working models:

- single delay value;
- RPM -> delay curve;
- RPM × load delay table.

The **table is the primary/full model**. Curve and single-value modes are supported because they are useful for simpler setups and compatibility workflows.

### On-demand discovery only

Lambda-delay discovery must not run:

- at application startup;
- when a log is loaded;
- when VE Analyzer is opened.

The Lambda Delay section is collapsed by default. Opening it may initialize lightweight UI/state only. The expensive discovery scan runs only when the user presses:

**Grab lambda delays from log**

### Lambda Delay Discovery preset

Delay discovery has a separate preset from VE correction because it intentionally needs controlled fuel-command changes rather than steady-state samples.

Candidate events should require:

- a meaningful final fuel-command / injector-PW change;
- valid actual-mixture evidence;
- sufficient spacing from prior events;
- no hard fuel cut;
- no ambiguous overlapping strong command change before mixture response;
- contiguous source samples;
- valid RPM/load context.

AE/decel transitions may be usable delay evidence when their command effect is explicit and isolated. They should remain visible as context instead of being blindly discarded.

### Discovery output

The discovery operation should estimate observed mixture-response delay, not claim pure sensor delay. The measured interval may contain combustion-cycle, exhaust transport, turbo/manifold volume, sensor/controller, filtering and logging latency.

For each usable event retain at least:

- command sample/time;
- first-response sample/time;
- command delta;
- baseline mixture;
- first-response mixture;
- onset delay;
- peak response and delay;
- T50/T90 where useful;
- RPM/load context;
- transient context;
- source sample indices.

Aggregate evidence into the selected working model:

- single value: robust central estimate with spread;
- curve: RPM-binned robust estimates;
- table: RPM × load robust estimates.

### Recommendation versus working values

Never overwrite user-adjusted delay values invisibly.

Keep separate state for:

- recommendation from log;
- working value/model used by VE Analyzer;
- difference between them.

Example:

```text
2500 rpm / 100 kPa
Recommended: 195 ms
Working:     220 ms
Difference:  +25 ms
Events:      18
Spread:      24 ms
Confidence:  Strong
```

Actions:

- Grab lambda delays from log;
- Reset working values to recommendation;
- Clear recommendation.

### Measured, interpolated and unsupported cells

For delay curves/tables, distinguish:

- **Measured** — direct usable event evidence;
- **Interpolated** — derived from neighboring measured regions;
- **Insufficient evidence** — no trustworthy estimate.

Interpolation must never be visually indistinguishable from direct measurement.

### Caching

Delay-discovery results should be cached by an identity containing at least:

- log/source identity;
- selected scope;
- selected command/mixture/RPM/load channel identities;
- discovery thresholds/settings;
- relevant qualification configuration.

Changing any of these marks the recommendation **stale**. Do not automatically trigger another expensive scan; offer the button again.

## Delay application

VE correction aligns mixture evidence against the earlier engine/fuel state most plausibly responsible for it by timestamp.

Do not shift by integer record count. Use time-based interpolation against source timestamps so behavior is independent of logger rate.

The UI must expose:

- delay model used;
- whether each region is measured/interpolated/manual;
- confidence/evidence behind the model;
- uncompensated evidence alongside compensated evidence where practical.

Weak or missing delay evidence must not silently enable compensation.

## VE evidence calculation

### Operating-point geometry

VE-table breakpoints are nodes, not rectangular buckets.

A qualifying operating point contributes spatially to the surrounding VE nodes using bilinear breakpoint relevance. Outside the outer axes, behavior must be explicitly defined and tested; silent extrapolation is not allowed.

The runtime/effective VE at the exact operating point should be used where available. If it must be reconstructed from the tune table, use the same explicit interpolation model.

### Mixture correction evidence

Base correction evidence starts from target-vs-actual mixture on a compatible scale.

For lambda, conceptually:

```text
fuel ratio correction ~= actual lambda / target lambda
```

The final estimator must also account for known correction layers where sufficient semantic information exists. STFT/EGO/total correction are explanatory and potentially compensable inputs; they must not be ignored or blindly attributed to base VE.

The analyzer must avoid claiming that mixture error proves VE is the cause. Injector characterization, fuel pressure, stoichiometric setup, transient models and other corrections can produce similar evidence.

### Per-node evidence accumulator

Each VE node should retain, at minimum:

- contributing sample count;
- cumulative spatial weight;
- accepted source sample indices;
- robust central correction estimate;
- correction spread;
- mixture-error central estimate/spread;
- RPM/load context summary;
- exclusion/qualification provenance;
- delay model/value used;
- confidence grade.

A single `minimum samples` threshold is insufficient. Recommendation authority should consider both sample count and weighted evidence.

## Confidence and prior authority

Adopt the useful mature concept behind MLV's starting-cell weight, but make it explicit.

The current tune value acts as a **prior**. New log evidence must overcome that prior before moving the proposed VE cell substantially.

Conceptually:

```text
proposal =
  (currentVE * priorWeight + sum(candidateVE * evidenceWeight))
  / (priorWeight + sum(evidenceWeight))
```

Exact implementation may evolve, but the behavioral contract is:

- weak evidence moves the tune little or not at all;
- strong repeated evidence gains authority;
- prior authority is configurable and visible;
- evidence confidence and user apply strength are separate concepts.

Possible user-facing prior labels may be descriptive rather than MLV's Easy/Normal/Hard names.

## Correction limits

Support independent safeguards such as:

- minimum individual contribution weight;
- minimum cumulative evidence;
- minimum meaningful proposed change;
- maximum absolute VE change;
- maximum percentage VE change.

When a raw proposal exceeds authority/safety limits, **withhold/reject the recommendation rather than silently clamp it**.

Example:

```text
Current VE:       60
Raw proposal:     78 (+30%)
Allowed change:   ±10%
Result:           withheld — exceeds recommendation authority
```

This preserves the fact that the evidence is outside the trusted correction envelope.

## Result states

Each VE-table cell must visibly distinguish:

- Measured recommendation;
- Interpolated suggestion;
- Weak evidence / observational only;
- Recommendation withheld by limit;
- No usable evidence.

Do not fill unvisited cells in a way that looks measured.

## Result views

Useful switchable views should include at least:

- Proposed VE;
- VE change / percent change;
- mixture error;
- contributing samples;
- cumulative weighted evidence;
- confidence;
- delay used;
- excluded/qualification context summary.

Every cell should offer evidence navigation into Logger or an evidence panel.

## Evidence grades

Initial descriptive grades may reuse the established Weak / Moderate / Strong language, but VE recommendation confidence should incorporate more than count alone.

Relevant dimensions include:

- cumulative spatial weight;
- number of independent/repeated observations;
- error spread;
- stable fraction;
- delay confidence;
- correction-layer ambiguity;
- proximity to injector/fuel-pressure limitations.

A confidence grade is explanatory, not proof of causation.

## User application authority

Keep **what the evidence recommends** separate from **how aggressively the user chooses to apply it**.

The analyzer first computes a proposal using its evidence/prior model. The review layer may then offer application authority such as:

- 25%;
- 50%;
- 75%;
- 100%;
- custom.

This application factor does not change the evidence result itself.

## Original tune preservation

The starting VE table is immutable analysis input.

Maintain separately:

- original/current tune table;
- analysis proposal;
- user-reviewed/application result.

Never mutate tune state merely by running Analyze.

Any eventual write/apply operation must be explicit and must present a diff against the current tune first.

## Edge and regression requirements

Explicit automated tests are required for:

- exact RPM breakpoint;
- exact load breakpoint;
- four-node center contribution;
- first/last RPM row;
- first/last load column;
- all four table corners;
- operating points outside the configured table axes;
- equality at contribution/evidence thresholds;
- sparse evidence;
- invalid/NaN mixture data;
- scope/source-index discontinuities;
- variable sample rate;
- delay interpolation by timestamp;
- stale delay recommendation detection;
- overlapping fuel-command events;
- DFCO/fuel-cut exclusion;
- AE/decel state behavior;
- cold/warm-up exclusion;
- correction-layer presence/absence;
- recommendation over absolute/percentage authority limit;
- user-edited delay values surviving re-render/reopen;
- measured versus interpolated delay-table cells.

## Performance requirements

No VE-specific full-log work should occur during ordinary application/log load.

VE correction runs only when explicitly requested by the user.

Lambda-delay discovery runs only from **Grab lambda delays from log**.

Reuse cached aligned ranges/qualification artifacts where safe, and cache delay-discovery output by analysis identity.

Changing settings invalidates the relevant result but should not automatically recompute expensive analysis.

## Architecture direction

VE Analyzer should reuse rather than duplicate:

- `core/analysis/afr-delay-analyzer.ts` for observed mixture-response event timing, extended for curve/table aggregation;
- Fueling context/state qualification;
- Fueling trailing-window stability logic;
- shared scope selection;
- weighted breakpoint/table geometry used by Histogram/Table Generator;
- shared Logger evidence navigation;
- semantic channel-role resolution;
- loaded MSQ/tune-table representation.

New VE-specific layers should focus on:

- qualification preset composition;
- delay model recommendation/working-state management;
- delay-compensated sample alignment;
- VE-node evidence accumulation;
- prior/confidence/authority model;
- review/proposal state.

## Non-goals for the first implementation

Do not initially require:

- fully automatic tune writes;
- 4D/switched-table editing;
- live closed-loop autotune;
- automatic filling of wholly unvisited table areas;
- causal claims that VE is definitely responsible for a mixture error.

The internal evidence model should nevertheless avoid assumptions that make later switched/4D/context-aware calibration impossible.

## Initial implementation sequence

A low-risk sequence is:

1. VE Analyzer shell using shared scope/channel-role patterns;
2. built-in Recommended VE Analysis qualification preset and visible exclusion counts;
3. table-aware RPM/load alignment and evidence-only operating map;
4. Lambda Delay section with single/curve/table working models;
5. explicit **Grab lambda delays from log** using existing delay-event analysis;
6. curve/table aggregation, confidence, stale-state and caching;
7. timestamp-based delay-compensated mixture alignment;
8. spatial VE-node weighted evidence;
9. prior/authority model and correction-limit rejection;
10. result views and evidence-to-Logger navigation;
11. review/application percentage layer and export/diff;
12. only after validation, consider tune-write integration.

## Product invariant

The core promise is:

> EpicScope may recommend a VE change only when it can show what log evidence produced it, what operating-state rules qualified that evidence, what lambda-delay model aligned it, how strong/confident the evidence is, and why the requested change is inside or outside the configured authority.
