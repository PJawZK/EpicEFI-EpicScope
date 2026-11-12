import {projectChannelUnavailable} from '../../core/parsers/mlg/mlg-continuity';
import {createGraphViewport} from '../../apps/web/src/components/graph-viewport';
import {sourceIntegrityDisplayClusters,sourceIntegrityMarkersFromDiagnostics} from '../../apps/web/src/app/source-integrity-markers';
const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
export async function runGapReconciliationChecks(){
 const graph=createGraphViewport(),checks=[],assert=(v,m)=>{if(!v)throw Error(m);};graph.element.style.cssText='position:fixed;left:0;top:70px;width:800px;height:280px;z-index:999999';document.body.append(graph.element);
 const channels=['RPM','MAP','TPS','CLT'].map(id=>({id,sourceName:id,displayName:id,unit:'',valueType:'number'})),timeMs=Float64Array.from([...Array.from({length:409},(_,i)=>14523.28-(408-i)*10.56),14583.26,14593.82,14604.38]);
 const ranges=new Map(channels.map(c=>[c.id,{startSampleIndex:0,timeMs,values:new Float64Array(timeMs.length).fill(900),validity:new Uint8Array(timeMs.length).fill(1)}]));const source={sampleCount:timeMs.length,readChannelRange:async()=>{throw Error('Retained graph must not read source');}};
 const drawn=()=>{const canvas=graph.element.querySelector('canvas'),r=canvas.getBoundingClientRect(),x=6+(14553.27-14495)/120*(r.width-12),data=canvas.getContext('2d').getImageData(Math.round(x*devicePixelRatio),Math.round((r.height/2-2)*devicePixelRatio),1,Math.round(5*devicePixelRatio)).data;for(let i=0;i<data.length;i+=4)if(data[i]>160||data[i+1]>160||data[i+2]>180)return true;return false;};
 try{
  graph.setLog(channels,source,{startMs:timeMs[0],endMs:14604.38,durationMs:14604.38-timeMs[0]});graph.activatePreloadedChannels(ranges);graph.setViewport({fullStartMs:timeMs[0],fullEndMs:14604.38,visibleStartMs:14495,visibleEndMs:14615});await frame();assert(drawn(),'CHDL threshold-only interval is a visible unexplained gap');checks.push('four finite channels draw through CHDL spacing without an unsupported warning');
  const diagnostics=[{code:'mlg-source-time-spacing',severity:'info',message:'Threshold observation',recoverable:true,timeMs:14583.26,sourceIntegrity:{kind:'cadence-observation',breaksContinuity:false}}];assert(sourceIntegrityDisplayClusters(sourceIntegrityMarkersFromDiagnostics(diagnostics),14495,14615,800).length===0,'Threshold-only marker promoted');checks.push('threshold observation remains Diagnostics-only when trace continuity is valid');
  for(const r of ranges.values())r.values[408]=NaN;graph.refreshValidity();await frame();assert(!drawn(),'Channel unavailable interval was bridged');checks.push('recorded channel unavailability still interrupts traces');
  const blue=sourceIntegrityMarkersFromDiagnostics(projectChannelUnavailable(ranges.get('RPM'),'RPM','RPM'));graph.setSourceIntegrity(source,blue);await frame();assert(blue.length===1&&blue[0].kind==='channel-unavailable','Isolated unavailable observation has no explanation');
  const visible=sourceIntegrityDisplayClusters(blue,14550,14560,800);assert(visible.length===1&&visible[0].canonicalTimeMs===14523.28,'Zoom inside an unavailable line interval lost its source notice');checks.push('single-channel unavailable sample retains blue source evidence even inside a narrower blank interval');
 }finally{graph.clear();graph.disposeSourceIntegrity();graph.element.remove();}return{passed:checks.length,checks};
}
