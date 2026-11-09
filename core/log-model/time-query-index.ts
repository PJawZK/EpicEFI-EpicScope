/** Immutable timestamp query metadata. Canonical arrays are never sorted or rewritten.
 * Build once at source/range publication; CRC/value changes do not invalidate it.
 * Few runs: bounded run-local binary searches. Many runs: a separate original-index
 * permutation prevents repeated O(recordCount) searches through pathological runs.
 */
export interface TimeSpan { readonly start: number; readonly end: number; readonly run: number }
export interface TimeRun { readonly start: number; readonly end: number }
const indexes = new WeakMap<Float64Array, TimeQueryIndex>();
const RUN_SEARCH_LIMIT = 64;
export class TimeQueryIndex {
  readonly runs: readonly TimeRun[];
  readonly min: number;
  readonly max: number;
  readonly permutation: Uint32Array | undefined;
  constructor(readonly times: Float64Array) {
    const runs: TimeRun[] = []; let start = -1, min = Infinity, max = -Infinity;
    for (let i = 0; i < times.length; i++) {
      const t = times[i]!;
      if (!Number.isFinite(t)) { if (start >= 0) runs.push({start,end:i}); start = -1; continue; }
      min = Math.min(min,t); max = Math.max(max,t);
      if (start < 0) start = i;
      else if (t < times[i-1]!) { runs.push({start,end:i}); start=i; }
    }
    if (start >= 0) runs.push({start,end:times.length});
    this.runs=runs;this.min=min;this.max=max;
    if (runs.length > RUN_SEARCH_LIMIT) {
      const count=runs.reduce((n,r)=>n+r.end-r.start,0),order=new Uint32Array(count);let at=0;
      for(const r of runs)for(let i=r.start;i<r.end;i++)order[at++]=i;
      order.sort((a,b)=>times[a]!-times[b]!||a-b);this.permutation=order;
    }
  }
  get monotonic(): boolean { return this.runs.length === 1 && this.runs[0]!.start===0 && this.runs[0]!.end===this.times.length; }
  bound(target:number, start:number, end:number, upper=false):number {
    while(start<end){const mid=start+Math.floor((end-start)/2);if(this.times[mid]!<target||(upper&&this.times[mid]===target))start=mid+1;else end=mid;}return start;
  }
  private orderBound(target:number,upper=false):number {
    const order=this.permutation!;let lo=0,hi=order.length;
    while(lo<hi){const m=(lo+hi)>>>1,t=this.times[order[m]!]!;if(t<target||(upper&&t===target))lo=m+1;else hi=m;}return lo;
  }
  runAt(index:number):number|undefined {
    let lo=0,hi=this.runs.length;while(lo<hi){const m=(lo+hi)>>>1;if(this.runs[m]!.start<=index)lo=m+1;else hi=m;}
    const r=this.runs[lo-1];return r&&index<r.end?lo-1:undefined;
  }
  spans(startMs:number,endMs:number,neighbors=false):TimeSpan[] {
    const lo=Math.min(startMs,endMs),hi=Math.max(startMs,endMs);if(Number.isNaN(lo)||Number.isNaN(hi))throw new RangeError('Invalid time query');
    if(lo<=this.min&&hi>=this.max)return this.runs.map((r,run)=>({...r,run}));
    if(this.permutation && !neighbors){
      const a=this.orderBound(lo),b=this.orderBound(hi,true),selected=this.permutation.slice(a,b);selected.sort();const spans:TimeSpan[]=[];
      for(const i of selected){const run=this.runAt(i)!,last=spans.at(-1);if(last&&last.end===i&&last.run===run)spans[spans.length-1]={...last,end:i+1};else spans.push({start:i,end:i+1,run});}return spans;
    }
    // Neighbor queries on many runs use exact membership plus the nearest source
    // neighbors at each selected span. Empty bracketing queries use nearest time.
    if(this.permutation){const spans=this.spans(lo,hi);if(!spans.length){const i=this.nearest((lo+hi)/2);if(i===undefined)return [];const run=this.runAt(i)!,r=this.runs[run]!;return [{start:Math.max(r.start,i-1),end:Math.min(r.end,i+2),run}];}return spans.map(s=>({start:Math.max(this.runs[s.run]!.start,s.start-1),end:Math.min(this.runs[s.run]!.end,s.end+1),run:s.run}));}
    const spans:TimeSpan[]=[];
    this.runs.forEach((r,run)=>{if(this.times[r.end-1]!<lo||this.times[r.start]!>hi)return;let start=this.bound(lo,r.start,r.end),end=this.bound(hi,r.start,r.end,true);if(neighbors){start=Math.max(r.start,start-1);end=Math.min(r.end,end+1);}if(start<end)spans.push({start,end,run});});return spans;
  }
  cover(startMs:number,endMs:number,neighbors=false):{startSampleIndex:number;sampleCount:number} {
    const spans=this.spans(startMs,endMs,neighbors);if(!spans.length)return {startSampleIndex:0,sampleCount:0};let start=Infinity,end=0;for(const s of spans){start=Math.min(start,s.start);end=Math.max(end,s.end);}return {startSampleIndex:start,sampleCount:end-start};
  }
  nearest(target:number,anchor?:number):number|undefined {
    if(!Number.isFinite(target)||target<this.min||target>this.max)return undefined;
    let best:number|undefined,distance=Infinity;
    const consider=(i:number)=>{const t=this.times[i];if(t===undefined||!Number.isFinite(t))return;const d=Math.abs(t-target);if(d<distance||(d===distance&&(best===undefined||t<this.times[best]!||(t===this.times[best]&&i<best)))){best=i;distance=d;}};
    if(anchor!==undefined&&!this.monotonic){const k=this.runAt(anchor),r=k===undefined?undefined:this.runs[k];if(!r||target<this.times[r.start]!||target>this.times[r.end-1]!)return undefined;const i=this.bound(target,r.start,r.end);if(i<r.end)consider(i);if(i>r.start)consider(this.bound(this.times[i-1]!,r.start,r.end));return best;}
    if(this.permutation){const at=this.orderBound(target),order=this.permutation;if(at<order.length)consider(order[at]!);if(at>0)consider(order[this.orderBound(this.times[order[at-1]!]!)]!);return best;}
    for(const r of this.runs){const i=this.bound(target,r.start,r.end);if(i<r.end)consider(i);if(i>r.start)consider(this.bound(this.times[i-1]!,r.start,r.end));}return best;
  }
  /** Temporal calculation requires an explicit original anchor when runs overlap.
   * Without an anchor, nonmonotonic histories are not interpolation authority. */
  bracket(target:number,anchor?:number):readonly [number,number]|undefined {
    const k=this.monotonic?0:anchor===undefined?undefined:this.runAt(anchor),r=k===undefined?undefined:this.runs[k];
    if(!r||!Number.isFinite(target)||target<this.times[r.start]!||target>this.times[r.end-1]!)return undefined;
    if(anchor!==undefined&&anchor>=r.start&&anchor<r.end&&this.times[anchor]===target)return [anchor,anchor];
    const i=this.bound(target,r.start,r.end);if(this.times[i]===target)return [i,i];if(i<=r.start||i>=r.end)return undefined;return [i-1,i];
  }
}
export function getTimeQueryIndex(times:Float64Array):TimeQueryIndex {let index=indexes.get(times);if(!index){index=new TimeQueryIndex(times);indexes.set(times,index);}return index;}

/** Legacy temporal detectors cannot merge histories solely because timestamps
 * overlap. Order-independent aggregates can still consume all selected records. */
export function requireSingleMonotonicRun(times:Float64Array,origin:number,indices:readonly number[]):void {
  const index=getTimeQueryIndex(times);if(index.monotonic)return;
  let selectedRun:number|undefined;
  for(const sourceIndex of indices){const run=index.runAt(sourceIndex-origin);if(run===undefined)continue;if(selectedRun!==undefined&&run!==selectedRun)throw new RangeError('Temporal events require one monotonic source segment; selected records cross a backward-time boundary. Source data is unchanged.');selectedRun=run;}
}
