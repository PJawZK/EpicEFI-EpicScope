import type {ChannelDefinition,NumericChannelRange} from '../../../../core/log-model/log-types';
import type {TimelineViewport} from '../../../../core/timeline/viewport-state';
import {nearestNumericSamplePosition} from '../../../../core/timeline/viewport-series';
interface HoverTrace {readonly channel:ChannelDefinition;readonly range:NumericChannelRange;readonly color:string;}
/** Graph-owned presentation only: cached original samples, no data-source/read/cursor capability.
 * A top-layer tooltip avoids clipping eight values inside short freeform rows. */
export function createGraphHoverInspection(root:HTMLElement,canvas:HTMLCanvasElement,getView:()=>{viewport:TimelineViewport|undefined;traces:readonly HoverTrace[]}){
  const line=document.createElement('div');line.className='graph-hover-line';line.hidden=true;line.setAttribute('aria-hidden','true');
  const popup=document.createElement('div');popup.className='graph-hover-popup';popup.setAttribute('popover','manual');popup.setAttribute('role','tooltip');
  const title=document.createElement('strong'),rows=Array.from({length:8},()=>document.createElement('div'));popup.append(title,...rows);root.append(line,popup);
  let frame:number|undefined,point:{x:number;y:number}|undefined,listener:((timeMs:number|undefined)=>void)|undefined;
  const closePopup=()=>{if(popup.matches(':popover-open'))popup.hidePopover();};
  const setTime=(time:number|undefined)=>{
    if(time===undefined){if(!line.hidden)line.hidden=true;closePopup();if(frame!==undefined)cancelAnimationFrame(frame);frame=undefined;point=undefined;return;}
    const {viewport}=getView(),width=canvas.clientWidth;
    if(time===undefined||!Number.isFinite(time)||!viewport||time<viewport.visibleStartMs||time>viewport.visibleEndMs||viewport.visibleEndMs<=viewport.visibleStartMs||!canvas.getClientRects().length){line.hidden=true;return;}
    line.style.left=`${6+(time-viewport.visibleStartMs)/(viewport.visibleEndMs-viewport.visibleStartMs)*Math.max(1,width-12)}px`;line.hidden=false;
  };
  const clear=()=>{const owned=point!==undefined||popup.matches(':popover-open');setTime(undefined);if(owned)listener?.(undefined);};
  const inspect=()=>{
    frame=undefined;const pointer=point;if(!pointer||root.closest('[hidden]')||root.classList.contains('graph-viewport--panning')){clear();return;}
    const {viewport,traces}=getView(),rect=canvas.getBoundingClientRect();
    if(!viewport||!traces.length||rect.width<=12||rect.height<=0){clear();return;}
    const ratio=Math.min(1,Math.max(0,(pointer.x-rect.left-6)/(rect.width-12))),time=viewport.visibleStartMs+ratio*(viewport.visibleEndMs-viewport.visibleStartMs),reference=nearestNumericSamplePosition(traces[0]!.range,time);
    if(!reference||reference.timeMs<viewport.visibleStartMs||reference.timeMs>viewport.visibleEndMs){clear();return;}
    setTime(reference.timeMs);listener?.(reference.timeMs);
    title.textContent=`Hover · ${(reference.timeMs/1000).toFixed(3)} s · sample ${reference.sampleIndex}`;
    rows.forEach((row,i)=>{const trace=traces[i];row.hidden=!trace;if(!trace)return;const index=reference.sampleIndex-trace.range.startSampleIndex,value=trace.range.values[index],valid=trace.range.validity[index]===1&&trace.range.timeMs[index]===reference.timeMs&&value!==undefined&&Number.isFinite(value);row.style.color=trace.color;row.textContent=`${trace.channel.sourceName}: ${valid?value.toFixed(Math.min(6,Math.max(0,trace.channel.precision??2)))+(trace.channel.unit?' '+trace.channel.unit:''):'Unavailable'}`;});
    if(!popup.matches(':popover-open'))popup.showPopover();
    const size=popup.getBoundingClientRect();popup.style.left=`${Math.max(8,Math.min(innerWidth-size.width-8,pointer.x+14))}px`;popup.style.top=`${Math.max(8,Math.min(innerHeight-size.height-8,pointer.y+14))}px`;
  };
  canvas.addEventListener('pointermove',event=>{if(event.pointerType==='touch'||event.buttons){clear();return;}point={x:event.clientX,y:event.clientY};if(frame===undefined)frame=requestAnimationFrame(inspect);});
  canvas.addEventListener('pointerleave',clear);canvas.addEventListener('pointercancel',clear);canvas.addEventListener('pointerdown',clear);canvas.addEventListener('wheel',clear,{passive:true});
  return {clear,setTime,onHover(listenerValue:typeof listener){listener=listenerValue;}};
}
