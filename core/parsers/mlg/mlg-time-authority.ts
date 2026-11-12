import type { MlgFieldDescriptor, MlgScalarFieldDescriptor } from './mlg-format';
import type { MlgRecordIndex } from './mlg-records';

export const MLG_TIME_POLICY_VERSION = 1;
export type MlgTimeFallbackReason = 'missing-time' | 'ambiguous-time' | 'unsupported-time-metadata'
  | 'missing-time-values' | 'invalid-trusted-time' | 'backward-trusted-time' | 'constant-time';
export interface MlgTimeCandidate {
  readonly source: 'recorded-time' | 'header-clock';
  readonly reason: 'validated-recorded-time' | MlgTimeFallbackReason;
  readonly fingerprint: string;
  readonly headerTimeMs: Float64Array;
  readonly recordedValues: Float64Array | undefined;
  readonly field: Readonly<MlgScalarFieldDescriptor> | undefined;
  /** Candidate geometry only. Excluded slots may be NaN/outside the trusted extent.
   * DO NOT publish through existing consumers until time eligibility is supported. */
  readonly timeMs: Float64Array;
  readonly timeEligible: Uint8Array;
  readonly originIndex: number | undefined;
  readonly originSeconds: number | undefined;
  readonly trustedStartMs: number;
  readonly trustedEndMs: number;
}
export type MlgTimeResolution =
  | { readonly status: 'pending-crc' | 'no-trusted-time' }
  | { readonly status: 'candidate'; readonly candidate: MlgTimeCandidate };

/** Stage-one admission contract. Deliberately not connected to runtime publication.
 * No I/O, clock repair, deduplication, source-array writes or per-row clock mixing. */
export function resolveMlgTimeCandidate(input: {
  readonly sourceId: string;
  readonly validationRevision: number;
  readonly crcValidated: boolean;
  readonly index: MlgRecordIndex;
  readonly fields: readonly MlgFieldDescriptor[];
  /** Values already decoded using the raw field's scale/transform, never INI roles. */
  readonly recordedValues?: Float64Array;
}): MlgTimeResolution {
  const { index } = input, headerTimeMs = index.headerTimeMs ?? index.timeMs;
  const count = headerTimeMs.length;
  if (index.timeMs.length !== count || index.offsets.length !== count || index.counters.length !== count || index.crcValid.length !== count
    || (index.rawTimestampTicks && index.rawTimestampTicks.length !== count)) throw new RangeError('MLG clock geometry mismatch');
  if (!Number.isSafeInteger(input.validationRevision) || input.validationRevision < 0) throw new RangeError('Invalid CRC validation revision');
  if (!input.crcValidated) return { status: 'pending-crc' };
  let trusted = 0;
  for (const crc of index.crcValid) if (crc === 1) trusted++;
  if (!trusted) return { status: 'no-trusted-time' };
  const matches = input.fields.filter(field => field.name === 'Time');
  const field = matches.length === 1 && matches[0]!.kind === 'scalar' ? matches[0] as MlgScalarFieldDescriptor : undefined;
  const unit = field?.units.trim();
  const secondsFactor = unit === 's' ? 1 : unit === 'ms' ? .001 : undefined;
  let reason: MlgTimeFallbackReason | undefined;
  if (!matches.length) reason = 'missing-time';
  else if (matches.length !== 1) reason = 'ambiguous-time';
  else if (!field || secondsFactor === undefined || !Number.isFinite(field.scale) || field.scale <= 0
    || !Number.isFinite(field.transform)) reason = 'unsupported-time-metadata';
  else if (!input.recordedValues || input.recordedValues.length !== count) reason = 'missing-time-values';

  let originIndex: number | undefined, originSeconds: number | undefined;
  let previous: number | undefined, progressed = false;
  if (!reason) for (let i = 0; i < count; i++) {
    if (index.crcValid[i] !== 1) continue;
    const value = input.recordedValues![i]!, seconds = value * secondsFactor!;
    if (!Number.isFinite(seconds) || seconds < 0 || (field!.type === 6 && !Number.isSafeInteger(value / field!.scale - field!.transform))
      || !Number.isFinite(seconds * 1000)) { reason = 'invalid-trusted-time'; break; }
    if (previous !== undefined && seconds < previous) { reason = 'backward-trusted-time'; break; }
    if (previous !== undefined && seconds > previous) progressed = true;
    if (originIndex === undefined) { originIndex = i; originSeconds = seconds; }
    previous = seconds;
  }
  if (!reason && !progressed) reason = 'constant-time';
  const recorded = reason === undefined;
  const timeMs = recorded ? new Float64Array(count) : headerTimeMs;
  const timeEligible = new Uint8Array(count);
  let start = Infinity, end = -Infinity;
  for (let i = 0; i < count; i++) {
    if (recorded) timeMs[i] = (input.recordedValues![i]! * secondsFactor! - originSeconds!) * 1000;
    if (index.crcValid[i] === 1 && Number.isFinite(timeMs[i])) {
      timeEligible[i] = 1; start = Math.min(start, timeMs[i]!); end = Math.max(end, timeMs[i]!);
    }
  }
  if (!Number.isFinite(start)) return { status: 'no-trusted-time' };
  const descriptor = field ? Object.freeze({ ...field }) : undefined;
  const fingerprint = JSON.stringify({ version: MLG_TIME_POLICY_VERSION, sourceId: input.sourceId,
    validationRevision: input.validationRevision, source: recorded ? 'recorded-time' : 'header-clock',
    reason: reason ?? 'validated-recorded-time', field: descriptor, originIndex: recorded ? originIndex : undefined,
    originSeconds: recorded ? originSeconds : undefined });
  return { status: 'candidate', candidate: Object.freeze({ source: recorded ? 'recorded-time' : 'header-clock',
    reason: reason ?? 'validated-recorded-time', fingerprint, headerTimeMs, recordedValues: input.recordedValues,
    field: descriptor, timeMs, timeEligible, originIndex: recorded ? originIndex : undefined,
    originSeconds: recorded ? originSeconds : undefined, trustedStartMs: start, trustedEndMs: end }) };
}
