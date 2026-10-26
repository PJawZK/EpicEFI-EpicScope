import { describe, expect, it } from 'vitest';
import { createIdleRegionSession } from '../apps/web/src/pages/idle-region-session';
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
  });
});
