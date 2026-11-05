import { describe, expect, it } from 'vitest';
import { analyzeIdleStability } from '../../core/analysis/idle-stability';
import { assessIdleStability } from '../../core/analysis/idle-stability-assessment';
import { presentIdleStabilityAssessment } from '../../apps/web/src/pages/idle-stability-assessment';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { summarizeIdlePurposes } from '../../core/analysis/idle-region-purpose';
const range=(values:number[]):NumericChannelRange=>({startSampleIndex:7,values:Float64Array.from(values),timeMs:Float64Array.from(values,(_,i)=>i*100),validity:new Uint8Array(values.length).fill(1)});
const assess=(rpm:number[],target?:number[],complete=true)=>assessIdleStability(analyzeIdleStability(range(rpm),target?range(target):undefined,{complete}));
describe('qualified descriptive Stability findings',()=>{
  it('makes empty/one-point/missing-target evidence unavailable or limited, never a tuning pass',()=>{
    expect(assess([],[])).toMatchObject({status:'unavailable',nextTest:'source',findings:['no-rpm']});
    const single=assess([900],[900]);expect(single.status).toBe('limited');expect(single.findings).not.toContain('within-band');expect(single.nextTest).toBe('longer-region');
    const missing=assess([900,910]);expect(missing.findings).toContain('missing-target');expect(missing.nextTest).toBe('target-mapping');expect(missing.facts.inBandPercent).toBeUndefined();
  });
  it('uses exact existing reference-band boundaries without universal good/bad thresholds',()=>{
    const boundary=assess([960,1040],[1000,1000]);expect(boundary.findings).toContain('within-band');expect(boundary.findings).not.toContain('mean-offset');expect(boundary.nextTest).toBe('repeat-baseline');
    const outside=assess([950,1050],[1000,1000]);expect(outside.findings).toContain('outside-band');expect(outside.facts.inBandPercent).toBe(0);expect(outside.nextTest).toBe('repeat-excursions');
    expect(outside.facts.sigma).toBeCloseTo(Math.sqrt(5000));expect(outside.facts.rmse).toBe(50);
  });
  it('distinguishes signed offset from variability and gives condition-matched tests',()=>{
    const high=assess([1100,1100],[1000,1000]);expect(high.facts.sigma).toBe(0);expect(high.facts.meanError).toBe(100);expect(high.nextTest).toBe('tracking-offset');
    expect(presentIdleStabilityAssessment(high).findings.find(f=>f.code==='mean-offset')?.text).toContain('above target');
    const low=assess([900,900],[1000,1000]);expect(low.facts.meanError).toBe(-100);expect(presentIdleStabilityAssessment(low).findings.find(f=>f.code==='mean-offset')?.text).toContain('below target');
  });
  it('prioritizes stopped-engine/mixed-target review without inventing automatic idle state',()=>{
    const stopped=assess([0,900],[900,900]);expect(stopped.status).toBe('scope-review');expect(stopped.nextTest).toBe('known-idle');expect(stopped.idleState).toBe('not-established');
    const mixed=assess([900,1200],[900,1200]);expect(mixed.findings).toContain('target-span');expect(mixed.nextTest).toBe('matched-target');
    expect(assess([900,901],[900,901]).findings).not.toContain('target-span');
  });
  it('reports invalid attempts without falsely declaring unrecovered physical loss',()=>{
    const rpm=range([900,9999,900]),target=range([900,900,900]);rpm.validity[1]=target.validity[1]=0;
    const result=assessIdleStability(analyzeIdleStability(rpm,target,{complete:true}));expect(result.findings).toContain('rejected-samples');expect(result.facts.paired).toBe(2);expect(result.status).toBe('recorded-region');
    expect(presentIdleStabilityAssessment(result).findings.find(f=>f.code==='rejected-samples')?.text).toContain('counts alone do not establish unrecovered data loss');
  });
  it('limits partial scope and incomplete target pairing with correct valid-pair denominators',()=>{
    expect(assess([900,900],[900,900],false)).toMatchObject({status:'limited',nextTest:'coverage'});
    const rpm=range([900,900,900]),target=range([900,900,900]);target.validity[1]=0;
    const result=assessIdleStability(analyzeIdleStability(rpm,target,{complete:true}));expect(result.status).toBe('limited');expect(result.nextTest).toBe('coverage');expect(result.facts.paired).toBe(2);expect(result.facts.inBandPercent).toBe(100);
  });
  it('does not read retained sample arrays when projecting findings or next tests',()=>{
    const result=analyzeIdleStability(range([900,900]),range([900,900]),{complete:true});
    Object.defineProperty(result,'error',{get(){throw Error('Scanned error array');}});Object.defineProperty(result,'sampleIndices',{get(){throw Error('Scanned indices');}});
    expect(assessIdleStability(result).nextTest).toBe('repeat-baseline');
  });
  it('does not treat nonfinite derived metrics as stable recorded evidence',()=>{
    const result=assess([1e308,-1e308],[0,0]);expect(result.findings).toContain('invalid-metrics');expect(result.status).toBe('limited');expect(result.nextTest).toBe('source');
  });
  it('uses the deduplicated analysis union, not the viewed or intervening region',()=>{
    const rpm=range([900,900,900,4000,900,900]),target=range([900,900,900,900,900,900]);
    const result=assessIdleStability(analyzeIdleStability(rpm,target,{complete:true,regions:[{startMs:0,endMs:200},{startMs:100,endMs:200},{startMs:400,endMs:500}]}));
    expect(result.facts.validRpm).toBe(5);expect(result.findings).toContain('within-band');expect(result.nextTest).toBe('repeat-baseline');
  });
  it('preserves numbers but suppresses steady-idle tracking conclusions for nonsteady and mixed purposes',()=>{
    const result=analyzeIdleStability(range([2000,2000]),range([900,900]),{complete:true});
    for(const purpose of ['raised','recovery','entry','mixed'] as const){
      const assessment=assessIdleStability(result,purpose);expect(assessment.purpose).toBe(purpose);expect(assessment.facts.rmse).toBe(1100);expect(assessment.facts.sigma).toBe(0);
      expect(assessment.findings).toContain('purpose-review');expect(assessment.findings).not.toContain('mean-offset');expect(assessment.findings).not.toContain('outside-band');expect(assessment.nextTest).toBe('purpose-test');expect(assessment.idleState).toBe('not-established');
      expect(presentIdleStabilityAssessment(assessment).purpose).toContain('not verified');
    }
    expect(presentIdleStabilityAssessment(assessIdleStability(result,'raised')).next).toContain('raised-RPM hold');
    expect(presentIdleStabilityAssessment(assessIdleStability(result,'recovery')).next).toContain('does not measure recovery time');
    expect(presentIdleStabilityAssessment(assessIdleStability(result,'entry')).next).toContain('does not measure entry');
    for(const purpose of ['idle','custom'] as const)expect(assessIdleStability(result,purpose).findings).toContain('mean-offset');
  });
  it('keeps source/coverage failures ahead of purpose guidance and never verifies declared idle',()=>{
    expect(assessIdleStability(analyzeIdleStability(range([]),undefined), 'raised').nextTest).toBe('source');
    expect(assessIdleStability(analyzeIdleStability(range([2000,2000]),range([900,900]),{complete:false}), 'raised').nextTest).toBe('coverage');
    const idle=assessIdleStability(analyzeIdleStability(range([900,900]),range([900,900])),'idle');expect(idle.idleState).toBe('not-established');
    expect(presentIdleStabilityAssessment(idle).purpose).toContain('user-declared');
    expect(summarizeIdlePurposes([])).toBe('custom');expect(summarizeIdlePurposes(['idle','idle'])).toBe('idle');expect(summarizeIdlePurposes(['idle','custom'])).toBe('mixed');expect(summarizeIdlePurposes(['recovery','raised'])).toBe('mixed');
  });
});
