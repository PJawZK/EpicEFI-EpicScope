import type { IdleAirflowMetric, IdleAirflowResult } from '../../../../core/analysis/idle-airflow';
const n = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? value.toFixed(2) : 'Unavailable';
export const idleAirflowValue = (metric: IdleAirflowMetric, field: 'mean' | 'rootMeanSquare' = 'mean') => metric.status === 'available' ? n(metric.statistics[field]) : 'Unavailable';
/** Constant-size projection of retained request statistics. Never reads recorded arrays. */
export function presentIdleAirflow(result: IdleAirflowResult, complete: boolean) {
  const roles = ([['Base request', result.basePosition], ['Applied correction', result.closedLoop], ['Final request', result.finalPosition]] as const).map(([label, metric]) => ({
    label, value: `${idleAirflowValue(metric)} ${metric.unit}`,
    coverage: 'statistics' in metric ? `${metric.statistics.validSampleCount} valid, ${metric.statistics.invalidSampleCount} invalid, ${metric.statistics.unavailableSampleCount} unavailable of ${metric.statistics.inputSampleCount} selected original records; ${metric.status}.` : `${metric.status}: ${metric.reason}`,
  }));
  const metrics = [result.basePosition, result.closedLoop, result.finalPosition];
  const missing = metrics.some(metric => metric.status === 'missing' || metric.status === 'incompatible-unit');
  const nonfinite = metrics.some(metric => metric.status === 'nonfinite-metrics');
  return {
    roles,
    status: result.status === 'unavailable' ? 'Logged request evidence unavailable' : !complete || result.status === 'limited' ? 'Limited logged request evidence' : 'Recorded request context',
    observed: roles.map(role => `${role.label} mean ${role.value}`).join('; ') + `. Applied-correction RMS ${idleAirflowValue(result.closedLoop, 'rootMeanSquare')} pp.`,
    limits: 'These are logged position requests and correction, not measured physical airflow. Independent valid denominators may differ. Mean base plus mean correction is not assumed to equal final request. Raw PID terms, actuator tracking, tune-table correctness and causal tuning improvement are not established. Invalid counts can include recovered retry attempts and do not by themselves establish unrecovered physical loss. No tune or ECU values are changed.',
    next: missing ? 'Map compatible logged base/applied/final request channels in Channels / region and verify source validity, selected conditions and units. Missing evidence is not zero correction.' : nonfinite ? 'Verify recorded magnitudes and channel units before interpreting nonfinite derived request measurements.' : result.status !== 'recorded-context' || !complete ? 'Review per-role coverage and Diagnostics to distinguish recovered retries from missing or unusable measurements. Preserve the recorded facts and repeat under matched documented conditions before interpreting a difference.' : 'Repeat the declared test under matched target, coolant and electrical/mechanical loads. Inspect request changes with RPM and independently verified actuator feedback before proposing any tuning experiment.',
    supports: 'Comparable repeated intervals preserve aligned valid signal coverage and documented operating conditions.',
    contradicts: 'The apparent difference depends on mismatched times, different validity denominators, target/load changes or missing signals.',
  };
}
