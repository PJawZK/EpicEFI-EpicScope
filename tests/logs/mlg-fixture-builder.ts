import {
  MLG_MAGIC,
  MLG_V1_FIELD_DESCRIPTOR_LENGTH,
  MLG_V1_FIXED_HEADER_LENGTH,
  MLG_V2_FIELD_DESCRIPTOR_LENGTH,
  MLG_V2_FIXED_HEADER_LENGTH,
  mlgFieldWidthBytes,
  type MlgFieldType,
  type MlgVersion,
} from '../../core/parsers/mlg/mlg-format';

export interface ScalarFixtureOptions {
  readonly version: MlgVersion;
  readonly type?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly name?: string;
  readonly units?: string;
  readonly category?: string;
  readonly scale?: number;
  readonly transform?: number;
  readonly digits?: number;
  readonly recordLength?: number;
}

export interface BitFieldFixtureOptions {
  readonly version: MlgVersion;
  readonly type?: 10 | 11 | 12;
  readonly name?: string;
  readonly units?: string;
  readonly category?: string;
  readonly bits?: number;
  readonly bitFieldNamesIndex?: number;
  readonly recordLength?: number;
}

function writeAscii(target: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = new TextEncoder().encode(value);
  const copyLength = Math.min(bytes.byteLength, Math.max(0, length - 1));
  target.set(bytes.subarray(0, copyLength), offset);
}

function writeCommonHeader(
  bytes: Uint8Array,
  version: MlgVersion,
  recordLength: number,
): { descriptorOffset: number; descriptorLength: number } {
  bytes.set(MLG_MAGIC, 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(6, version, false);
  view.setUint32(8, 1_700_000_000, false);

  const descriptorOffset = version === 1
    ? MLG_V1_FIXED_HEADER_LENGTH
    : MLG_V2_FIXED_HEADER_LENGTH;
  const descriptorLength = version === 1
    ? MLG_V1_FIELD_DESCRIPTOR_LENGTH
    : MLG_V2_FIELD_DESCRIPTOR_LENGTH;
  const dataBeginIndex = descriptorOffset + descriptorLength;

  if (version === 1) {
    view.setUint16(12, 0, false);
    view.setUint32(14, dataBeginIndex, false);
    view.setUint16(18, recordLength, false);
    view.setUint16(20, 1, false);
  } else {
    view.setUint32(12, 0, false);
    view.setUint32(16, dataBeginIndex, false);
    view.setUint16(20, recordLength, false);
    view.setUint16(22, 1, false);
  }

  return { descriptorOffset, descriptorLength };
}

export function createScalarHeaderFixture(options: ScalarFixtureOptions): Uint8Array {
  const type = options.type ?? 2;
  const descriptorOffset = options.version === 1
    ? MLG_V1_FIXED_HEADER_LENGTH
    : MLG_V2_FIXED_HEADER_LENGTH;
  const descriptorLength = options.version === 1
    ? MLG_V1_FIELD_DESCRIPTOR_LENGTH
    : MLG_V2_FIELD_DESCRIPTOR_LENGTH;
  const bytes = new Uint8Array(descriptorOffset + descriptorLength);
  const width = mlgFieldWidthBytes(type);
  const common = writeCommonHeader(bytes, options.version, options.recordLength ?? width);
  const view = new DataView(bytes.buffer);

  view.setUint8(common.descriptorOffset, type);
  writeAscii(bytes, common.descriptorOffset + 1, 34, options.name ?? 'RPM');
  writeAscii(bytes, common.descriptorOffset + 35, 10, options.units ?? 'rpm');
  view.setUint8(common.descriptorOffset + 45, 0);
  view.setFloat32(common.descriptorOffset + 46, options.scale ?? 1, false);
  view.setFloat32(common.descriptorOffset + 50, options.transform ?? 0, false);
  view.setInt8(common.descriptorOffset + 54, options.digits ?? 0);

  if (options.version === 2) {
    writeAscii(bytes, common.descriptorOffset + 55, 34, options.category ?? 'Engine');
  }

  return bytes;
}

export function createBitFieldHeaderFixture(options: BitFieldFixtureOptions): Uint8Array {
  const type = options.type ?? 10;
  const descriptorOffset = options.version === 1
    ? MLG_V1_FIXED_HEADER_LENGTH
    : MLG_V2_FIXED_HEADER_LENGTH;
  const descriptorLength = options.version === 1
    ? MLG_V1_FIELD_DESCRIPTOR_LENGTH
    : MLG_V2_FIELD_DESCRIPTOR_LENGTH;
  const bytes = new Uint8Array(descriptorOffset + descriptorLength);
  const width = mlgFieldWidthBytes(type);
  const common = writeCommonHeader(bytes, options.version, options.recordLength ?? width);
  const view = new DataView(bytes.buffer);

  view.setUint8(common.descriptorOffset, type);
  writeAscii(bytes, common.descriptorOffset + 1, 34, options.name ?? 'status');
  writeAscii(bytes, common.descriptorOffset + 35, 10, options.units ?? '');
  view.setUint8(common.descriptorOffset + 45, 2);
  view.setUint8(common.descriptorOffset + 46, 4);
  view.setUint32(common.descriptorOffset + 47, options.bitFieldNamesIndex ?? 0, false);
  view.setUint8(common.descriptorOffset + 51, options.bits ?? width * 8);

  if (options.version === 2) {
    writeAscii(bytes, common.descriptorOffset + 55, 34, options.category ?? 'Status');
  }

  return bytes;
}

export function createIdentityFixture(version: number): Uint8Array {
  const bytes = new Uint8Array(8);
  bytes.set(MLG_MAGIC, 0);
  new DataView(bytes.buffer).setUint16(6, version, false);
  return bytes;
}

export function setLoggerFieldCount(bytes: Uint8Array, version: MlgVersion, count: number): void {
  new DataView(bytes.buffer).setUint16(version === 1 ? 20 : 22, count, false);
}

export function setFieldType(bytes: Uint8Array, version: MlgVersion, type: number): void {
  const descriptorOffset = version === 1
    ? MLG_V1_FIXED_HEADER_LENGTH
    : MLG_V2_FIXED_HEADER_LENGTH;
  new DataView(bytes.buffer).setUint8(descriptorOffset, type);
}

export function fieldWidth(type: MlgFieldType): number {
  return mlgFieldWidthBytes(type);
}
