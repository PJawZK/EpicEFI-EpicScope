import type { TuneEntry, TuneModel } from './tune-model';

/** Detached committed review values; neither DOM presentation nor generated-only proposal. */
export interface VeMsqWriteSnapshot {
  readonly tuneModel: TuneModel;
  readonly entry: TuneEntry;
  readonly rpmAxis: TuneEntry;
  readonly loadAxis: TuneEntry;
  readonly revision: number;
  readonly authorityGeneration: number;
  readonly rows: number;
  readonly cols: number;
  readonly values: readonly (number | undefined)[];
}
export interface VeMsqStoragePolicy {
  readonly tuneModel: TuneModel;
  readonly entry: TuneEntry;
  readonly scale: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly rawMinimum: number;
  readonly rawMaximum: number;
}

function decimal(value: number): { numerator: bigint; places: number } {
  const [mantissa, exponentText] = value.toString().toLowerCase().split('e');
  const parts = mantissa!.split('.');
  const places = (parts[1]?.length ?? 0) - Number(exponentText ?? 0);
  const numerator = BigInt(parts.join(''));
  return places < 0 ? { numerator: numerator * 10n ** BigInt(-places), places: 0 } : { numerator, places };
}

/** Round positive VE to storage steps, half up, ignoring only floating-point noise at ties. */
export function quantizeVeMsqValue(value: number | undefined, policy: VeMsqStoragePolicy): { text: string; value: number } {
  if (value === undefined || !Number.isFinite(value) || value < 0) throw new Error('Every VE cell must contain a finite nonnegative value; fill blank cells before saving.');
  if (!(policy.scale > 0) || !Number.isFinite(policy.scale) || !Number.isFinite(policy.minimum) || !Number.isFinite(policy.maximum)
    || policy.minimum > policy.maximum || !Number.isSafeInteger(policy.rawMinimum) || !Number.isSafeInteger(policy.rawMaximum)) throw new Error('Invalid VE storage policy.');
  if (value < policy.minimum || value > policy.maximum) throw new Error(`VE value ${value} is outside the INI range ${policy.minimum}–${policy.maximum}.`);
  const input = decimal(value), scale = decimal(policy.scale);
  if (scale.places > 12) throw new Error('Unsupported VE storage precision.');
  const numerator = input.numerator * 10n ** BigInt(scale.places);
  const denominator = scale.numerator * 10n ** BigInt(input.places);
  let raw = (2n * numerator + denominator) / (2n * denominator);
  const units = value / policy.scale;
  if (Number.isSafeInteger(Math.floor(units)) && Math.abs(units - Math.floor(units) - 0.5) <= 8 * Number.EPSILON * Math.max(1, Math.abs(units))) raw = BigInt(Math.floor(units) + 1);
  if (raw < BigInt(policy.rawMinimum) || raw > BigInt(policy.rawMaximum)) throw new Error('VE value cannot be represented by the INI storage type.');
  const integer = raw * scale.numerator;
  const digits = integer.toString().padStart(scale.places + 1, '0');
  const text = scale.places === 0 ? digits : `${digits.slice(0, -scale.places)}.${digits.slice(-scale.places)}`.replace(/\.?0+$/, '');
  const result = Number(text);
  if (result < policy.minimum || result > policy.maximum) throw new Error('Rounded VE value is outside the INI range.');
  return { text, value: result };
}
