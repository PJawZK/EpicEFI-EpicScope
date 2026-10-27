import { describe, expect, it } from 'vitest';
import { MemoryByteSource } from '../../core/parsers/byte-source';
import { parseMlg } from '../../core/parsers/mlg/mlg-parser';
import { analyzeIdleStability } from '../../core/analysis/idle-stability';
import { discoverIdleCandidates } from '../../core/analysis/idle-regions';
import { IDLE_CONTRACT_RECORDS, idleContractMlg } from '../fixtures/idle/mlg-contract';
const parse = (bytes: Uint8Array, recover = false) => parseMlg(new MemoryByteSource(bytes), { id: 'idle-contract', displayName: 'generated-idle-contract.mlg', format: 'MLG', sizeBytes: bytes.length }, { incompleteTail: recover ? 'retain-complete-records' : 'reject' });
describe('canonical MLG → native Idle contract',()=>{
  it('keeps retry attempts, CRC exclusions, counter gaps and wrapped times on the original statistics grid',async()=>{
    const parsed=await parse(idleContractMlg(IDLE_CONTRACT_RECORDS));
    const rpm=await parsed.channelData.readChannelRange('mlg:0',0,7);
    expect([...rpm.timeMs]).toEqual([0,.1,.1,.2,.3,.4,.5]);expect([...rpm.validity]).toEqual([1,0,1,1,1,0,1]);
    expect([...rpm.values]).toEqual([900,1000,1000,1100,1200,1300,900]);
    expect(parsed.summary.diagnostics.map(d=>d.code)).toEqual(expect.arrayContaining(['mlg-crc-retry-recovered','mlg-crc-mismatch','mlg-counter-discontinuity']));
    const target={...rpm,values:new Float64Array(7).fill(1000),validity:new Uint8Array(7).fill(1)};
    const result=analyzeIdleStability(rpm,target,{complete:true});
    expect([...result.sampleIndices]).toEqual([0,1,2,3,4,5,6]);expect(result.analysis.rpm.inputSampleCount).toBe(7);expect(result.analysis.rpm.invalidSampleCount).toBe(2);
    expect(result.analysis.rpm.validSampleCount).toBe(5);expect(result.analysis.rpm.mean).toBe(1020);expect(result.analysis.rpm.standardDeviation).toBeCloseTo(Math.sqrt(17000));
    expect(result.analysis.tracking?.sampleCount).toBe(5);expect(result.analysis.tracking?.meanError).toBe(20);expect(result.analysis.tracking?.rmse).toBeCloseTo(Math.sqrt(14000));expect(result.inBandPercent).toBe(20);expect(result.analysis.sagEvents).toEqual([]);
  });
  it('never turns an incomplete physical tail into an Idle sample or repairs it silently',async()=>{
    const bytes=idleContractMlg(IDLE_CONTRACT_RECORDS,true);
    await expect(parse(bytes)).rejects.toMatchObject({code:'short-read'});
    const parsed=await parse(bytes,true),rpm=await parsed.channelData.readChannelRange('mlg:0',0,7);
    expect(parsed.recordIndex.offsets.length).toBe(7);expect(rpm.values.length).toBe(7);
    expect(parsed.summary.diagnostics).toContainEqual(expect.objectContaining({code:'mlg-incomplete-tail',sourceIntegrity:{kind:'delivery-loss',breaksContinuity:true}}));
    expect(analyzeIdleStability(rpm,undefined,{complete:true}).analysis.rpm.validSampleCount).toBe(5);
  });
  it('preserves a small backward timestamp as a regression rather than silently treating it as wrap',async()=>{
    const parsed=await parse(idleContractMlg([{counter:0,timestamp:100,rpm:900},{counter:1,timestamp:90,rpm:900}]));
    const rpm=await parsed.channelData.readChannelRange('mlg:0',0,2);
    expect(rpm.timeMs[1]).toBeCloseTo(-.1);expect(rpm.validity[1]).toBe(1);
    expect(discoverIdleCandidates(rpm,{maximumRpm:1200,minimumDurationMs:1,maximumGapMs:100}).regions).toEqual([]);
  });
  it('breaks discovery at an actual supplied time regression without inventing continuous event recovery',()=>{
    const rpm={startSampleIndex:20,timeMs:Float64Array.from([0,100,50,150]),values:new Float64Array(4).fill(900),validity:new Uint8Array(4).fill(1)};
    const candidates=discoverIdleCandidates(rpm,{maximumRpm:1200,minimumDurationMs:50,maximumGapMs:200});
    expect(candidates.regions.map(r=>[r.startSampleIndex,r.endSampleIndex])).toEqual([[20,21],[22,23]]);
    expect(analyzeIdleStability(rpm,undefined).analysis.sagEvents).toEqual([]);
  });
});
