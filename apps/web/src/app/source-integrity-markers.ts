import type {
  ParserDiagnostic,
  SourceContinuityEvidence,
  SourceIntegrityKind,
} from '../../../../core/log-model/log-types';

export interface SourceIntegrityMarker {
  readonly timeMs: number;
  readonly kind: SourceIntegrityKind;
  readonly breaksContinuity: boolean;
  readonly count: number;
  readonly message: string;
  readonly clusteredEventCount?:number;
  readonly lastTimeMs?:number;
  readonly evidence?:SourceContinuityEvidence;
  readonly canonicalTimeMs?:number;
}

// Source-owned interval summaries are prepared once. No channel/sample scan on pan.
const unavailableIntervals=new WeakMap<readonly SourceIntegrityMarker[],readonly {marker:SourceIntegrityMarker;start:number;end:number;prefixEnd:number}[]>();
export function sourceIntegrityMarkersFromDiagnostics(
  diagnostics: readonly ParserDiagnostic[],
): readonly SourceIntegrityMarker[] {
  const grouped = new Map<string, SourceIntegrityMarker>();

  for (const diagnostic of diagnostics) {
    const metadata = diagnostic.sourceIntegrity;
    const timeMs = diagnostic.timeMs;
    if (!metadata || timeMs === undefined || !Number.isFinite(timeMs)) continue;

    const key = `${metadata.kind}:${metadata.evidence?.classification ?? ""}:${metadata.evidence?.channelId ?? ""}:${timeMs}`;
    const existing = grouped.get(key);
    if (existing) {
      grouped.set(key, {
        ...existing,
        count: existing.count + 1,
      });
      continue;
    }

    grouped.set(key, {
      timeMs,
      kind: metadata.kind,
      breaksContinuity: metadata.breaksContinuity,
      count: 1,
      message: diagnostic.message,
      ...(metadata.evidence ? {evidence:metadata.evidence} : {}),
    });
  }

  const markers=[...grouped.values()].sort((left,right)=>left.timeMs-right.timeMs);
  const intervals=markers.flatMap(marker=>{
    const e=marker.evidence;
    if(!e||(marker.kind!=='corrupt-record'&&marker.kind!=='channel-unavailable'))return [];
    return [{marker,start:e.traceStartMs??Math.min(e.fromTimeMs,e.toTimeMs),end:e.traceEndMs??Math.max(e.fromTimeMs,e.toTimeMs),prefixEnd:0}];
  }).sort((a,b)=>a.start-b.start);
  let max=-Infinity;for(const interval of intervals){max=Math.max(max,interval.end);interval.prefixEnd=max;}
  unavailableIntervals.set(markers,intervals);return markers;
}

/** Index each immutable canonical projection once; redraw cost is bounded by pixels,
 * not the number of events in a full-log viewport. Prefix counts preserve occurrences. */
const displayIndexes=new WeakMap<readonly SourceIntegrityMarker[],readonly {items:readonly SourceIntegrityMarker[];prefix:readonly number[]}[]>();
function lower(items:readonly SourceIntegrityMarker[],time:number,inclusive=false):number {
 let lo=0,hi=items.length;while(lo<hi){const m=(lo+hi)>>>1;if(items[m]!.timeMs<time||(inclusive&&items[m]!.timeMs===time))lo=m+1;else hi=m;}return lo;
}
export function sourceIntegrityDisplayClusters(markers:readonly SourceIntegrityMarker[],startMs:number,endMs:number,width:number):readonly SourceIntegrityMarker[] {
 if(endMs<=startMs||width<=0)return [];
 const intervals=unavailableIntervals.get(markers),crossing:SourceIntegrityMarker[]=[];
 if(intervals?.length){
  let lo=0,hi=intervals.length;while(lo<hi){const m=(lo+hi)>>>1;if(intervals[m]!.start<=endMs)lo=m+1;else hi=m;}
  for(let i=lo-1;i>=0&&intervals[i]!.prefixEnd>=startMs;i--){const entry=intervals[i]!,m=entry.marker;if(entry.end<startMs||(m.timeMs>=startMs&&m.timeMs<=endMs))continue;
   crossing.push({...m,timeMs:Math.max(startMs,Math.min(endMs,m.timeMs)),canonicalTimeMs:m.timeMs,message:`${m.message} Display anchor clipped to this viewport; original event anchor ${m.timeMs} ms.`});
  }
 }
 if(crossing.length){const selected=markers.slice(lower(markers,startMs),lower(markers,endMs,true));return sourceIntegrityDisplayClusters([...selected,...crossing].sort((a,b)=>a.timeMs-b.timeMs),startMs,endMs,width);}
 const first=lower(markers,startMs),end=lower(markers,endMs,true);
 // Narrow first inspection must not prepare an entire offscreen marker index.
 if(end-first<=Math.max(1,Math.ceil(width/20))){const visible:SourceIntegrityMarker[]=[];for(let i=first;i<end;i++){const m=markers[i]!;if(m.breaksContinuity||m.kind==='channel-unavailable')visible.push(m);}return visible;}
 let groups=displayIndexes.get(markers);
 if(!groups){
  const byKind=new Map<string,SourceIntegrityMarker[]>();
  for(const m of markers){if(!m.breaksContinuity&&m.kind!=='channel-unavailable')continue;const key=m.kind==='channel-unavailable'?`${m.kind}:${m.evidence?.channelId??''}`:m.kind;const items=byKind.get(key)??[];items.push(m);byKind.set(key,items);}
  groups=[...byKind.values()].map(items=>{const prefix=[0];for(const m of items)prefix.push(prefix[prefix.length-1]!+m.count);return {items,prefix};});
  displayIndexes.set(markers,groups);
 }
 const result:SourceIntegrityMarker[]=[],bins=Math.max(1,Math.ceil(width/20));
 for(const {items,prefix} of groups)for(let bin=0;bin<bins;bin++){
  const a=startMs+(endMs-startMs)*bin/bins,b=startMs+(endMs-startMs)*(bin+1)/bins;
  const lo=lower(items,a),hi=lower(items,b,bin===bins-1);if(hi<=lo)continue;
  const first=items[lo]!,last=items[hi-1]!,events=hi-lo,records=prefix[hi]!-prefix[lo]!;
  result.push(events===1?first:{...first,count:records,clusteredEventCount:events,lastTimeMs:last.timeMs,message:`${events} source diagnostic groups clustered from ${first.timeMs} to ${last.timeMs} ms (${records} diagnostic occurrences). Zoom in for individual source events. First: ${first.message} Last: ${last.message}`});
 }
 return result.sort((a,b)=>a.timeMs-b.timeMs);
}

export function sourceIntegrityMarkerColor(marker:SourceIntegrityMarker):string { return marker.kind==='corrupt-record'?'#ef6c75':marker.kind==='channel-unavailable'?'#58a6ff':'#eab95b'; }
