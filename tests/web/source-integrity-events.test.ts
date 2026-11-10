import { describe, expect, it } from 'vitest';
import { sourceIntegrityMarkersFromDiagnostics } from '../../apps/web/src/app/source-integrity-markers';

describe('sourceIntegrityMarkersFromDiagnostics', () => {
  it('groups repeated retry artifacts at one timestamp and keeps unrecovered corruption separate', () => {
    const markers = sourceIntegrityMarkersFromDiagnostics([
      {
        code: 'mlg-crc-retry-recovered',
        severity: 'info',
        message: 'retry 1',
        recoverable: true,
        timeMs: 100,
        sourceIntegrity: { kind: 'recovered-retry', breaksContinuity: false },
      },
      {
        code: 'mlg-crc-retry-recovered',
        severity: 'info',
        message: 'retry 2',
        recoverable: true,
        timeMs: 100,
        sourceIntegrity: { kind: 'recovered-retry', breaksContinuity: false },
      },
      {
        code: 'mlg-crc-mismatch',
        severity: 'warning',
        message: 'bad source record',
        recoverable: true,
        timeMs: 250,
        sourceIntegrity: { kind: 'corrupt-record', breaksContinuity: true },
      },
    ]);

    expect(markers).toEqual([
      {
        timeMs: 100,
        kind: 'recovered-retry',
        breaksContinuity: false,
        count: 2,
        message: 'retry 1',
      },
      {
        timeMs: 250,
        kind: 'corrupt-record',
        breaksContinuity: true,
        count: 1,
        message: 'bad source record',
      },
    ]);
  });
});

import {sourceIntegrityDisplayClusters} from '../../apps/web/src/app/source-integrity-markers';
describe('source-marker presentation clustering',()=>{
 it('keeps source timestamps and semantic kinds while bounding icons by pixel bins',()=>{
  const markers=Array.from({length:10000},(_,i)=>({timeMs:i,kind:'corrupt-record' as const,breaksContinuity:true,count:1,message:'CRC'}));
  const clusters=sourceIntegrityDisplayClusters(markers,0,10000,800);expect(clusters.length).toBeLessThanOrEqual(40);expect(clusters.reduce((n,m)=>n+m.count,0)).toBe(10000);expect(clusters[0]?.timeMs).toBe(0);expect(clusters[0]?.message).toContain('source diagnostic groups clustered');
  expect(sourceIntegrityDisplayClusters([{...markers[0]!,kind:'recovered-retry',breaksContinuity:false}],0,10000,800)).toEqual([]);
 });
 it('does not merge unknown-cause timestamp diagnostics into corruption',()=>{
  const a={timeMs:10,kind:'corrupt-record' as const,breaksContinuity:true,count:1,message:'CRC'},b={...a,timeMs:11,kind:'timestamp-gap' as const,message:'Unknown cause'};
  expect(sourceIntegrityDisplayClusters([a,b],0,1000,100).map(m=>m.kind)).toEqual(['corrupt-record','timestamp-gap']);
 });
});

it('keeps a source-backed unavailable interval inspectable when its event anchor is outside a narrow viewport',()=>{
 const evidence={classification:'crc-exclusion' as const,fromRecordIndex:18,toRecordIndex:20,fromTimeMs:2598.22,toTimeMs:3171.1,durationMs:572.88,deltaMs:572.88,cadenceSampleCount:5,relatedCrcRecords:[19]};
 const markers=sourceIntegrityMarkersFromDiagnostics([{code:'mlg-crc-mismatch',severity:'warning',recoverable:true,message:'record 19 excluded',timeMs:2889.53,sourceIntegrity:{kind:'corrupt-record',breaksContinuity:true,evidence}}]);
 const visible=sourceIntegrityDisplayClusters(markers,2700,2800,800);expect(visible).toHaveLength(1);expect(visible[0]?.timeMs).toBe(2800);expect(visible[0]?.message).toContain('2889.53');expect(markers[0]?.timeMs).toBe(2889.53);
});
