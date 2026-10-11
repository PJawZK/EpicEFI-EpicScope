# Fueling Analyzer maturity

Fueling Analyzer should separate steady-state calibration evidence from transient response evidence. It must not treat every AFR deviation as a VE-table error.

## Current direction

The maturity sequence is:

1. steady-state AFR target/actual error and rich/lean bias;
2. observed AFR response-delay estimation;
3. delay-compensated AFR error;
4. transient versus steady-state separation;
5. injector PW/duty/headroom evidence;
6. fuel-pressure and rail-differential stability;
7. repeated-event / before-after consistency;
8. conservative diagnostic interpretation.

## Steady-state AFR operating map

`core/analysis/fueling-operating-map.ts` builds RPM × load operating points from aligned Actual AFR, Target AFR, RPM and load channels.

The map is deliberately stricter than simply binning every valid sample. A sample only becomes steady-state evidence after RPM and load have remained inside configured rate limits for the configured stable duration. The stable duration therefore acts as a **settling period**: samples immediately after a load/RPM transition stay rejected even when the following operating point becomes stable. Selected-source-index gaps, invalid values and unavailable channel coverage break the stable segment and remain explicit provenance.

Each trustworthy bin reports:

- sample count and RPM/load means;
- actual and target AFR means;
- AFR error mean and median;
- P10–P90 AFR error spread;
- mean absolute error and error standard deviation;
- lean, rich and within-deadband sample counts;
- a descriptive lean/rich/balanced/within-deadband bias.

AFR error uses `Actual AFR − Target AFR`, so positive values are lean and negative values are rich. The map is descriptive calibration evidence; it does not by itself prove that VE is the cause of an error.

The operating-map result also retains input, stable-eligible, transient-rejected, invalid and unavailable counts. Bins below the configured minimum sample count are omitted instead of being promoted as weak tuning evidence.

## AFR response delay

`core/analysis/afr-delay-analyzer.ts` estimates **observed AFR response delay** from isolated changes in a selected fuel-command channel. This is intentionally not labelled as a pure sensor delay because the observation can include:

- combustion-cycle delay;
- exhaust transport time;
- turbo/manifold/exhaust volume effects;
- wideband sensor and controller response;
- filtering and logging latency.

The selected command channel must have explicit semantics. The initial intended use is a command where increasing the value adds fuel (for example injector pulse width or a suitable commanded-fuel/VE signal). With the default `inverse` response polarity, a positive fuel-command change is expected to move AFR downward and a negative command change upward. Other channel semantics can use `same` or `either` polarity explicitly.

### Event qualification

A candidate event requires:

- a contiguous selected source sample transition;
- a fuel-command delta at or above the configured threshold;
- finite aligned AFR evidence;
- configured minimum spacing from the prior candidate.

While looking for an AFR response, the analyzer rejects an event when another strong fuel-command transition occurs before AFR responds. It also refuses to bridge selected-source-index gaps. These safeguards keep qualification/scope gaps and compound transients from silently becoming delay evidence.

### Reported timing

For each usable event the analyzer retains:

- source command and response sample indices/times;
- command delta;
- baseline and first-response AFR;
- onset delay;
- peak AFR response and its delay;
- T50 and T90 relative to the observed peak response;
- optional RPM and load context.

Across events it reports onset minimum, P10, median, P90 and maximum, plus median T50/T90 and a deliberately simple evidence-strength label.

The median should be presented as an estimate with its spread and usable-event count, not as a universal constant. RPM/load-dependent delay should be added only once enough repeated evidence exists to support trustworthy binning.

## Delay-compensated AFR error

A later slice may shift the causal engine/fuel state backward by the estimated delay before calculating fast-transient AFR error. That feature must always expose:

- the delay value or delay model used;
- the evidence strength behind it;
- whether a global or RPM/load-dependent delay was applied;
- uncompensated evidence alongside compensated evidence where practical.

Weak or absent delay evidence must not silently enable compensation.

## Interpretation guardrails

Fueling Analyzer may suggest evidence consistent with base-fuel calibration error, transient-fueling error, fuel-pressure limitation, injector headroom limitation, or sensor/measurement uncertainty. It must avoid claiming proven causation from observational log evidence alone.
