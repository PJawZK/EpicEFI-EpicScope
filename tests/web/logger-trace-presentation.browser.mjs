import { createTimelineShell } from '../../apps/web/src/components/timeline-shell';
import { createGraphViewport } from '../../apps/web/src/components/graph-viewport';
const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const assert = (ok, message) => { if (!ok) throw Error(message); };

export async function runLoggerTracePresentationChecks() {
  const checks = [], host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0 auto auto 0;width:1680px;z-index:100;background:#071019';
  document.body.append(host);
  const timeline = createTimelineShell(); host.append(timeline.element);
  const extent = { startMs: 0, endMs: 6_000_000_000, durationMs: 6_000_000_000 };
  const selectors = ['.transport', '.timeline-progress', '.timeline-zoom-actions', '.timeline-history-actions', '.timeline-navigate-status'];
  const geometry = () => selectors.flatMap(selector => [...timeline.element.querySelectorAll(selector)].map(e => {
    const r = e.getBoundingClientRect(); return { x: r.x, width: r.width, height: r.height };
  }));
  try {
    timeline.setTimeRange(extent, 1000); await frame();
    for (const width of [1680, 1024, 480]) {
      host.style.width = width + 'px'; await frame();
      const before = geometry();
      for (const time of [0, 59_999, 600_000, 60_000_000, 5_999_999_999]) {
        timeline.setCursorTime(time);
        timeline.setViewport({ fullStartMs: 0, fullEndMs: extent.endMs, visibleStartMs: time, visibleEndMs: Math.min(extent.endMs, time + 1000) });
        await frame(); const after = geometry();
        assert(after.every((r, i) => Math.abs(r.x - before[i].x) < .1 && Math.abs(r.width - before[i].width) < .1 && r.height === before[i].height), 'Timestamp text moved navigation controls at width ' + width);
      }
      const controls = timeline.element.querySelector('.timeline-controls');
      assert(controls.scrollWidth <= controls.clientWidth || getComputedStyle(controls).overflowX === 'auto', 'Narrow controls overflow without access');
    }
    checks.push('Cursor/Visible digit changes preserve button and timeline geometry at desktop, medium and narrow widths, including long recordings');
    checks.push('Narrow navigation remains horizontally accessible instead of squeezing or wrapping controls');
  } finally { timeline.setTimeRange(undefined, 0); host.remove(); }

  const graphHost = document.createElement('div');
  graphHost.style.cssText = 'position:fixed;left:0;top:0;width:112px;height:200px;z-index:100';
  const graph = createGraphViewport(); graphHost.append(graph.element); document.body.append(graphHost);
  const times = Float64Array.from([...Array.from({length:400},(_,i)=>i/100),20,40]);
  const range = {startSampleIndex:0,timeMs:times,values:new Float64Array(times.length).fill(900),validity:new Uint8Array(times.length).fill(1)};
  const channel = {id:'rpm',sourceName:'RPM',displayName:'RPM',valueType:'number',unit:'RPM'};
  const source = {sampleCount:times.length,readChannelRange:async()=>{throw Error('Presentation must use retained samples');}};
  const tracePixels = () => {
    const canvas = graph.element.querySelector('canvas'), rect = canvas.getBoundingClientRect(), x = 6 + (rect.width - 12) * .35, y = rect.height / 2;
    const pixels = canvas.getContext('2d').getImageData(Math.round(x*devicePixelRatio),Math.round((y-3)*devicePixelRatio),1,Math.max(1,Math.round(7*devicePixelRatio))).data;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]===66&&pixels[i+1]===165&&pixels[i+2]===245)return true;
    return false;
  };
  try {
    graph.setLog([channel],source,{startMs:0,endMs:40,durationMs:40});graph.activatePreloadedChannels(new Map([['rpm',range]]));
    for(const end of [40,30,20]){graph.setViewport({fullStartMs:0,fullEndMs:40,visibleStartMs:0,visibleEndMs:end},0);await frame();assert(tracePixels(),'Valid trace disappeared across empty pixels when zoomed to '+end);}
    checks.push('Actual Logger canvas connects checksum-valid observations across empty pixel buckets while zooming');
    for(const start of [5,6,12]){graph.setViewport({fullStartMs:0,fullEndMs:40,visibleStartMs:start,visibleEndMs:start+5},0);await frame();assert(tracePixels(),'Trace vanished while panning between valid observations');}
    checks.push('Panning between source observations retains the clipped segment from actual boundary neighbors');
    range.values[400]=NaN;
    graph.activatePreloadedChannels(new Map([['rpm',range]]));graph.setViewport({fullStartMs:0,fullEndMs:40,visibleStartMs:0,visibleEndMs:40},0);await frame();
    assert(!tracePixels(),'Nonfinite source gap was filled');
    checks.push('Actual Logger canvas retains a recorded nonfinite interruption instead of smoothing or zero-filling it');
  } finally { graph.clear();graphHost.remove(); }
  return {passed:checks.length,checks};
}
