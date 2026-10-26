import { MlgFormatError } from '../../core/parsers/mlg/mlg-errors';
import { getAppObservabilitySnapshot } from '../../apps/web/src/app/app-shell';
import { annotateMlgSourceIntegrityDiagnostics } from '../../core/parsers/mlg/mlg-integrity';
import { createScalarHeaderFixture } from '../logs/mlg-fixture-builder';
import { importMlgFile } from '../../apps/web/src/adapters/mlg-file-import';
import { importMlgFileStaged } from '../../apps/web/src/adapters/mlg-staged-import';
const assert = (ok, message) => { if (!ok) throw Error(message); };

export async function runMlgIntegrityChecks() {
  const checks = [], count = 320_005;
  let reads = 0;
  const offsets = new Proxy(Float64Array.from({ length: count }, (_, i) => 100 + i * 13), {
    get(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key) && ++reads > 100) throw Error('Annotation scanned full index');
      return Reflect.get(target, key, target);
    },
  });
  const index = { offsets, timeMs: Float64Array.from({ length: count }, (_, i) => i * 10), counters: new Uint8Array(count), crcValid: new Uint8Array(count) };
  const unrelated = [{ code: 'unrelated', severity: 'info', message: 'Info', recoverable: true }];
  assert(annotateMlgSourceIntegrityDiagnostics(index, unrelated, 5) === unrelated && reads === 0, 'Irrelevant annotation touched records or copied diagnostics');
  const samples = [count - 1, 0, 160_002];
  const annotated = annotateMlgSourceIntegrityDiagnostics(index, samples.map(i => ({ code: 'mlg-crc-mismatch', severity: 'warning', message: 'CRC', recoverable: true, offset: 109 + i * 13 })), 5);
  assert(annotated.every((d, i) => d.timeMs === samples[i] * 10 && d.sourceIntegrity.breaksContinuity) && reads <= 100, 'Sparse large-index annotations lost offsets, time or bounded lookup');
  checks.push('>320k-record sparse annotation uses bounded offset reads; irrelevant diagnostics read none');

  const header = createScalarHeaderFixture({ version: 2, type: 0, recordLength: 1 });
  const bytes = new Uint8Array(header.length + 5 * 6); bytes.set(header);
  const records = [[10, 100, 1, true], [11, 101, 2, false], [11, 101, 2, true], [12, 102, 3, false], [13, 103, 4, true]];
  records.forEach(([counter, timestamp, value, valid], i) => bytes.set([0, counter, timestamp >> 8, timestamp & 255, value, valid ? value : value + 1], header.length + i * 6));
  const file = new File([bytes], 'integrity-parity.mlg', { lastModified: 123 });
  const fallback = await importMlgFile(file);
  const crc = fallback.summary.diagnostics.filter(d => d.code === 'mlg-crc-retry-recovered' || d.code === 'mlg-crc-mismatch');
  assert(crc.length === 2 && crc[0].sourceIntegrity.kind === 'recovered-retry' && !crc[0].sourceIntegrity.breaksContinuity && crc[1].sourceIntegrity.kind === 'corrupt-record' && crc[1].sourceIntegrity.breaksContinuity, 'Actual fallback parsing lost recovered/unrecovered semantics');
  assert(crc[0].timeMs === fallback.recordIndex.timeMs[1] && crc[1].timeMs === fallback.recordIndex.timeMs[3], 'Actual annotation has incorrect source times');
  if (typeof Worker !== 'undefined') {
    const handle = importMlgFileStaged(file);
    const indexed = await handle.indexed;
    handle.startValidation();
    const validated = await handle.validated;
    assert(JSON.stringify(validated.diagnostics) === JSON.stringify(fallback.summary.diagnostics), 'Staged/fallback diagnostic metadata differs');
    assert(JSON.stringify([...indexed.recordIndex.crcValid]) === JSON.stringify([...fallback.recordIndex.crcValid]), 'Annotation changed source validity across import paths');
    checks.push('actual staged/fallback CRC diagnostics, source times and validity are identical');
  } else checks.push('actual fallback CRC diagnostics retain source times and retry/corruption semantics with Worker disabled');
  const partialBytes=new Uint8Array(bytes.length+4);partialBytes.set(bytes);partialBytes.set([0,14,0,104],bytes.length);
  const partialFile=new File([partialBytes],'incomplete-tail.mlg',{lastModified:789}),partial=await importMlgFile(partialFile);
  const tail=partial.summary.diagnostics.find(d=>d.code==='mlg-incomplete-tail');
  assert(partial.recordIndex.offsets.length===5&&partial.summary.source.sizeBytes===partialBytes.length&&tail.offset===bytes.length&&tail.incompleteTail.missingBytes===2,'Partial import lost source size, complete prefix or tail metadata');
  assert(partial.summary.diagnostics.filter(d=>d.code!=='mlg-incomplete-tail').length===fallback.summary.diagnostics.length,'Tail recovery erased CRC diagnostics');
  if(typeof Worker!=='undefined'){
    const staged=importMlgFileStaged(partialFile),indexed=await staged.indexed;staged.startValidation();const validated=await staged.validated;
    assert(indexed.recordIndex.offsets.length===5&&JSON.stringify(validated.diagnostics)===JSON.stringify(partial.summary.diagnostics),'Incomplete-tail staged/fallback semantics differ');
    assert(JSON.stringify([...indexed.recordIndex.crcValid])===JSON.stringify([...partial.recordIndex.crcValid]),'Tail recovery changed staged CRC exclusions');
    const rejected=importMlgFileStaged(new File([new Uint8Array(24)],'invalid-magic.mlg'));let error;try{await rejected.indexed;}catch(e){error=e;}
    assert(error instanceof MlgFormatError&&error.code==='invalid-magic'&&error.offset===0,'Worker format failure lost typed metadata');checks.push('Worker preserves typed parser failure code and offset without message parsing');
  }
  const unknownTail=new Uint8Array(bytes.length+1);unknownTail.set(bytes);unknownTail[bytes.length]=9;
  let unknownError;try{await importMlgFile(new File([unknownTail],'unknown-short-tail.mlg'));}catch(error){unknownError=error;}
  assert(unknownError instanceof MlgFormatError&&unknownError.code==='unsupported-block-type','Recovery accepted an unknown EOF type');
  checks.push('File imports retain complete prefix/source size/tail diagnostic and preserve worker/fallback CRC classification');
  const scaleCount=320_005,scaleBytes=new Uint8Array(header.length+scaleCount*6+4);scaleBytes.set(header);
  for(let i=0;i<scaleCount;i++)scaleBytes.set([0,i&255,(i>>8)&255,i&255,7,7],header.length+i*6);
  scaleBytes.set([0,scaleCount&255,(scaleCount>>8)&255,scaleCount&255],header.length+scaleCount*6);
  const scaleFile=new File([scaleBytes],'continuous-320k-incomplete-tail.mlg'),scale=await importMlgFile(scaleFile);
  assert(scale.recordIndex.offsets.length===scaleCount&&scale.recordIndex.crcValid.every(v=>v===1)&&scale.summary.diagnostics.length===1&&scale.summary.diagnostics[0].code==='mlg-incomplete-tail','Browser-scale complete samples lost or treated as corrupt');
  if(typeof Worker!=='undefined'){const staged=importMlgFileStaged(scaleFile),indexed=await staged.indexed;staged.startValidation();const validated=await staged.validated;assert(indexed.recordIndex.offsets.length===scaleCount&&indexed.recordIndex.crcValid.every(v=>v===1)&&JSON.stringify(validated.diagnostics)===JSON.stringify(scale.summary.diagnostics),'Browser-scale staged tail recovery differs');}
  checks.push('320,005 continuous valid samples survive tail recovery with bounded iteration and matching worker/fallback evidence');
  checks.push(...await runMlgShellTailChecks(partialFile));
  return { passed: checks.length, checks };
}

async function runMlgShellTailChecks(file){
 const root=document.querySelector('#app'),input=root.querySelector('input[accept^=".mlg"]'),button=root.querySelector('.open-log'),checks=[];
 const load=async candidate=>{const transfer=new DataTransfer();transfer.items.add(candidate);if(Object.hasOwn(input,'files'))delete input.files;input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));const end=performance.now()+20000;while(button.disabled||button.dataset.loadState==='loading'){assert(performance.now()<end,'MLG shell import did not settle');await new Promise(r=>setTimeout(r,10));}};
 await load(file);assert(root.querySelector('.app-status').textContent.includes('incomplete tail excluded')&&button.title.includes('incomplete tail excluded')&&!root.querySelector('.app-status').textContent.includes('Import failed'),'Shell hides incomplete-tail warning or rejected usable prefix');checks.push('Actual shell keeps incomplete-tail warning visible after final validation');
 if(typeof Worker!=='undefined'){
  const before=getAppObservabilitySnapshot(root).records.at(-1)?.sequence??0;await load(new File([new Uint8Array(24)],'known-invalid-magic.mlg'));
  const records=getAppObservabilitySnapshot(root).records.filter(r=>r.sequence>before);
  assert(button.title.includes('[invalid-magic]')&&records.some(r=>r.name==='source.load.completed'&&r.outcome==='failure')&&!records.some(r=>r.name==='source.load.worker-fallback'),'Known worker format error was rescanned on main thread');checks.push('Actual shell rejects worker format errors once without fallback or stale source publication');
  const WorkerBefore=globalThis.Worker;try{
   globalThis.Worker=class{terminate(){}postMessage(){queueMicrotask(()=>this.onerror?.({message:'Controlled worker startup failure'}));}};
   const before=getAppObservabilitySnapshot(root).records.at(-1)?.sequence??0;await load(file);
   assert(button.title.includes('incomplete tail excluded')&&getAppObservabilitySnapshot(root).records.filter(r=>r.sequence>before&&r.name==='source.load.worker-fallback').length===1,'Infrastructure failure no longer falls back exactly once');checks.push('Actual shell still falls back once for worker infrastructure failures');
  }finally{globalThis.Worker=WorkerBefore;}
 }
 return checks;
}
