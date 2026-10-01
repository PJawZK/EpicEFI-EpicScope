import type { ChannelDefinition } from '../../log-model/log-types';
import type { RandomAccessByteSource } from '../byte-source';
import { MlgFormatError } from './mlg-errors';
import {
  MLG_MAGIC,
  MLG_V1_FIELD_DESCRIPTOR_LENGTH,
  MLG_V1_FIXED_HEADER_LENGTH,
  MLG_V2_FIELD_DESCRIPTOR_LENGTH,
  MLG_V2_FIXED_HEADER_LENGTH,
  isMlgBitFieldType,
  isMlgScalarFieldType,
  mlgFieldWidthBytes,
  type MlgBitFieldDescriptor,
  type MlgFieldDescriptor,
  type MlgHeader,
  type MlgScalarFieldDescriptor,
  type MlgVersion,
} from './mlg-format';

export interface MlgHeaderParseResult {
  readonly header: MlgHeader;
  readonly fields: readonly MlgFieldDescriptor[];
  readonly channels: readonly ChannelDefinition[];
}

function decodeAsciiCString(bytes: Uint8Array): string {
  const zeroIndex = bytes.indexOf(0);
  const end = zeroIndex >= 0 ? zeroIndex : bytes.length;
  let value = '';

  for (let index = 0; index < end; index += 1) {
    value += String.fromCharCode(bytes[index] ?? 0);
  }

  return value;
}

async function readExact(
  source: RandomAccessByteSource,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  let bytes: Uint8Array;

  try {
    bytes = await source.read(offset, length);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new MlgFormatError(
        'short-read',
        `Unable to read ${length} bytes at offset ${offset}.`,
        offset,
      );
    }
    throw error;
  }

  if (bytes.byteLength !== length) {
    throw new MlgFormatError(
      'short-read',
      `Expected ${length} bytes at offset ${offset}, received ${bytes.byteLength}.`,
      offset,
    );
  }

  return bytes;
}

function hasMagic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < MLG_MAGIC.byteLength) {
    return false;
  }

  for (let index = 0; index < MLG_MAGIC.byteLength; index += 1) {
    if (bytes[index] !== MLG_MAGIC[index]) {
      return false;
    }
  }

  return true;
}

function normalizeChannel(field: MlgFieldDescriptor): ChannelDefinition {
  const valueType = field.kind === 'bitfield'
    ? 'bitfield'
    : field.type === 7
      ? 'number'
      : 'integer';

  return {
    id: `mlg:${field.index}`,
    sourceName: field.name,
    displayName: field.name,
    valueType,
    ...(field.units.length > 0 ? { unit: field.units } : {}),
    ...(field.category.length > 0 ? { category: field.category } : {}),
    ...(field.kind === 'scalar' ? { precision: field.digits } : {}),
  };
}

function parseDescriptor(
  bytes: Uint8Array,
  version: MlgVersion,
  index: number,
  offset: number,
  descriptorRegionEnd: number,
  dataBeginIndex: number,
): MlgFieldDescriptor {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rawType = view.getUint8(0);
  const name = decodeAsciiCString(bytes.subarray(1, 35));
  const units = decodeAsciiCString(bytes.subarray(35, 45));
  const displayStyle = view.getUint8(45);
  const category = version === 2
    ? decodeAsciiCString(bytes.subarray(55, 89))
    : '';

  if (isMlgScalarFieldType(rawType)) {
    const field: MlgScalarFieldDescriptor = {
      kind: 'scalar',
      index,
      offset,
      type: rawType,
      name,
      units,
      displayStyle,
      widthBytes: mlgFieldWidthBytes(rawType),
      category,
      scale: view.getFloat32(46, false),
      transform: view.getFloat32(50, false),
      digits: view.getInt8(54),
    };
    return field;
  }

  if (isMlgBitFieldType(rawType)) {
    const widthBytes = mlgFieldWidthBytes(rawType);
    const bitFieldNamesIndex = view.getUint32(47, false);
    const bits = view.getUint8(51);

    if (bits > widthBytes * 8) {
      throw new MlgFormatError(
        'invalid-bit-field',
        `Bit field ${index} declares ${bits} bits in ${widthBytes * 8}-bit storage.`,
        offset + 51,
      );
    }

    if (
      bitFieldNamesIndex !== 0
      && (bitFieldNamesIndex < descriptorRegionEnd || bitFieldNamesIndex >= dataBeginIndex)
    ) {
      throw new MlgFormatError(
        'invalid-bit-field',
        `Bit-field names index ${bitFieldNamesIndex} is outside the header data region.`,
        offset + 47,
      );
    }

    const field: MlgBitFieldDescriptor = {
      kind: 'bitfield',
      index,
      offset,
      type: rawType,
      name,
      units,
      displayStyle,
      widthBytes,
      category,
      bitFieldStyle: view.getUint8(46),
      bitFieldNamesIndex,
      bits,
    };
    return field;
  }

  throw new MlgFormatError(
    'unsupported-field-type',
    `Unsupported MLG field type ${rawType} at logger field ${index}.`,
    offset,
  );
}

export async function parseMlgHeader(
  source: RandomAccessByteSource,
): Promise<MlgHeaderParseResult> {
  if (source.size < 8) {
    throw new MlgFormatError(
      'truncated-header',
      'MLG source is too short to contain the format identity and version.',
      0,
    );
  }

  const identityBytes = await readExact(source, 0, 8);
  if (!hasMagic(identityBytes)) {
    throw new MlgFormatError('invalid-magic', 'Source does not begin with MLVLG\\0.', 0);
  }

  const identityView = new DataView(
    identityBytes.buffer,
    identityBytes.byteOffset,
    identityBytes.byteLength,
  );
  const rawVersion = identityView.getUint16(6, false);

  if (rawVersion !== 1 && rawVersion !== 2) {
    throw new MlgFormatError(
      'unsupported-version',
      `MLVLG format version ${rawVersion} is not supported by this parser.`,
      6,
    );
  }

  const version: MlgVersion = rawVersion;
  const fixedHeaderLength = version === 1
    ? MLG_V1_FIXED_HEADER_LENGTH
    : MLG_V2_FIXED_HEADER_LENGTH;
  const descriptorLength = version === 1
    ? MLG_V1_FIELD_DESCRIPTOR_LENGTH
    : MLG_V2_FIELD_DESCRIPTOR_LENGTH;

  if (source.size < fixedHeaderLength) {
    throw new MlgFormatError(
      'truncated-header',
      `MLVLG v${version} requires at least ${fixedHeaderLength} bytes for its fixed header.`,
      source.size,
    );
  }

  const fixedBytes = await readExact(source, 0, fixedHeaderLength);
  const view = new DataView(fixedBytes.buffer, fixedBytes.byteOffset, fixedBytes.byteLength);

  const logStartUnixSeconds = view.getUint32(8, false);
  const infoDataStart = version === 1
    ? view.getUint16(12, false)
    : view.getUint32(12, false);
  const dataBeginIndex = version === 1
    ? view.getUint32(14, false)
    : view.getUint32(16, false);
  const recordLength = version === 1
    ? view.getUint16(18, false)
    : view.getUint16(20, false);
  const loggerFieldCount = version === 1
    ? view.getUint16(20, false)
    : view.getUint16(22, false);
  const loggerFieldsStart = fixedHeaderLength;

  const maxDescriptorsByFile = Math.floor(
    Math.max(0, source.size - loggerFieldsStart) / descriptorLength,
  );
  if (loggerFieldCount > maxDescriptorsByFile) {
    throw new MlgFormatError(
      'descriptor-range-out-of-bounds',
      `Logger field count ${loggerFieldCount} cannot fit inside a ${source.size}-byte source.`,
      loggerFieldsStart,
    );
  }

  const descriptorRegionEnd = loggerFieldsStart + loggerFieldCount * descriptorLength;

  if (dataBeginIndex < descriptorRegionEnd || dataBeginIndex > source.size) {
    throw new MlgFormatError(
      'invalid-header-offset',
      `Data begin index ${dataBeginIndex} is outside the valid range ${descriptorRegionEnd}..${source.size}.`,
      version === 1 ? 14 : 16,
    );
  }

  if (
    infoDataStart !== 0
    && (infoDataStart < descriptorRegionEnd || infoDataStart > dataBeginIndex)
  ) {
    throw new MlgFormatError(
      'invalid-header-offset',
      `Info-data start ${infoDataStart} is outside the header data region.`,
      12,
    );
  }

  const fields: MlgFieldDescriptor[] = [];
  let computedRecordLength = 0;

  for (let index = 0; index < loggerFieldCount; index += 1) {
    const offset = loggerFieldsStart + index * descriptorLength;
    const descriptorBytes = await readExact(source, offset, descriptorLength);
    const field = parseDescriptor(
      descriptorBytes,
      version,
      index,
      offset,
      descriptorRegionEnd,
      dataBeginIndex,
    );
    fields.push(field);
    computedRecordLength += field.widthBytes;
  }

  if (computedRecordLength !== recordLength) {
    throw new MlgFormatError(
      'record-length-mismatch',
      `Header record length ${recordLength} does not match logger-field width ${computedRecordLength}.`,
      version === 1 ? 18 : 20,
    );
  }

  const header: MlgHeader = {
    version,
    logStartUnixSeconds,
    infoDataStart,
    dataBeginIndex,
    recordLength,
    loggerFieldCount,
    loggerFieldsStart,
    loggerFieldDescriptorLength: descriptorLength,
  };

  return {
    header,
    fields,
    channels: fields.map(normalizeChannel),
  };
}
