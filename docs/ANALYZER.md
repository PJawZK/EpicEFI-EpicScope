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

Current scope choices:

- Full Log
- Current A/B
- Saved Range

Required semantic roles must not silently fall back to the first available channel. Role matching should prefer canonical runtime identifiers where known, then fall back to increasingly fuzzy name/display matching.

Detected event rows preserve a route back to Logger source evidence. Normal row selection remains in Analyzer; double-click or Enter opens the event window in Logger where implemented.

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

## Boost analyzer direction

Current Boost already has useful aggregate/spool/steady-state foundations. The intended mature workflow is:

- measured vs target pressure curves;
- RPM/TPS context;
- upper/lower wastegate duty where available;
- spool 10/50/90% attainment;
- overshoot/undershoot and settling;
- duty saturation/headroom;
- duty-change → boost response;
- upper-vs-lower chamber contribution;
- steady-state error by RPM/load band;
- repeated-pull comparison;
- direct event/source navigation.

Support remains capability-driven: single/dual solenoid, upper/lower chamber, open/closed loop are not hard-coded to one vehicle setup.

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

## Range Compare direction

Range Compare should become the general before/after experiment tool:

- compare Current A/B or two saved ranges/event sets;
- overlay distributions/traces;
- median/percentiles/time-in-band;
- optional qualification filters;
- highlight the samples/events responsible for the largest differences;
- direct navigation to Logger evidence.

## Shared next implementation layer

Before independently expanding every specialized analyzer, build common infrastructure for:

1. **Comparison** — two ranges/event cohorts in one analyzer.
2. **Qualification** — reusable RPM/MAP/TPS/CLT/state/range filters and stable-state qualification where appropriate.
3. **Evidence/quality** — sample/event coverage, qualifying percentage, number of independent events, variability/confidence/repeatability warnings.
4. **Derived analysis signals** — e.g. AFR error, rail differential, PID total, MAP prediction error and boost error without requiring every value to be logged explicitly.
5. **Presets** — persist role mappings, thresholds and qualification settings by relevant source/INI signature.
6. **Tune/MSQ context** — calibration curves/tables where the tuning question requires calibration data, including the real Idle DC Bias curve.

## Analyzer invariant

> **An analyzer should not merely report channel averages. It should find the relevant operating events/conditions, show the evidence that produced the result, quantify repeatability/error, and let the user move directly between the analysis and the original log.**
