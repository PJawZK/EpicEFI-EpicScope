import { loadIniTableEditorDefinitions, saveIniTableEditorDefinitions } from '../../apps/web/src/state/ini-table-editor-storage';
import { buildOwnerEvidenceTail } from '../../apps/web/src/observability/reports/owner-report';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObservabilityRecorder } from '../../apps/web/src/observability/recorder';
import { createOwnerEvidence, rejectOwnerCompletion } from '../../apps/web/src/observability/producers/owner';
import { createWorkspaceLocalStorageAdapter } from '../../apps/web/src/adapters/workspace-local-storage';
import { createApplicationWorkspaceLocalStorageAdapter } from '../../apps/web/src/adapters/application-workspace-local-storage';
import { createIniCatalogLocalStorageAdapter } from '../../apps/web/src/adapters/ini-catalog-local-storage';
import { storageSource, storageWorkspace, storageCatalog } from '../fixtures/browser/storage-workspace';
const recorder = () => new ObservabilityRecorder({ sessionId: 'owner-test' });
afterEach(() => vi.unstubAllGlobals());
describe('explicit owner evidence', () => {
  it('remains passive when disabled, even with an unreadable metadata getter', () => {
    const owner = createOwnerEvidence(undefined, 'disabled');
    const metadata = { get bad(): string { throw Error('must not read'); } };
    expect(() => owner.event('noop', metadata)).not.toThrow(); expect(owner.begin('noop', metadata)).toBeUndefined();
  });
  it('retains exact owner revisions/visibility/origin without taking domain ownership', () => {
    const r=recorder(),owner=createOwnerEvidence(r,'ve');
    owner.event('ve.context.noop', { sourceChanged: false }, { stateRevision: 9, sourceRevision: 4, visibility: 'hidden', origin: 'programmatic', semanticFingerprint: 'scope=full' });
    expect(r.snapshot()[0]).toMatchObject({ component: 've', name: 've.context.noop', stateRevision: 9, sourceRevision: 4, visibility: 'hidden', origin: 'programmatic', semanticFingerprint: 'scope=full' });
  });
  it('correlates interleaved owner operations without an ambient current operation', () => {
    const r=recorder(),a=createOwnerEvidence(r,'ve'),b=createOwnerEvidence(r,'math');
    const first=a.begin('ve.analysis',{generation:1})!,second=b.begin('math.preview',{generation:4})!;
    second.finish('success'); first.finish('cancelled','hidden'); rejectOwnerCompletion(first,'old load settled');
    const records=r.snapshot(); expect(first.id).not.toBe(second.id);
    expect(records.filter(x=>x.name==='ve.analysis.completed')).toHaveLength(1);
    expect(records.find(x=>x.name==='async.completion.stale')).toMatchObject({operationId:first.id,outcome:'stale'});
    expect(first.outcome).toBe('cancelled');
  });
  it('bounds/coalesces repeated no-op evidence and exposes un-terminated stale work explicitly', () => {
    const r=recorder(),owner=createOwnerEvidence(r,'ve');
    for(let i=0;i<1000;i++)owner.event('ve.tune.noop',{unchanged:true});
    expect(r.snapshot().length).toBe(2); expect(r.status().coalesced).toBe(999);
    const operation=owner.begin('ve.analysis')!;rejectOwnerCompletion(operation,'new-generation');
    expect(operation.outcome).toBe('superseded');expect(r.countNamed('async.completion.stale')).toBe(1);
  });
});
const specs=[
 { name:'workspace', create:(r:ObservabilityRecorder)=>{const a=createWorkspaceLocalStorageAdapter(undefined,r);return {load:()=>a.load(storageSource),save:()=>a.save(storageSource,storageWorkspace),remove:()=>a.remove(storageSource)};} },
 { name:'application', create:(r:ObservabilityRecorder)=>{const a=createApplicationWorkspaceLocalStorageAdapter(undefined,r);return {load:()=>a.load(),save:()=>a.save(storageWorkspace),remove:()=>a.remove()};} },
 { name:'catalog', create:(r:ObservabilityRecorder)=>{const a=createIniCatalogLocalStorageAdapter(undefined,r);return {load:()=>a.load(),save:()=>a.save('test.ini',storageCatalog),remove:()=>a.remove()};} },
];
for(const spec of specs)describe(`${spec.name} persistence evidence`,()=>{
 it('preserves the original exception when its name getter itself throws',()=>{
  const r=recorder(),original=new Error('original');Object.defineProperty(original,'name',{get(){throw Error('getter failed');}});
  vi.stubGlobal('window',{get localStorage(){throw original;}});
  const a=spec.create(r);let caught;try{a.save();}catch(error){caught=error;}
  expect(caught).toBe(original);expect(r.snapshot().find(x=>x.name==='storage.save.completed')).toMatchObject({outcome:'failure',reason:'owner-error'});
 });
 it('captures getter denial without changing exception identity or number of accesses',()=>{
  const r=recorder(),denied=new DOMException('denied','SecurityError');let calls=0;
  vi.stubGlobal('window',{get localStorage(){calls++;throw denied;}});
  const a=spec.create(r);expect(calls).toBe(0);
  for(const operation of [a.load,a.save,a.remove])expect(operation).toThrow(denied);
  expect(calls).toBe(3);expect(r.snapshot().filter(x=>x.name.endsWith('.completed')).map(x=>[x.outcome,x.reason])).toEqual(Array.from({length:3},()=>['failure','SecurityError']));
 });
 it('records successful recovery with no extra writes and never stores workspace/catalog payloads',()=>{
  const r=recorder(),values=new Map<string,string>();let writes=0;
  vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{writes++;values.set(k,v);},removeItem:(k:string)=>values.delete(k)}});
  const a=spec.create(r);expect(a.load()).toBeUndefined();a.save();expect(a.load()).toBeDefined();a.remove();
  expect(writes).toBe(1);expect(r.snapshot().filter(x=>x.name.endsWith('.completed')).map(x=>x.outcome)).toEqual(['success','success','success','success']);
  const evidence=JSON.stringify(r.snapshot());expect(evidence).not.toContain('channelIds');expect(evidence).not.toContain('Storage recovery');
 });
});

describe('owner evidence report lens',()=>{
 it('keeps operation identity/outcome and existing generation/revision decisions reviewable',()=>{
  const r=recorder(),owner=createOwnerEvidence(r,'ve');
  owner.event('ve.context.noop',{generation:3},{stateRevision:7});const operation=owner.begin('ve.analysis',{generation:4})!;
  operation.finish('cancelled','hidden');rejectOwnerCompletion(operation,'old-read');
  const report=buildOwnerEvidenceTail(r.snapshot());expect(report).toContain(operation.id);expect(report).toContain('generation=3');expect(report).toContain('stateRevision=7');expect(report).toContain('outcome=cancelled');expect(report).toContain('async.completion.stale');
 });
 it('shows coalesced repeated work rather than treating a repeated run as one event',()=>{
  const r=recorder(),owner=createOwnerEvidence(r,'ve');for(let i=0;i<1000;i++)owner.event('ve.context.noop');
  expect(buildOwnerEvidenceTail(r.snapshot())).toContain('count=999');
 });
 it('bounds explicit report size without dropping or modifying stored evidence',()=>{
  const r=recorder(),owner=createOwnerEvidence(r,'view');for(let i=0;i<100;i++)owner.event('view.request',{generation:i,label:'x'.repeat(200)});
  const records=r.snapshot(),report=buildOwnerEvidenceTail(records);expect(report.split('\n')).toHaveLength(32);expect(report).toContain('[truncated]');expect(r.snapshot()).toEqual(records);
 });
});

describe('INI definition authority evidence',()=>{
 it('records actual failed persistence after memory acceptance and preserves one dispatch',()=>{
  const r=recorder();let writes=0,dispatches=0;vi.stubGlobal('localStorage',{setItem(){writes++;throw new DOMException('quota','QuotaExceededError');}});vi.stubGlobal('window',{dispatchEvent(){dispatches++;return true;}});
  const definitions=Object.freeze([{tableId:'ve',mapId:undefined,title:undefined,page:undefined,xBins:'rpm',xChannel:undefined,yBins:'map',yChannel:undefined,zBins:'veTable'}]);
  saveIniTableEditorDefinitions(definitions,r);expect(loadIniTableEditorDefinitions()).toBe(definitions);expect(writes).toBe(1);expect(dispatches).toBe(1);
  expect(r.snapshot().find(x=>x.name==='persistence.result')).toMatchObject({metadata:{outcome:'failure',acceptedInMemory:true,definitions:1}});
 });
});
