import { describe, expect, it } from 'vitest';

import { MemoryByteSource, type RandomAccessByteSource } from '../../core/parsers/byte-source';
import { parseMlgHeader } from '../../core/parsers/mlg/mlg-header';
import {
  calculateMlgRecordChecksum,
  scanMlgRecords,
  validateMlgRecordCrc,
} from '../../core/parsers/mlg/mlg-records';
import { createScalarHeaderFixture } from './mlg-fixture-builder';

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function loggerBlock(
  counter: number,
  timestamp: number,
  record: readonly number[],
  crcOverride?: number,
): Uint8Array {
  const result = new Uint8Array(4 + record.length + 1);
  const view = new DataView(result.buffer);
  result[0] = 0;
  result[1] = counter;
  view.setUint16(2, timestamp, false);
  result.set(record, 4);
  const crc = record.reduce((sum, value) => (sum + value) & 0xff, 0);
  result[result.length - 1] = crcOverride ?? crc;
  return result;
}

function markerBlock(counter: number, timestamp: number, message: string): Uint8Array {
  const result = new Uint8Array(54);
  const view = new DataView(result.buffer);
  result[0] = 1;
  result[1] = counter;
  view.setUint16(2, timestamp, false);
  const encoded = new TextEncoder().encode(message);
  result.set(encoded.subarray(0, 49), 4);
  return result;
}

class CountingByteSource implements RandomAccessByteSource {
  readonly size: number;
  readCount = 0;
  private readonly source: MemoryByteSource;

  constructor(bytes: Uint8Array) {
    this.source = new MemoryByteSource(bytes);
    this.size = this.source.size;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    this.readCount += 1;
    return this.source.read(offset, length);
  }
}

async function parseAndScan(bytes: Uint8Array) {
  const source = new MemoryByteSource(bytes);
  const parsed = await parseMlgHeader(source);
  return scanMlgRecords(source, parsed.header);
}

describe('scanMlgRecords', () => {
  it('builds a compact index and unwraps the 16-bit 10us timestamp', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const bytes = concat(
      header,
      loggerBlock(7, 65_530, [10]),
      loggerBlock(8, 4, [20]),
      loggerBlock(9, 14, [30]),
    );

    const result = await parseAndScan(bytes);

    expect([...result.records.counters]).toEqual([7, 8, 9]);
    expect([...result.records.crcValid]).toEqual([1, 1, 1]);
    expect([...result.records.timeMs]).toEqual([0, 0.1, 0.2]);
    expect(result.records.offsets).toHaveLength(3);
    expect(result.performance.scanMode).toBe('fixed');
    expect(result.diagnostics).toEqual([]);
  });

  it('extracts fixed-length marker messages', async () => {
    const header = createScalarHeaderFixture({ version: 1, type: 0 });
    const bytes = concat(
      header,
      loggerBlock(1, 100, [1]),
      markerBlock(2, 110, 'boost starts'),
      loggerBlock(3, 120, [2]),
    );

    const result = await parseAndScan(bytes);

    expect(result.performance.scanMode).toBe('general');
    expect(result.markers).toEqual([{ timeMs: 0.1, label: 'boost starts' }]);
    expect([...result.records.timeMs]).toEqual([0, 0.2]);
  });

  it('reports checksum mismatches without discarding the record', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const bytes = concat(header, loggerBlock(1, 10, [4], 99));

    const result = await parseAndScan(bytes);

    expect([...result.records.crcValid]).toEqual([0]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'mlg-crc-mismatch',
      severity: 'warning',
      recoverable: true,
    }));
  });

  it('reports block-counter discontinuities as recoverable warnings', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const bytes = concat(
      header,
      loggerBlock(10, 10, [1]),
      loggerBlock(12, 20, [2]),
    );

    const result = await parseAndScan(bytes);

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'mlg-counter-discontinuity',
      severity: 'warning',
      recoverable: true,
    }));
  });

  it('rejects unknown block types because their length is not trustworthy', async () => {
    const header = createScalarHeaderFixture({ version: 1, type: 0 });
    const unknown = Uint8Array.from([9, 1, 0, 1, 0]);
    const bytes = concat(header, unknown);

    await expect(parseAndScan(bytes)).rejects.toMatchObject({
      code: 'unsupported-block-type',
    });
  });

  it('rejects truncated logger records rather than fabricating bytes', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const truncated = Uint8Array.from([0, 1, 0, 1]);
    const bytes = concat(header, truncated);

    await expect(parseAndScan(bytes)).rejects.toMatchObject({
      code: 'short-read',
    });
  });

  it('rejects truncated markers', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const truncated = Uint8Array.from([1, 1, 0, 1, 65, 66]);
    const bytes = concat(header, truncated);

    await expect(parseAndScan(bytes)).rejects.toMatchObject({
      code: 'short-read',
    });
  });
  it('scans many records with one bounded source read when they fit one scan chunk', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const recordCount = 100_000;
    const blockLength = 6;
    const bytes = new Uint8Array(header.byteLength + recordCount * blockLength);
    bytes.set(header, 0);

    for (let index = 0; index < recordCount; index += 1) {
      const offset = header.byteLength + index * blockLength;
      bytes[offset] = 0;
      bytes[offset + 1] = index & 0xff;
      const timestamp = index & 0xffff;
      bytes[offset + 2] = (timestamp >>> 8) & 0xff;
      bytes[offset + 3] = timestamp & 0xff;
      bytes[offset + 4] = index & 0xff;
      bytes[offset + 5] = index & 0xff;
    }

    const source = new CountingByteSource(bytes);
    const parsed = await parseMlgHeader(source);
    source.readCount = 0;
    const result = await scanMlgRecords(source, parsed.header);

    expect(result.records.offsets).toHaveLength(recordCount);
    expect(source.readCount).toBe(1);
  });
});


describe('fixed-record checksum fast path', () => {
  it('sums a wide non-aligned payload identically to the reference checksum', () => {
    const payload = Uint8Array.from(
      { length: 4_390 },
      (_, index) => (index * 37 + 11) & 0xff,
    );
    const reference = [...payload].reduce((sum, value) => (sum + value) & 0xff, 0);

    expect(calculateMlgRecordChecksum(payload, 0, payload.byteLength)).toBe(reference);
    expect(calculateMlgRecordChecksum(payload, 13, 4_321)).toBe(
      [...payload.subarray(13, 13 + 4_321)]
        .reduce((sum, value) => (sum + value) & 0xff, 0),
    );
  });
});


describe('staged CRC validation', () => {
  it('indexes a bad-CRC record as provisionally usable, then validates it separately', async () => {
    const headerBytes = createScalarHeaderFixture({ version: 2, type: 0 });
    const bytes = concat(headerBytes, loggerBlock(1, 10, [4], 99));
    const source = new MemoryByteSource(bytes);
    const parsed = await parseMlgHeader(source);

    const indexed = await scanMlgRecords(source, parsed.header, { validateCrc: false });
    expect([...indexed.records.crcValid]).toEqual([1]);
    expect(indexed.diagnostics.some((item) => item.code === 'mlg-crc-mismatch')).toBe(false);

    const validated = await validateMlgRecordCrc(source, parsed.header, indexed.records);
    expect([...validated.crcValid]).toEqual([0]);
    expect(validated.diagnostics).toContainEqual(expect.objectContaining({
      code: 'mlg-crc-mismatch',
      severity: 'warning',
    }));
  });
});


describe('explicit complete-prefix tail recovery', () => {
  async function scan(bytes: Uint8Array, recover = true) {
    const source = new MemoryByteSource(bytes);
    const {header} = await parseMlgHeader(source);
    return scanMlgRecords(source, header, {incompleteTail: recover ? 'retain-complete-records' : 'reject'});
  }
  it.each([1,2,3,4,5])('excludes a %i-byte partial final logger block with exact metadata; strict still rejects', async length => {
    const header=createScalarHeaderFixture({version:2,type:0}),block=loggerBlock(0,100,[7]),tail=loggerBlock(1,200,[8]).slice(0,length),bytes=concat(header,block,tail),original=bytes.slice();
    const result=await scan(bytes);
    expect([...result.records.offsets]).toEqual([header.length]);expect([...result.records.crcValid]).toEqual([1]);expect(result.records.timeMs.length).toBe(1);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({code:'mlg-incomplete-tail',severity:'warning',offset:header.length+block.length,sourceIntegrity:{kind:'delivery-loss',breaksContinuity:true},incompleteTail:{kind:length<4?'block-header':'logger-record',actualBytes:length,expectedBytes:length<4?4:6,missingBytes:(length<4?4:6)-length}}));
    expect(bytes).toEqual(original);await expect(scan(bytes,false)).rejects.toMatchObject({code:'short-read'});
  });
  it('retains prior complete markers, excludes an incomplete marker, and does not invent a sample/time',async()=>{
    const header=createScalarHeaderFixture({version:2,type:0}),block=loggerBlock(0,100,[7]),marker=markerBlock(1,110,'complete'),tail=markerBlock(2,120,'partial').slice(0,20);
    const result=await scan(concat(header,block,marker,tail));expect(result.records.offsets.length).toBe(1);expect(result.markers).toHaveLength(1);expect(result.markers[0]!.label).toBe('complete');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({code:'mlg-incomplete-tail',incompleteTail:{kind:'marker',actualBytes:20,expectedBytes:54,missingBytes:34}}));
  });
  it('rejects tails without a complete logger record and unknown block types even in recovery mode',async()=>{
    const header=createScalarHeaderFixture({version:2,type:0});
    await expect(scan(concat(header,loggerBlock(0,100,[7]).slice(0,4)))).rejects.toMatchObject({code:'short-read'});
    await expect(scan(concat(header,markerBlock(0,100,'marker'),new Uint8Array([0,1,0,1])))).rejects.toMatchObject({code:'short-read'});
    await expect(scan(concat(header,loggerBlock(0,100,[7]),new Uint8Array([9,1,0,1])))).rejects.toMatchObject({code:'unsupported-block-type'});
  });
  it('rejects unknown EOF types even with an incomplete header, including at a scan-chunk boundary',async()=>{
    const header=createScalarHeaderFixture({version:2,type:0});
    for(const tail of [new Uint8Array([9]),new Uint8Array([9,0,0])])await expect(scan(concat(header,loggerBlock(0,100,[7]),tail))).rejects.toMatchObject({code:'unsupported-block-type'});
    const blockLength=65536,count=128,bytes=new Uint8Array(blockLength*count+1);
    for(let i=0;i<count;i++)bytes[i*blockLength+1]=i;
    const modelHeader=(await parseMlgHeader(new MemoryByteSource(header))).header;
    const options={incompleteTail:'retain-complete-records' as const};
    const recovered=await scanMlgRecords(new MemoryByteSource(bytes),{...modelHeader,dataBeginIndex:0,recordLength:blockLength-5},options);
    expect(recovered.records.offsets.length).toBe(count);
    bytes[bytes.length-1]=9;
    await expect(scanMlgRecords(new MemoryByteSource(bytes),{...modelHeader,dataBeginIndex:0,recordLength:blockLength-5},options)).rejects.toMatchObject({code:'unsupported-block-type'});
  });
  it('retains previous CRC exclusions and complete input remains warning-free',async()=>{
    const header=createScalarHeaderFixture({version:2,type:0}),bad=loggerBlock(0,100,[7],8),good=loggerBlock(1,200,[8]);
    const result=await scan(concat(header,bad,good,new Uint8Array([0,2,1,0])));expect([...result.records.crcValid]).toEqual([0,1]);expect(result.diagnostics.some(d=>d.code==='mlg-crc-mismatch')).toBe(true);
    const complete=await scan(concat(header,good));expect(complete.diagnostics.some(d=>d.code==='mlg-incomplete-tail')).toBe(false);
  });
  it('does not treat a short backing-source read as an incomplete physical tail',async()=>{
    const bytes=concat(createScalarHeaderFixture({version:2,type:0}),loggerBlock(0,100,[7]),new Uint8Array([0,1,0,2])),source=new MemoryByteSource(bytes),{header}=await parseMlgHeader(source);
    await expect(scanMlgRecords({size:bytes.length,read:async(offset,length)=>(await source.read(offset,length)).slice(0,-1)},header,{incompleteTail:'retain-complete-records'})).rejects.toMatchObject({code:'short-read'});
  });
  it('refills across scan chunks before diagnosing only physical EOF',async()=>{
    const length=65000,blockLength=length+5,count=130,bytes=new Uint8Array(count*blockLength+4);
    for(let i=0;i<count;i++){bytes[i*blockLength]=0;bytes[i*blockLength+1]=i;}
    bytes.set([0,count,0,1],count*blockLength);
    const originalHeader=(await parseMlgHeader(new MemoryByteSource(createScalarHeaderFixture({version:2,type:0})))).header;
    const result=await scanMlgRecords(new MemoryByteSource(bytes),{...originalHeader,dataBeginIndex:0,recordLength:length},{incompleteTail:'retain-complete-records'});
    expect(result.records.offsets.length).toBe(count);expect(result.records.offsets[count-1]).toBe((count-1)*blockLength);expect(result.diagnostics.filter(d=>d.code==='mlg-incomplete-tail')).toHaveLength(1);
  });
});
