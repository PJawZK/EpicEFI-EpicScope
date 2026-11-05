import type { ImportedLogSummary, NumericChannelDataSource } from '../../../../core/log-model/log-types';
import {importMlgFile} from '../adapters/mlg-file-import';
import {importMlgFileStaged,supportsStagedMlgWorker} from '../adapters/mlg-staged-import';
export interface IdleComparisonRecording {readonly summary:ImportedLogSummary;readonly channelData:NumericChannelDataSource;}
export interface IdleComparisonImportJob {readonly ready:Promise<IdleComparisonRecording>;cancel():void;}
/** Reuse canonical import, CRC validation and shared storage policy. Never instantiate Logger.
 * Fully validate the temporary candidate before allowing it to replace accepted B. */
export function prepareIdleComparisonFile(file:File):IdleComparisonImportJob{
  // Metadata is not a content fingerprint. Isolate B lifetimes from primary/other B caches.
  const identity={id:`idle-b:${crypto.randomUUID()}`,displayName:file.name,format:'MLG',sizeBytes:file.size};
  if(!supportsStagedMlgWorker())return {ready:importMlgFile(file,identity),cancel(){/* Existing fallback parser has no abort API; owner rejects retired completion. */}};
  const handle=importMlgFileStaged(file,[],identity);
  return {cancel:()=>handle.cancel(),ready:(async()=>{const indexed=await handle.indexed;handle.startValidation();const validated=await handle.validated;return {summary:{...indexed.summary,diagnostics:validated.diagnostics},channelData:indexed.channelData};})()};
}
export interface IdleComparisonSourceState {readonly recording:IdleComparisonRecording|undefined;readonly loading:boolean;readonly message:string;readonly revision:number;}
/** B-specific transactional lifetime. Old accepted bytes/selections remain authoritative on failure.
 * Retiring drops references; it must not delete shared persistent stores also used by primary A. */
export function createIdleComparisonSource(changed:(state:IdleComparisonSourceState)=>void,prepare=(file:File)=>prepareIdleComparisonFile(file)){
  let active=false,disposed=false,generation=0,revision=0,recording:IdleComparisonRecording|undefined,pending:IdleComparisonImportJob|undefined,message='No independent recording B loaded.';
  const state=():IdleComparisonSourceState=>({recording,loading:!!pending,message,revision});
  const publish=()=>{if(!disposed)changed(state());};
  const cancel=()=>{generation++;const old=pending;pending=undefined;old?.cancel();if(old){message='B replacement cancelled; previous accepted B retained.';publish();}};
  return {state,
    setActive(next:boolean){active=next;if(!next)cancel();},
    async load(file:File){
      if(disposed||!active)return;
      cancel();const request=++generation;message=`Preparing ${file.name}; current B remains authoritative until canonical validation succeeds.`;
      try{
        const job=prepare(file);pending=job;publish();const candidate=await job.ready;
        if(disposed||!active||request!==generation)return;
        const extent=candidate.summary.timeRange;
        if(candidate.summary.source.format!=='MLG'||!candidate.channelData.sampleCount||!extent||!Number.isFinite(extent.startMs)||!Number.isFinite(extent.endMs)||extent.endMs<extent.startMs)throw Error('B needs an indexed MLG with a finite canonical time extent.');
        recording=candidate;revision++;pending=undefined;message=`${candidate.summary.source.displayName}: accepted independent B after canonical validation. No comparison or tune association is implied.`;publish();
      }catch(error){if(disposed||!active||request!==generation)return;pending?.cancel();pending=undefined;message=`B replacement rejected: ${error instanceof Error?error.message:'Import failed'}. Previous accepted B retained.`;publish();}
    },cancel,
    release(){cancel();recording=undefined;revision++;message='Independent recording B released; primary Logger is unchanged.';publish();},
    dispose(){cancel();disposed=true;active=false;recording=undefined;},
  };
}
