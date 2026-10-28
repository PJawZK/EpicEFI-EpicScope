import {compareIdleStability,type IdleStabilityComparisonSide} from '../../../../core/analysis/idle-stability-comparison';
import {createIdleComparisonSource,type IdleComparisonSourceState} from './idle-comparison-source';
import {idleRoleUnit,suggestAnalyzerChannel,analyzerChannelOptionLabel} from './analyzer-channel-roles';
import {analyzeIdleStability,type IdleStabilityResult} from '../../../../core/analysis/idle-stability';
/** Independent B preparation only. Its source, role mappings and bounds never write primary Logger. */
export function createIdleComparisonSourceView(signal:AbortSignal, primaryEvidence:()=>IdleStabilityComparisonSide|undefined=()=>undefined){
  const element=document.createElement('dialog');element.className='idle-region-manager idle-comparison-source';element.setAttribute('aria-label','Independent recording B');
  element.innerHTML=`<header><h2>Independent recording B · Stability comparison</h2><button type="button" data-idle-b="close" aria-label="Close recording B">×</button></header><p data-idle-b="primary"></p>
    <p>Logger A–B selects bounds within the primary recording. This is a separate recording with its own time axis and channel metadata. Preview B, then compare it with accepted primary Stability evidence. A uses the main Analysis scope controls (including Viewed region); B uses the independent range below. Loading B alone does not run comparison. Tune association and graph alignment are not enabled.</p>
    <div class="idle-tune-lookup"><button type="button" data-idle-b="load">Load / replace B MLG</button><button type="button" data-idle-b="cancel">Cancel replacement</button><button type="button" data-idle-b="release">Release B</button></div><input type="file" accept="application/octet-stream,.mlg" data-idle-b="file" aria-label="Load independent recording B MLG" hidden>
    <p data-idle-b="status" role="status" aria-live="polite"></p><p data-idle-b="identity"></p><div class="idle-b-axis" data-idle-b="axis" aria-label="Independent B source extent"><span></span></div><p data-idle-b="extent"></p>
    <div class="idle-tune-lookup"><label>Start (s)<input type="number" step="any" data-idle-b="start"></label><label>End (s)<input type="number" step="any" data-idle-b="end"></label><button type="button" data-idle-b="apply">Apply B range</button><label>RPM <select data-idle-b="rpm" aria-label="Independent B RPM channel"></select></label><label>Target <select data-idle-b="target" aria-label="Independent B target channel"></select></label><button type="button" data-idle-b="preview">Preview B stability</button></div>
    <p data-idle-b="selection"></p><p data-idle-b="preview-status" role="status"></p><p data-idle-b="metrics"></p><p>Preview uses B's original sample grid and canonical validity. It is recorded variability, not idle qualification or proof of improvement. No primary INI/tune mappings are borrowed. Closing this dialog or leaving Idle cancels pending replacement/preview publication; accepted B remains available for this session.</p><section aria-label="Descriptive Stability comparison"><h3>A / B · recorded Stability</h3><p data-idle-b="a-evidence"></p><button type="button" data-idle-b="compare">Compare accepted A / B</button><p data-idle-b="comparison-status" role="status"></p><div data-idle-b="comparison"></div></section><footer><button type="button" data-idle-b="close">Done</button></footer>`;
  const field=<T extends HTMLElement=HTMLElement>(name:string)=>element.querySelector<T>(`[data-idle-b="${name}"]`)!;
  let active=false,disposed=false,primary='No primary recording',current:IdleComparisonSourceState|undefined,bounds:{startMs:number;endMs:number}|undefined,request=0;
  let preview:{key:string;result:IdleStabilityResult}|undefined;
  let previewPending:string|undefined;
  const refreshPrimary=()=>{
    const a=primaryEvidence();
    field('a-evidence').textContent=a?`A: ${a.sourceName} · RPM ${a.rpmChannel} · target ${a.targetChannel??'Unavailable'} · ${a.regions.map(r=>`${(r.startMs/1000).toFixed(3)}–${(r.endMs/1000).toFixed(3)} s`).join(', ')} · ${a.qualificationDescription}`:'A unavailable. Close this dialog, select the primary Analysis scope and run analysis.';
    field('comparison').replaceChildren();
    field('comparison-status').textContent='Compare explicitly after accepting both source selections. Graph focus alone does not change A analysis.';
  };
  const compare=()=>{
    const a=primaryEvidence(),recording=current?.recording;
    if(!active||!element.open||!a||!preview||!recording||!bounds){field('comparison-status').textContent='Accepted A analysis and B preview are required. Run primary analysis and Preview B stability first.';return;}
    const channelName=(role:string)=>{const id=field<HTMLSelectElement>(role).value;return recording.summary.channels.find(c=>c.id===id)?.sourceName;};
    const b:IdleStabilityComparisonSide={result:preview.result,sourceName:recording.summary.source.displayName,regions:[bounds],rpmChannel:channelName('rpm')??'Unavailable',targetChannel:channelName('target'),qualification:'off',qualificationDescription:'Qualification off; recorded B range'};
    const facts=compareIdleStability(a,b),table=document.createElement('table');table.className='idle-comparison-table';
    const caption=table.createCaption();caption.textContent=`A: ${a.sourceName} ↔ B: ${b.sourceName} · B−A, descriptive only`;
    const header=table.createTHead().insertRow();for(const text of ['Metric','A','B','B−A / availability']){const cell=document.createElement('th');cell.scope='col';cell.textContent=text;header.append(cell);}
    const format=(value:number|undefined)=>value===undefined?'Unavailable':value.toFixed(2);
    for(const metric of facts.metrics){const row=table.insertRow();row.dataset.idleComparisonMetric=metric.label;for(const text of [metric.label,`${format(metric.a)} ${metric.unit==='pp'?'%':metric.unit}`,`${format(metric.b)} ${metric.unit==='pp'?'%':metric.unit}`,metric.reason??`${format(metric.delta)} ${metric.unit}`])row.insertCell().textContent=text;}
    const details=document.createElement('p');details.textContent=`B: RPM ${b.rpmChannel}; target ${b.targetChannel??'Unavailable'}; range ${(bounds.startMs/1000).toFixed(3)}–${(bounds.endMs/1000).toFixed(3)} s; qualification off. A/B valid RPM ${a.result.analysis.rpm.validSampleCount}/${b.result.analysis.rpm.validSampleCount}; invalid ${a.result.analysis.rpm.invalidSampleCount}/${b.result.analysis.rpm.invalidSampleCount}; unavailable ${a.result.analysis.rpm.unavailableSampleCount}/${b.result.analysis.rpm.unavailableSampleCount}. Valid target pairs ${a.result.analysis.tracking?.sampleCount??0}/${b.result.analysis.tracking?.sampleCount??0}; invalid pairs ${a.result.analysis.tracking?.invalidSampleCount??0}/${b.result.analysis.tracking?.invalidSampleCount??0}; unavailable pairs ${a.result.analysis.tracking?.unavailableSampleCount??0}/${b.result.analysis.tracking?.unavailableSampleCount??0}. Sample σ requires at least two valid samples and uses n−1; RMSE uses each source's own aligned target pairs; band ±${a.result.settledBandRpm}/±${b.result.settledBandRpm} RPM. Different durations and valid populations are not resampled or paired across sources.`;
    field('comparison').replaceChildren(table,details);field('comparison-status').textContent=facts.warnings.join(' ');
  };
  field('compare').addEventListener('click',compare,{signal});
  const cancelPreview=()=>{request++;previewPending=undefined;field<HTMLButtonElement>('preview').disabled=!current?.recording;};
  const withdraw=()=>{refreshPrimary();cancelPreview();preview=undefined;field('metrics').textContent='';field('preview-status').textContent='Preview B explicitly after selecting its range/channels.';};
  const selection=()=>{field('selection').textContent=bounds?`Accepted B range ${(bounds.startMs/1000).toFixed(3)}–${(bounds.endMs/1000).toFixed(3)} s. This does not change primary bounds.`:'No B range.';const extent=current?.recording?.summary.timeRange;const marker=field('axis').firstElementChild as HTMLElement;if(bounds&&extent){const duration=extent.endMs-extent.startMs;marker.style.left=duration?`${100*(bounds.startMs-extent.startMs)/duration}%`:'0%';marker.style.width=duration?`${100*(bounds.endMs-bounds.startMs)/duration}%`:'100%';}else marker.style.width='0%';};
  const render=(next:IdleComparisonSourceState)=>{
    if(disposed)return;
    const changed=!current||current.recording!==next.recording;current=next;field('status').textContent=next.message;field<HTMLButtonElement>('cancel').disabled=!next.loading;field<HTMLButtonElement>('release').disabled=!next.recording;
    for(const name of ['apply','preview','rpm','target','start','end'])field<HTMLInputElement>(name).disabled=!next.recording||(name==='preview'&&!!previewPending);
    if(changed){withdraw();const recording=next.recording,extent=recording?.summary.timeRange;bounds=extent?{startMs:extent.startMs,endMs:extent.endMs}:undefined;
      field('identity').textContent=recording?`B: ${recording.summary.source.displayName} · ${recording.channelData.sampleCount.toLocaleString()} indexed records · ${recording.summary.channels.length} recorded channels · ${recording.summary.diagnostics.length} canonical diagnostics`:'B unavailable.';
      field('extent').textContent=extent?`B source axis ${(extent.startMs/1000).toFixed(3)}–${(extent.endMs/1000).toFixed(3)} s · amber is the independent B range.`:'No B source axis.';
      for(const role of ['rpm','target'] as const){const select=field<HTMLSelectElement>(role);select.replaceChildren(new Option(role==='rpm'?'Select RPM':'Unavailable / no target',''));const choices=(recording?.summary.channels??[]).filter(channel=>idleRoleUnit(channel,role));for(const channel of choices)select.add(new Option(analyzerChannelOptionLabel(channel),channel.id));select.value=suggestAnalyzerChannel('idle',role,choices)?.id??'';}
      field<HTMLInputElement>('start').value=bounds?String(bounds.startMs/1000):'';field<HTMLInputElement>('end').value=bounds?String(bounds.endMs/1000):'';selection();
    }
  };
  const owner=createIdleComparisonSource(render);render(owner.state());
  const close=()=>{owner.cancel();cancelPreview();element.close();};
  for(const button of element.querySelectorAll('[data-idle-b=close]'))button.addEventListener('click',close,{signal});element.addEventListener('cancel',()=>{owner.cancel();cancelPreview();},{signal});
  field('load').addEventListener('click',()=>field<HTMLInputElement>('file').click(),{signal});field('file').addEventListener('change',()=>{const input=field<HTMLInputElement>('file'),file=input.files?.item(0);input.value='';if(file)void owner.load(file);},{signal});field('cancel').addEventListener('click',()=>owner.cancel(),{signal});field('release').addEventListener('click',()=>owner.release(),{signal});
  field('apply').addEventListener('click',()=>{const start=field<HTMLInputElement>('start').value.trim(),end=field<HTMLInputElement>('end').value.trim(),startMs=Number(start)*1000,endMs=Number(end)*1000,extent=current?.recording?.summary.timeRange;if(!start||!end||!extent||!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<extent.startMs||endMs>extent.endMs||endMs<startMs){field('preview-status').textContent='Invalid B range; previous accepted B selection retained.';return;}if(bounds?.startMs===startMs&&bounds.endMs===endMs)return;bounds={startMs,endMs};withdraw();selection();},{signal});
  for(const role of ['rpm','target'])field(role).addEventListener('change',withdraw,{signal});
  field('preview').addEventListener('click',()=>{void (async()=>{
    const recording=current?.recording,scope=bounds,rpm=field<HTMLSelectElement>('rpm').value,target=field<HTMLSelectElement>('target').value;if(!active||!element.open||!recording||!scope||!rpm){field('preview-status').textContent='Load B and select its RPM channel/range.';return;}
    const key=JSON.stringify([current!.revision,scope,rpm,target]);
    const format=(value:number|undefined)=>value!==undefined&&Number.isFinite(value)?value.toFixed(2):'Unavailable';
    const present=(result:IdleStabilityResult)=>{const stats=result.analysis;field('metrics').textContent=`B only: ${stats.rpm.validSampleCount} valid RPM, ${stats.rpm.invalidSampleCount} invalid, original-index evidence ${result.sampleIndices[0]??'Unavailable'}–${result.sampleIndices[result.sampleIndices.length-1]??'Unavailable'}; ${stats.complete?'Complete':'Partial'} requested coverage; mean ${format(stats.rpm.mean)} RPM; σ ${format(stats.rpm.standardDeviation)} RPM; target RMSE ${format(stats.tracking?.rmse)} RPM. No comparative verdict.`;field('preview-status').textContent='Accepted B preview.';};
    if(preview?.key===key){present(preview.result);return;}
    if(previewPending===key)return;previewPending=key;field<HTMLButtonElement>('preview').disabled=true;
    const token=++request;field('preview-status').textContent='Reading B channels / calculating selected B stability…';
    try{
      const source=recording.channelData,range=source.sampleRangeForTime?.(scope.startMs,scope.endMs)??{startSampleIndex:0,sampleCount:source.sampleCount},ids=[...new Set([rpm,target].filter(Boolean))];
      const channels=source.readChannelsRange?(await source.readChannelsRange(ids,range.startSampleIndex,range.sampleCount)).ranges:new Map(await Promise.all(ids.map(async id=>[id,await source.readChannelRange(id,range.startSampleIndex,range.sampleCount)] as const)));
      if(disposed||!active||!element.open||request!==token||current?.recording!==recording)return;
      const actual=channels.get(rpm);if(!actual||target&&!channels.get(target))throw Error('Selected B channels unavailable; choose B source channels.');
      const complete=[...channels.values()].every(value=>value.startSampleIndex<=range.startSampleIndex&&value.values.length>=range.sampleCount);
      const result=analyzeIdleStability(actual,channels.get(target),{...scope,complete});preview={key,result};refreshPrimary();present(result);
    }catch(error){if(!disposed&&active&&element.open&&request===token){field('preview-status').textContent=error instanceof Error?error.message:'B preview failed.';field('metrics').textContent='';}}finally{if(request===token){previewPending=undefined;field<HTMLButtonElement>('preview').disabled=!current?.recording;}}
  })();},{signal});
  return {element,refreshPrimary,setPrimary(name:string){primary=name;if(active&&element.open)field('primary').textContent=`Primary: ${primary}. Primary Logger and its analysis stay authoritative.`;},setActive(next:boolean){active=next;owner.setActive(next);if(!next){cancelPreview();element.close();}},open(){if(!active||disposed)return;field('primary').textContent=`Primary: ${primary}. Primary Logger and its analysis stay authoritative.`;refreshPrimary();if(!element.open)element.showModal();},dispose(){disposed=true;active=false;request++;owner.dispose();preview=undefined;current=undefined;bounds=undefined;element.close();element.replaceChildren();}};
}
