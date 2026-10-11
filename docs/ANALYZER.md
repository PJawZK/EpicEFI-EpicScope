# Analyzer

EpicScope Analyzer answers specific tuning questions from log evidence. Logger remains the raw-trace/navigation authority; Histogram/Distribution/Scatter/Table Generator remain general statistical/relationship tools. Analyzer should identify relevant events/conditions, quantify the result, show the evidence, and preserve a route back to the original log.

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

The Analyzer selector is a compact dropdown in the global analysis header rather than a permanent row of mode buttons.

## Shared workflow foundation

Specialized analyzers resolve semantic channel roles from the loaded INI/log where possible while keeping every mapping visible and manually overridable.

Current shared scope choices:

- Full Log
- Current A/B
- Saved Range

Required semantic roles must not silently fall back to the first available channel. Role matching should prefer canonical runtime identifiers where known, then fall back to increasingly fuzzy name/display matching.

Shared Analyzer infrastructure now includes:

- contextual Logger → Analyzer handoff for Current A/B;
- Analyzer → Logger source/event navigation;
- shared saved qualification filter storage;
- grouped ALL/ANY qualification semantics;
- qualification provenance: Input / Eligible / Rejected / Invalid / Unavailable;
- shared numeric range/cohort comparison;
- P10 / Median / P90 comparison metrics;
- reusable inline `i` help.

Do not build analyzer-local replacements for those concepts.

## Inline help convention

The earlier Idle-only help implementation is now shared EpicScope infrastructure.

For non-obvious controls, thresholds, statistics and interpretations, inline help should explain:

1. what the setting/result is;
2. what changing it changes;
3. what result the user should expect;
4. how to interpret it for tuning;
5. important limitations / what cannot be concluded.

Avoid redundant help on self-explanatory controls.

## Event-aligned evidence

Idle and AE / MAP Predict currently use the shared event-evidence renderer.

Each detected event is aligned to `t=0` at event onset. Aggregate mode draws:

- median response;
- 10–90% envelope;
- all configured/available evidence signals.

Selecting one event row shows that event alone. **All events** returns to aggregate evidence. Double-click/Enter opens the event in Logger.

Current evidence graphs independently scale different signals to emphasize timing/response shape. They are not yet a common absolute-value Y-axis plot; numeric values remain available in summary/event evidence.

Future event analyzers should reuse this model rather than create incompatible one-off navigation/plot behavior.

## Idle analyzer

Idle is explicitly subsystem-aware.

### Common required roles

- RPM
- Idle Target

Canonical RPM resolution strongly prefers the EpicEFI runtime `RPMValue` channel before fuzzy RPM matches.

Idle Target is required because sag/recovery is defined relative to target.

### Idle system selector

- Combined
- DC Idle
- IAC Valve
- ETB
- Ignition

Selecting one system narrows visible role mappings to that subsystem while preserving the common engine roles. Combined is intended for interaction analysis across several helpers/controllers.

### DC Bias distinction

The **DC Bias calibration curve/table is tune calibration data**, not a scalar runtime channel.

Analyzer may expose **DC Bias output (runtime)** only when a distinct logged contribution/output channel exists. Curve/table/axis-like names must not be auto-selected as if they were runtime scalar data.

Future calibration-aware Idle analysis should obtain the actual bias curve from tune/MSQ context, show its current operating point/interpolated value, and correlate that with runtime control output. Do not fake the curve through one logged number.

### Analyze semantics

Idle Analyze currently uses:

- **Sag threshold RPM** — sag begins when actual RPM is at least this far below Idle Target;
- **Settled band RPM** — recovery ends when actual RPM returns inside this ±RPM band around target.

The UI must explain those semantics beside the controls.

Current summary/evidence includes, where available:

- target tracking;
- sag depth;
- worst sag;
- recovery duration;
- median recovery;
- IAC/valve command;
- DC Idle feed-forward/P/I/D/runtime bias output;
- ETB idle contribution/position evidence;
- ignition/idle-correction evidence.

The long-term goal is event-phase reasoning: entry/load application/clutch catch/sag/overshoot/recovery, controller response, headroom/saturation and oscillation/settling quality.

## AE / MAP Predict analyzer

Current aligned evidence can include:

- TPS;
- measured MAP;
- predicted MAP;
- AFR/lambda evidence.

Current richer metrics include:

- mean prediction error;
- prediction MAE;
- peak lean excursion;
- peak rich excursion.

Next maturity should add reusable operating-condition qualification and richer transient timing metrics such as peak error, integrated absolute error, error timing/time-to-peak, lean-hole/rich-spike timing, event classes by RPM/load/TPS movement, and comparison between event sets.

## Boost analyzer — current authoritative model

Boost is capability-driven and must support the control arrangement present in the data rather than hard-code one vehicle setup.

### Control strategy comes first

**Open Loop** has no meaningful Boost Target requirement. The useful relationship is:

> **RPM / TPS-load / operating state → wastegate command → measured pressure response**

**Closed Loop** keeps the physical context and adds:

> **Boost Target → pressure tracking / error / attainment / over/undershoot / settling**

Open Loop is the default Analyzer mode.

Target-dependent controls and results must be hidden/disabled in Open Loop.

### Open Loop inputs and context

Current first-class roles include:

- measured pressure;
- RPM;
- TPS/load;
- upper/main wastegate duty where available;
- lower-chamber wastegate duty where available.

TPS/load is not assumed to be percentage TPS. Bin sizes and quick-gate thresholds use the selected channel's native unit.

For current EpicEFI naming:

- `boostOutput` → **Boost: Output** — final upper/main boost-control output;
- `lwgDutyPct` → **Lower WG port output** — lower chamber output;
- `openLoopPart` → **Boost: Open loop** — open-loop contribution rather than necessarily the final output.

A selected duty channel that is zero throughout the source should produce zero duty results; verify it in Logger before treating that as Analyzer math failure.

### Open Loop pressure-rise spool

Open-loop spool is target-independent.

The user supplies:

- start pressure;
- end pressure;
- minimum duration.

T10/T50/T90 are first crossings through 10%, 50% and 90% of that configured measured-pressure rise.

Event evidence can retain:

- start/end pressure;
- RPM and TPS/load;
- upper/lower duty;
- attainment times/locations.

No Boost Target is used for this event definition.

### Peak pressure context

Measured max pressure retains the same sample's:

- RPM;
- TPS/load;
- upper duty;
- lower duty.

Do not present peak pressure as an isolated number when operating context is available.

### RPM × TPS/load operating points

Qualified Open Loop samples can be grouped into configurable RPM × TPS/load bins.

Current per-bin evidence includes:

- sample count;
- actual mean RPM;
- actual mean TPS/load;
- pressure mean / min / max / SD;
- mean upper duty;
- mean lower duty;
- evidence strength;
- pressure consistency;
- compact assessment;
- neighboring RPM trend;
- neighboring load trend;
- conservative `What this suggests` interpretation.

Evidence quality uses sample population relative to the configured minimum plus unit-independent pressure variation. Mixed/transient and limited-evidence bins are not treated as equally trustworthy tuning evidence.

Neighbor trends compare only usable bins and expose observed pressure delta plus duty deltas where available.

### Qualification and high-load quick gate

Boost can use the same saved shared qualification sets as Range Compare/Table Generator.

An optional Open Loop high-load quick gate can additionally require minimum TPS/load and minimum RPM.

Default starting values are TPS/load ≥ 80 and RPM ≥ 2000. `80` is only a sensible starting value for percentage TPS; other load channels need their native-unit threshold.

The UI exposes Saved eligible / Quick gate eligible / Final eligible separately.

### Matched scope comparison

Open Loop can optionally compare a second scope using the same shared scope choices:

- Full Log;
- Current A/B;
- Saved Range.

Both sides use the same selected channels, shared qualification, quick gate and RPM × TPS/load bin geometry.

Only bins with trustworthy evidence on both sides are matched.

Current comparison evidence includes:

- Primary/Compare sample counts;
- Primary/Compare pressure;
- Δ pressure;
- Δ upper duty;
- Δ lower duty;
- observed interpretation.

Valid descriptive interpretations include:

- observed duty + pressure response; repeat to confirm;
- duty changed with little pressure response;
- pressure changed at approximately similar duty.

If a comparison is selected but no trustworthy bins match, report that explicitly.

### Upper/lower chamber response summary

Matched comparisons are also summarized separately for upper and lower wastegate control.

A chamber is treated as isolated evidence only when:

- selected chamber duty changes by at least 0.5 duty point;
- opposite chamber remains within 0.5 duty point when available.

If the opposite chamber is unavailable, that count is reported because true chamber isolation cannot be proven.

At least two usable comparisons are required for a directional association.

Possible summaries:

- higher duty accompanied higher pressure;
- higher duty accompanied lower pressure;
- duty changed with little pressure response;
- mixed observed association;
- insufficient evidence.

### Closed Loop additions

Closed-loop-only analysis includes, where configured/available:

- measured-vs-target error;
- MAE / RMSE;
- target-attainment percentage inside a configurable pressure tolerance;
- target-relative T10/T50/T90 spool landmarks;
- overshoot / undershoot;
- steady-state / settling concepts.

The pressure tolerance stays in the selected pressure channel's native unit.

### Critical interpretation invariant

> **Boost Analyzer does not assume wastegate plumbing/polarity.**

An observed positive/negative duty-to-pressure association is evidence, not an instruction to increase/decrease duty.

Do not add automatic duty-direction recommendations without a separately designed, validated layer with explicit actuator semantics and sufficient repeatability evidence.

### Next Boost maturity step

The next meaningful feature is **automatic repeated-pull/event grouping**.

Build it from the existing qualification/high-load evidence rather than inventing another hidden Boost definition.

Expected behavior:

- detect contiguous candidate pulls with visible configurable criteria;
- retain start/end source/time context;
- let the user inspect detected pulls before comparison;
- compare only pulls with overlapping trustworthy RPM × TPS/load operating regions;
- quantify repeatability/spread and observed duty→pressure response across multiple events;
- preserve Logger navigation;
- keep conclusions polarity-agnostic.

After repeated-pull grouping is useful, revisit duty saturation/headroom and richer Closed Loop settling/controller-quality analysis.

## Fueling analyzer direction

Fueling should become stable-state correction analysis rather than global AFR means:

- actual vs target / lambda error;
- RPM × MAP/TPS cell analysis;
- stable-state qualification;
- optional exclusion of AE, DFCO, transient and closed-loop correction periods;
- trimmed/weighted statistics;
- sample count/confidence;
- error distribution;
- evidence-driven correction proposal.

Tune Table's useful tune-awareness should converge with the mature Table Generator rather than remain a competing cell-analysis system.

## Ignition analyzer direction

Move from aggregate advance/retard/knock summaries toward contextual evidence:

- RPM + load/MAP;
- commanded advance and retard response;
- knock threshold/base-noise context where logged;
- IAT/CLT context;
- per-cylinder evidence where available;
- event window before/after knock;
- RPM×load knock-density/advance views;
- direct event navigation.

## Fuel / Injector analyzer direction

Intended focus:

- differential rail pressure vs MAP rather than only absolute rail pressure;
- pressure regulation error/sag/recovery;
- pump recovery/prime behavior where logged;
- injector PW/duty saturation;
- voltage/deadtime evidence;
- deadtime calibration comparisons.

## Trigger / Sync analyzer direction

Intended focus:

- sync state / trigger error / loss counter/reason;
- RPM/voltage/load at each event;
- pre/post event evidence;
- frequency by RPM band;
- distinguish one-sample glitches from real loss;
- direct jump to occurrence in Logger.

## Range Compare — current state

Range Compare is the general before/after experiment tool.

Current capabilities include:

- Full Log / Current A/B / Saved Range independently on each side;
- shared saved qualification filters;
- grouped ALL/ANY qualification semantics;
- Input / Eligible / Rejected / Invalid / Unavailable provenance per side;
- Count / Mean / Min / Max / Std Dev;
- P10 / Median / P90;
- contextual Logger A/B → Range Compare handoff.

Future maturity can add trace/distribution overlays, event-set comparison and direct evidence for the largest differences, but should reuse the shared comparison/qualification model.

## Shared next implementation layer

Much of the earlier shared layer is now implemented. Continue extending common infrastructure where several analyzers need the same semantics:

1. **Automatic event/cohort grouping** — reusable contiguous-event evidence where appropriate.
2. **Evidence/quality** — independent event counts, coverage, variability/confidence/repeatability warnings.
3. **Derived analysis signals** — e.g. AFR error, rail differential, PID total, MAP prediction error and boost error without requiring every value to be logged explicitly.
4. **Presets** — persist role mappings, thresholds and qualification settings by relevant source/INI signature.
5. **Tune/MSQ context** — calibration curves/tables where the tuning question requires calibration data, including the real Idle DC Bias curve.

## Analyzer invariant

> **An analyzer should not merely report channel averages. It should find the relevant operating events/conditions, show the evidence that produced the result, quantify repeatability/error, and let the user move directly between the analysis and the original log.**
