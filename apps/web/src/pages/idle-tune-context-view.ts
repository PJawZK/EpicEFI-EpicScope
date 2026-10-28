import type { TuneModel } from '../../../../core/tune/tune-model';
import { IDLE_TUNE_PANELS, IDLE_TUNE_AUTHORITY, projectIdleTune, lookupIdleTuneReference, type IdleTunePanelContext, type IdleTunePanelId } from '../../../../core/tune/idle-tune-context';
/** Scoped read-only related-tune dialog. Tune context never becomes recorded analysis authority. */
export function createIdleTuneContextView(signal:AbortSignal,onProjection:()=>void){
  const element=document.createElement('dialog');element.className='idle-region-manager idle-tune-dialog';element.setAttribute('aria-label','Idle related tune tables');
  element.innerHTML=`<header><h2>Related tune tables · read only</h2><button type="button" data-idle-tune="close" aria-label="Close related tune tables">×</button></header>
    <p data-idle-tune="identity"></p><p data-idle-tune="authority"></p><label>Related context <select data-idle-tune="panel" aria-label="Idle related tune context"></select></label>
    <p data-idle-tune="geometry"></p><section class="idle-tune-lookup"><strong>Reference lookup · user coordinates</strong><label>X <input type="number" step="any" data-idle-tune="x" aria-label="Loaded tune reference X"></label><span data-idle-tune="x-unit"></span><label data-idle-tune="y-control">Y <input type="number" step="any" data-idle-tune="y" aria-label="Loaded tune reference Y"></label><span data-idle-tune="y-unit"></span><output data-idle-tune="lookup"></output></section>
    <p>Lookup uses shared linear/bilinear interpolation and endpoint clamping on the loaded reference only. It is not a firmware prediction or a logged operating-point highlight. Table cells select details; they cannot edit values.</p>
    <div class="idle-region-table" data-idle-tune="grid"></div><p data-idle-tune="cell" role="status"></p><details><summary>Exact loaded entries and availability</summary><div class="idle-tune-entries" data-idle-tune="entries"></div></details>
    <p>Runtime gates: tune-derived bias mismatch, saturation/clamp coverage and raw-to-applied attenuation remain unavailable. Loaded configuration does not prove flashed state, actuator identity, controller output staging or common engineering scaling. No ECU, Burn or MSQ changes.</p><footer><button type="button" data-idle-tune="close">Done</button></footer>`;
  const field=<T extends HTMLElement=HTMLElement>(name:string)=>element.querySelector<T>(`[data-idle-tune="${name}"]`)!;
  const select=field<HTMLSelectElement>('panel');for(const panel of IDLE_TUNE_PANELS)select.add(new Option(panel.label,panel.id));
  let resetCoordinates=false,active=false,disposed=false,model:TuneModel|undefined,sourceName:string|undefined,recording='No recording',projection:readonly IdleTunePanelContext[]|undefined;
  const current=()=>projection?.find(panel=>panel.id===select.value);
  const number=(value:number)=>Number.isFinite(value)?String(value):'Unavailable';
  const identity=()=>{field('identity').textContent=`MSQ: ${sourceName??'None loaded'} · Signature: ${model?.identity.signature??'unspecified'} · Firmware: ${model?.identity.firmwareInfo??'unspecified'} · Saved: ${model?.identity.writeDate??'unspecified'} · Recording: ${recording}`;field('authority').textContent=IDLE_TUNE_AUTHORITY;};
  const lookup=()=>{
    const panel=current(),x=field<HTMLInputElement>('x').value.trim(),y=field<HTMLInputElement>('y').value.trim();
    const value=panel&&x&&(panel.geometry?.rows===1||y)?lookupIdleTuneReference(panel,Number(x),panel.geometry?.rows===1?0:Number(y)):undefined;
    field('lookup').textContent=value===undefined?'Unavailable — enter valid coordinates for accepted geometry.':`${value.toFixed(3)} ${panel?.geometry?.units||'(unit unspecified)'} · loaded reference only`;
  };
  const render=()=>{
    if(!active||!element.open||disposed)return;
    if(!projection){projection=projectIdleTune(model);onProjection();}
    if(resetCoordinates){field<HTMLInputElement>('x').value='';field<HTMLInputElement>('y').value='';resetCoordinates=false;}
    identity();const panel=current();if(!panel)return;
    field('geometry').textContent=panel.geometryReason;field('x-unit').textContent=panel.xUnit;field('y-unit').textContent=panel.geometry?.rows===1?'':panel.yUnit;
    field('y-control').hidden=panel.geometry?.rows===1;field<HTMLInputElement>('x').disabled=!panel.geometry;field<HTMLInputElement>('y').disabled=!panel.geometry;
    const grid=field('grid');grid.replaceChildren();field('cell').textContent='Select a loaded reference cell to inspect its reference grid coordinates and units.';
    if(panel.geometry){
      const geometry=panel.geometry,table=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr'),corner=document.createElement('th');corner.textContent=geometry.rows===1?geometry.xAxisName:`${geometry.yAxisName} / ${geometry.xAxisName}`;header.append(corner);
      for(const value of geometry.xAxis){const th=document.createElement('th');th.textContent=number(value);header.append(th);}head.append(header);table.append(head);const body=document.createElement('tbody');
      for(let row=0;row<geometry.rows;row++){const tr=document.createElement('tr'),th=document.createElement('th');th.textContent=geometry.rows===1?'Loaded values':number(geometry.yAxis[row]!);tr.append(th);for(let col=0;col<geometry.cols;col++){
        const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent=number(geometry.values[row*geometry.cols+col]!);button.dataset.idleTuneRow=String(row);button.dataset.idleTuneCol=String(col);td.append(button);tr.append(td);
      }body.append(tr);}table.append(body);grid.append(table);
    }else grid.textContent='No validated geometry for this context. Exact raw entries remain available below; no shape or values are invented.';
    const entries=field('entries');entries.replaceChildren();for(const item of panel.entries){const section=document.createElement('section'),heading=document.createElement('strong'),text=document.createElement('p');heading.textContent=item.name;
      const e=item.entry;text.textContent=e?`Page ${e.pageNumber??'unspecified'} · ${e.rows} × ${e.cols} · ${e.units||'unit unspecified'} · ${e.numericValues?e.numericValues.map(number).join(', '):(e.textValue??'').slice(0,2048)} · ${item.reason}`:`${item.status}: ${item.reason}`;section.append(heading,text);entries.append(section);}
    lookup();
  };
  field('grid').addEventListener('click',event=>{
    const button=(event.target as Element).closest<HTMLButtonElement>('button[data-idle-tune-row]'),panel=current(),geometry=panel?.geometry;if(!button||!geometry)return;
    const row=Number(button.dataset.idleTuneRow),col=Number(button.dataset.idleTuneCol);
    if(!Number.isInteger(row)||!Number.isInteger(col)||row<0||col<0||row>=geometry.rows||col>=geometry.cols)return;
    field('cell').textContent=`${geometry.name} · row ${row+1}, column ${col+1} · X ${number(geometry.xAxis[col]!)} ${panel!.xUnit}${geometry.rows>1?` · Y ${number(geometry.yAxis[row]!)} ${panel!.yUnit}`:''} · value ${number(geometry.values[row*geometry.cols+col]!)} ${geometry.units||'(unit unspecified)'} · loaded MSQ reference, runtime association unverified.`;
  },{signal});
  for(const button of element.querySelectorAll('[data-idle-tune=close]'))button.addEventListener('click',()=>element.close(),{signal});
  select.addEventListener('change',()=>{field<HTMLInputElement>('x').value='';field<HTMLInputElement>('y').value='';render();},{signal});
  for(const key of ['x','y'])field(key).addEventListener('input',lookup,{signal});
  return {element,
    setActive(next:boolean){active=next;if(!next)element.close();},
    setRecording(name:string){if(recording===name)return;recording=name;if(active&&element.open)identity();},
    setTuneModel(next:TuneModel|undefined,name?:string){if(disposed||model===next&&sourceName===name)return;const changed=model!==next;model=next;sourceName=name;if(changed){projection=undefined;resetCoordinates=true;}if(active&&element.open){if(changed)render();else identity();}},
    open(id:IdleTunePanelId){if(!active||disposed)return;select.value=id;if(!element.open)element.showModal();render();},
    dispose(){disposed=true;active=false;model=undefined;projection=undefined;element.close();element.replaceChildren();},
  };
}
