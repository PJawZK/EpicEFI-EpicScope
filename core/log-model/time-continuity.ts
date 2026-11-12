import {getTimeQueryIndex} from './time-query-index';
/** Observed preceding cadence only. A later sampling-rate change cannot establish
 * missing data at the first interval of an earlier/new clock run. */
export function precedingTimeCadence(times:Float64Array,index:number):{medianMs:number|undefined;count:number} {
  const query=getTimeQueryIndex(times),runId=query.runAt(index),run=runId===undefined?undefined:query.runs[runId];
  const intervals:number[]=[];
  for(let i=index-1;i>Math.max(run?.start??0,index-130);i--){const delta=times[i]!-times[i-1]!;if(Number.isFinite(delta)&&delta>0)intervals.push(delta);}
  intervals.sort((a,b)=>a-b);const n=intervals.length,m=n>>>1;
  return {medianMs:n?(n%2?intervals[m]!:(intervals[m-1]!+intervals[m]!)/2):undefined,count:n};
}
export function observedSpacingOutlier(times:Float64Array,index:number,previousTime=times[index-1]!):boolean {
  const delta=times[index]!-previousTime;if(!(delta>50))return false;
  const cadence=precedingTimeCadence(times,index);
  return cadence.medianMs!==undefined&&delta>Math.max(50,5*cadence.medianMs);
}

/** Sequential source projection: same preceding 129 positive intervals as the
 * random-access renderer, with bounded incremental median maintenance. */
export function createTimeCadenceCursor(times:Float64Array):(index:number)=>{medianMs:number|undefined;count:number} {
 const window:{index:number;value:number}[]=[],sorted:number[]=[];let last=0;
 const bound=(value:number)=>{let a=0,b=sorted.length;while(a<b){const m=(a+b)>>>1;if(sorted[m]!<value)a=m+1;else b=m;}return a;};
 return index=>{
  if(index!==last+1)throw new RangeError('Cadence cursor requires consecutive source indices');last=index;
  const j=index-1,delta=times[j]!-times[j-1]!;
  if(times[index]!<times[j]!){window.length=0;sorted.length=0;return {medianMs:undefined,count:0};}
  if(j>0&&(!Number.isFinite(delta)||delta<0)){window.length=0;sorted.length=0;}
  else if(j>0&&delta>0){window.push({index:j,value:delta});sorted.splice(bound(delta),0,delta);}
  while(window.length&&window[0]!.index<=index-130){const removed=window.shift()!;sorted.splice(bound(removed.value),1);}
  const n=sorted.length,m=n>>>1;return {medianMs:n?(n%2?sorted[m]!:(sorted[m-1]!+sorted[m]!)/2):undefined,count:n};
 };
}
