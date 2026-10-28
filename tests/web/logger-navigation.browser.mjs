import {createGraphViewport} from '../../apps/web/src/components/graph-viewport';
import {panViewport,cursorAfterViewportPan} from '../../core/timeline/viewport-state';
const assert=(value,message)=>{if(!value)throw Error(message);};
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
export async function runLoggerNavigationChecks(){
 const checks=[],host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:900px;height:260px;z-index:100';document.body.append(host);
 const graph=createGraphViewport();host.append(graph.element);const canvas=graph.element.querySelector('canvas');
 // Synthetic events cannot acquire native pointer capture. Real capture is covered by CDP replay.
 let captured=false;canvas.setPointerCapture=()=>{captured=true;};canvas.hasPointerCapture=()=>captured;canvas.releasePointerCapture=()=>{captured=false;};
 const channels=[{id:'rpm',sourceName:'RPM',displayName:'RPM',unit:'RPM',valueType:'number'}];
 const range={startSampleIndex:0,timeMs:Float64Array.from([1000,2000,3000,4000,5000]),values:Float64Array.from([900,950,1000,950,900]),validity:new Uint8Array(5).fill(1)};
 const source={sampleCount:5,readChannelRange:async()=>{throw Error('Navigation must use retained data');}};
 let view={fullStartMs:1000,fullEndMs:5000,visibleStartMs:2000,visibleEndMs:4000},cursor=2500,seeks=[],pans=[];
 const load=()=>{graph.setLog(channels,source,{startMs:1000,endMs:5000,durationMs:4000});graph.activatePreloadedChannels(new Map([['rpm',range]]));graph.setViewport(view,cursor);};
 graph.onSeekTime(time=>{seeks.push(time);cursor=time;graph.setCursorTime(time);});
 graph.onPan(delta=>{pans.push(delta);const next=panViewport(view,delta);cursor=cursorAfterViewportPan(view,next,cursor);view=next;graph.setViewport(view,cursor);});
 const event=(type,ratio,extra={})=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.left+6+(r.width-12)*ratio,clientY:r.top+30,...extra}));};
 const click=ratio=>{event('pointerdown',ratio);event('pointerup',ratio);};
 try{
  load();await frame();click(.3);assert(Math.abs(cursor-2600)<.01&&seeks.length===1,'Click did not seek visible source time');click(.9);assert(Math.abs(cursor-3800)<.01&&seeks.length===2,'Farther click did not produce larger time jump');checks.push('near and far clicks select proportional visible times with nonzero source extent');
  event('pointerdown',.5);event('pointermove',.501);event('pointerup',.501);assert(seeks.length===3&&pans.length===0,'Small pointer jitter became drag');checks.push('sub-four-pixel jitter remains a click');
  const old=view,oldCursor=cursor;event('pointerdown',.5);event('pointermove',.4);event('pointerup',.4);assert(seeks.length===3&&pans.length===1&&view.visibleStartMs>old.visibleStartMs,'Drag also sought or did not pan');assert(Math.abs((cursor-oldCursor)-(view.visibleStartMs-old.visibleStartMs))<.01,'Selected cursor did not follow actual pan');checks.push('drag carries selected time by actual viewport movement without release seek');
  event('pointerdown',.5);event('pointercancel',.5);event('pointerup',.7);assert(seeks.length===3&&!captured,'Cancelled pointer committed seek');event('pointerdown',.5);event('lostpointercapture',.5);event('pointerup',.7);assert(seeks.length===3,'Lost capture committed seek');checks.push('pointer cancellation and lost capture reject pending selection');
  event('pointerdown',.5);graph.cancelNavigationGesture();event('pointerup',.7);assert(seeks.length===3,'Hidden-view cancellation committed seek');event('pointerdown',.5);load();event('pointerup',.7);assert(seeks.length===3,'Source replacement committed old seek');checks.push('explicit view retirement and source replacement reject obsolete gestures');
  event('pointerdown',.5,{button:2});event('pointerup',.7,{button:2});assert(seeks.length===3,'Right button sought');checks.push('non-primary buttons leave selection unchanged');
  view={fullStartMs:1000,fullEndMs:5000,visibleStartMs:1000,visibleEndMs:5000};cursor=2500;graph.setViewport(view,cursor);event('pointerdown',.5);event('pointermove',.3);event('pointerup',.3);assert(cursor===2500&&view.visibleStartMs===1000,'Blocked full-log pan moved cursor');checks.push('full-log clamping does not create a cursor jump');
 }finally{graph.cancelNavigationGesture();graph.clear();host.remove();}
 return{passed:checks.length,checks};
}
