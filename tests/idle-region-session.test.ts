import { describe, expect, it } from 'vitest';
import { createIdleRegionSession, idleRegionAllowsBypass, idleRegionMergeError } from '../apps/web/src/pages/idle-region-session';
const extent={startMs:0,endMs:1000};
describe('source-bound Idle region definitions',()=>{
  it('keeps candidate review separate, preserves edits on rediscovery and unions included bounds',()=>{
    const s=createIdleRegionSession(),source={};s.bind(source,1,extent);
    expect(s.addCandidates([{startMs:0,endMs:300}])).toBe(1);expect(s.includedBounds()).toEqual([]);
    const candidate=s.regions[0]!;s.edit(candidate.id,{startMs:100,endMs:300},'Reviewed');s.include(candidate.id,true);
    s.add({startMs:200,endMs:500},'Manual');expect(s.includedBounds()).toEqual([{startMs:100,endMs:500}]);
    s.addCandidates([{startMs:100,endMs:300}]);expect(s.regions.length).toBe(2);expect(s.regions[0]?.label).toBe('Reviewed');
    s.include(undefined,false);expect(s.includedBounds()).toEqual([]);
  });
  it('rejects invalid edits transactionally and keeps identity across same-source contexts',()=>{
    const s=createIdleRegionSession(),source={};s.bind(source,1,extent);const region=s.add({startMs:100,endMs:200});const previous=s.regions;
    expect(()=>s.edit(region.id,{startMs:-1,endMs:100},'bad')).toThrow();expect(s.regions).toBe(previous);
    expect(()=>s.add({startMs:100,endMs:NaN})).toThrow();expect(s.bind(source,1,{...extent})).toBe(false);expect(s.regions).toBe(previous);
    expect(s.bind(source,2,extent)).toBe(true);expect(s.regions).toEqual([]);
    s.add({startMs:0,endMs:100});s.bind({},2,extent);expect(s.regions).toEqual([]);
  });
  it('bounds manager growth and deletes definitions without touching any source',()=>{
    const s=createIdleRegionSession();s.bind({},0,extent);for(let i=0;i<200;i++)s.add({startMs:0,endMs:100});
    expect(()=>s.add({startMs:0,endMs:100})).toThrow(/200/);s.remove(s.regions[0]!.id);expect(s.regions.length).toBe(199);
    s.add({startMs:0,endMs:100});expect(s.regions.length).toBe(200);
    const before=s.regions;expect(()=>s.split(before[0]!.id,50)).toThrow(/200/);expect(s.regions).toBe(before);
  });
  it('partitions source bounds without changing union, inclusion or candidate bypass eligibility',()=>{
    const s=createIdleRegionSession();s.bind({},0,extent);s.addCandidates([{startMs:0,endMs:900}]);const original=s.regions[0]!;s.include(original.id,true);
    const [first,second]=s.split(original.id,333.25);
    expect(first.id).toBe(original.id);expect(second.id).not.toBe(first.id);
    expect([first.startMs,first.endMs,second.startMs,second.endMs]).toEqual([0,333.25,333.25,900]);
    expect(s.includedBounds()).toEqual([{startMs:0,endMs:900}]);
    for(const region of s.regions){expect(region.included).toBe(true);expect(region.origin).toBe('candidate');expect(idleRegionAllowsBypass(region)).toBe(false);}
    expect(s.merge(first.id,second.id)).toMatchObject({id:original.id,startMs:0,endMs:900,boundsEdited:false});
    expect(s.regions).toHaveLength(1);
  });
  it('rejects malformed splits and missing identities atomically',()=>{
    const s=createIdleRegionSession();s.bind({},0,extent);const r=s.add({startMs:100,endMs:900});const before=s.regions;
    for(const time of [NaN,Infinity,100,900,99,901]){expect(()=>s.split(r.id,time)).toThrow();expect(s.regions).toBe(before);}
    expect(()=>s.split('missing',500)).toThrow(/no longer exists/);expect(()=>s.merge(r.id,'missing')).toThrow(/no longer exists/);expect(s.regions).toBe(before);
    s.split(r.id,500);expect(s.regions[1]!.id).toBe('region:2');
  });
  it('merges overlap in either temporal order and preserves excluded review and manual policy',()=>{
    const s=createIdleRegionSession();s.bind({},0,extent);const a=s.add({startMs:500,endMs:900},'Later'),b=s.add({startMs:100,endMs:600},'Earlier');
    s.include(undefined,false);s.edit(b.id,b,'Renamed only');
    const merged=s.merge(a.id,b.id);expect(merged).toMatchObject({id:a.id,label:'Later',startMs:100,endMs:900,included:false,origin:'manual'});
    expect(idleRegionAllowsBypass(merged)).toBe(true);expect(s.includedBounds()).toEqual([]);
    const children=s.split(merged.id,400);expect(children.every(idleRegionAllowsBypass)).toBe(true);expect(children.every(r=>!r.included)).toBe(true);
  });
  it('never fills gaps or mixes inclusion, origin or candidate bypass policy',()=>{
    const s=createIdleRegionSession();s.bind({},0,extent);s.addCandidates([{startMs:0,endMs:300},{startMs:400,endMs:500},{startMs:200,endMs:500}]);
    const [a,b,c]=s.regions;const reject=(one:string,two:string,pattern:RegExp)=>{const before=s.regions;expect(()=>s.merge(one,two)).toThrow(pattern);expect(s.regions).toBe(before);};
    reject(a!.id,b!.id,/gap/);reject(a!.id,a!.id,/different/);
    s.include(c!.id,true);reject(a!.id,c!.id,/inclusion/);s.include(c!.id,false);
    s.edit(c!.id,{startMs:200,endMs:550},'Manual bounds');reject(a!.id,c!.id,/bypass/);
    const manual=s.add({startMs:100,endMs:300});s.include(manual.id,false);reject(a!.id,manual.id,/origin/);
    expect(idleRegionMergeError(a!,s.regions.find(r=>r.id===c!.id)!)).toMatch(/bypass/);
  });
  it('retains declared purposes without changing bounds, inclusion, bypass or edit provenance',()=>{
    const s=createIdleRegionSession();s.bind({},0,extent);s.addCandidates([{startMs:0,endMs:900}]);const before=s.regions[0]!;
    expect(before.purpose).toBe('custom');s.setPurpose(before.id,'raised');
    expect(s.regions[0]).toEqual({...before,purpose:'raised'});expect(idleRegionAllowsBypass(s.regions[0]!)).toBe(false);
    const unchanged=s.regions;s.setPurpose(before.id,'raised');expect(s.regions).toBe(unchanged);
    expect(()=>s.setPurpose(before.id,'invented')).toThrow();expect(()=>s.setPurpose('missing','idle')).toThrow();expect(s.regions).toBe(unchanged);
    const parts=s.split(before.id,400);expect(parts.map(p=>p.purpose)).toEqual(['raised','raised']);
    s.setPurpose(parts[1].id,'recovery');const previous=s.regions;expect(()=>s.merge(parts[0].id,parts[1].id)).toThrow(/purpose/);expect(s.regions).toBe(previous);
    s.setPurpose(parts[1].id,'raised');expect(s.merge(parts[0].id,parts[1].id).purpose).toBe('raised');
    expect(s.add({startMs:0,endMs:100},'Entry','entry').purpose).toBe('entry');const prior=s.regions;
    expect(()=>s.add({startMs:0,endMs:100},'Bad','invented')).toThrow();expect(s.regions).toBe(prior);
  });
});
