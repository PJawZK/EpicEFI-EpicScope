# Analyzer

EpicScope Analyzer answers specific tuning questions from log evidence. Logger remains the raw-trace/navigation authority; Histogram/Table Generator/Distribution/Scatter remain the generic statistical/relationship tools.

An analyzer should identify relevant events/conditions, quantify the result, show the evidence, explain what can and cannot be concluded, and preserve a route back to the original log.

For present-tense continuation state, `docs/HANDOFF.md` remains authoritative.

## Current surfaces

- Range Compare
- Tune Table
- Boost · Experimental
- Idle · Experimental
- AE / MAP Predict · Experimental
- Fueling · Experimental
- Ignition · Experimental
- Fuel / Injector · Experimental
- Trigger / Sync · Experimental

The Analyzer selector is a compact dropdown in the global analysis header.

## Current development position

Analyzer feature expansion is deliberately paused as of 2026-10-13.

Fueling and non-knock Ignition have reached useful maturity checkpoints. The intended next Analyzer phase is not to keep deepening those same two surfaces indefinitely; when Analyzer work resumes, bring the less-mature analyzers toward similar practical coverage first, then begin a deliberate cleanup/consolidation/optimization pass across the shared implementation.

Unless a concrete defect appears, treat Fueling and Ignition as frozen for now.

## Shared workflow foundation

Specialized analyzers resolve semantic channel roles from the loaded INI/log where possible while keeping mappings visible and manually overridable.

Current shared scope choices:

- **Full Log**
- **Current A/B**
- **Saved Range**

Required semantic roles must not silently fall back to the first available channel. Role matching should prefer canonical runtime identifiers where known, then fall back to increasingly fuzzy name/display matching.

Shared Analyzer infrastructure includes:

- contextual Logger → Analyzer handoff for Current A/B;
- Analyzer → Logger source/event navigation;
- shared saved Qualification filter storage where appropriate;
- grouped ALL/ANY Qualification semantics;
- qualification provenance;
- shared numeric range/cohort comparison;
- reusable event-aligned evidence rendering;
- progressive disclosure of decision-facing vs secondary diagnostics;
- sortable evidence tables where useful;
- one standardized anchored round-`i` information/help component.

Do not build analyzer-local replacements for shared concepts unless the domain genuinely requires different semantics.

## Presentation rules

Analyzer work in October 2026 established several UI rules that should remain consistent.

### Progressive disclosure

Calculate the evidence needed for correctness, but do not show every available metric at once.

Default presentation should usually expose a small number of decision-facing results. Secondary provenance, distributions, raw diagnostic counts and supporting metrics belong behind **More details**, expandable sections, optional columns or evidence drill-down.

### Information buttons

Use the standardized small round `i` button with an anchored popup near the invoking control/result.

Do not send the user to a shared help bar or a distant fixed explanation area. Help closes by the standard popup interaction and should only be added where calculation, qualification or interpretation is not immediately obvious.

### Event evidence graphs

Aligned-event canvases must render at their actual displayed dimensions. Do not render hidden canvases at a fallback size and then allow CSS to stretch the bitmap.

Default aggregate evidence should be restrained. Avoid enabling every trace plus every percentile envelope simultaneously. Decision-facing signals should be on by default; context signals/envelopes may be enabled deliberately.

### Large-log event presentation

Analysis should use all relevant data. Browser rendering may be bounded.

Do not confuse a display cap with an analysis cap. Event tables may use pagination, and aggregate graph evidence may use representative sampling across the whole scope, but statistics/detection should remain full-scope unless explicitly documented otherwise.

## Inline help convention

For non-obvious controls, thresholds, statistics and interpretations, inline help should explain:

1. what the setting/result is;
2. what changing it changes;
3. what result the user should expect;
4. how to interpret it for tuning;
5. important limitations / what cannot be concluded.

Avoid redundant help on self-explanatory controls.

## Event-aligned evidence

Idle, AE / MAP Predict, Ignition and other event-oriented analyzers reuse the shared event-evidence model.

Each detected event is aligned to `t=0` at event onset. Aggregate evidence can show median response and optional 10–90% envelopes. Selecting one event shows that event alone. **All events** returns to aggregate evidence. Event rows preserve Logger navigation.

Different channels may be independently normalized/scaled for timing/shape inspection. Numeric values remain available in summary/event evidence. Do not misrepresent independently scaled traces as sharing one physical Y axis.

## Idle analyzer

Idle remains subsystem-aware.

Current systems:

- Combined
- DC Idle
- IAC Valve
- ETB
- Ignition

Common required roles:

- RPM
- Idle Target

Canonical EpicEFI `RPMValue` remains preferred for RPM.

The **DC Bias calibration curve/table is tune calibration data**, not a scalar runtime channel. A distinct logged runtime DC Bias contribution/output may be analyzed as runtime evidence. Future curve/current-operating-point analysis should come from MSQ/tune context.

Current maturity includes target tracking, sag/recovery evidence, subsystem-specific controller/actuator context and shared help. Later work may add richer idle phases, settling/oscillation/headroom and real tune-curve context.

## AE / MAP Predict analyzer

Current aligned evidence can include TPS, measured MAP, predicted MAP and mixture evidence.

Current metrics include prediction mean/error/MAE and lean/rich excursion context.

Actual-mixture role matching prefers Lambda before AFR for the same fuel-independent reason as Fueling.

Later maturity may add richer event classes, integrated/timing error metrics and comparison between event sets.

## Boost analyzer — current model

Boost remains capability-driven and control-mode aware.

Open Loop asks:

> **RPM / TPS-load / operating state → wastegate command → measured pressure response**

Closed Loop adds:

> **Boost Target → pressure tracking / error / attainment / over/undershoot / settling**

Implemented maturity includes:

- explicit Open Loop / Closed Loop mode;
- target-independent Open Loop measured-pressure-rise T10/T50/T90;
- peak pressure with RPM/load/duty context;
- qualified RPM × TPS/load operating points;
- sample/evidence strength and pressure consistency;
- neighbor trends;
- matched Primary/Compare scopes;
- upper/lower chamber response summaries;
- conservative evidence interpretation;
- sortable result/evidence tables;
- inline help and Logger traceability.

### Critical Boost invariant

> **Boost Analyzer does not assume wastegate plumbing/polarity.**

An observed positive/negative duty-to-pressure association is evidence, not an instruction to increase/decrease duty.

Repeated-pull/repeatability maturity remains viable later, but Boost is not the active development surface now.

## Fueling analyzer — current maturity checkpoint

Fueling is no longer merely a future direction. It is a substantially matured experimental analyzer and should remain frozen unless a concrete defect/regression appears.

Detailed semantics are authoritative in `docs/FUELING_ANALYZER.md`.

### Canonical EpicEFI/JZ roles

Preferred roles include:

- actual mixture: `lambdaValue`;
- target mixture: `targetLambda`;
- current effective VE: `veValue`;
- fuel command for response timing: `actualLastInjection`;
- RPM: `RPMValue`;
- VE/load coordinate: `veTableYAxis`;
- DFCO: `dfcoActive`;
- other fuel-cut reason: `fuelCutReason`;
- AE/decel state where available;
- total/STFT/LTFT correction context where available.

Lambda is canonical because it is fuel-independent. If Lambda is unavailable, Gas Scale AFR is preferred before generic AFR. Actual and target scales must remain compatible.

`Fuel: VE` is the live effective VE used at the current operating point. It is not the editable VE table and should not be confused with `Fuel: Tuned VE`.

### State qualification

Fueling explicitly separates intentional state effects from ordinary steady calibration evidence:

- DFCO is explanatory intentional fuel-off state, not a VE error;
- nonzero hard fuel-cut reasons are excluded from ordinary steady/delay conclusions;
- TPS AE/decel are excluded from steady calibration evidence but may remain useful transient context;
- invalid/unavailable selected state context is handled conservatively.

### Stable operating evidence

The original adjacent-sample derivative gate was replaced with a trailing-window stability model because high-rate logger jitter made steady-state evidence artificially sparse.

Low-count bins remain visible. The minimum samples value is now an evidence threshold with **Weak / Moderate / Strong** strength rather than a visibility cutoff.

### Observed mixture response delay

Fueling can estimate observed mixture response delay from isolated injector-pulse changes using `actualLastInjection` by default.

The result is deliberately described as observed mixture response delay rather than pure wideband-sensor delay because it can include combustion, exhaust transport, turbo/manifold volume, sensor/controller response, filtering and logging latency.

### Correction context

STFT/LTFT/total correction can explain when apparent target tracking may be correction-assisted. The analyzer must not automatically claim VE is the cause because injector characterization, stoich setup, pressure delivery, transient models and other layers can also contribute.

### Fueling visualization rollback

A compact RPM×load heatmap experiment was implemented and then fully rolled back after it caused page-load and graph-stretch regressions. The rollback restored the stable pre-heatmap behavior.

Do not reintroduce a DOM-heavy overview/heatmap integration without a safer architecture and measured large-log validation.

## Ignition analyzer — current non-knock maturity checkpoint

Ignition is deliberately **non-knock-focused** in the current validation scope.

Trusted knock hardware/evidence is not currently available for product validation, so the analyzer must not pretend to diagnose knock, detonation or timing safety.

### Preferred EpicEFI roles

Current automatic preferences prioritize canonical runtime semantics:

- final timing: `correctedIgnitionAdvance`;
- aggregate correction context: `ignitionAdvanceCorrections`, then `ignitionCorrections`;
- dwell: `sparkDwell`;
- RPM: `RPMValue`;
- ignition-table load: `loadForIgnitionTableDot`, then `ignitionLoad`, before generic MAP fallbacks.

Knock-named correction channels are not preferred as the automatic generic correction role.

### Current visible questions

Ignition currently focuses on:

- advance behavior;
- timing-step stability/discontinuities;
- aggregate correction activity;
- dwell context;
- RPM/load context;
- repeated stable operating regions worth inspection.

It does **not** answer:

- whether timing is safe/unsafe;
- whether detonation occurred;
- whether the user should add/remove a specific number of degrees.

### Large-log-safe events

The original implementation exposed a stack-overflow hazard by spreading hundreds of thousands of timing-step values into `Math.max`. Large-log statistics now avoid large argument spreading.

Full-scope event detection/statistics remain available while presentation is bounded:

- aggregate evidence uses a representative workload budget across the whole scope;
- the event table uses pagination rather than silently truncating after the first rows;
- individual events remain inspectable and Logger-navigable.

### Clean aggregate graph default

Ignition aggregate evidence defaults to decision-facing traces rather than every trace/envelope.

Ignition advance and correction context are the primary visible traces. Dwell, RPM, load and percentile envelopes are opt-in from the legend.

The shared canvas renderer now waits for measurable layout size and redraws on resize, which also fixes the same hidden-canvas stretching class for other aligned-evidence analyzers.

### Areas to review

Ignition groups stable-context evidence into RPM×load regions and surfaces a short ranked **Areas to review** list instead of a dense full matrix.

Potential review findings include:

- repeated timing steps under relatively stable RPM/load;
- timing variability on repeated visits;
- repeated correction activity;
- persistent adjacent-region timing differences.

Only supported/repeated regions should enter the shortlist. Single isolated events remain in the ordinary event table.

The shortlist defaults to a configurable **Review focus minimum RPM = 1000 rpm** so cranking/start/very-low-RPM regions do not displace normal-running areas. This affects prioritization only; low-RPM evidence remains in the underlying analysis/event data. Setting the threshold to `0` restores all-RPM ranking.

### Base ignition table attribution

With MSQ/tune context loaded, Ignition can compare final logged timing against the interpolated base ignition table using explicit table/RPM-axis/load-axis mapping.

For EpicEFI the main ignition table uses RPM and ignition-load coordinates; `loadForIgnitionTableDot` / `ignitionLoad` are therefore preferred ahead of generic MAP for this purpose.

Each surfaced review area can expose a **Source clue** based on auditable evidence, for example:

- base table follows representative timing steps closely enough;
- base table contains a similar adjacent transition;
- only some steps are explained and residual movement remains;
- correction activity overlaps the representative visit;
- correction activity exists elsewhere in the region but not at the representative visit;
- the base table leaves substantial residual spread;
- no strong base-table/correction clue is available.

A step counts as base-table-aligned only when the base table moves in the same direction and accounts for enough of the movement that the remaining observed-minus-base step falls below the same visible timing-step threshold.

The Source clue is observational attribution, not proof of engine preference. It points the user toward the likely tuning layer to inspect next.

## Fuel / Injector analyzer direction

This analyzer exists but has not yet received the same maturity depth as Fueling/Ignition.

Useful focus when resumed:

- differential rail pressure vs MAP;
- pressure regulation error/sag/recovery;
- pump recovery/prime behavior where logged;
- injector PW/duty saturation/headroom;
- voltage/deadtime evidence;
- deadtime calibration comparison;
- direct evidence navigation.

## Trigger / Sync analyzer direction

This analyzer also exists but remains thinner.

Useful focus when resumed:

- sync state / trigger error / loss counter/reason;
- RPM/voltage/load at events;
- pre/post evidence;
- frequency by RPM band;
- distinguish one-sample glitches from real loss;
- direct Logger navigation.

## Range Compare — current state

Range Compare is the general before/after experiment tool.

Current capabilities include:

- Full Log / Current A/B / Saved Range independently on each side;
- shared saved Qualification filters;
- grouped ALL/ANY semantics;
- provenance per side;
- Count / Mean / Min / Max / Std Dev;
- P10 / Median / P90;
- contextual Logger A/B → Range Compare handoff.

Future work should extend the common comparison model rather than fork analyzer-local equivalents.

## Cleanup/consolidation policy

Do not start a broad Analyzer refactor merely because duplicate or awkward implementation details are now visible.

Current project-owner direction is:

1. reach useful coverage across the analyzer family;
2. stop mature analyzers at sensible checkpoints;
3. then run a dedicated cleanup/consolidation/optimization phase.

That later phase should review:

- duplicated DOM enhancement logic;
- unnecessary MutationObservers;
- direct DOM state bridges/lookups;
- Boost-specific utilities that became generic;
- duplicated table/event/help/rendering code;
- canvas resize ownership;
- CSS/runtime UI surgery;
- dead/unreachable branches and compatibility leftovers;
- representative large-log performance after consolidation.

Until then, preserve working behavior over internal tidiness.

## Analyzer invariant

> **An analyzer should not merely report channel averages. It should find the relevant operating events/conditions, show the evidence that produced the result, quantify repeatability/error, explain the likely tuning layer when evidence supports it, and let the user move directly between the analysis and the original log without overstating causation.**