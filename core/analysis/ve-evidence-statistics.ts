import { VE_ANALYSIS_BATCH_SIZE, sortVeAnalysisValues, type VeAnalysisSteps } from './ve-analysis-work';

export interface WeightedObservation {
  readonly value: number;
  readonly weight: number;
}

export interface RobustWeightedEstimate {
  readonly median: number | undefined;
  readonly p10: number | undefined;
  readonly p90: number | undefined;
  readonly spread: number | undefined;
  readonly totalWeight: number;
  readonly observationCount: number;
}

function validObservations(observations: readonly WeightedObservation[]): WeightedObservation[] {
  return observations
    .filter((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((left, right) => left.value - right.value);
}

// Internal contract: values have already been filtered and sorted; callers own preparation.
function sortedWeightedQuantile(values: readonly WeightedObservation[], totalWeight: number, fraction: number): number | undefined {
  if (values.length === 0) return undefined;
  if (!(totalWeight > 0)) return undefined;
  const target = Math.max(0, Math.min(1, fraction)) * totalWeight;
  let cumulative = 0;
  for (const entry of values) {
    cumulative += entry.weight;
    if (cumulative >= target) return entry.value;
  }
  return values[values.length - 1]!.value;
}

export function weightedQuantile(observations: readonly WeightedObservation[], fraction: number): number | undefined {
  const values = validObservations(observations);
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  return sortedWeightedQuantile(values, totalWeight, fraction);
}

export function robustWeightedEstimate(observations: readonly WeightedObservation[]): RobustWeightedEstimate {
  const values = validObservations(observations);
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  const median = sortedWeightedQuantile(values, totalWeight, 0.5);
  const p10 = sortedWeightedQuantile(values, totalWeight, 0.1);
  const p90 = sortedWeightedQuantile(values, totalWeight, 0.9);
  return {
    median,
    p10,
    p90,
    spread: p10 === undefined || p90 === undefined ? undefined : p90 - p10,
    totalWeight,
    observationCount: values.length,
  };
}

/** Same estimator, with bounded preparation/sort/scan steps for browser-owned jobs. */
export function* robustWeightedEstimateSteps(observations: readonly WeightedObservation[]): VeAnalysisSteps<RobustWeightedEstimate> {
  let values: WeightedObservation[] = [];
  const progress = (phase: string, completed: number, total: number) => ({ phase, completed, total });
  for (let index = 0; index < observations.length; index += 1) {
    const entry = observations[index]!;
    if (Number.isFinite(entry.value) && Number.isFinite(entry.weight) && entry.weight > 0) values.push(entry);
    if ((index + 1) % VE_ANALYSIS_BATCH_SIZE === 0) yield progress('Preparing cell observations', index + 1, observations.length);
  }
  values = yield* sortVeAnalysisValues(values, (a, b) => a.value - b.value, 'Sorting weighted evidence');
  let totalWeight = 0;
  for (let index = 0; index < values.length; index += 1) {
    totalWeight += values[index]!.weight;
    if ((index + 1) % VE_ANALYSIS_BATCH_SIZE === 0) yield progress('Summing evidence weights', index + 1, values.length);
  }
  const quantiles: (number | undefined)[] = [];
  for (const fraction of [0.5, 0.1, 0.9]) {
    let estimate: number | undefined;
    if (values.length && totalWeight > 0) {
      const threshold = fraction * totalWeight;
      let cumulative = 0;
      estimate = values[values.length - 1]!.value;
      for (let index = 0; index < values.length; index += 1) {
        cumulative += values[index]!.weight;
        if (cumulative >= threshold) { estimate = values[index]!.value; break; }
        if ((index + 1) % VE_ANALYSIS_BATCH_SIZE === 0) yield progress(fraction === 0.5 ? 'Reading weighted median' : fraction === 0.1 ? 'Reading weighted P10' : 'Reading weighted P90', index + 1, values.length);
      }
    }
    quantiles.push(estimate);
  }
  const [median, p10, p90] = quantiles;
  return { median, p10, p90, spread: p10 === undefined || p90 === undefined ? undefined : p90 - p10, totalWeight, observationCount: values.length };
}
