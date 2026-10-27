import type { IdleRecordedMetric } from '../../../../core/analysis/idle-recorded-signal';
/** Constant-size projection shared by native request and valve evidence views. */
export function idleRecordedValue(metric: IdleRecordedMetric, field: 'mean' | 'rootMeanSquare' = 'mean'): string {
  const value = 'statistics' in metric ? metric.statistics[field] : undefined;
  return metric.status === 'available' && value !== undefined && Number.isFinite(value) ? value.toFixed(2) : 'Unavailable';
}
export function idleRecordedCoverage(metric: IdleRecordedMetric): string {
  return 'statistics' in metric ? `${metric.statistics.validSampleCount} valid, ${metric.statistics.invalidSampleCount} invalid, ${metric.statistics.unavailableSampleCount} unavailable of ${metric.statistics.inputSampleCount} selected original records; ${metric.status}.` : `${metric.status}: ${metric.reason}`;
}
