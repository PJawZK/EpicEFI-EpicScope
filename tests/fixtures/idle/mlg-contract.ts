import { createScalarHeaderFixture } from '../../logs/mlg-fixture-builder';

/** Generated public test bytes only; production parser/decoder remains authoritative. */
export function idleContractMlg(records: readonly { counter: number; timestamp: number; rpm: number; valid?: boolean }[], incompleteTail = false) {
  const header = createScalarHeaderFixture({ version: 2, type: 2, name: 'RPM', units: 'RPM', scale: 1, transform: 0 });
  const bytes = new Uint8Array(header.length + records.length * 7 + (incompleteTail ? 5 : 0));
  bytes.set(header);
  for (let index = 0; index < records.length; index++) {
    const record = records[index]!, offset = header.length + index * 7, view = new DataView(bytes.buffer);
    bytes[offset] = 0; bytes[offset + 1] = record.counter;
    view.setUint16(offset + 2, record.timestamp, false); view.setUint16(offset + 4, record.rpm, false);
    bytes[offset + 6] = (bytes[offset + 4]! + bytes[offset + 5]! + (record.valid === false ? 1 : 0)) & 255;
  }
  if (incompleteTail) bytes.set([0, 5, 0, 54, 3], header.length + records.length * 7);
  return bytes;
}
export const IDLE_CONTRACT_RECORDS = [
  { counter: 254, timestamp: 65530, rpm: 900 },
  { counter: 255, timestamp: 4, rpm: 1000, valid: false },
  { counter: 255, timestamp: 4, rpm: 1000 },
  { counter: 0, timestamp: 14, rpm: 1100 },
  { counter: 2, timestamp: 24, rpm: 1200 },
  { counter: 3, timestamp: 34, rpm: 1300, valid: false },
  { counter: 4, timestamp: 44, rpm: 900 },
] as const;
