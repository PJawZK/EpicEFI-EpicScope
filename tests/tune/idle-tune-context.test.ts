import {describe,it,expect} from 'vitest';
import {parseMsq} from '../../core/parsers/msq/msq-parser';
import {normalizeMsqTune,type TuneModel} from '../../core/tune/tune-model';
import {projectIdleTune,lookupIdleTuneReference,IDLE_TUNE_AUTHORITY} from '../../core/tune/idle-tune-context';
const tune=(content:string)=>normalizeMsqTune(parseMsq(`<msq><versionInfo signature="unverified"/><page number="0">${content}</page></msq>`));
const vector=(name:string,values:string,units='')=>`<constant name="${name}" rows="${values.split(' ').length}" cols="1" units="${units}">${values}</constant>`;
const bias=()=>tune(vector('dcIdleBiasBins','0 10 18 30 45 60 80 100','target idle position')+vector('dcIdleBiasValues','-40 -20 35 30 39 42 44 37','DC idle duty bias'));
const panel=(model:TuneModel|undefined,id='bias')=>projectIdleTune(model).find(p=>p.id===id)!;
describe('read-only Idle loaded-tune reference authority',()=>{
 it('preserves exact normalized values/units/pages and performs shared clamped linear reference lookup without runtime attribution',()=>{
  const m=bias(),before=JSON.stringify(m.entries),p=panel(m);expect(p.geometry).toMatchObject({rows:1,cols:8,units:'DC idle duty bias'});expect(p.entries[0]!.entry?.rows).toBe(8);expect(lookupIdleTuneReference(p,20)).toBeCloseTo(35+(30-35)*2/12);expect(lookupIdleTuneReference(p,-1)).toBe(-40);expect(lookupIdleTuneReference(p,101)).toBe(37);expect(lookupIdleTuneReference(p,18)).toBe(35);expect(JSON.stringify(m.entries)).toBe(before);expect(IDLE_TUNE_AUTHORITY).toContain('unverified');
 });
 it('reuses row-major bilinear geometry and known arithmetic without flipping axes',()=>{
  const m=tune(vector('cltIdleCorrBins','0 100','C')+vector('rpmIdleCorrBins','900 1100','RPM')+'<constant name="cltIdleCorrTable" rows="2" cols="2" units="%">10 20 30 40</constant>');const p=panel(m,'base');expect(lookupIdleTuneReference(p,50,1000)).toBe(25);expect(p.geometry?.values).toEqual([10,20,30,40]);expect(lookupIdleTuneReference(p,-10,1300)).toBe(30);
 });
 it('rejects duplicate entries even when byName points at a plausible last value on another page',()=>{
  const m=bias(),entry=m.entries[1]!,duplicate={...entry,pageNumber:1};const ambiguous={...m,entries:[...m.entries,duplicate],byName:new Map([...m.byName,[entry.name,duplicate]])};const p=panel(ambiguous);expect(p.entries[1]!.status).toBe('ambiguous');expect(p.geometry).toBeUndefined();expect(lookupIdleTuneReference(p,20)).toBeUndefined();
 });
 it('rejects malformed, repeated, descending and nonfinite curve axes without sorting or repairing loaded values',()=>{
  for(const values of ['0 10 10 30 45 60 80 100','100 80 60 45 30 18 10 0','0 10 18 15 45 60 80 100']){const m=bias(),entry={...m.entries[0]!,numericValues:values.split(' ').map(Number)},p=panel({...m,entries:[entry,m.entries[1]!]});expect(p.geometry).toBeUndefined();expect(p.entries[0]!.entry?.numericValues).toEqual(entry.numericValues);}
  const m=bias(),entry={...m.entries[0]!,numericValues:[0,10,NaN,30,45,60,80,100]};expect(panel({...m,entries:[entry,m.entries[1]!]}).entries[0]!.status).toBe('invalid');
 });
 it('rejects mismatched dimensions/value counts and bounded-view overflow instead of creating invented geometry',()=>{
  const m=bias();for(const entry of [{...m.entries[1]!,rows:7},{...m.entries[1]!,rows:2048,numericValues:new Array(2048).fill(1)},{...m.entries[1]!,rows:2,cols:4,kind:'table' as const}]){const p=panel({...m,entries:[m.entries[0]!,entry]});expect(p.geometry).toBeUndefined();}
 });
 it('does not use ETB bias or numeric PID limits as DC/runtime authority and preserves unspecified units',()=>{
  const m=tune(vector('etbBiasBins','0 100')+vector('etbBiasValues','-20 25')+'<constant name="idleRpmPid_maxValue">30</constant>');expect(panel(m).geometry).toBeUndefined();expect(panel(m,'etbBias').geometry).toBeDefined();expect(panel(m,'etbBias').geometry?.units).toBeUndefined();expect(panel(m,'rpmPid').entries.find(e=>e.name==='idleRpmPid_maxValue')?.entry?.numericValues).toEqual([30]);expect(lookupIdleTuneReference(panel(m,'rpmPid'),30)).toBeUndefined();
 });
 it('handles no tune and invalid coordinates as unavailable and rejects derived interpolation overflow',()=>{
  expect(panel(undefined).entries.every(e=>e.status==='missing')).toBe(true);expect(lookupIdleTuneReference(panel(bias()),NaN)).toBeUndefined();const m=tune(vector('dcIdleBiasBins','0 1')+vector('dcIdleBiasValues','-1e308 1e308'));expect(lookupIdleTuneReference(panel(m),.5)).toBeUndefined();
 });
});
