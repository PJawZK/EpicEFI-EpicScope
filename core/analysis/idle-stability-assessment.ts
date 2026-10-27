import type { IdleStabilityResult } from './idle-stability';

export type IdleStabilityFinding = 'invalid-metrics' | 'no-rpm' | 'few-rpm' | 'partial-coverage' | 'rejected-samples' | 'nonpositive-rpm' | 'missing-target' | 'few-pairs' | 'unpaired-rpm' | 'target-span' | 'mean-offset' | 'outside-band' | 'within-band';
export type IdleStabilityNextTest = 'source' | 'longer-region' | 'known-idle' | 'target-mapping' | 'coverage' | 'matched-target' | 'tracking-offset' | 'repeat-excursions' | 'repeat-baseline';
export interface IdleStabilityAssessment {
  readonly status: 'unavailable' | 'limited' | 'scope-review' | 'recorded-region';
  readonly findings: readonly IdleStabilityFinding[];
  readonly nextTest: IdleStabilityNextTest;
  readonly facts: {
    readonly selected: number; readonly validRpm: number; readonly invalidRpm: number; readonly unavailableRpm: number;
    readonly paired: number; readonly invalidPairs: number; readonly unavailablePairs: number;
    readonly minimumRpm: number | undefined; readonly sigma: number | undefined; readonly meanError: number | undefined; readonly rmse: number | undefined;
    readonly targetMin: number | undefined; readonly targetMax: number | undefined; readonly validTarget: number;
    readonly band: number; readonly inBandPercent: number | undefined;
  };
  /** Descriptive eligibility only; source/tune/load/temperature cannot be inferred from RPM. */
  readonly idleState: 'not-established';
}

/** O(1) projection from accepted aggregates. Never reads/scans recorded arrays or fits tuning parameters. */
export function assessIdleStability(result: IdleStabilityResult): IdleStabilityAssessment {
  const { rpm, target, tracking, complete } = result.analysis;
  const facts = {
    selected: rpm.inputSampleCount, validRpm: rpm.validSampleCount, invalidRpm: rpm.invalidSampleCount, unavailableRpm: rpm.unavailableSampleCount,
    paired: tracking?.sampleCount ?? 0, invalidPairs: tracking?.invalidSampleCount ?? 0, unavailablePairs: tracking?.unavailableSampleCount ?? 0,
    minimumRpm: rpm.min, sigma: rpm.standardDeviation, meanError: tracking?.meanError, rmse: tracking?.rmse,
    targetMin: target?.min, targetMax: target?.max, validTarget: target?.validSampleCount ?? 0,
    band: result.settledBandRpm, inBandPercent: result.inBandPercent,
  };
  const findings: IdleStabilityFinding[] = [];
  if (!facts.validRpm) return { status: 'unavailable', findings: ['no-rpm'], nextTest: 'source', facts, idleState: 'not-established' };
  if (facts.validRpm < 2) findings.push('few-rpm');
  if ((facts.validRpm >= 2 && !Number.isFinite(facts.sigma)) || (facts.paired >= 2 && (!Number.isFinite(facts.rmse) || !Number.isFinite(facts.meanError) || !Number.isFinite(facts.inBandPercent)))) findings.push('invalid-metrics');
  if (!complete) findings.push('partial-coverage');
  if (facts.invalidRpm || facts.unavailableRpm || facts.invalidPairs || facts.unavailablePairs) findings.push('rejected-samples');
  if (facts.minimumRpm !== undefined && facts.minimumRpm <= 0) findings.push('nonpositive-rpm');
  if (!tracking) findings.push('missing-target');
  else {
    if (facts.paired < 2) findings.push('few-pairs');
    if (facts.paired < facts.validRpm) findings.push('unpaired-rpm');
    // Explicit reference-band comparison, not a universal target-change limit.
    if (facts.targetMin !== undefined && facts.targetMax !== undefined && facts.targetMax - facts.targetMin > 2 * facts.band) findings.push('target-span');
    if (facts.paired >= 2 && !findings.includes('invalid-metrics')) {
      if (facts.meanError !== undefined && Math.abs(facts.meanError) > facts.band) findings.push('mean-offset');
      if (facts.inBandPercent !== undefined) findings.push(facts.inBandPercent < 100 ? 'outside-band' : 'within-band');
    }
  }
  const has = (code: IdleStabilityFinding) => findings.includes(code);
  const limited = has('invalid-metrics') || has('few-rpm') || has('partial-coverage') || facts.unavailableRpm > 0 || facts.unavailablePairs > 0 || has('missing-target') || has('few-pairs') || has('unpaired-rpm');
  const scopeReview = has('nonpositive-rpm') || has('target-span');
  const nextTest: IdleStabilityNextTest = has('invalid-metrics') ? 'source' : has('few-rpm') ? 'longer-region' : has('nonpositive-rpm') ? 'known-idle'
    : has('missing-target') || has('few-pairs') ? 'target-mapping' : has('partial-coverage') || facts.unavailableRpm > 0 || facts.unavailablePairs > 0 || has('unpaired-rpm') ? 'coverage'
    : has('target-span') ? 'matched-target' : has('mean-offset') ? 'tracking-offset' : has('outside-band') ? 'repeat-excursions' : 'repeat-baseline';
  return { status: has('invalid-metrics') ? 'limited' : scopeReview ? 'scope-review' : limited ? 'limited' : 'recorded-region', findings, nextTest, facts, idleState: 'not-established' };
}
