export interface FixedDistributionGeometry {
  readonly min: number;
  readonly max: number;
  readonly width: number;
  readonly binCount: number;
}

export interface FixedDistributionGeometryInput {
  readonly min: number;
  readonly max: number;
  readonly width: number;
  readonly maximumBinCount?: number;
}

export function resolveFixedDistributionGeometry(input: FixedDistributionGeometryInput): FixedDistributionGeometry {
  const { min, max, width } = input;
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(width)) {
    throw new RangeError('Fixed Distribution min, max and width must be finite numbers.');
  }
  if (!(max > min)) throw new RangeError('Fixed Distribution max must be greater than min.');
  if (!(width > 0)) throw new RangeError('Fixed Distribution bin width must be greater than zero.');
  const rawCount = (max - min) / width;
  const binCount = Math.round(rawCount);
  const tolerance = 1e-9 * Math.max(1, Math.abs(rawCount));
  if (Math.abs(rawCount - binCount) > tolerance) {
    throw new RangeError('Fixed Distribution range must be an exact whole number of bin widths.');
  }
  const maximumBinCount = input.maximumBinCount ?? 512;
  if (binCount < 1 || binCount > maximumBinCount) {
    throw new RangeError(`Fixed Distribution geometry must contain 1–${maximumBinCount} bins.`);
  }
  return { min, max, width, binCount };
}

export function distributionValueInsideGeometry(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}
