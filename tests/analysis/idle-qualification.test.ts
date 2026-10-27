import { describe, expect, it } from 'vitest';
import type { NumericChannelRange, ChannelDefinition } from '../../core/log-model/log-types';
import { qualifyIdleSamples, idleCoolantThreshold } from '../../core/analysis/idle-qualification';
import { qualifyNumericSamples } from '../../core/analysis/sample-qualification';
import { discoverIdleCandidates } from '../../core/analysis/idle-regions';
import { analyzeIdleStability } from '../../core/analysis/idle-stability';
import { buildIdleQualificationPlan, type IdleQualificationSettings } from '../../apps/web/src/pages/idle-qualification-plan';
import { createIdleRegionSession } from '../../apps/web/src/pages/idle-region-session';
import { idleQualificationRoleUnit } from '../../apps/web/src/pages/analyzer-channel-roles';
const range=(values: number[]):NumericChannelRange=>({startSampleIndex:10,values:Float64Array.from(values),timeMs:Float64Array.from(values,(_,i)=>i*100),validity:new Uint8Array(values.length).fill(1)});
const channel=(id:string,sourceName:string,unit:string):ChannelDefinition=>({id,sourceName,displayName:sourceName,unit,valueType:'number'});
const channels=[channel('rpm','RPMValue','RPM'),channel('clt','coolant','deg C'),channel('pedal','throttlePedalPosition','%'),channel('tps','TPSValue','%')];
const settings:IdleQualificationSettings={enabled:true,requireWarm:true,requireClosed:true,closedSource:'pedal',minimumCelsius:70,maximumPercent:3,maximumRpm:1200,manualBypass:false,ids:{coolant:'clt',pedal:'pedal',physicalTps:'tps'}};
const scope=[{startMs:0,endMs:500}];
const data=()=>new Map([['rpm',{range:range([1000,1000,1000,1000,1000,1000]),complete:true}],['clt',{range:range([69,70,80,90,90,90]),complete:true}],['pedal',{range:range([0,0,4,2,0,0]),complete:true}],['tps',{range:range([10,10,1,10,0,0]),complete:true}]]);
const evaluate=(s:IdleQualificationSettings,map=data(),regions=[])=>{
 const plan=buildIdleQualificationPlan(s,channels,'rpm',{kind:'full',manualId:undefined,regions});
 return qualifyIdleSamples({referenceId:'rpm',channels:map,conditions:plan.conditions,scope,bypass:plan.bypass});
};
describe('Idle recorded-condition qualification',()=>{
 it('uses inclusive warm/percent boundaries, preserves original indices and affects discovery and analysis equally',()=>{
  const map=data(),q=evaluate(settings,map);expect([...q.eligibility]).toEqual([0,1,0,1,1,1]);expect(q.eligible).toBe(4);expect(q.rejected).toBe(2);
  const rpm=map.get('rpm')!.range;const result=analyzeIdleStability(rpm,rpm,{eligibility:q.eligibility,complete:true});expect([...result.sampleIndices]).toEqual([11,13,14,15]);
  const candidates=discoverIdleCandidates(rpm,{maximumRpm:1200,minimumDurationMs:200,maximumGapMs:150,eligibility:q.eligibility});expect(candidates.regions[0]).toMatchObject({startSampleIndex:13,endSampleIndex:15});
 });
 it('never substitutes physical TPS for pedal position',()=>{
  expect([...evaluate({...settings,closedSource:'physicalTps'}).eligibility]).toEqual([0,0,1,0,1,1]);
  expect(idleQualificationRoleUnit(channels[3]!,'pedal')).toBeUndefined();expect(idleQualificationRoleUnit(channels[2]!,'physicalTps')).toBeUndefined();
  expect(idleQualificationRoleUnit(channel('x','DriverThrottleIntent','%'),'pedal')).toBeUndefined();
  expect(idleQualificationRoleUnit(channel('x','Commanded throttle position','%'),'physicalTps')).toBeUndefined();
 });
 it('requires declared compatible units and converts a Celsius threshold into Fahrenheit without rewriting arrays',()=>{
  expect(idleQualificationRoleUnit(channel('x','coolant',''),'coolant')).toBeUndefined();expect(idleQualificationRoleUnit(channel('x','coolant','K'),'coolant')).toBeUndefined();
  expect(idleQualificationRoleUnit(channel('x','intake temperature','deg C'),'coolant')).toBeUndefined();expect(idleCoolantThreshold(70,'°F')).toBe(158);
  const map=data();map.get('clt')!.range.values.set([156.2,158,176,194,194,194]);const original=map.get('clt')!.range.values.slice();
  const plan=buildIdleQualificationPlan(settings,[channels[0]!,channel('clt','coolant','°F'),...channels.slice(2)],'rpm',{kind:'full',manualId:undefined,regions:[]});
  expect(plan.conditions.find(c=>c.channelId==='clt')?.value).toBe(158);
  const q=qualifyIdleSamples({referenceId:'rpm',channels:map,conditions:plan.conditions,scope,bypass:[]});expect([...q.eligibility]).toEqual([0,1,0,1,1,1]);expect(map.get('clt')!.range.values).toEqual(original);
 });
 it('rejects misaligned/invalid/missing condition measurements rather than interpolating or assuming zero',()=>{
  const map=data();map.get('clt')!.range.timeMs[1]=101;map.get('pedal')!.range.validity[3]=0;
  const q=evaluate(settings,map);expect([...q.eligibility]).toEqual([0,0,0,0,1,1]);expect(q.invalid).toBe(2);
  map.delete('clt');expect(()=>evaluate(settings,map)).toThrow(/Missing qualification channel/);
  expect(()=>buildIdleQualificationPlan({...settings,ids:{...settings.ids,coolant:''}},channels,'rpm',{kind:'full',manualId:undefined,regions:[]})).toThrow(/Qualification unavailable/);
 });
 it('keeps shared index-only behavior opt-in compatible and scopes strict qualification by original indices',()=>{
  const map=data();map.get('clt')!.range.timeMs[1]=101;const req={referenceChannelId:'rpm',channels:map,conditions:[{channelId:'clt',operator:'gte' as const,value:70}],sampleIndices:Uint32Array.from([11,15])};
  expect(qualifyNumericSamples(req).eligibleSampleCount).toBe(2);const strict=qualifyNumericSamples({...req,requireTimeAlignment:true});expect([...strict.eligibleSampleIndices]).toEqual([15]);expect(strict.invalidSampleCount).toBe(1);
 });
 it('manual bypass is explicit, deduplicated, never bypasses RPM validity, and labels do not enable it',()=>{
  const s=createIdleRegionSession();s.bind({},0,{startMs:0,endMs:500});s.addCandidates([{startMs:0,endMs:300}]);const candidate=s.regions[0]!;s.include(candidate.id,true);
  s.edit(candidate.id,{startMs:0,endMs:300},'Only renamed');expect(s.regions[0]!.boundsEdited).toBe(false);
  const noBypass=buildIdleQualificationPlan({...settings,minimumCelsius:200,manualBypass:true},channels,'rpm',{kind:'regions',manualId:undefined,regions:s.regions});expect(noBypass.bypass).toEqual([]);
  s.add({startMs:200,endMs:500});const plan=buildIdleQualificationPlan({...settings,minimumCelsius:200,manualBypass:true},channels,'rpm',{kind:'regions',manualId:undefined,regions:s.regions});
  const map=data();map.get('rpm')!.range.validity[5]=0;const q=qualifyIdleSamples({referenceId:'rpm',channels:map,conditions:plan.conditions,scope,bypass:plan.bypass});expect([...q.eligibility]).toEqual([0,0,1,1,1,0]);expect(q.manualBypassed).toBe(3);expect(q.input).toBe(6);
  s.edit(candidate.id,{startMs:0,endMs:200},'Changed bounds');expect(s.regions[0]!.boundsEdited).toBe(true);
 });
 it('permits missing conditional inputs only for an entirely explicit manual-bypass scope, never for discovery',()=>{
  const s=createIdleRegionSession();s.bind({},0,{startMs:0,endMs:500});s.add({startMs:0,endMs:500});
  const missing={...settings,manualBypass:true,ids:{coolant:'',pedal:'',physicalTps:''}};
  const plan=buildIdleQualificationPlan(missing,channels,'rpm',{kind:'regions',manualId:undefined,regions:s.regions});expect(plan.bypass).toEqual(scope);
  expect(()=>buildIdleQualificationPlan(missing,channels,'rpm',{kind:'regions',manualId:undefined,regions:s.regions},true)).toThrow(/Qualification unavailable/);
 });
 it('Viewed qualification follows provenance, not inclusion, labels or purpose',()=>{
  const session=createIdleRegionSession();session.bind({},0,{startMs:0,endMs:500});session.addCandidates([{startMs:0,endMs:500}]);
  const candidate=session.regions[0]!;
  const missing={...settings,manualBypass:true,ids:{coolant:'',pedal:'',physicalTps:''}};
  const scope=()=>({kind:'viewed',manualId:undefined,viewedId:candidate.id,regions:session.regions});
  expect(()=>buildIdleQualificationPlan(missing,channels,'rpm',scope())).toThrow(/Qualification unavailable/);
  session.edit(candidate.id,{startMs:0,endMs:500},'Renamed');session.setPurpose(candidate.id,'idle');
  expect(()=>buildIdleQualificationPlan(missing,channels,'rpm',scope())).toThrow(/Qualification unavailable/);
  session.edit(candidate.id,{startMs:100,endMs:500},'Edited');
  expect(buildIdleQualificationPlan(missing,channels,'rpm',scope()).bypass).toEqual([{startMs:100,endMs:500}]);
  expect(session.regions[0]!.included).toBe(false);
  expect(()=>buildIdleQualificationPlan({...missing,manualBypass:false},channels,'rpm',scope())).toThrow(/Qualification unavailable/);
  expect(()=>buildIdleQualificationPlan(missing,channels,'rpm',scope(),true)).toThrow(/Qualification unavailable/);
  expect(()=>buildIdleQualificationPlan(missing,channels,'rpm',{...scope(),viewedId:'missing'})).toThrow(/Qualification unavailable/);
 });
 it('does not fall back to full log for an empty requested scope and rejects invalid settings',()=>{
  const plan=buildIdleQualificationPlan(settings,channels,'rpm',{kind:'full',manualId:undefined,regions:[]});
  expect(qualifyIdleSamples({referenceId:'rpm',channels:data(),conditions:plan.conditions,scope:[],bypass:[]}).eligible).toBe(0);
  expect(()=>buildIdleQualificationPlan({...settings,minimumCelsius:NaN},channels,'rpm',{kind:'full',manualId:undefined,regions:[]})).toThrow();
 });
 it('qualifies >320k samples with bounded iteration and the original grid',()=>{
  const n=320459,rpm:NumericChannelRange={startSampleIndex:7,values:new Float64Array(n).fill(1000),timeMs:Float64Array.from({length:n},(_,i)=>i*10),validity:new Uint8Array(n).fill(1)};
  const q=qualifyIdleSamples({referenceId:'rpm',channels:new Map([['rpm',{range:rpm,complete:true}]]),conditions:[{channelId:'rpm',operator:'lte',value:1200}],scope:[{startMs:0,endMs:(n-1)*10}],bypass:[]});expect(q.eligible).toBe(n);expect(q.eligibility.length).toBe(n);
 });
});
