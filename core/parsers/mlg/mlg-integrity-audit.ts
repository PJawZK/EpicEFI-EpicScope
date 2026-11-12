import type {NumericChannelRange,ParserDiagnostic} from '../../log-model/log-types';
import type {MlgRecordIndex} from './mlg-records';
export type MlgAuditClassification='unrecovered-corrupt-record'|'recovered-retry'|'valid-retry-like-run'|'sequence-discontinuity'|'recording-time-discontinuity'|'timestamp-regression'|'timestamp-wrap-or-reset'|'duplicate-timestamp'|'channel-invalid'|'unclassified';
export interface MlgAuditRecord {readonly recordIndex:number;readonly offset:number;readonly timeMs:number|null;readonly rawTimestampTicks:number|null;readonly counter:number;readonly crcValid:boolean;}
export interface MlgAuditEvent {
 readonly startRecordIndex:number;readonly endRecordIndex:number;readonly startOffset:number;readonly endOffset:number;
 readonly before:MlgAuditRecord|null;readonly first:MlgAuditRecord|null;readonly last:MlgAuditRecord|null;readonly after:MlgAuditRecord|null;readonly cadenceBeforeMs:number|null;readonly cadenceAfterMs:number|null;
 readonly startTimeMs:number|null;readonly endTimeMs:number|null;
 readonly classifications:readonly MlgAuditClassification[];readonly observations:readonly string[];
 readonly diagnostics:readonly {code:string;offset?:number}[];
}
const median=(values:readonly number[])=>{if(!values.length)return undefined;const copy=[...values].sort((a,b)=>a-b),mid=Math.floor(copy.length/2);return copy.length%2?copy[mid]!:(copy[mid-1]!+copy[mid]!)/2;};
/** Read-only offline audit. Never used by viewport navigation or to alter canonical validity/time.
 * Interval outliers are explicit heuristics, never proof or a count of missing records. */
export function auditMlgIntegrity(index:MlgRecordIndex,diagnostics:readonly ParserDiagnostic[],recordLength:number,options:{rawTimestamps?:Uint16Array;channels?:ReadonlyMap<string,NumericChannelRange>}={}) {
 const represented=new Set<ParserDiagnostic>();
 const events:MlgAuditEvent[]=[],byRecord=new Map<number,ParserDiagnostic[]>();
 for(const diagnostic of diagnostics){if(diagnostic.offset===undefined)continue;let lo=0,hi=index.offsets.length;while(lo<hi){const mid=(lo+hi)>>>1;if(index.offsets[mid]!<=diagnostic.offset)lo=mid+1;else hi=mid;}const i=lo-1;if(i<0||diagnostic.offset>index.offsets[i]!+recordLength+4)continue;const list=byRecord.get(i)??[];list.push(diagnostic);byRecord.set(i,list);}
 const describe=(i:number):MlgAuditRecord|null=>i<0||i>=index.offsets.length?null:{recordIndex:i,offset:index.offsets[i]!,timeMs:Number.isFinite(index.timeMs[i])?index.timeMs[i]!:null,rawTimestampTicks:options.rawTimestamps?.[i]??null,counter:index.counters[i]!,crcValid:index.crcValid[i]===1};
 const followingCadence=(i:number)=>{const intervals:number[]=[];for(let j=i+1;j<Math.min(index.timeMs.length,i+130);j++){const delta=index.timeMs[j]!-index.timeMs[j-1]!;if(Number.isFinite(delta)&&delta>0)intervals.push(delta);}return median(intervals)??null;};
 const cadence:number[]=[];let cadenceCursor=0;let invalidRecords=0,positiveIntervals=0;const observedCounts:Partial<Record<MlgAuditClassification,number>>={};
 for(let i=0;i<index.offsets.length;i++){
  const classes:MlgAuditClassification[]=[],notes:string[]=[],time=index.timeMs[i]!,previous=index.timeMs[i-1],localMedian=i>0&&previous!==undefined&&(time-previous>50||time<=previous||index.crcValid[i]!==1)?median(cadence):undefined,ds=byRecord.get(i)??[];
  if(index.crcValid[i]!==1){invalidRecords++;classes.push(ds.some(d=>d.code==='mlg-crc-retry-recovered')?'recovered-retry':'unrecovered-corrupt-record');notes.push('Canonical CRC exclusion retained; corrupt attempt does not establish missing recording time.');}
  if(ds.some(d=>d.code==='mlg-counter-retry-pattern')){classes.push('valid-retry-like-run');notes.push('Canonical CRC-valid same-counter/same-timestamp retry-like run; records stay valid, not a confirmed loss.');}
  if(ds.some(d=>d.code==='mlg-counter-discontinuity')){classes.push('sequence-discontinuity');notes.push(`Counter ${index.counters[i-1]??'unavailable'} → ${index.counters[i]}; modulo counter mismatch, exact missing-record count/cause not established.`);}
  if(!Number.isFinite(time)){classes.push('unclassified');notes.push('Nonfinite canonical timestamp.');}
  if(i>0&&Number.isFinite(time)&&previous!==undefined&&Number.isFinite(previous)){
   const delta=time-previous;
   if(delta===0){classes.push('duplicate-timestamp');notes.push('Equal source timestamps; not proof of byte-identical records or a failed recording.');}
   else if(delta<0){classes.push('timestamp-regression');notes.push(`Canonical timestamp decreased by ${-delta} ms; monotonic binary-search consumers require investigation.`);}
   else {positiveIntervals++;if(localMedian!==undefined&&delta>Math.max(50,5*localMedian)){classes.push('recording-time-discontinuity');notes.push(`Observed adjacent timestamps ${previous} → ${time} ms, interval ${delta} ms; preceding positive-interval median ${localMedian} ms (${cadence.length} observations). Heuristic outlier, unknown cause; endpoint measurements exist; absence of indexed records between these adjacent records does not prove packet loss.`);}if(cadence.length<129)cadence.push(delta);else{cadence[cadenceCursor]=delta;cadenceCursor=(cadenceCursor+1)%129;}}
  }
  if(options.rawTimestamps&&i>0&&options.rawTimestamps[i]!<options.rawTimestamps[i-1]!&&options.rawTimestamps[i-1]!-options.rawTimestamps[i]!>32768){classes.push('timestamp-wrap-or-reset');notes.push(`Raw 16-bit ticks ${options.rawTimestamps[i-1]} → ${options.rawTimestamps[i]}; scanner applies modulo unwrap. Rollover and reset cannot be distinguished from these fields alone.`);}
  for(const [name,range]of options.channels??[]){const local=i-range.startSampleIndex;if(index.crcValid[i]!==1)continue;if(local<0||local>=range.values.length||range.validity[local]!==1||!Number.isFinite(range.values[local])||range.timeMs[local]!==time){if(!classes.includes('channel-invalid'))classes.push('channel-invalid');notes.push(`${name}: invalid/unavailable/nonfinite or misaligned measurement at original record ${i}; not a source-wide CRC failure.`);}}
  if(!classes.length)continue;
  for(const d of ds)represented.add(d);
  for(const name of classes)observedCounts[name]=(observedCounts[name]??0)+1;
  // Correlate consecutive CRC attempts with identical classification/notes into one event span.
  const prior=events.at(-1),crcOnly=classes.length===1&&(classes[0]==='recovered-retry'||classes[0]==='unrecovered-corrupt-record');
  if(prior?.endRecordIndex===i-1&&((crcOnly&&prior.classifications.length===1&&prior.classifications[0]===classes[0])||(time===previous&&index.counters[i]===index.counters[i-1]))){const items=prior.diagnostics as {code:string;offset?:number}[];for(const d of ds)items.push({code:d.code,...(d.offset!==undefined?{offset:d.offset}:{})});events[events.length-1]={...prior,endRecordIndex:i,endOffset:index.offsets[i]!,endTimeMs:Number.isFinite(time)?time:null,last:describe(i),after:describe(i+1),cadenceAfterMs:followingCadence(i),classifications:[...new Set([...prior.classifications,...classes])],observations:[...new Set([...prior.observations,...notes])],diagnostics:prior.diagnostics};}
  else events.push({before:describe(i-1),first:describe(i),last:describe(i),after:describe(i+1),cadenceBeforeMs:localMedian??null,cadenceAfterMs:followingCadence(i),startRecordIndex:i,endRecordIndex:i,startOffset:index.offsets[i]!,endOffset:index.offsets[i]!,startTimeMs:Number.isFinite(time)?time:null,endTimeMs:Number.isFinite(time)?time:null,classifications:classes,observations:notes,diagnostics:ds.map(d=>({code:d.code,...(d.offset!==undefined?{offset:d.offset}:{})}))});
 }
 return {recordCount:index.offsets.length,invalidRecords,positiveIntervals,observedCounts,events,unmappedDiagnostics:diagnostics.filter(d=>!represented.has(d)).map(d=>({code:d.code,offset:d.offset,message:d.message})),policy:'Offline observations only; no source rewrite, inferred missing-record counts, causal verdict or new gap markers.'};
}
