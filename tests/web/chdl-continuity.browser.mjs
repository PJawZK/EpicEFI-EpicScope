import {chdlClockFixture} from '../fixtures/mlg/chdl-clock';
import {parseMlg} from '../../core/parsers/mlg/mlg-parser';
import {MemoryByteSource} from '../../core/parsers/byte-source';
import {sourceIntegrityMarkersFromDiagnostics} from '../../apps/web/src/app/source-integrity-markers';
import {createGraphViewport} from '../../apps/web/src/components/graph-viewport';
import {createTimelineShell} from '../../apps/web/src/components/timeline-shell';
import {createLoggerPage} from '../../apps/web/src/pages/logger-page';
import {buildRawViewportSeries} from '../../core/timeline/viewport-series';
const assert=(v,m)=>{if(!v)throw Error(m);};
const frame=()=>new Promise(r=>requestAnimationFrame(r));
export async function runChdlContinuityChecks(){
 const checks=[],bytes=chdlClockFixture(),parsed=await parseMlg(new MemoryByteSource(bytes),{id:'clock-browser',format:'MLG',displayName:'clock.mlg',sizeBytes:bytes.length});
 const marker=sourceIntegrityMarkersFromDiagnostics(parsed.summary.diagnostics).find(m=>m.timeMs===6535.27),graph=createGraphViewport(),timeline=createTimelineShell();
 graph.element.style.cssText='position:fixed;left:0;top:80px;width:800px;height:280px;z-index:99999';timeline.element.style.width='800px';document.body.append(graph.element,timeline.element);
 try{
  const channel=parsed.summary.channels[0],range=await parsed.channelData.readChannelRange(channel.id,0,parsed.channelData.sampleCount);
  assert(buildRawViewportSeries(range,6000,7500).find(p=>p.timeMs===6947.06)?.breakBefore===false,'CHDL first new-run interval remains falsely broken');
  assert(Math.abs(marker?.evidence?.deltaMs+322.26)<1e-6&&marker.kind==='timestamp-gap','Missing observed canonical clock evidence');checks.push('real-header transition preserves valid samples and removes future-cadence false gap');
  graph.setLog(parsed.summary.channels,parsed.channelData,parsed.summary.timeRange);await graph.toggleChannel(channel.id);graph.setSourceIntegrity(parsed.channelData,[marker]);graph.setViewport({fullStartMs:0,fullEndMs:9000,visibleStartMs:6000,visibleEndMs:7500});await frame();
  const c=graph.element.querySelector('canvas'),r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+6+(6535.27-6000)/1500*(r.width-12),clientY:r.top+r.height/2-22}));
  const notice=graph.element.querySelector('.graph-toast');assert(!notice.hidden&&notice.textContent.includes('original records 23 → 24')&&notice.textContent.includes('322.26')&&notice.textContent.includes('Related CRC records: none'),'Amber graph notice lost provenance');checks.push('amber click shows source indices, exact clock interval, cadence and CRC relation');
  timeline.setTimeRange({startMs:0,endMs:9000,durationMs:9000},range.values.length);timeline.setSourceIntegrity([marker]);await frame();const overview=timeline.element.querySelector('.timeline-overview'),o=overview.getBoundingClientRect();overview.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:o.left+6535.27/9000*o.width,clientY:o.top+2}));
  assert(!timeline.element.querySelector('.timeline-integrity-detail').hidden&&timeline.element.querySelector('.timeline-integrity-detail').textContent.includes('original records 23 → 24'),'Overview marker lacks observed evidence');checks.push('overview click exposes the same canonical evidence');
 }finally{graph.clear();graph.disposeSourceIntegrity();graph.element.remove();timeline.element.remove();}
 const logger=createLoggerPage();logger.element.style.cssText='position:fixed;left:0;top:80px;width:800px;height:500px;z-index:99999';document.body.append(logger.element);let reads=0;
 const source={sampleCount:10,async readChannelRange(){reads++;return {startSampleIndex:0,timeMs:Float64Array.from({length:10},(_,i)=>i*100),values:Float64Array.from({length:10},(_,i)=>i>0&&i<8?NaN:1),validity:new Uint8Array(10).fill(1)};}};
 const id={id:'availability',format:'MLG',displayName:'availability.mlg',sizeBytes:0},channels=[{id:'RPM',sourceName:'RPM',displayName:'RPM',unit:'rpm',valueType:'number'}];
 try{
  logger.setLog({source:id,channels,markers:[],timeRange:{startMs:0,endMs:900,durationMs:900},diagnostics:[{code:'mlg-crc-validation-pending',severity:'info',message:'pending',recoverable:true}]},10,source);
  await logger.restoreWorkspaceState(logger.getWorkspaceState());
  for(let i=0;i<50&&reads===0;i++)await frame();await frame();
  assert(!logger.getParserDiagnosticsEvidence().some(d=>d.code==='mlg-channel-unavailable'),'Provisional channel data classified before CRC validation');
  logger.setDiagnostics([],id);assert(logger.getParserDiagnosticsEvidence().some(d=>d.code==='mlg-channel-unavailable'&&d.severity==='info'),'Validated loaded channel NaNs missing info');const evidence=logger.getParserDiagnosticsEvidence(),before=reads;
  logger.setDiagnostics([], { ...id });assert(logger.getParserDiagnosticsEvidence()===evidence,'Stale identity overwrote availability');assert(reads===before,'Publishing availability caused additional source I/O');checks.push('channel availability waits for CRC acceptance, uses loaded data and rejects stale sources');
  await frame();const canvas=logger.element.querySelector('.graph-window:not([hidden]) canvas'),rect=canvas.getBoundingClientRect();
  canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:rect.left+6+100/900*(rect.width-12),clientY:rect.top+rect.height/2+22}));
  const info=logger.element.querySelector('.graph-window:not([hidden]) .graph-toast');assert(!info.hidden&&info.textContent.includes('channel-unavailable')&&info.textContent.includes('original records 1 → 7'),'Blue channel-only graph marker lacks availability evidence');
  checks.push('blue channel-only marker is inspectable on its affected graph without a CRC classification');
 }finally{logger.disposeSourceIntegrity();logger.element.remove();}
 return {passed:checks.length,checks};
}
