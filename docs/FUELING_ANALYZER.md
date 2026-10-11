# Fueling Analyzer maturity

Fueling Analyzer should separate steady-state calibration evidence from transient response evidence. It must not treat every mixture deviation as a VE-table error.

## Canonical EpicEFI / JZ channels

EpicEFI/JZ works in lambda internally, so the analyzer should prefer fuel-independent mixture channels instead of treating AFR as the canonical representation.

Preferred runtime roles are:

- actual mixture: `lambdaValue` (`Lambda`);
- target mixture: `targetLambda` (`Fuel: target lambda`);
- current VE: `veValue` (`Fuel: VE`);
- fuel command for response-delay work: `actualLastInjection` (`Fuel: Last inj pulse width`);
- engine speed: `RPMValue`;
- VE-table load axis: `veTableYAxis`;
- DFCO state: `dfcoActive`;
- other fuel-cut reason: `fuelCutReason` (`Fuel: Cut Code`);
- acceleration-enrichment state: `isAboveAccelThreshold` (`Fuel: TPS AE Active`);
- deceleration state: `isBelowDecelThreshold` (`Fuel: TPS Decel Active`);
- aggregate fuel correction: `totalFuelCorrection` (`Fuel: Total correction`);
- short-term trim context: `stftCorrection1` (`STFT: Bank 1`);
- long-term trim context: `ltftCorrection1` (`LTFT: Bank 1`).

`Fuel: VE` is the live effective VE being used at the current operating point; it is not the editable VE table itself. `Fuel: Tuned VE` is a separate tuning/learning-oriented value and must not be substituted for current VE by default.

For actual mixture fallback, `afrGasolineScale` (`Air/Fuel Ratio (Gas Scale)`) is preferred over generic `AFRValue` when lambda is unavailable. Actual and target channels must use compatible scales; Lambda must not be paired with AFR. AFR fallback remains best-effort because fuel-dependent AFR representations can differ in flex-fuel configurations.

AE / MAP Predict follows the same actual-mixture preference and therefore selects lambda before AFR when available.

## Fuel-state and transient qualification

`core/analysis/fueling-context.ts` separates intentional fuel-state effects from ordinary calibration evidence before the steady-state or response-delay analyzers run.

The rules are deliberately analysis-specific:

- **DFCO active**: excluded from steady calibration evidence and response-delay evidence. DFCO intentionally zeros injection, so the resulting lean exhaust reading is explanatory state evidence rather than a VE error.
- **nonzero fuel-cut reason**: excluded from steady calibration and delay evidence. This covers cuts such as RPM limit, boost cut, lambda protection, injector-duty protection and fuel-pressure protection.
- **TPS AE active**: excluded from steady calibration evidence, but retained for response-delay analysis because an enrichment transient may provide useful command/mixture timing evidence.
- **TPS Decel active**: excluded from steady calibration evidence, but retained for response-delay analysis for the same reason.
- if a selected state/context channel is invalid or unavailable at a sample, the sample is conservatively excluded rather than silently assuming the state was inactive.

The UI keeps explicit provenance for scoped samples, calibration-eligible samples, delay-eligible samples, DFCO count, other fuel cuts, fuel-cut reason breakdown, AE/decel exclusions, and invalid/unavailable context.

This distinction is important: **TPS deceleration/enleanment is not DFCO**. Decel shaping changes fueling while DFCO is a hard zero-fuel cut.

## Current direction

The maturity sequence is:

1. steady-state target/actual mixture error and rich/lean bias;
2. observed mixture response-delay estimation;
3. state-aware DFCO/fuel-cut/transient qualification;
4. delay-compensated mixture error;
5. injector PW/duty/headroom evidence;
6. fuel-pressure and rail-differential stability;
7. repeated-event / before-after consistency;
8. conservative diagnostic interpretation.

## Steady-state mixture operating map

`core/analysis/fueling-operating-map.ts` builds RPM × load operating points from aligned actual mixture, target mixture, RPM and load channels. Its current internal field names retain `Afr` for compatibility, but the math is valid for either lambda or matched AFR channels because it operates on the selected numeric scale.

For EpicEFI/JZ, the preferred load channel is `veTableYAxis`, not guessed MAP/TPS. This is the Y-axis value actually used by the VE table after any configured VE load-axis override. That keeps operating bins aligned with the calibration table being evaluated.

Before the map sees a sample, the Fueling context qualifier removes DFCO, other fuel cuts, TPS AE, TPS Decel, and selected-context gaps. The map then applies its own stability rules.

The map is deliberately stricter than simply binning every valid sample. A sample only becomes steady-state evidence after RPM and load have remained inside configured rate limits for the configured stable duration. The stable duration therefore acts as a **settling period**: samples immediately after a load/RPM transition stay rejected even when the following operating point becomes stable. Selected-source-index gaps, invalid values and unavailable channel coverage break the stable segment and remain explicit provenance.

Each trustworthy bin reports:

- sample count and RPM/load means;
- actual and target mixture means;
- mixture error mean and median;
- P10–P90 error spread;
- mean absolute error and error standard deviation;
- lean, rich and within-deadband sample counts;
- a descriptive lean/rich/balanced/within-deadband bias.

Error uses `actual mixture − target mixture`, so positive values are lean and negative values are rich for both lambda and AFR. The map is descriptive calibration evidence; it does not by itself prove that VE is the cause of an error.

The operating-map result also retains input, stable-eligible, transient-rejected, invalid and unavailable counts. Bins below the configured minimum sample count are omitted instead of being promoted as weak tuning evidence. The browser shows an explicit empty-state explanation when no bin passes the current context, stability and evidence rules.

### Mixture-scale-aware thresholds

The UI leaves the mixture deadband blank by default and chooses an explicit scale-aware value from the selected actual-mixture channel:

- Lambda: `0.015`;
- AFR: `0.20`.

A user-entered value always overrides the automatic default and is interpreted in the selected channel's units.

## Correction-layer context

Fueling analysis should not assume that target tracking means base VE is correct. EpicEFI/JZ can apply multiple correction layers after the base airmass/VE calculation.

The browser therefore reports, when available, calibration-eligible means for:

- `totalFuelCorrection`;
- `stftCorrection1`;
- `ltftCorrection1`.

These are explanatory signals only. Persistent STFT/LTFT or a non-neutral total correction may indicate that closed-loop/other correction layers are masking a base-fueling error, but the analyzer must not automatically attribute the correction to VE because injector flow/deadtime, stoichiometric setup, pressure delivery, transient models and other corrections can also contribute.

## Observed mixture response delay

`core/analysis/afr-delay-analyzer.ts` estimates **observed mixture response delay** from isolated changes in a selected fuel-command channel. The internal API retains its historic AFR naming, but the event timing logic is equally valid for lambda because richer mixture moves both lambda and AFR downward.

This is intentionally not labelled as a pure sensor delay because the observation can include:

- combustion-cycle delay;
- exhaust transport time;
- turbo/manifold/exhaust volume effects;
- wideband sensor and controller response;
- filtering and logging latency.

The selected command channel must have explicit semantics. The canonical EpicEFI/JZ input is `actualLastInjection`, the final scheduled injector pulse width. Increasing pulse width normally adds fuel, so with `inverse` response polarity a positive command change is expected to move lambda/AFR downward and a negative command change upward.

VE is deliberately **not** a default fuel-command fallback. VE can change simply because RPM/load moved across the table and therefore creates weaker/ambiguous delay events compared with actual scheduled injector pulse width.

Hard fuel cuts are removed before delay analysis. TPS AE/decel state is retained and, when available, displayed alongside event-aligned delay evidence so transient context remains visible.

### Event qualification

A candidate event requires:

- a contiguous selected source sample transition;
- a fuel-command delta at or above the configured threshold;
- finite aligned mixture evidence;
- configured minimum spacing from the prior candidate.

While looking for a mixture response, the analyzer rejects an event when another strong fuel-command transition occurs before the mixture responds. It also refuses to bridge selected-source-index gaps. These safeguards keep qualification/scope gaps and compound transients from silently becoming delay evidence.

### Response threshold

The UI leaves the mixture-response threshold blank by default and chooses a scale-aware value:

- Lambda: `0.010`;
- AFR: `0.15`.

A user-entered value overrides that default.

### Reported timing

For each usable event the analyzer retains:

- source command and response sample indices/times;
- command delta;
- baseline and first-response mixture;
- onset delay;
- peak mixture response and its delay;
- T50 and T90 relative to the observed peak response;
- optional RPM and load context.

Across events it reports onset minimum, P10, median, P90 and maximum, plus median T50/T90 and a deliberately simple evidence-strength label.

The median should be presented as an estimate with its spread and usable-event count, not as a universal constant. RPM/load-dependent delay should be added only once enough repeated evidence exists to support trustworthy binning.

## Browser maturity / transferable UI patterns

Fueling reuses Analyzer patterns proven in Boost where they are genuinely domain-independent:

- sortable operating-point and evidence tables with keyboard-accessible column headers and `aria-sort` state;
- retained sorting through re-renders;
- inline `i` help for channel roles, thresholds and summary/provenance metrics;
- explicit empty-state feedback instead of blank tables;
- visible scope and evidence provenance;
- event rows that remain inspectable/openable in Logger;
- observational wording instead of unsupported causal or tuning claims.

Boost-specific concepts such as wastegate polarity, spool thresholds or target-tracking semantics are not copied into Fueling.

## Delay-compensated mixture error

A later slice may shift the causal engine/fuel state backward by the estimated delay before calculating fast-transient mixture error. That feature must always expose:

- the delay value or delay model used;
- the evidence strength behind it;
- whether a global or RPM/load-dependent delay was applied;
- uncompensated evidence alongside compensated evidence where practical.

Weak or absent delay evidence must not silently enable compensation.

## Viable next Fueling slices

High-value follow-up work includes:

- **DFCO exit recovery analysis**: detect the falling edge of `dfcoActive`, inspect the first roughly 0.2–0.5 s of mixture response, quantify lean/rich excursion and recovery-to-target, and correlate it with scheduled injector PW. This directly addresses restart enrichment after a hard cut.
- **delay-compensated operating evidence**: compare fast-changing measured mixture against the earlier engine/fuel state that most plausibly caused it, with compensated and uncompensated evidence shown together.
- **trim/correction masking analysis**: distinguish target tracking achieved with substantial STFT/LTFT/total correction from target tracking achieved with little correction.
- **wideband plausibility/confidence**: flat-line, clipping, invalid/fault state, implausible steps and response-delay inconsistency.
- **fuel/flex context**: expose stoichiometric ratio / ethanol content when useful, especially when AFR fallback rather than lambda is selected.
- **repeatability / before-after comparison**: compare matching RPM × VE-load regions or repeated pulls across tune revisions.
- **cross-link to injector/pressure evidence**: surface when a fueling deviation coincides with injector headroom or fuel-pressure/differential-pressure limitations without duplicating the dedicated Fuel Pressure / Injector analyzer.

## Interpretation guardrails

Fueling Analyzer may suggest evidence consistent with base-fuel calibration error, transient-fueling error, fuel-pressure limitation, injector headroom limitation, correction masking, intentional fuel cut, or sensor/measurement uncertainty. It must avoid claiming proven causation from observational log evidence alone.
