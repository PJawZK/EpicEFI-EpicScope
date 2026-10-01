export const MLG_MAGIC = Uint8Array.from([0x4d, 0x4c, 0x56, 0x4c, 0x47, 0x00]);

export type MlgVersion = 1 | 2;
export type MlgScalarFieldType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type MlgBitFieldType = 10 | 11 | 12;
export type MlgFieldType = MlgScalarFieldType | MlgBitFieldType;

export const MLG_V1_FIXED_HEADER_LENGTH = 22;
export const MLG_V2_FIXED_HEADER_LENGTH = 24;
export const MLG_V1_FIELD_DESCRIPTOR_LENGTH = 55;
export const MLG_V2_FIELD_DESCRIPTOR_LENGTH = 89;

export interface MlgHeader {
  readonly version: MlgVersion;
  readonly logStartUnixSeconds: number;
  readonly infoDataStart: number;
  readonly dataBeginIndex: number;
  readonly recordLength: number;
  readonly loggerFieldCount: number;
  readonly loggerFieldsStart: number;
  readonly loggerFieldDescriptorLength: number;
}

interface MlgFieldDescriptorBase {
  readonly index: number;
  readonly offset: number;
  readonly type: MlgFieldType;
  readonly name: string;
  readonly units: string;
  readonly displayStyle: number;
  readonly widthBytes: number;
  readonly category: string;
}

export interface MlgScalarFieldDescriptor extends MlgFieldDescriptorBase {
  readonly kind: 'scalar';
  readonly type: MlgScalarFieldType;
  readonly scale: number;
  readonly transform: number;
  readonly digits: number;
}

export interface MlgBitFieldDescriptor extends MlgFieldDescriptorBase {
  readonly kind: 'bitfield';
  readonly type: MlgBitFieldType;
  readonly bitFieldStyle: number;
  readonly bitFieldNamesIndex: number;
  readonly bits: number;
}

export type MlgFieldDescriptor = MlgScalarFieldDescriptor | MlgBitFieldDescriptor;

export function isMlgScalarFieldType(type: number): type is MlgScalarFieldType {
  return type >= 0 && type <= 7;
}

export function isMlgBitFieldType(type: number): type is MlgBitFieldType {
  return type === 10 || type === 11 || type === 12;
}

export function mlgFieldWidthBytes(type: MlgFieldType): number {
  switch (type) {
    case 0:
    case 1:
    case 10:
      return 1;
    case 2:
    case 3:
    case 11:
      return 2;
    case 4:
    case 5:
    case 7:
    case 12:
      return 4;
    case 6:
      return 8;
  }
}
