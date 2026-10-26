export type MlgFormatErrorCode =
  | 'truncated-header'
  | 'invalid-magic'
  | 'unsupported-version'
  | 'invalid-header-offset'
  | 'descriptor-range-out-of-bounds'
  | 'unsupported-field-type'
  | 'unsupported-block-type'
  | 'invalid-bit-field'
  | 'record-length-mismatch'
  | 'short-read';

export class MlgFormatError extends Error {
  public readonly code: MlgFormatErrorCode;
  public readonly offset: number | undefined;

  public constructor(
    code: MlgFormatErrorCode,
    message: string,
    offset?: number,
  ) {
    super(message);
    this.name = 'MlgFormatError';
    this.code = code;
    this.offset = offset;
  }
}

/** Worker messages preserve semantic format errors without parsing human-readable text. */
export function isMlgFormatErrorCode(value: unknown): value is MlgFormatErrorCode {
  return typeof value === 'string' && [
    'truncated-header', 'invalid-magic', 'unsupported-version', 'invalid-header-offset',
    'descriptor-range-out-of-bounds', 'unsupported-field-type', 'unsupported-block-type',
    'invalid-bit-field', 'record-length-mismatch', 'short-read',
  ].includes(value);
}
