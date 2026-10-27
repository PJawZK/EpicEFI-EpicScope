import { idleScopePurposeLabel } from '../../../../core/analysis/idle-region-purpose';
import type { IdleStabilityAssessment, IdleStabilityFinding, IdleStabilityNextTest } from '../../../../core/analysis/idle-stability-assessment';
const n = (value: number | undefined, decimals = 2) => value === undefined || !Number.isFinite(value) ? 'Unavailable' : value.toFixed(decimals);
/** Copy projects typed retained findings; rendered text is never analysis authority. */
export function presentIdleStabilityAssessment(assessment: IdleStabilityAssessment, qualification?: { input: number; eligible: number; manualBypassed: number; rejected: number; invalid: number; unavailable: number }) {
  const purpose = assessment.purpose;
  const purposeAdvice = {
    raised: 'Repeat a documented raised-RPM hold at matched commanded speed, temperature and loads. Compare hold variability; logged idle-target error is descriptive, not a steady-idle regulation verdict.',
    recovery: 'Select a bounded, documented load disturbance with recorded pre-event and follow-up evidence. This Stability view does not measure recovery time or declare an event recovered.',
    entry: 'Select a documented transition into idle with pre-entry and post-entry evidence. Separate the transition from an established steady interval; this view does not measure entry or settling time.',
    mixed: 'Separate different test purposes into independently analyzed scopes before interpreting idle tracking. The combined metrics still describe the deduplicated recorded union.',
    idle: 'Repeat the declared steady-idle interval under matched measured conditions.',
    custom: 'Document the intended operating test before interpreting its measurements.',
  }[purpose];
  const f = assessment.facts, band = `±${n(f.band, 0)} RPM`;
  const descriptions: Record<IdleStabilityFinding, readonly [string, string]> = {
    'purpose-review': ['Purpose-specific interpretation required', `${idleScopePurposeLabel(purpose)} is declared intent. RPM variation and logged-target errors remain descriptive measurements; steady-idle tracking findings are not applied to this scope. No purpose label verifies controller state or changes eligibility.`],
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
    'purpose-test': [purposeAdvice, 'Comparable repeats document the declared test, source validity, target and operating conditions.', 'The apparent difference depends on mixed test purposes, missing measurements or uncontrolled loads.'],
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
  let [next, supports, contradicts] = tests[assessment.nextTest];
  const noMatches = qualification && qualification.input > 0 && qualification.eligible === 0;
  const invalidQualification = noMatches && !qualification.rejected && (qualification.invalid > 0 || qualification.unavailable > 0);
  if(noMatches) {next='No records meet the selected qualification conditions. Review the thresholds, selected channels and operating interval; managed regions are retained.';supports='Recorded samples with valid aligned required channels meet the chosen conditions.';contradicts='The selected region remains outside the requested conditions or required measurements are missing.';}
  if(invalidQualification){next='Required qualification measurements are invalid, unavailable or misaligned. Verify mappings, timestamps and source-integrity diagnostics before interpreting conditions.';}
  return {
    status: invalidQualification ? 'Qualification evidence unavailable' : noMatches ? 'No condition-matching evidence' : assessment.status === 'recorded-region' ? 'Recorded-region evidence' : assessment.status === 'scope-review' ? 'Operating scope needs review' : assessment.status === 'limited' ? 'Limited recorded evidence' : 'Evidence unavailable',
    observed: `${f.validRpm} valid RPM samples; minimum ${n(f.minimumRpm)} RPM; sample σ ${n(f.sigma)} RPM. Target RMSE ${n(f.rmse)} RPM; signed mean error ${n(f.meanError)} RPM.`,
    findings: assessment.findings.map(code => ({ code, title: descriptions[code][0], text: descriptions[code][1] })),
    purpose: `${idleScopePurposeLabel(purpose)} · user-declared, not verified operating state. ${purpose === 'custom' ? 'No specific test purpose is established.' : purposeAdvice}`,
    limits: qualification ? `Only the selected recorded conditions were applied; ${qualification.manualBypassed} valid records manually bypassed them. Bypassed conditions are not verified. Firmware idle-controller activation, stationary vehicle state and matched loads are not established. Physical TPS is not pedal intent. Reference thresholds are not firmware limits or tuning instructions.` : 'Warm-engine, closed-throttle idle and matched mechanical/electrical loads are not established by this view. Physical throttle position alone does not prove pedal intent. The reference band is not a firmware limit. These observations do not identify a causal fault, controller timing, oscillation frequency or a validated tuning instruction.',
    next, supports, contradicts,
    holdConstant: 'Logged RPM target, coolant temperature, electrical/mechanical loads, controller state, recording quality and tune version. No tune or ECU state is changed.',
  };
}
