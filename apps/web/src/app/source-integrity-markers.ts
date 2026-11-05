import type {
  ParserDiagnostic,
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
}

export function sourceIntegrityMarkersFromDiagnostics(
  diagnostics: readonly ParserDiagnostic[],
): readonly SourceIntegrityMarker[] {
  const grouped = new Map<string, SourceIntegrityMarker>();

  for (const diagnostic of diagnostics) {
    const metadata = diagnostic.sourceIntegrity;
    const timeMs = diagnostic.timeMs;
    if (!metadata || timeMs === undefined || !Number.isFinite(timeMs)) continue;

    const key = `${metadata.kind}:${timeMs}`;
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
    });
  }

  return [...grouped.values()].sort((left, right) => left.timeMs - right.timeMs);
}

/** Pixel clustering is presentation only: never reclassifies source evidence or claims one cause. */
export function sourceIntegrityDisplayClusters(markers:readonly SourceIntegrityMarker[],startMs:number,endMs:number,width:number):readonly SourceIntegrityMarker[] {
  if(endMs<=startMs||width<=0)return [];
  let low=0,high=markers.length;
  while(low<high){const mid=(low+high)>>>1;if(markers[mid]!.timeMs<startMs)low=mid+1;else high=mid;}
  const bins=new Map<string,{first:SourceIntegrityMarker;last:number;events:number;records:number}>();
  const binCount=Math.max(1,Math.ceil(width/20));
  for(let i=low;i<markers.length;i++){
    const marker=markers[i]!;if(marker.timeMs>endMs)break;if(!marker.breaksContinuity)continue;
    const bin=Math.min(binCount-1,Math.floor((marker.timeMs-startMs)/(endMs-startMs)*binCount)),key=`${marker.kind}:${bin}`,existing=bins.get(key);
    if(existing){existing.last=marker.timeMs;existing.events++;existing.records+=marker.count;}
    else bins.set(key,{first:marker,last:marker.timeMs,events:1,records:marker.count});
  }
  return [...bins.values()].map(b=>b.events===1?b.first:{...b.first,count:b.records,clusteredEventCount:b.events,lastTimeMs:b.last,message:`${b.events} source diagnostic groups clustered from ${b.first.timeMs} to ${b.last} ms (${b.records} diagnostic occurrences). Zoom in for individual source events. First: ${b.first.message}`});
}
