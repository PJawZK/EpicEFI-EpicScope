import {describe,it,expect} from 'vitest';
import {analyzeIdleStability} from '../../core/analysis/idle-stability';
import {compareIdleStability,type IdleStabilityComparisonSide} from '../../core/analysis/idle-stability-comparison';
const side=(values:number[],target=true,complete=true):IdleStabilityComparisonSide=>{
 const range={startSampleIndex:100,timeMs:Float64Array.from(values,(_,i)=>i*100),values:Float64Array.from(values),validity:new Uint8Array(values.length).fill(1)};
 return{result:analyzeIdleStability(range,target?{...range,values:new Float64Array(values.length).fill(1000)}:undefined,{complete}),sourceName:'source.mlg',regions:[{startMs:0,endMs:(values.length-1)*100}],rpmChannel:'RPM',targetChannel:target?'Target':undefined,qualification:'off',qualificationDescription:'Off'};
};
describe('retained descriptive Idle Stability comparison',()=>{
 it('uses B minus A without reweighting or resampling unequal populations',()=>{
  const a=side([900,1000,1100]),b=side([1000,1000]);const facts=compareIdleStability(a,b);
  expect(facts.metrics.map(m=>m.delta)).toEqual([0,-100,-Math.sqrt(20000/3),100-100/3]);
  expect(facts.warnings[0]).toContain('do not establish improvement');
 });
 it('does not fabricate missing target metrics and retains independent RPM facts',()=>{
  const facts=compareIdleStability(side([900,1100]),side([1000,1000],false));
  expect(facts.metrics[0]!.delta).toBe(0);expect(facts.metrics[2]!).toMatchObject({b:undefined,delta:undefined,reason:'Missing or insufficient valid evidence'});
 });
 it('withholds all deltas on partial coverage or unmatched qualification',()=>{
  for(const b of [side([900,1000],true,false),{...side([900,1000]),qualification:'qualified' as const}]){
   const facts=compareIdleStability(side([900,1000]),b);expect(facts.metrics.every(m=>m.delta===undefined)).toBe(true);expect(facts.metrics[0]!.a).toBe(950);
  }
 });
 it('withholds band deltas when definitions differ without blocking other metrics',()=>{
  const a=side([1000,1000]),b=side([1000,1000]);const facts=compareIdleStability(a,{...b,result:{...b.result,settledBandRpm:50}});
  expect(facts.metrics[0]!.delta).toBe(0);expect(facts.metrics[3]!.reason).toBe('Different target bands');
 });
 it('preserves invalid denominators and refuses insufficient sigma',()=>{
  const a=side([NaN,1000]),b=side([1000,1000]);const facts=compareIdleStability(a,b);
  expect(a.result.analysis.rpm.invalidSampleCount).toBe(1);expect(facts.metrics[1]!.delta).toBeUndefined();expect(facts.metrics[0]!.delta).toBe(0);
 });
 it('does not inspect sample arrays or mutate retained source facts',()=>{
  const a=side([900,1000,1100]);const result={...a.result,sampleIndices:new Proxy(a.result.sampleIndices,{get(){throw Error('Must not scan');}})};
  expect(compareIdleStability({...a,result},a).metrics[0]!.delta).toBe(0);expect(a.result.analysis.rpm.mean).toBe(1000);
 });
});
