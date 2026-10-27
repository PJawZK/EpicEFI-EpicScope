import type { IdleValveTrackingResult } from '../../../../core/analysis/idle-valve-tracking';
import type { IdleRecordedMetric } from '../../../../core/analysis/idle-recorded-signal';
import { idleRecordedValue, idleRecordedCoverage } from './idle-recorded-presentation';

/** Constant-size presentation of retained facts; no array reads or controller diagnosis. */
export function presentIdleValveTracking(result: IdleValveTrackingResult, complete: boolean) {
  const roles = ([['Requested position', result.requested], ['Measured position', result.measured], ['Tracking error · measured − requested', result.tracking], ['Signed motor duty', result.motor]] as const).map(([label, metric]) => ({
    label, value: `${idleRecordedValue(metric)} ${metric.unit}`,
    coverage: idleRecordedCoverage(metric),
  }));
  const tracking = result.tracking, motor = result.motor;
  const value = (metric: IdleRecordedMetric, rms = false) => idleRecordedValue(metric, rms ? 'rootMeanSquare' : 'mean');
  const reference = result.motorAtReferencePercent === undefined ? 'Unavailable' : result.motorAtReferencePercent.toFixed(1) + '%';
  const limited = !complete || roles.some((_, i) => {
    const metric = [result.requested, result.measured, tracking, motor][i]!;
    return metric.status !== 'available' || 'statistics' in metric && (metric.statistics.invalidSampleCount > 0 || metric.statistics.unavailableSampleCount > 0);
  });
  return {
    roles,
    rmse: value(tracking, true), signedError: value(tracking), motorMean: value(motor), reference,
    status: tracking.status !== 'available' ? 'Valve tracking evidence unavailable' : limited ? 'Limited recorded valve tracking' : 'Recorded valve tracking',
    observed: `Measured − requested position error RMSE ${value(tracking, true)} pp; signed mean ${value(tracking)} pp. Positive means measured position exceeds requested position. Signed motor mean ${value(motor)}%. |Motor duty| ≥ ${result.motorReferencePercent}% in ${reference} of valid aligned motor records (${result.motorAtReferenceCount ?? 'Unavailable'} records).`,
    limits: 'Position error is measured − requested in percentage points. Requested and measured positions require identical original indices and timestamps, with valid RPM provenance. Motor evidence has its own denominator. Invalid counts can include recovered retry attempts; derived overflow is unusable, not zero. The motor reference is user-selected, not a firmware saturation limit. Controller cadence, latency, steady/moving classification, step t63, oscillation frequency, sensor calibration, flashed control mode and causal faults are not established. Raw focused traces can include excluded measurements; the error trace uses accepted analysis samples only. No tune or ECU values are changed.',
    next: tracking.status === 'missing' || tracking.status === 'incompatible-unit' ? 'Map compatible recorded DC requested and measured position channels (%) in Channels / region. Do not substitute final request, raw sensor voltage or motor duty for measured position.' : tracking.status === 'nonfinite-metrics' ? 'Verify source magnitudes, scaling and units before interpreting nonfinite derived tracking measurements.' : tracking.status !== 'available' || limited ? 'Review per-role coverage, qualification, exact timestamp alignment and source Diagnostics. Missing feedback or motor measurements are not perfect tracking or zero effort.' : 'Repeat a bounded requested-position change with matched temperature, voltage and load. Inspect requested/measured position and signed motor duty together; verify direction, calibration and firmware limits before interpreting controller response.',
    supports: 'Comparable repeated intervals retain valid aligned position feedback, documented conditions and the same explicit motor reference.',
    contradicts: 'A difference relies on missing feedback, different times, units, validity denominators or changed operating conditions.',
  };
}
