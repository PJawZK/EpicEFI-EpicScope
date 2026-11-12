import type {IdleStabilityResult} from './idle-stability';
import type {IdleRegionBounds} from './idle-regions';

/** Accepted source-local facts, not a request to load or reanalyze a recording. */
export interface IdleStabilityComparisonSide {
  readonly result: IdleStabilityResult;
  readonly sourceName: string;
  readonly regions: readonly IdleRegionBounds[];
  readonly rpmChannel: string;
  readonly targetChannel: string | undefined;
  readonly qualification: 'off' | 'qualified';
  readonly qualificationDescription: string;
}
export interface IdleStabilityComparisonMetric {
  readonly label: string;
  readonly unit: string;
  readonly a: number | undefined;
  readonly b: number | undefined;
  readonly delta: number | undefined;
  readonly reason: string | undefined;
}
/** Constant-size projection of retained facts. B−A is descriptive, never an improvement verdict. */
export function compareIdleStability(a: IdleStabilityComparisonSide, b: IdleStabilityComparisonSide) {
  const warnings = ['Operating conditions, chronology and tune association are not verified. Differences do not establish improvement or cause.'];
  const policyMismatch = a.qualification !== 'off' || b.qualification !== 'off';
  if (policyMismatch) warnings.push('Qualification policies are not matched: deltas withheld. This slice supports unqualified recorded scopes only.');
  const partial = !a.result.analysis.complete || !b.result.analysis.complete;
  if (partial) warnings.push('Partial requested coverage: deltas withheld.');
  const finite = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? value : undefined;
  const metric = (label: string, unit: string, left: number | undefined, right: number | undefined, special?: string): IdleStabilityComparisonMetric => {
    const av = finite(left), bv = finite(right);
    const reason = policyMismatch ? 'Qualification policies not matched' : partial ? 'Partial coverage' : special ?? (av === undefined || bv === undefined ? 'Missing or insufficient valid evidence' : undefined);
    const difference = av !== undefined && bv !== undefined ? finite(bv - av) : undefined;
    return {label,unit,a:av,b:bv,delta:reason ? undefined : difference,reason:reason ?? (difference === undefined ? 'Nonfinite difference' : undefined)};
  };
  const metrics = [
    metric('Mean RPM','RPM',a.result.analysis.rpm.mean,b.result.analysis.rpm.mean),
    metric('Sample σ','RPM',a.result.analysis.rpm.validSampleCount>=2?a.result.analysis.rpm.standardDeviation:undefined,b.result.analysis.rpm.validSampleCount>=2?b.result.analysis.rpm.standardDeviation:undefined),
    metric('Target error RMSE','RPM',a.result.analysis.tracking?.rmse,b.result.analysis.tracking?.rmse),
    metric('Within target band','pp',a.result.inBandPercent,b.result.inBandPercent,a.result.settledBandRpm !== b.result.settledBandRpm ? 'Different target bands' : undefined),
  ];
  return {metrics,warnings};
}
