import {describe,it,expect} from 'vitest';
import {materializeStarterWorkspace,LOGGER_STARTER_GROUPS} from '../../apps/web/src/state/prepopulated-workspace-runtime';
import {GENERAL_SINGLE_WORKSPACE,STARTER_WORKSPACE_TEMPLATES} from '../../apps/web/src/state/built-in-workspace-templates';
import {semanticChannelRole} from '../../apps/web/src/state/semantic-channel-roles';
import {paneCountForLayout,freeformArrangement,DEFAULT_FREEFORM_ARRANGEMENT} from '../../apps/web/src/state/logger-pane-layout';
const ids=[...new Set(LOGGER_STARTER_GROUPS.flatMap(g=>g.roles).map(id=>semanticChannelRole(id).aliases[0]!))];
const channels=ids.map(id=>({id:'ini:'+id,sourceName:id,displayName:id,valueType:'number' as const}));
describe('Logger source-resolved layout starters',()=>{
 it('seeds every supported layout from six reusable semantic groups, up to four unique channels per pane',()=>{
  expect(LOGGER_STARTER_GROUPS.map(g=>g.name)).toEqual(['Engine','Idle','Fueling','Boost','Electrical','Controller']);
  const state=materializeStarterWorkspace(GENERAL_SINGLE_WORKSPACE,channels,'new').workspace;
  for(const layout of ['single','dual','grid4','grid5','grid6','freeform'] as const){
   const panes=state.panes!.slice(0,paneCountForLayout(layout));
   expect(panes).toHaveLength(paneCountForLayout(layout));
   for(const pane of panes){expect(pane.channelIds.length).toBeGreaterThan(0);expect(pane.channelIds.length).toBeLessThanOrEqual(4);expect(new Set(pane.channelIds).size).toBe(pane.channelIds.length);expect(pane.channelIds.every(id=>channels.some(c=>c.id===id))).toBe(true);}
  }
 });
 it('uses the same four-channel cap for every named starter without truncating resolver evidence',()=>{
  for(const template of STARTER_WORKSPACE_TEMPLATES){const result=materializeStarterWorkspace(template,channels,'new');expect(result.workspace.panes).toHaveLength(6);expect(result.workspace.panes!.every(p=>p.channelIds.length<=4)).toBe(true);}
 });
 it('omits missing roles and does not fill sparse catalogs with unrelated or fabricated channels',()=>{
  const sparse=[{id:'random',sourceName:'Unrelated sensor',displayName:'Unrelated sensor',valueType:'number' as const}];
  expect(materializeStarterWorkspace(GENERAL_SINGLE_WORKSPACE,sparse,'new').workspace.panes!.every(p=>p.channelIds.length===0)).toBe(true);
  const rpm=[{id:'rpm',sourceName:'RPM',displayName:'RPM',valueType:'number' as const}];
  expect(materializeStarterWorkspace(GENERAL_SINGLE_WORKSPACE,rpm,'new').workspace.panes!.flatMap(p=>p.channelIds).every(id=>id==='rpm')).toBe(true);
 });
 it('keeps normalized rows/columns/mosaic gap-free and leaves arrangement choice outside saved state migration',()=>{
  expect(DEFAULT_FREEFORM_ARRANGEMENT).toBe('rows');
  for(const name of ['rows','columns','mosaic'] as const){const geometry=Object.values(freeformArrangement(name));expect(geometry.reduce((area,g)=>area+g.width*g.height,0)).toBeCloseTo(1);for(const g of geometry){expect(g.x+g.width).toBeLessThanOrEqual(1.000001);expect(g.y+g.height).toBeLessThanOrEqual(1.000001);}}
 });
});
