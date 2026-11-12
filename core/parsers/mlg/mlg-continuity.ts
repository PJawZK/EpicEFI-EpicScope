import type {NumericChannelRange,ParserDiagnostic,SourceContinuityEvidence} from '../../log-model/log-types';
import {getTimeQueryIndex} from '../../log-model/time-query-index';
import {precedingTimeCadence,createTimeCadenceCursor} from '../../log-model/time-continuity';
import type {MlgRecordIndex} from './mlg-records';

export function continuityEvidenceText(e:SourceContinuityEvidence):string {
 const cadence=e.cadenceBeforeMs===undefined?'No preceding cadence reference in this source run.':`Preceding cadence median ${e.cadenceBeforeMs.toFixed(2)} ms (${e.cadenceSampleCount} positive intervals).`;
 return `${e.classification}: original records ${e.fromRecordIndex} → ${e.toRecordIndex}${e.fromOffset===undefined?'':`; record offsets ${e.fromOffset} → ${e.toOffset}`}. Source time ${e.fromTimeMs.toFixed(2)} → ${e.toTimeMs.toFixed(2)} ms; signed step ${e.deltaMs.toFixed(2)} ms; observed interval magnitude ${e.durationMs.toFixed(2)} ms. ${cadence} Related CRC records: ${e.relatedCrcRecords.length?e.relatedCrcRecords.join(', '):'none'}.${e.interiorRecords===undefined?'':` Other original records strictly inside this time interval: ${e.interiorRecords}.`}${e.channelName===undefined?'':` Channel ${e.channelName} (${e.channelId}): ${e.sampleCount} checksum-valid nonfinite observations; other channels retain their own validity.`} ${e.classification==='clock-regression'?'A 16-bit header clock wrap/reset interpretation can be ambiguous; canonical timestamps are retained. ':''}These observations do not prove packet loss, source-wide corruption or ECU failure.`;
}

/** One canonical, post-CRC source projection shared by fallback and staged import.
 * Reads retained index arrays only, never file bytes or pane state. */
export function projectMlgContinuityDiagnostics(index:MlgRecordIndex,diagnostics:readonly ParserDiagnostic[],recordLength:number):readonly ParserDiagnostic[] {
 const query=getTimeQueryIndex(index.timeMs),events:ParserDiagnostic[]=[],cadenceCursor=createTimeCadenceCursor(index.timeMs);
 const evidence=(from:number,to:number,classification:SourceContinuityEvidence['classification'],extra:Partial<SourceContinuityEvidence>={}):SourceContinuityEvidence=>{
  const cadence=precedingTimeCadence(index.timeMs,classification==='clock-regression'?from:to);
  const a=index.timeMs[from]!,b=index.timeMs[to]!;
  return {classification,fromRecordIndex:from,toRecordIndex:to,fromTimeMs:a,toTimeMs:b,deltaMs:b-a,durationMs:Math.abs(b-a),fromOffset:index.offsets[from]!,toOffset:index.offsets[to]!,...(cadence.medianMs===undefined?{}:{cadenceBeforeMs:cadence.medianMs}),cadenceSampleCount:cadence.count,relatedCrcRecords:[...new Set([from,to].filter(i=>index.crcValid[i]!==1))],...extra};
 };
 for(let i=1;i<index.timeMs.length;i++){
  const cadence=cadenceCursor(i),a=index.timeMs[i-1]!,b=index.timeMs[i]!;if(!Number.isFinite(a)||!Number.isFinite(b))continue;
  const regression=b<a;if(!regression&&!(cadence.medianMs!==undefined&&b-a>Math.max(50,5*cadence.medianMs)))continue;
  const interiorRecords=query.count(a,b,true);
  const e=evidence(i-1,i,regression?'clock-regression':'cadence-outlier',{interiorRecords});
  events.push({code:regression?'mlg-source-time-regression':'mlg-source-time-spacing',severity:regression?'warning':'info',recoverable:true,timeMs:b,offset:index.offsets[i]!,sourceIntegrity:{kind:regression?'timestamp-gap':'cadence-observation',breaksContinuity:regression,evidence:e},message:continuityEvidenceText(e)});
 }
 const decorated=diagnostics.map(d=>{
  if(d.code!=='mlg-crc-mismatch'||!d.sourceIntegrity||d.offset===undefined)return d;
  let lo=0,hi=index.offsets.length;while(lo<hi){const mid=(lo+hi)>>>1;if(index.offsets[mid]!+recordLength+4<d.offset)lo=mid+1;else hi=mid;}
  if(lo>=index.offsets.length||index.offsets[lo]!+recordLength+4!==d.offset)return d;
  const e=evidence(Math.max(0,lo-1),Math.min(index.offsets.length-1,lo+1),'crc-exclusion',{relatedCrcRecords:[lo]});
  return {...d,sourceIntegrity:{...d.sourceIntegrity,evidence:e},message:d.message+' '+continuityEvidenceText(e)};
 });
 return events.length||decorated.some((d,i)=>d!==diagnostics[i])?[...decorated,...events]:diagnostics;
}

/** Complete decoded channel only; caller owns source generation, validation gate
 * and one-time channel caching. CRC exclusions never become blue channel events. */
export function projectChannelUnavailable(range:NumericChannelRange,channelId:string,channelName:string):readonly ParserDiagnostic[] {
 const events:ParserDiagnostic[]=[];let start=-1,last=-1,count=0;
 const finish=()=>{if(start>=0&&last>=start){const cadence=precedingTimeCadence(range.timeMs,start),a=range.timeMs[start]!,b=range.timeMs[last]!;
  const e:SourceContinuityEvidence={classification:'channel-unavailable',fromRecordIndex:range.startSampleIndex+start,toRecordIndex:range.startSampleIndex+last,fromTimeMs:a,toTimeMs:b,deltaMs:b-a,durationMs:b-a,...(cadence.medianMs===undefined?{}:{cadenceBeforeMs:cadence.medianMs}),cadenceSampleCount:cadence.count,relatedCrcRecords:[],channelId,channelName,sampleCount:count,traceStartMs:start>0&&range.validity[start-1]===1&&range.timeMs[start-1]!<=a?range.timeMs[start-1]!:a,traceEndMs:last+1<range.timeMs.length&&range.validity[last+1]===1&&range.timeMs[last+1]!>=b?range.timeMs[last+1]!:b};
  events.push({code:'mlg-channel-unavailable',severity:'info',recoverable:true,timeMs:a,sourceIntegrity:{kind:'channel-unavailable',breaksContinuity:false,evidence:e},message:continuityEvidenceText(e)});
 }start=-1;last=-1;count=0;};
 for(let i=0;i<range.values.length;i++){
  if(range.validity[i]!==1||!Number.isFinite(range.timeMs[i])||Number.isFinite(range.values[i])){finish();continue;}
  if(last>=0&&range.timeMs[i]!<range.timeMs[last]!)finish();if(start<0)start=i;last=i;count++;
 }finish();return events;
}
