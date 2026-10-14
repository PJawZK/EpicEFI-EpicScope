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

export function weightedQuantile(observations: readonly WeightedObservation[], fraction: number): number | undefined {
  const values = validObservations(observations);
  if (values.length === 0) return undefined;
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(totalWeight > 0)) return undefined;
  const target = Math.max(0, Math.min(1, fraction)) * totalWeight;
  let cumulative = 0;
  for (const entry of values) {
    cumulative += entry.weight;
    if (cumulative >= target) return entry.value;
  }
  return values[values.length - 1]!.value;
}

export function robustWeightedEstimate(observations: readonly WeightedObservation[]): RobustWeightedEstimate {
  const values = validObservations(observations);
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  const median = weightedQuantile(values, 0.5);
  const p10 = weightedQuantile(values, 0.1);
  const p90 = weightedQuantile(values, 0.9);
  return {
    median,
    p10,
    p90,
    spread: p10 === undefined || p90 === undefined ? undefined : p90 - p10,
    totalWeight,
    observationCount: values.length,
  };
}
