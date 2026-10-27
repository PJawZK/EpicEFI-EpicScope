import type { IdleStabilityAssessment, IdleStabilityFinding, IdleStabilityNextTest } from '../../../../core/analysis/idle-stability-assessment';
const n = (value: number | undefined, decimals = 2) => value === undefined || !Number.isFinite(value) ? 'Unavailable' : value.toFixed(decimals);
/** Copy projects typed retained findings; rendered text is never analysis authority. */
export function presentIdleStabilityAssessment(assessment: IdleStabilityAssessment) {
  const f = assessment.facts, band = `±${n(f.band, 0)} RPM`;
  const descriptions: Record<IdleStabilityFinding, readonly [string, string]> = {
    'invalid-metrics': ['Derived measurements unavailable', 'Some derived measurements are nonfinite despite valid source samples. Verify channel units and recorded magnitudes; no stability judgement is available.'],
    'no-rpm': ['No usable RPM evidence', 'No valid RPM samples remain in the analysis scope. No stability or tracking conclusion is available.'],
    'few-rpm': ['Insufficient variability evidence', 'Only one valid RPM sample is available. Sample standard deviation needs at least two; one matching point does not establish steady idle.'],
    'partial-coverage': ['Partial source coverage', 'The returned evidence is not known to cover the complete requested scope. These metrics describe only returned samples.'],
    'rejected-samples': ['Excluded measurement evidence', `RPM invalid/unavailable: ${f.invalidRpm}/${f.unavailableRpm}; paired measurements invalid/unavailable: ${f.invalidPairs}/${f.unavailablePairs}. Excluded measurements are not healthy zero values. These counts can include invalid retry attempts; counts alone do not establish unrecovered data loss. Review source-integrity diagnostics.`],
    'nonpositive-rpm': ['Review the selected operating region', `Minimum recorded RPM is ${n(f.minimumRpm)}. Nonpositive samples require source/mapping and operating-scope review before steady running idle can be assessed.`],
    'missing-target': ['RPM variability only', 'No compatible logged target is selected. RPM variation is measurable; target tracking and reference-band coverage are unavailable.'],
    'few-pairs': ['Insufficient target tracking evidence', `Only ${f.paired} aligned valid RPM/target pairs are available. Verify target mapping and use a longer recorded region before interpreting tracking.`],
    'unpaired-rpm': ['Target pairing coverage', `${f.paired} of ${f.validRpm} valid RPM samples have aligned valid target evidence. Tracking metrics use only those pairs.`],
    'target-span': ['Mixed target conditions', `Logged target-valid samples span ${n(f.targetMin)}–${n(f.targetMax)} RPM (${f.validTarget} samples), wider than the ${n(2*f.band,0)} RPM reference-band width. RPM variation can include commanded target changes; paired RMSE still uses each logged target.`],
    'mean-offset': ['Mean tracking offset outside reference band', `Mean actual−target is ${n(f.meanError)} RPM (${(f.meanError ?? 0) > 0 ? 'above' : 'below'} target), outside ${band}. This is an observed signed offset, not proof of base-airflow or gain error.`],
    'outside-band': ['Recorded excursions outside reference band', `${n(f.inBandPercent)}% of ${f.paired} valid pairs are within ${band}; ${n(100-(f.inBandPercent ?? 0))}% are outside. This does not identify oscillation frequency, sag events or their cause.`],
    'within-band': ['All observed pairs within reference band', `All ${f.paired} valid pairs are within ${band}. This reference-band observation is not a universal pass criterion or evidence of correct tuning.`],
  };
  const tests: Record<IdleStabilityNextTest, readonly [string, string, string]> = {
    source: ['Verify the RPM mapping and include a recorded running-engine interval, then run analysis.', 'Valid original RPM samples and declared coverage are available.', 'Source, validity or region selection remains unavailable.'],
    'longer-region': ['Select a longer known idle interval with repeated valid RPM measurements.', 'Repeated measurements support a sample variability estimate.', 'Only isolated points or invalid measurements remain.'],
    'known-idle': ['Separate verified engine-off/start-stop portions from a known running-idle interval and verify unexpected nonpositive values against the mapping/source before interpreting stability.', 'A repeated running interval excludes stopped-engine samples under matched conditions.', 'The selected interval still contains stops, starts or unrecorded operating changes.'],
    'target-mapping': ['Verify the logged target channel and original time/index alignment, then repeat the same region.', 'Multiple aligned valid RPM/target pairs cover the selected interval.', 'The target is missing, invalid or incompatible with the source grid.'],
    coverage: ['Review source-integrity diagnostics to distinguish recovered retry attempts from actual missing measurements; verify target pairing and select a fully recorded comparable interval.', 'Coverage and pairing are established without treating gaps as measurements.', 'The apparent difference depends on rejected records or incomplete target pairing.'],
    'matched-target': ['Compare separately selected intervals with matched logged targets, temperature and loads.', 'The observed variation persists at comparable target levels.', 'The difference follows a commanded target change rather than repeatable disturbance response.'],
    'tracking-offset': ['Repeat a known idle interval at the same target and conditions; inspect logged base/applied/final request before proposing a tuning experiment.', 'A similarly signed offset repeats with verified target, temperature and load conditions.', 'The offset disappears under matched conditions or is explained by target/load changes.'],
    'repeat-excursions': ['Repeat equal-duration known idle intervals at matched target, temperature and electrical/mechanical loads; record intentional load changes.', 'Similar excursions recur with sufficient paired evidence and documented operating conditions.', 'The excursions follow different targets, loads, starts/stops or missing measurements.'],
    'repeat-baseline': ['Retain this recording as a descriptive baseline and verify repeatability under matched conditions before considering a tuning experiment.', 'Comparable independent intervals reproduce the band coverage without worse disturbance response.', 'A comparable repeat shows excursions or conditions were not actually matched.'],
  };
  const [next, supports, contradicts] = tests[assessment.nextTest];
  return {
    status: assessment.status === 'recorded-region' ? 'Recorded-region evidence' : assessment.status === 'scope-review' ? 'Operating scope needs review' : assessment.status === 'limited' ? 'Limited recorded evidence' : 'Evidence unavailable',
    observed: `${f.validRpm} valid RPM samples; minimum ${n(f.minimumRpm)} RPM; sample σ ${n(f.sigma)} RPM. Target RMSE ${n(f.rmse)} RPM; signed mean error ${n(f.meanError)} RPM.`,
    findings: assessment.findings.map(code => ({ code, title: descriptions[code][0], text: descriptions[code][1] })),
    limits: 'Warm-engine, closed-throttle idle and matched mechanical/electrical loads are not established by this view. Physical throttle position alone does not prove pedal intent. The reference band is not a firmware limit. These observations do not identify a causal fault, controller timing, oscillation frequency or a validated tuning instruction.',
    next, supports, contradicts,
    holdConstant: 'Logged RPM target, coolant temperature, electrical/mechanical loads, controller state, recording quality and tune version. No tune or ECU state is changed.',
  };
}
