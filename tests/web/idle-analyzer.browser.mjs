import {parseMsq} from '../../core/parsers/msq/msq-parser';
import {normalizeMsqTune} from '../../core/tune/tune-model';
import { analyzeIdleAirflow } from '../../core/analysis/idle-airflow';
import { analyzeIdleStability } from '../../core/analysis/idle-stability';
import { MemoryByteSource } from '../../core/parsers/byte-source';
import { parseMlg } from '../../core/parsers/mlg/mlg-parser';
import { IDLE_CONTRACT_RECORDS, idleContractMlg } from '../fixtures/idle/mlg-contract';
import { createIdleAnalyzerView } from '../../apps/web/src/pages/idle-analyzer-view';

const wait = () => new Promise(resolve => setTimeout(resolve, 15));
const assert = (value, message) => { if (!value) throw Error(message); };
const change = (element, value) => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })); };
function fixture(values = [900, 1000, 1100], target = true) {
  const channels = [
    { id: 'rpm', sourceName: 'RPM', displayName: 'Engine RPM', unit: 'rpm', valueType: 'number' },
    ...(target ? [{ id: 'target', sourceName: 'Idle target', displayName: 'Idle target', unit: 'rpm', valueType: 'number' }] : []),
  ];
  const traces = channels.map((channel, i) => ({ channel, complete: true, color: '#abc', range: {
    startSampleIndex: 10, values: Float64Array.from(values, value => i ? 1000 : value),
    timeMs: Float64Array.from(values, (_, index) => index * 100), validity: new Uint8Array(values.length).fill(1),
  } }));
  const calls = [];
  const context = {
    source: { identity: {}, revision: 0, sampleCount: values.length, descriptor: { id: 'fixture', displayName: 'fixture.mlg', format: 'MLG', sizeBytes: 100 } },
    sourceTimeRange: { startMs: 0, endMs: (values.length - 1) * 100 }, channels, traces: [],
    aTimeMs: 0, bTimeMs: 100, savedRanges: [{ label: 'Recorded segment', startMs: 100, endMs: 200 }],
    loadTraces: async (ids, start, end) => { calls.push({ ids, start, end }); return traces.filter(trace => ids.includes(trace.channel.id)); },
  };
  return { context, calls, traces };
}
function airflowFixture(target=true) {
  const f=fixture([1000,1000,1000,1000],target);
  for(const [id,name,values]of[['base','baseIdlePosition',[20,22,24,26]],['correction','idleClosedLoop',[-2,4,6,-4]],['final','currentIdlePosition',[18,26,30,22]]]){
    const channel={id,sourceName:name,displayName:name,unit:'%',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:Float64Array.from(values),validity:new Uint8Array(4).fill(1)}});
  }
  return f;
}
function valveFixture(count=4) {
  const f=airflowFixture();
  if(count!==4){for(const trace of f.traces)trace.range={startSampleIndex:10,timeMs:Float64Array.from({length:count},(_,i)=>i*10),validity:new Uint8Array(count).fill(1),values:new Float64Array(count).fill(trace.channel.id==='rpm'||trace.channel.id==='target'?1000:20)};f.context.source.sampleCount=count;f.context.sourceTimeRange.endMs=(count-1)*10;}
  for(const [id,name,values,value]of[['dc-request','dcIdleTarget',[10,20,30,40],20],['dc-measured','IdlePosition',[12,18,36,40],22],['dc-motor','dcIdlePositionStatus_output',[-95,95,94,-100],-95]]){
    const channel={id,sourceName:name,displayName:name,unit:'%',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:count===4?Float64Array.from(values):new Float64Array(count).fill(value)}});
  }
  return f;
}
function pidFixture(count=4){
  const f=valveFixture(count);f.traces.find(t=>t.channel.id==='correction').range.values=count===4?Float64Array.from([0,1,2,3]):new Float64Array(count).fill(5);
  for(const [id,name,values,value]of [['pid-p','idleStatus_pTerm',[-3,3,-3,3],-3],['pid-i','idleStatus_iTerm',[1,2,3,4],2],['pid-d','idleStatus_dTerm',[-4,4,-4,4],4],['pid-output','idleStatus_output',[30,30,5,5],30]]){
    const channel={id,sourceName:name,displayName:name,valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:count===4?Float64Array.from(values):new Float64Array(count).fill(value)}});
  }return f;
}
function biasFixture(count=4){
  const f=pidFixture(count);
  for(const [id,name,values,value]of [['inner-feed','etbFeedForward',[10,14,18,22],10],['inner-p','dcIdlePositionStatus_pTerm',[-2,2,-2,2],-2],['inner-i','dcIdlePositionStatus_iTerm',[-3,-1,1,3],3],['inner-d','dcIdlePositionStatus_dTerm',[-4,4,-4,4],4]]){
    const channel={id,sourceName:name,displayName:name,valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:count===4?Float64Array.from(values):new Float64Array(count).fill(value)}});
  }return f;
}
function ignitionFixture(count=4){
  const f=biasFixture(count);if(count===4)f.traces[0].range.values=Float64Array.from([900,1000,1100,1300]);
  for(const [id,name,unit,values,value]of [['spark-advance','correctedIgnitionAdvance','deg',[10,14,18,22],16],['spark-correction','timingPidCorrection','deg',[-4,-2,2,4],-2],['actual-lambda','lambdaValue',undefined,[.9,1,1.1,1],1.01]]){
    const channel={id,sourceName:name,displayName:name,...(unit?{unit}:{}),valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:count===4?Float64Array.from(values):new Float64Array(count).fill(value)}});
  }return f;
}
function mount(observability) {
  const view = createIdleAnalyzerView(observability); view.element.hidden = false;
  document.body.append(view.element);
  const field = name => view.element.querySelector(`[data-idle="${name}"]`);
  return { view, field, close: () => { view.dispose(); view.element.remove(); } };
}
export async function runIdleAnalyzerChecks() {
  const checks = [];
  const check = async (name, run) => { await run(); checks.push(name); };
  await check('canonical retry/CRC/wrap fixture reaches native Stability without dense reindexing or invented target',async()=>{
    const bytes=idleContractMlg(IDLE_CONTRACT_RECORDS,true),parsed=await parseMlg(new MemoryByteSource(bytes),{id:'idle-contract',displayName:'generated-idle-contract.mlg',format:'MLG',sizeBytes:bytes.length},{incompleteTail:'retain-complete-records'});
    const m=mount();let reads=0;
    try{
      const context={source:{identity:parsed,revision:0,sampleCount:7,descriptor:parsed.summary.source},sourceTimeRange:parsed.summary.timeRange,channels:parsed.summary.channels,traces:[],savedRanges:[],aTimeMs:undefined,bTimeMs:undefined,loadTraces:async ids=>{reads++;return Promise.all(ids.map(async id=>({channel:parsed.summary.channels.find(c=>c.id===id),complete:true,color:'#abc',range:await parsed.channelData.readChannelRange(id,0,7)})));}};
      m.view.setContext(context);m.view.setActive(true);await wait();
      assert(m.field('samples').textContent==='5'&&m.field('sigma').textContent==='130.38'&&m.field('rmse').textContent==='Unavailable','Canonical counts/variance changed or a target was fabricated');
      m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('RPM valid 5, invalid 2, unavailable 0')&&m.field('assessment').textContent.includes('Original source sample indices'),'Canonical exclusions or original-index authority missing');
      const rpm=await parsed.channelData.readChannelRange('mlg:0',0,7),scope=analyzeIdleStability(rpm,undefined);
      const airflow=analyzeIdleAirflow({rpm,sampleIndices:scope.sampleIndices,basePosition:{range:{...rpm,values:new Float64Array(7).fill(20),validity:new Uint8Array(7).fill(1)},unit:'%'},closedLoop:{range:{...rpm,values:new Float64Array(7).fill(-2),validity:new Uint8Array(7).fill(1)},unit:'pp'}});
      assert(airflow.status==='limited'&&airflow.basePosition.statistics.validSampleCount===5&&airflow.basePosition.statistics.invalidSampleCount===2&&airflow.closedLoop.statistics.mean===-2&&airflow.finalPosition.status==='missing','Airflow context lost canonical validity or fabricated an optional signal');
      assert(parsed.recordIndex.offsets.length===7&&parsed.summary.diagnostics.some(d=>d.code==='mlg-incomplete-tail'),'Physical tail was indexed or its diagnostic lost');
      m.view.setActive(false);m.view.setContext({...context});m.view.setActive(true);await wait();assert(reads===1&&m.field('samples').textContent==='5','Unchanged canonical context destroyed retained evidence');
      assert([...m.field('mode').options].filter(o=>!o.disabled).length===7,'Unexpected diagnostic mode became active');
    }finally{m.close();}
  });
  await check('Base Airflow renders retained context and reuses calculation across modes/tabs without reads',async()=>{
    const f=airflowFixture(false),m=mount();let gets=0;const trace=f.traces.find(t=>t.channel.id==='correction'),values=trace.range.values;Object.defineProperty(trace.range,'values',{get(){gets++;return values;}});
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();const reads=f.calls.length;
      change(m.field('mode'),'airflow');const calculated=gets;
      assert(m.field('airflow-base').textContent==='23.00'&&m.field('airflow-correction').textContent==='1.00'&&m.field('airflow-final').textContent==='24.00'&&m.field('airflow-rms').textContent==='4.24','Airflow reference cards incorrect');
      assert(m.field('stability-metrics').hidden&&!m.field('airflow-metrics').hidden&&m.field('assessment').textContent.includes('not measured physical airflow'),'Airflow projection or caution missing');
      for(const tab of ['evidence','next','diagnosis'])m.view.element.querySelector(`[data-idle-tab=${tab}]`).click();change(m.field('mode'),'stability');change(m.field('mode'),'airflow');
      assert(gets===calculated&&f.calls.length===reads,'Presentation repeated Airflow sample work or source reads');
      assert(m.field('assessment').textContent.includes('4 valid, 0 invalid, 0 unavailable'),'Role denominators missing');
      m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();assert(m.field('mode').value==='airflow'&&m.field('airflow-base').textContent==='23.00'&&f.calls.length===reads,'Navigation destroyed retained Airflow context');
    }finally{m.close();}
  });
  await check('Airflow uses qualified scopes and withdraws missing roles/catalog units instead of old values',async()=>{
    const f=airflowFixture(),m=mount(),channel={id:'clt',sourceName:'coolant',displayName:'Coolant',unit:'deg C',valueType:'number'};
    f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:Float64Array.from([60,80,90,90]),validity:new Uint8Array(4).fill(1)}});
    const checked=(name,value)=>{m.field(name).checked=value;m.field(name).dispatchEvent(new Event('change',{bubbles:true}));};
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'airflow');checked('qual-enabled',true);await wait();
      assert(m.field('airflow-base').textContent==='24.00'&&m.field('airflow-correction').textContent==='2.00'&&m.field('assessment').textContent.includes('3 valid'),'Qualification did not reach Airflow statistics');
      change(m.field('qual-temperature'),'200');await wait();assert(m.field('airflow-base').textContent==='Unavailable'&&m.field('assessment').textContent.includes('No records meet'),'Empty qualified scope retained old values');
      checked('qual-enabled',false);await wait();change(m.field('closedLoop'),'');await wait();assert(m.field('airflow-correction').textContent==='Unavailable'&&m.field('airflow-base').textContent==='23.00','Missing optional role discarded valid context or fabricated zero');
      m.view.setContext({...f.context,channels:f.context.channels.map(c=>c.id==='base'?{...c,unit:'kPa'}:c)});await wait();assert(m.field('airflow-base').textContent==='Unavailable','Changed unit reused old Airflow results');
    }finally{m.close();}
  });
  await check('Airflow rejects obsolete source completions and defers hidden work',async()=>{
    const f=airflowFixture(),m=mount();let release;
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'airflow');
      m.view.setContext({...f.context,source:{...f.context.source,revision:1},loadTraces:()=>new Promise(resolve=>{release=resolve;})});await wait();assert(m.field('airflow-base').textContent==='—','Pending replacement retained stale cards');
      change(m.field('mode'),'stability');change(m.field('mode'),'airflow');m.view.setContext({...f.context,source:{...f.context.source,revision:2}});await wait();release(f.traces.map(t=>t.channel.id==='base'?{...t,range:{...t.range,values:new Float64Array(4).fill(99)}}:t));await wait();assert(m.field('airflow-base').textContent==='23.00','Late source completion replaced newer Airflow');
      m.view.setActive(false);const reads=f.calls.length;m.view.setContext({...f.context,source:{...f.context.source,revision:3}});change(m.field('mode'),'stability');assert(f.calls.length===reads&&m.field('mode').value==='stability','Hidden work read source');
      m.view.setActive(true);await wait();assert(m.field('airflow-base').textContent==='23.00','Resumed Airflow did not restore current evidence');
    }finally{m.close();}
  });
  await check('browser-scale Base Airflow mode uses retained source evidence and bounded graph DOM',async()=>{
    const f=fixture(new Float64Array(320459).fill(1000)),m=mount(),channel={id:'base',sourceName:'baseIdlePosition',displayName:'Base request',unit:'%',valueType:'number'};
    f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:new Float64Array(320459).fill(20)}});
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'airflow');
      assert(m.field('airflow-base').textContent==='20.00'&&m.field('assessment').textContent.includes('320459 valid')&&m.field('airflow-correction').textContent==='Unavailable','Large native mode failed role counts or missing evidence');
      change(m.field('mode'),'stability');change(m.field('mode'),'airflow');assert(f.calls.length===1&&m.view.element.querySelectorAll('svg *').length<150,'Large mode transition reread source or expanded graph DOM');
    }finally{m.close();}
  });
  await check('single-manual purpose metadata cannot restart cached CPU analysis on navigation',async()=>{
    const events=[],f=airflowFixture(),m=mount({record:event=>{events.push(event);}}),requests=()=>events.filter(event=>event.name==='idle.stability.request').length;
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();m.field('start').value='0';m.field('end').value='.1';m.field('apply-region').click();await wait();change(m.field('mode'),'airflow');
      m.view.element.querySelector('svg').dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));
      const paths=()=>[...m.view.element.querySelectorAll('[data-idle-trace]')].map(path=>path.getAttribute('d')).join('|'),viewport=paths();
      const before=requests(),reads=f.calls.length;m.field('manage-regions').click();change(m.view.element.querySelector('[data-purpose]'),'raised');m.view.element.querySelector('[data-manager=close]').click();
      m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();
      assert(requests()===before&&f.calls.length===reads,'Manual metadata repeated cached CPU analysis '+JSON.stringify({before,after:requests(),reads,afterReads:f.calls.length}));
      assert(m.field('airflow-base').textContent==='21.00'&&m.field('assessment').textContent.includes('Raised-RPM hold'),'Manual purpose or numeric scope was lost');
      assert(paths()===viewport,'Purpose metadata reset the retained graph viewport');
    }finally{m.close();}
  });
  await check('hidden source updates do not read; activation shows native reference metrics and two graph panes', async () => {
    const f = fixture(), m = mount(); try {
      f.context.channels.unshift({ ...f.context.channels[0], id: 'drop', sourceName: 'IdleDiag Catch Drop RPM', displayName: 'IdleDiag Catch Drop RPM' });
      m.view.setContext(f.context); m.view.refresh(); await wait(); assert(f.calls.length === 0, 'Hidden view read source');
      m.view.setActive(true); await wait();
      assert(f.calls.length === 1 && f.calls[0].ids.join(',') === 'rpm,target', 'Did not batch required channels once');
      assert(m.field('sigma').textContent === '100.00' && m.field('rmse').textContent === '81.65', 'Incorrect reference metrics');
      assert(m.view.element.querySelectorAll('[data-idle-trace]').length === 2, 'Missing actual/target graph');
      assert(m.field('source').textContent.includes('fixture.mlg'), 'Missing canonical source name');
      assert(!m.view.element.querySelector('iframe'), 'Embedded prototype');
    } finally { m.close(); }
  });
  await check('tabs, graph navigation, unchanged context and hide/resume retain accepted results without reads', async () => {
    const f = fixture(), m = mount(); try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      for (const button of m.view.element.querySelectorAll('[data-idle-tab]')) button.click();
      const svg = m.view.element.querySelector('svg'); svg.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true })); m.field('fit').click();
      m.view.setContext({ ...f.context }); m.view.refresh(); m.view.setActive(false); m.view.setContext({ ...f.context }); m.view.setActive(true); await wait();
      assert(f.calls.length === 1 && m.field('sigma').textContent === '100.00', 'Presentation/navigation repeated data work');
    } finally { m.close(); }
  });
  await check('manual region uses original indices and rejects invalid replacement bounds', async () => {
    const f = fixture(), m = mount(); try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      m.field('start').value = '.1'; m.field('end').value = '.2'; m.field('apply-region').click(); await wait();
      assert(m.field('samples').textContent === '2' && m.view.element.querySelectorAll('.idle-region-manager tbody tr').length === 1 && f.calls.length === 1, 'Manual bounds not applied');
      m.field('start').value = '-1'; m.field('apply-region').click(); await wait();
      assert(m.field('samples').textContent === '2' && f.calls.length === 1 && m.field('status').textContent.includes('Previous region retained'), 'Invalid region replaced accepted state');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager');
      d.querySelector('[data-edit=split]').value='.15';d.querySelector('[data-manager=split]').click();
      assert(d.querySelectorAll('tbody tr').length===1&&m.field('samples').textContent==='2'&&d.querySelector('[data-manager=message]').textContent.includes('Analyze included regions'),'Split silently changed single-region analysis scope');
    } finally { m.close(); }
  });
  await check('Logger A/B and saved ranges are real scope choices and preserve semantics across reordering', async () => {
    const f = fixture(), m = mount(); try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      change(m.field('scope'), 'ab'); await wait(); assert(m.field('samples').textContent === '2', 'A/B scope ignored');
      change(m.field('scope'), 'saved:0'); await wait(); const before = f.calls.length;
      m.view.setContext({ ...f.context, savedRanges: [{ label: 'Other', startMs: 0, endMs: 50 }, ...f.context.savedRanges] }); await wait();
      assert(m.field('scope').value === 'saved:1' && f.calls.length === before, 'Saved scope identity changed or reloaded');
    } finally { m.close(); }
  });
  await check('missing target preserves RPM-only diagnostics with unavailable target metrics', async () => {
    const f = fixture([900, 1000, 1100], false), m = mount(); try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      assert(m.field('sigma').textContent === '100.00' && m.field('rmse').textContent === 'Unavailable' && m.field('in-band').textContent === 'Unavailable', 'Missing target became zero/blocked RPM');
      assert(m.view.element.querySelectorAll('[data-idle-trace]').length === 1, 'Invented target/error');
    } finally { m.close(); }
  });
  await check('unknown units and live Shim sources cannot produce recorded stability claims', async () => {
    const f = fixture(), m = mount(); try {
      const wrong = f.context.channels.map(channel => ({ ...channel, unit: 'krpm' }));
      m.view.setContext({ ...f.context, channels: wrong }); m.view.setActive(true); await wait();
      assert(f.calls.length === 0, 'Incompatible unit accepted');
      m.view.setContext({ ...f.context, source: { ...f.context.source, descriptor: { ...f.context.source.descriptor, format: 'TS-SHIM' } } }); await wait();
      assert(f.calls.length === 0 && m.field('samples').textContent === '—', 'Live data claimed recorded evidence');
    } finally { m.close(); }
  });
  await check('older completion cannot replace a new source with otherwise identical metadata', async () => {
    const old = fixture(), next = fixture([1000, 1000, 1000]), m = mount(); let release;
    const gate = new Promise(resolve => { release = resolve; }); try {
      m.view.setContext({ ...old.context, loadTraces: () => gate }); m.view.setActive(true);
      m.view.setContext(next.context); await wait(); assert(m.field('sigma').textContent === '0.00', 'New source not accepted');
      release(old.traces); await wait(); assert(m.field('sigma').textContent === '0.00', 'Retired source completed into newer session');
    } finally { release?.([]); m.close(); }
  });
  await check('deactivation rejects late completion and resumes only latest source once', async () => {
    const old = fixture(), next = fixture([1000, 1000, 1000]), m = mount(); let release;
    const gate = new Promise(resolve => { release = resolve; }); try {
      m.view.setContext({ ...old.context, loadTraces: () => gate }); m.view.setActive(true); m.view.setActive(false);
      const html = m.view.element.innerHTML; release(old.traces); await wait(); assert(m.view.element.innerHTML === html, 'Hidden completion changed DOM');
      m.view.setContext(next.context); m.view.refresh(); assert(next.calls.length === 0, 'Hidden replacement read');
      m.view.setActive(true); await wait(); assert(next.calls.length === 1 && m.field('sigma').textContent === '0.00', 'Resume failed');
    } finally { release?.([]); m.close(); }
  });
  await check('load failure is actionable and retry can accept current source', async () => {
    const f = fixture(), m = mount(); let fail = true; try {
      m.view.setContext({ ...f.context, loadTraces: (...args) => fail ? Promise.reject(Error('Controlled read failure')) : f.context.loadTraces(...args) }); m.view.setActive(true); await wait();
      assert(m.field('samples').textContent === '—' && m.field('status').textContent.includes('Controlled read failure'), 'Failure retained old evidence');
      fail = false; m.field('run').click(); await wait(); assert(m.field('samples').textContent === '3', 'Retry failed');
    } finally { m.close(); }
  });
  await check('late rejection after disposal cannot publish or navigate Logger', async () => {
    const f = fixture(), m = mount(); let reject; let navigation = 0;
    const gate = new Promise((_, no) => { reject = no; });
    try {
      m.view.setContext({ ...f.context, loadTraces: () => gate, openRangeInLogger: () => { navigation++; } });
      m.view.setActive(true); m.view.setActive(false); m.field('logger').click();
      assert(navigation === 0, 'Hidden retired session navigated Logger');
      m.view.dispose(); const html = m.view.element.innerHTML; reject(Error('Retired failure')); await wait();
      assert(m.view.element.innerHTML === html, 'Disposed rejection published');
    } finally { m.close(); }
  });
  await check('source revision and selected channel changes invalidate while presentation does not', async () => {
    const f = fixture(), m = mount(); try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      m.view.setContext({ ...f.context, source: { ...f.context.source, revision: 1 } }); await wait(); assert(f.calls.length === 2, 'Validity revision ignored');
      change(m.field('target'), ''); await wait(); assert(f.calls.length === 3 && m.field('rmse').textContent === 'Unavailable', 'Target change did not invalidate');
      m.view.setContext({ ...f.context, source: { ...f.context.source, revision: 1 }, channels: f.context.channels.map(channel => ({ ...channel, displayName: channel.displayName + ' renamed' })) }); await wait();
      assert(m.field('target').value === '' && m.field('rmse').textContent === 'Unavailable', 'Catalog update silently rebound an explicitly missing target');
      const beforeTab = f.calls.length; m.view.element.querySelector('[data-idle-tab=evidence]').click(); assert(f.calls.length === beforeTab, 'Tab recalculated');
    } finally { m.close(); }
  });
  await check('all-invalid values remain unavailable and disposed completions cannot publish', async () => {
    const f = fixture([NaN, NaN, NaN]), m = mount(); try {
      m.view.setContext(f.context); m.view.setActive(true); await wait(); assert(m.field('sigma').textContent === 'Unavailable' && m.field('status').textContent === 'No valid RPM evidence', 'Invalid samples scored healthy');
      m.close(); const html = m.view.element.innerHTML; m.view.setContext(f.context); m.view.setActive(true); await wait(); assert(m.view.element.innerHTML === html, 'Disposed view changed');
    } finally { m.close(); }
  });
  await check('canonical unitless target/controller context, hover, trace reuse and recorded region card', async () => {
    const f = fixture(), m = mount();
    f.context.channels[1] = { ...f.context.channels[1], sourceName: 'Idle: Target RPM', displayName: 'Idle: Target RPM', unit: '' };
    f.traces[1].channel = f.context.channels[1];
    for (const [id, sourceName, values] of [['base','idle: base value',[15,16,17]], ['correction','Closed loop',[-1,0,1]], ['final','Idle: Position',[14,16,18]]]) {
      const channel = { id, sourceName, displayName: sourceName, valueType: 'number' };
      f.context.channels.push(channel); f.traces.push({ channel, complete: true, color: '#abc', range: { startSampleIndex: 10, timeMs: Float64Array.from([0,100,200]), values: Float64Array.from(values), validity: Uint8Array.from([1,1,1]) } });
    }
    try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      assert(f.calls.length === 1 && f.calls[0].ids.length === 5, 'Controller data was not loaded in one shared request');
      assert(m.field('rmse').textContent === '81.65' && m.view.element.querySelectorAll('[data-idle-trace]').length === 5, 'Unitless canonical target/context not used');
      assert(m.field('mapping-note').textContent.includes('canonical role; source unit unspecified'), 'Role unit authority not disclosed');
      const svg = m.view.element.querySelector('svg'), rect = svg.getBoundingClientRect();
      svg.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left+rect.width*.5, clientY: rect.top+50, bubbles: true }));
      const tip=m.view.element.querySelector('.idle-plot-tooltip'); assert(!tip.hidden && tip.textContent.includes('Base request') && tip.textContent.includes('sample 11'), 'Missing source-indexed hover context');
      m.view.element.querySelector('.idle-plot-legend button[data-trace-label="Base request"]').click();
      assert(m.view.element.querySelectorAll('[data-idle-trace]').length===4 && f.calls.length===1, 'Legend toggle repeated analysis or failed');
      m.field('region-focus').click(); assert(f.calls.length===1, 'Region card reloaded source');
    } finally { m.close(); }
  });
  await check('timeline commits once through Logger authority and performs no reads during preview', async () => {
    const f = fixture(), m = mount(); let commits = 0;
    f.context.setAnalysisRange = ({startMs,endMs}) => { commits++; f.context = { ...f.context, aTimeMs: startMs, bTimeMs: endMs }; m.view.setContext(f.context); return true; };
    try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      change(m.field('scope'),'ab'); await wait(); const before=f.calls.length;
      m.field('range-b').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})); await wait();
      assert(commits===1 && f.calls.length===before+1 && f.calls.at(-1).end===102, 'Range commit cascaded or bypassed Logger');
      assert(m.field('scope').value==='ab' && m.field('range-b').getAttribute('aria-valuenow')==='102', 'Range/selector diverged from Logger');
      m.view.setActive(false); m.field('range-b').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); assert(commits===1,'Hidden range edited Logger');
    } finally { m.close(); }
  });
  await check('native timeline pointer preview is presentation-only; release commits one real range', async () => {
    const f = fixture(), m = mount(); let commits = 0;
    f.context.setAnalysisRange = ({startMs,endMs}) => { commits++; f.context = { ...f.context, aTimeMs: startMs, bTimeMs: endMs }; m.view.setContext(f.context); return true; };
    try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      const track = m.field('range-track'), rect = track.getBoundingClientRect(); track.setPointerCapture = () => {};
      const pointer = (type, x) => track.dispatchEvent(new PointerEvent(type, {pointerId:71,button:0,bubbles:true,cancelable:true,clientX:rect.left+rect.width*x,clientY:rect.top+8}));
      pointer('pointerdown',.2); pointer('pointermove',.8);
      assert(commits===0 && f.calls.length===1 && m.field('samples').textContent==='3', 'Pointer preview mutated source/results');
      pointer('pointerup',.8); await wait();
      assert(commits===1 && f.calls.length===2 && Math.abs(f.calls.at(-1).start-40)<.01 && Math.abs(f.calls.at(-1).end-160)<.01, 'Pointer release duplicated/misrouted range');
    } finally { m.close(); }
  });
  await check('candidate discovery reuses full evidence, keeps analysis unchanged and adopts through Logger once', async () => {
    const f = fixture(new Float64Array(121).fill(900)), m = mount(); let commits = 0;
    f.context.setAnalysisRange = ({startMs,endMs}) => { commits++; f.context = {...f.context,aTimeMs:startMs,bTimeMs:endMs}; m.view.setContext(f.context); return true; };
    try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      m.field('discover').click(); await wait();
      assert(f.calls.length===1 && commits===0 && m.field('scope').value==='full', 'Discovery reread full accepted RPM or changed analysis scope');
      assert(m.field('candidates').options.length===2 && m.field('scope-note').textContent.includes('1 RPM-only candidates'), 'Missing recorded candidate');
      assert(!m.field('discovery-feedback').hidden&&!m.field('review-candidates').hidden&&m.field('discovery-message').textContent.includes('1 RPM candidate found')&&m.field('status').textContent==='Recorded evidence','Discovery result hidden or overwrote analytical status');
      m.field('review-candidates').click();assert(m.view.element.querySelector('.idle-region-manager').open,'Review action did not reveal candidate rows');m.view.element.querySelector('[data-manager=close]').click();
      change(m.field('candidates'),'0'); await wait();
      assert(commits===1 && f.calls.length===1 && m.field('scope').value==='ab' && f.context.aTimeMs===0 && f.context.bTimeMs===12000, 'Candidate bypassed Logger or redundantly analyzed identical bounds');
      m.field('discover').click(); await wait(); assert(f.calls.length===1, 'Repeated discovery reread source');
      change(m.field('candidate-rpm'),'850'); assert(m.field('candidates').disabled, 'Changed thresholds retained stale candidates');
      m.field('discover').click(); await wait(); assert(m.field('candidates').disabled && m.field('scope-note').textContent.includes('0 RPM-only'), 'RPM setting did not affect discovery');
      assert(m.field('discovery-message').textContent.includes('No candidates match')&&m.field('review-candidates').hidden&&m.field('status').textContent==='Recorded evidence','Zero-match feedback misrepresented new regions or analytical state');
      assert(m.view.element.querySelectorAll('.idle-region-manager tbody tr').length===1,'Zero matches removed retained managed snapshots');
      assert(m.field('samples').textContent==='121','Discovery altered accepted metrics');
    } finally { m.close(); }
  });
  await check('candidate reads reject hidden, replaced and configuration-obsolete completions', async () => {
    const f = fixture(new Float64Array(121).fill(900)), m = mount();
    try {
      m.view.setContext(f.context); m.view.setActive(true); await wait(); change(m.field('scope'),'ab'); await wait();
      const releases=[]; f.context={...f.context,source:{...f.context.source,revision:1},loadTraces:()=>new Promise(resolve=>{releases.push(resolve);})};m.view.setContext(f.context);
      m.field('discover').click(); await wait();
      change(m.field('candidate-duration'),'9'); releases.at(-1)(f.traces); await wait();
      assert(m.field('candidates').disabled,'Obsolete discovery completed after setting change');
      m.field('discover').click(); await wait(); m.view.setActive(false); const html=m.view.element.innerHTML; for(const release of releases)release(f.traces); await wait();
      assert(m.view.element.innerHTML===html,'Hidden discovery wrote UI');
      const next=fixture(new Float64Array(121).fill(1500)); m.view.setContext(next.context); m.view.setActive(true); await wait();
      assert(m.field('candidates').disabled && m.field('samples').textContent==='121','Source replacement retained old candidates or lost analysis');
    } finally { m.close(); }
  });
  await check('candidate adoption refusal retains the prior analysis and invalid settings do not read', async () => {
    const f=fixture(new Float64Array(121).fill(900)),m=mount(); f.context.setAnalysisRange=()=>false;
    try {
      m.view.setContext(f.context);m.view.setActive(true);await wait();m.field('discover').click();await wait();change(m.field('candidates'),'0');await wait();
      assert(m.field('scope').value==='full'&&m.field('samples').textContent==='121'&&f.calls.length===1,'Refused Logger range replaced analysis');
      change(m.field('candidate-rpm'),'');m.field('discover').click();await wait();assert(f.calls.length===1&&m.field('discovery-message').textContent.includes('positive'),'Invalid settings read source');
    } finally {m.close();}
  });
  await check('region manager unions overlaps, separates excluded graph focus and uses retained source evidence', async()=>{
    const f=fixture([900,1000,1100,2000,900,1000]),m=mount();let navigation;
    f.context.openRangeInLogger=request=>{navigation=request;};
    let commits=0;f.context.setAnalysisRange=({startMs,endMs})=>{commits++;f.context={...f.context,aTimeMs:startMs,bTimeMs:endMs};m.view.setContext(f.context);return true;};
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();m.field('manage-regions').click();
      const dialog=m.view.element.querySelector('.idle-region-manager'),button=name=>dialog.querySelector(`[data-manager="${name}"]`);
      const add=(a,b,label)=>{dialog.querySelector('[data-new=start]').value=String(a);dialog.querySelector('[data-new=end]').value=String(b);dialog.querySelector('[data-new=label]').value=label;button('add').click();};
      add(0,.2,'First');add(.1,.2,'Overlap');add(.4,.5,'Last');
      assert(m.field('metrics-scope').textContent==='Metrics: Full Log'&&m.field('scope-application').textContent.includes('not applied')&&dialog.querySelector('[data-manager=authority]').textContent.includes('not the analysis scope'),'Checked regions looked active before explicit apply');
      button('close').click();m.field('apply-included').click();m.field('manage-regions').click();await wait();
      assert(m.field('metrics-scope').textContent.includes('Combined included regions (3)')&&m.field('apply-included').hidden&&m.field('focus-explanation').textContent.includes('Gap samples are excluded'),'Combined scope or overview gap explanation missing');
      assert(m.field('scope').value==='regions'&&m.field('samples').textContent==='5'&&m.field('rmse').textContent==='77.46','Union included gap or counted overlap twice');
      assert(f.calls.length===1,'Union reread full retained source');
      const rows=()=>[...dialog.querySelectorAll('tbody tr')];
      let overlap=rows()[1].querySelector('[data-include]');overlap.checked=false;overlap.dispatchEvent(new Event('change',{bubbles:true}));await wait();
      assert(m.field('region-evidence').textContent.startsWith('2 included regions')&&m.field('samples').textContent==='5'&&f.calls.length===1,'Same-union inclusion left stale presentation metadata');
      overlap=rows()[1].querySelector('[data-include]');overlap.checked=true;overlap.dispatchEvent(new Event('change',{bubbles:true}));await wait();
      for(let index=0;index<2;index++){const input=rows()[index].querySelector('[data-include]');input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));}
      await wait();assert(m.field('samples').textContent==='2','Exclusions not applied');
      rows()[0].querySelector('[data-manager=focus]').click();
      assert(m.field('samples').textContent==='2'&&f.calls.length===1&&m.field('region-label').textContent.includes('First (excluded)'),'Viewing excluded region changed analysis');
      assert(m.field('focus-explanation').textContent.includes('First (excluded)')&&m.field('metrics-scope').textContent.includes('(1)'),'Graph focus confused with combined metric authority');
      assert(m.view.element.querySelectorAll('.idle-region-marker.is-excluded').length===2&&m.view.element.querySelector('.idle-region-marker.is-focused'),'Missing included/excluded/focus presentation');
      button('close').click();m.field('logger').click();assert(navigation.startMs===0&&navigation.endMs===200,'Logger handoff used union instead of viewed region');
      const track=m.field('range-track'),rect=track.getBoundingClientRect();track.setPointerCapture=()=>{};
      for(const [type,x] of [['pointerdown',.6],['pointermove',.8],['pointerup',.8]])track.dispatchEvent(new PointerEvent(type,{pointerId:91,button:0,shiftKey:true,bubbles:true,cancelable:true,clientX:rect.left+rect.width*x,clientY:rect.top+8}));
      await wait();assert(commits===1&&m.field('scope').value==='regions'&&m.field('focus').value==='logger'&&m.field('samples').textContent==='2'&&f.calls.length===1,'Logger timeline drag changed union analysis or reread source');
      m.field('manage-regions').click();button('none').click();await wait();assert(m.field('samples').textContent==='0'&&m.field('status').textContent.includes('No included'),'Empty included scope fell back to full log');
      button('all').click();await wait();assert(m.field('samples').textContent==='5'&&f.calls.length===1,'Include all failed or reread source');
      const first=rows()[0];first.querySelector('[data-edit=start]').value='-1';first.querySelector('[data-manager=edit]').click();
      assert(dialog.querySelector('[data-manager=message]').textContent.includes('Previous regions retained')&&m.field('samples').textContent==='5','Invalid edit destroyed state');
      first.querySelector('[data-edit=start]').value='.1';first.querySelector('[data-manager=edit]').click();await wait();assert(m.field('samples').textContent==='4','Accepted edit did not update union');
    }finally{m.close();}
  });
  await check('split and merge preserve recorded union, excluded gaps, qualification policy and retained evidence',async()=>{
    const f=fixture([900,1000,1100,2000,900,1000]),m=mount();
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();m.field('manage-regions').click();
      const d=m.view.element.querySelector('.idle-region-manager'),rows=()=>[...d.querySelectorAll('tbody tr')];
      const add=(a,b)=>{d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-manager=add]').click();};
      add(0,.2);add(.4,.5);d.querySelector('[data-manager=analyze]').click();await wait();
      const original=[m.field('sigma').textContent,m.field('rmse').textContent],reads=f.calls.length;
      assert(m.field('samples').textContent==='5','Fixture scope incorrect');
      const firstId=rows()[0].dataset.regionId;
      rows()[0].querySelector('[data-edit=split]').value='0';rows()[0].querySelector('[data-manager=split]').click();
      assert(rows().length===2&&d.querySelector('[data-manager=message]').textContent.includes('strictly inside'),'Invalid split mutated definitions');
      rows()[0].querySelector('[data-edit=split]').value='.1';rows()[0].querySelector('[data-manager=split]').click();await wait();
      assert(rows().length===3&&rows()[0].dataset.regionId===firstId&&m.field('samples').textContent==='5'&&JSON.stringify([m.field('sigma').textContent,m.field('rmse').textContent])===JSON.stringify(original),'Split changed measured union or retained identity');
      assert(m.field('region-evidence').textContent.startsWith('3 included regions')&&f.calls.length===reads,'Split left stale scope metadata or reread source');
      const targets=rows()[0].querySelector('[data-merge-target]');
      assert(targets.options.length===2&&targets.options[1].value===rows()[1].dataset.regionId,'Merge allowed a gapped target');
      rows()[1].querySelector('[data-manager=focus]').click();change(targets,rows()[1].dataset.regionId);rows()[0].querySelector('[data-manager=merge]').click();await wait();
      assert(rows().length===2&&m.field('focus').value===firstId&&m.field('samples').textContent==='5','Merge lost focus or changed union');
      assert(rows()[0].querySelector('[data-merge-target]').disabled&&m.field('region-evidence').textContent.startsWith('2 included regions'),'Gapped merge enabled or stale metadata');
      const excluded=rows()[1].querySelector('[data-include]');excluded.checked=false;excluded.dispatchEvent(new Event('change',{bubbles:true}));await wait();
      rows()[1].querySelector('[data-edit=split]').value='.45';rows()[1].querySelector('[data-manager=split]').click();await wait();
      assert(rows().length===3&&!rows()[1].querySelector('[data-include]').checked&&!rows()[2].querySelector('[data-include]').checked&&m.field('samples').textContent==='3','Split activated excluded data');
      change(rows()[1].querySelector('[data-merge-target]'),rows()[2].dataset.regionId);rows()[1].querySelector('[data-manager=merge]').click();await wait();
      assert(rows().length===2&&m.field('samples').textContent==='3'&&f.calls.length===reads,'Excluded merge changed evidence or performed IO');
      d.querySelector('[data-manager=all]').click();await wait();assert(m.field('samples').textContent==='5','Partition roundtrip lost original recorded coverage');
      m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();assert(rows().length===2&&m.field('samples').textContent==='5'&&f.calls.length===reads,'Navigation lost partition state or reread source');
    }finally{m.close();}
  });
  await check('declared purposes follow analysis inclusion without changing numbers, drafts, focus nodes or source reads',async()=>{
    const f=fixture([900,1000,1100,2000,900,1000]),m=mount();
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();m.field('manage-regions').click();
      const d=m.view.element.querySelector('.idle-region-manager'),rows=()=>[...d.querySelectorAll('tbody tr')];
      for(const [a,b]of[[0,.2],[.4,.5]]){d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-manager=add]').click();}
      d.querySelector('[data-manager=analyze]').click();await wait();const reads=f.calls.length,metrics=()=>['samples','sigma','rmse','in-band'].map(name=>m.field(name).textContent).join('|'),before=metrics();
      const row=rows()[0],select=row.querySelector('[data-purpose]');row.querySelector('[data-edit=start]').value='.123';select.focus();change(select,'raised');
      assert(rows()[0]===row&&row.querySelector('[data-purpose]')===select&&document.activeElement===select&&row.querySelector('[data-edit=start]').value==='.123','Purpose edit rebuilt native controls or lost draft/focus');
      change(rows()[1].querySelector('[data-purpose]'),'raised');
      assert(metrics()===before&&f.calls.length===reads&&m.field('assessment').textContent.includes('Raised-RPM hold')&&m.field('assessment').textContent.includes('not a steady-idle regulation verdict'),'Raised purpose changed samples or retained steady-idle guidance');
      assert(!m.view.element.querySelector('[data-idle-finding=outside-band]')&&m.view.element.querySelector('[data-idle-finding=purpose-review]'),'Raised scope retained steady-idle tracking findings');
      change(select,'idle');assert(m.field('assessment').textContent.includes('Mixed test purposes'),'Mixed purpose union treated as steady idle');
      const include=rows()[1].querySelector('[data-include]');include.checked=false;include.dispatchEvent(new Event('change',{bubbles:true}));await wait();
      assert(m.field('assessment').textContent.includes('Steady idle')&&!m.view.element.querySelector('[data-idle-finding=purpose-review]'),'Excluded purpose affected active scope');
      rows()[1].querySelector('[data-manager=focus]').click();assert(!m.view.element.querySelector('[data-idle-finding=purpose-review]'),'Graph focus replaced scope purpose');
      m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();assert(rows()[0].querySelector('[data-purpose]').value==='idle'&&rows()[1].querySelector('[data-purpose]').value==='raised'&&f.calls.length===reads,'Navigation lost purposes or reread source');
      change(m.field('scope'),'full');await wait();assert(m.field('assessment').textContent.includes('Custom investigation')&&!m.view.element.querySelector('[data-idle-finding=purpose-review]'),'Managed purpose leaked into Full Log');
    }finally{m.close();}
  });
  await check('pending evidence completion uses latest declared purpose without a new read',async()=>{
    const f=fixture(new Float64Array(6).fill(2000)),m=mount(),pending=[];f.context.loadTraces=()=>new Promise(resolve=>pending.push(resolve));
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager');
      d.querySelector('[data-new=start]').value='0';d.querySelector('[data-new=end]').value='.5';change(d.querySelector('[data-new=purpose]'),'raised');d.querySelector('[data-manager=add]').click();d.querySelector('[data-manager=analyze]').click();
      const reads=pending.length;change(d.querySelector('[data-purpose]'),'recovery');assert(pending.length===reads,'Purpose edit restarted numeric reads');
      for(const resolve of pending)resolve(f.traces);await wait();
      assert(m.field('samples').textContent==='6'&&m.field('assessment').textContent.includes('does not measure recovery time')&&!m.view.element.querySelector('[data-idle-finding=mean-offset]'),'Async completion restored obsolete purpose interpretation');
    }finally{m.close();}
  });
  await check('managed focus and edits survive navigation; source revision retires definitions and pending union work', async()=>{
    const f=fixture([900,1000,1100,2000,900,1000]),m=mount();
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();m.field('manage-regions').click();
      const d=m.view.element.querySelector('.idle-region-manager');d.querySelector('[data-new=start]').value='0';d.querySelector('[data-new=end]').value='.2';d.querySelector('[data-manager=add]').click();d.querySelector('[data-manager=analyze]').click();await wait();
      const id=d.querySelector('tr[data-region-id]').dataset.regionId;change(m.field('focus'),id);const calls=f.calls.length;
      m.view.setActive(false);assert(!d.open,'Dialog remained modal over another domain');m.view.setContext({...f.context});m.view.setActive(true);await wait();
      assert(m.field('focus').value===id&&m.field('samples').textContent==='3'&&f.calls.length===calls,'Navigation destroyed session or reread data');
      let release;const next={...f.context,source:{...f.context.source,revision:1},loadTraces:()=>new Promise(resolve=>{release=resolve;})};
      m.view.setContext(next);await wait();assert(d.querySelectorAll('tbody tr').length===0&&m.field('samples').textContent==='0','Revised source retained old definitions');
      change(m.field('scope'),'full');await wait();m.view.setActive(false);const html=m.view.element.innerHTML;release(f.traces);await wait();assert(m.view.element.innerHTML===html,'Retired completion changed hidden session');
    }finally{m.close();}
  });
  await check('obsolete union reads cannot overwrite a newer empty included selection', async()=>{
    const f=fixture([900,1000,1100,2000,900,1000]),m=mount(),releases=[];
    f.context.loadTraces=()=>new Promise(resolve=>releases.push(resolve));
    try{
      m.view.setContext(f.context);m.view.setActive(true);m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager');
      d.querySelector('[data-new=start]').value='0';d.querySelector('[data-new=end]').value='.2';d.querySelector('[data-manager=add]').click();d.querySelector('[data-manager=analyze]').click();d.querySelector('[data-manager=none]').click();
      releases.at(-1)(f.traces);await wait();assert(m.field('samples').textContent==='0','Latest empty selection failed');
      for(const release of releases.slice(0,-1))release(f.traces);await wait();assert(m.field('samples').textContent==='0'&&m.field('status').textContent.includes('No included'),'Obsolete union overwrote newer selection');
    }finally{m.close();}
  });
  await check('Stability findings and next tests follow accepted numeric evidence, not graph focus',async()=>{
    const f=fixture([900,900,900,1100,1100,1100]),m=mount();
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();
      assert(m.view.element.querySelector('[data-idle-finding="outside-band"]'),'Missing measured excursion finding');
      assert(m.field('assessment').textContent.includes('Warm-engine, closed-throttle idle')&&m.field('assessment').textContent.includes('not established'),'Invented idle qualification');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager');
      for(const [a,b,label]of[[0,.2,'Below target'],[.3,.5,'Above target']]){d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-new=label]').value=label;d.querySelector('[data-manager=add]').click();}
      d.querySelector('[data-manager=analyze]').click();await wait();const mixed=m.field('assessment').textContent;
      d.querySelector('[data-manager=focus]').click();assert(m.field('assessment').textContent===mixed&&f.calls.length===1,'Focus recomputed/replaced combined assessment');
      const include=d.querySelectorAll('[data-include]')[1];include.checked=false;include.dispatchEvent(new Event('change',{bubbles:true}));await wait();
      assert(m.view.element.querySelector('[data-idle-finding="mean-offset"]')&&m.field('assessment').textContent.includes('below target'),'Changed included evidence did not update signed-offset finding');
      d.querySelector('[data-manager=close]').click();m.view.element.querySelector('[data-idle-tab=next]').click();assert(m.field('assessment').textContent.includes('similarly signed offset')&&m.field('assessment').textContent.includes('What would contradict it?'),'Next-test guidance remained generic');
      m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();assert(f.calls.length===1&&m.field('assessment').textContent.includes('similarly signed offset'),'Navigation discarded accepted guidance or reread source');
    }finally{m.close();}
  });
  await check('missing target, stopped engine and paired reference-band evidence produce distinct guidance',async()=>{
    for(const [values,target,code,expected]of[[[1000,1000,1000],true,'within-band','Retain this recording'],[[1000,1000,1000],false,'missing-target','Verify the logged target'],[[0,1000,1000],true,'nonpositive-rpm','Separate verified engine-off']]){
      const f=fixture(values,target),m=mount();try{m.view.setContext(f.context);m.view.setActive(true);await wait();assert(m.view.element.querySelector(`[data-idle-finding="${code}"]`),'Missing finding '+code);m.view.element.querySelector('[data-idle-tab=next]').click();assert(m.field('assessment').textContent.includes(expected),'Wrong next test '+code);if(code==='within-band'){change(m.field('target'),'');await wait();m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('target: unavailable')&&m.field('mapping-note').textContent.includes('target: unavailable')&&!m.field('assessment').textContent.includes('Unavailable%'),'Evidence/setup retained stale target metadata or invalid unavailable percentage');}}finally{m.close();}
    }
  });
  await check('qualification controls change membership, keep pedal/TPS distinct and reuse raw columns for thresholds',async()=>{
    const f=fixture(new Float64Array(6).fill(1000)),m=mount();
    for(const [id,name,unit,values]of[['clt','coolant','deg C',[60,70,80,90,90,90]],['pedal','throttlePedalPosition','%',[0,0,4,2,0,0]],['tps','TPSValue','%',[0,0,0,10,5,0]]]){
      const channel={id,sourceName:name,displayName:name,unit,valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{startSampleIndex:10,values:Float64Array.from(values),timeMs:Float64Array.from(values,(_,i)=>i*100),validity:new Uint8Array(6).fill(1)}});
    }
    const checked=(name,value)=>{m.field(name).checked=value;m.field(name).dispatchEvent(new Event('change',{bubbles:true}));};
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();assert(m.field('samples').textContent==='6'&&m.field('qual-warm').disabled,'Off policy changed baseline');m.field('settings').click();m.field('qualification-settings').click();assert(m.field('qualification-setup').open&&!m.field('setup').open,'Setup sections compressed graph together');m.field('settings').click();assert(m.field('setup').open&&!m.field('qualification-setup').open,'Channel setup failed to close qualification disclosure');
      checked('qual-enabled',true);await wait();assert(m.field('samples').textContent==='5'&&f.calls.length===2&&f.calls.at(-1).ids.includes('clt'),'Warm condition not applied in one captured batch');
      change(m.field('qual-temperature'),'85');await wait();assert(m.field('samples').textContent==='3'&&f.calls.length===2,'Warm threshold unused or reread source');
      checked('qual-closed',true);await wait();assert(m.field('samples').textContent==='3'&&f.calls.length===3&&f.calls.at(-1).ids.includes('pedal'),'Pedal condition not loaded explicitly');
      change(m.field('qual-percent'),'1');await wait();assert(m.field('samples').textContent==='2'&&f.calls.length===3,'Pedal limit unused or reread source');
      change(m.field('qual-input'),'physicalTps');await wait();assert(m.field('samples').textContent==='1'&&f.calls.length===4,'Physical TPS substituted for pedal or ignored');
      change(m.field('qual-percent'),'6');await wait();assert(m.field('samples').textContent==='2'&&f.calls.length===4,'Physical threshold failed');
      checked('qual-warm',false);await wait();assert(m.field('samples').textContent==='5'&&f.calls.length===4,'Removing warm condition failed or reread a cached subset');
      change(m.field('qual-coolant'),'');m.view.setContext({...f.context});await wait();assert(m.field('samples').textContent==='5'&&f.calls.length===4,'Inactive mapping invalidated active evidence');
      checked('qual-enabled',false);await wait();assert(m.field('samples').textContent==='6'&&f.calls.length===4,'Off did not restore baseline from retained data');
    }finally{m.close();}
  });
  await check('qualification missing-channel and manual-bypass policies are explicit with no discovery fallback',async()=>{
    const f=fixture(new Float64Array(6).fill(1000)),m=mount();const checked=(name,value)=>{m.field(name).checked=value;m.field(name).dispatchEvent(new Event('change',{bubbles:true}));};
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();checked('qual-enabled',true);await wait();assert(m.field('samples').textContent==='—'&&m.field('status').textContent.includes('Qualification unavailable')&&f.calls.length===1,'Missing coolant fell back to unqualified analysis');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager');d.querySelector('[data-new=start]').value='0';d.querySelector('[data-new=end]').value='.5';d.querySelector('[data-manager=add]').click();d.querySelector('[data-manager=analyze]').click();await wait();
      assert(m.field('samples').textContent==='—','Manual regions silently bypassed missing conditions by default');
      checked('qual-bypass',true);await wait();assert(m.field('samples').textContent==='6'&&m.field('assessment').textContent.includes('6 valid records manually bypassed'),'Explicit manual bypass failed or claimed conditions were verified');
      d.querySelector('[data-edit=split]').value='.25';d.querySelector('[data-manager=split]').click();await wait();
      assert(d.querySelectorAll('tbody tr').length===2&&m.field('samples').textContent==='6'&&m.field('assessment').textContent.includes('6 valid records manually bypassed'),'Split changed explicit bypass coverage');
      const partRows=d.querySelectorAll('tbody tr');change(partRows[0].querySelector('[data-merge-target]'),partRows[1].dataset.regionId);partRows[0].querySelector('[data-manager=merge]').click();await wait();
      assert(d.querySelectorAll('tbody tr').length===1&&m.field('samples').textContent==='6','Merge changed qualified manual coverage');
      m.field('discover').click();await wait();assert(m.field('discovery-message').textContent.includes('Qualification unavailable'),'Discovery used a manual bypass or RPM-only fallback');
      d.querySelector('[data-manager=close]').click();change(m.field('scope'),'full');await wait();assert(m.field('samples').textContent==='—','Full log silently bypassed missing conditions');
    }finally{m.close();}
  });
  await check('obsolete qualification completions cannot overwrite a later disabled policy',async()=>{
    const f=fixture(new Float64Array(6).fill(1000)),m=mount(),pending=[];
    const channel={id:'clt',sourceName:'coolant',displayName:'coolant',unit:'°C',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{startSampleIndex:10,values:new Float64Array(6).fill(80),timeMs:Float64Array.from({length:6},(_,i)=>i*100),validity:new Uint8Array(6).fill(1)}});
    const original=f.context.loadTraces;f.context.loadTraces=(ids,a,b)=>ids.includes('clt')?new Promise(resolve=>{pending.push(resolve);}):original(ids,a,b);
    const checked=(name,value)=>{m.field(name).checked=value;m.field(name).dispatchEvent(new Event('change',{bubbles:true}));};
    try{m.view.setContext(f.context);m.view.setActive(true);await wait();checked('qual-enabled',true);await wait();change(m.field('qual-temperature'),'200');await wait();checked('qual-enabled',false);await wait();assert(m.field('samples').textContent==='6','Disabling policy failed');for(const release of pending)release(f.traces);await wait();assert(m.field('samples').textContent==='6'&&m.field('qualification-state').textContent.includes('Qualification off')&&!m.field('run').disabled,'Late qualification replaced newer state');}finally{m.close();}
  });
  await check('320459-sample browser analysis renders bounded SVG evidence without argument-limit failure', async () => {
    const values = new Float64Array(320459).fill(1000), f = fixture(values), m = mount(); try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      const rpm=f.traces[0].range,airflow=analyzeIdleAirflow({rpm,sampleIndices:Uint32Array.from({length:values.length},(_,i)=>rpm.startSampleIndex+i),basePosition:{range:{...rpm,values:new Float64Array(values.length).fill(20)},unit:'%'}});
      assert(airflow.basePosition.statistics.validSampleCount===320459&&airflow.basePosition.statistics.mean===20&&airflow.closedLoop.status==='missing','Browser-scale Airflow foundation failed');
      assert(m.field('samples').textContent.replaceAll(',', '') === '320459' && m.field('rmse').textContent === '0.00', 'Large browser analysis failed');
      const svg=m.view.element.querySelector('svg'), path=()=>svg.querySelector('[data-idle-trace="0"]');
      assert(path().dataset.traceMode==='envelope'&&(path().getAttribute('d').match(/M/g)||[]).length===1,'Dense trace lost flat-line continuity');
      for(let i=0;i<40;i++)svg.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));
      assert(path().dataset.traceMode==='raw'&&path().getAttribute('d').includes('L'),'Zoomed trace did not switch to original raw samples');
      assert(f.calls.length===1,'Graph zoom reread source');m.field('fit').click();
      assert(m.view.element.querySelectorAll('svg path').length === 2 && m.view.element.querySelectorAll('svg *').length < 100, 'Unbounded graph DOM');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager');
      d.querySelector('[data-new=start]').value='0';d.querySelector('[data-new=end]').value=String(f.context.sourceTimeRange.endMs/1000);d.querySelector('[data-manager=add]').click();d.querySelector('[data-manager=analyze]').click();await wait();
      d.querySelector('[data-edit=split]').value='16022.9';d.querySelector('[data-manager=split]').click();await wait();
      assert(m.field('samples').textContent.replaceAll(',', '')==='320459'&&f.calls.length===1,'Large split duplicated endpoint samples or reread source');
      const parts=d.querySelectorAll('tbody tr');change(parts[0].querySelector('[data-merge-target]'),parts[1].dataset.regionId);parts[0].querySelector('[data-manager=merge]').click();await wait();
      assert(m.field('samples').textContent.replaceAll(',', '')==='320459'&&m.field('rmse').textContent==='0.00'&&f.calls.length===1,'Large merge changed reference metrics');
      d.querySelector('[data-manager=focus]').click();change(m.field('scope'),'viewed');await wait();assert(m.field('samples').textContent.replaceAll(',', '')==='320459'&&f.calls.length===1&&m.view.element.querySelectorAll('svg *').length<100,'Large Viewed failed reference count, cache or bounded DOM');
    } finally { m.close(); }
  });
  await check('Viewed region updates unequal numerical evidence across focus entry points without changing combined inclusion',async()=>{
    const f=airflowFixture();const values=[900,1000,1100,1300];f.traces[0].range.values=Float64Array.from(values);
    let requests=0;
    const n=mount({record(event){if(event.name==='idle.stability.request')requests++;}});
    try{
      n.view.setContext(f.context);n.view.setActive(true);await wait();change(n.field('scope'),'viewed');await wait();
      assert(n.field('samples').textContent==='—'&&!n.field('focus-control').hidden&&n.field('status').textContent.includes('Select a managed region'),'Empty Viewed silently fell back or selector hidden');
      n.field('manage-regions').click();const d=n.view.element.querySelector('.idle-region-manager'),rows=()=>[...d.querySelectorAll('tbody tr')];
      const add=(a,b,label)=>{d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-new=label]').value=label;d.querySelector('[data-manager=add]').click();};
      add(0,.1,'A');add(.2,.3,'B');await wait();assert(n.field('samples').textContent==='—','Adding chose first region silently');
      const a=rows()[0].dataset.regionId,b=rows()[1].dataset.regionId;
      rows()[0].querySelector('[data-manager=focus]').click();await wait();
      assert(n.field('focus-label').textContent==='Viewed region'&&n.field('region-key').textContent.includes('View selects the region for analysis.')&&n.field('samples').textContent==='2'&&n.field('sigma').textContent==='70.71'&&n.field('rmse').textContent==='70.71'&&n.field('in-band').textContent==='50.0%','Viewed A reference case wrong');
      change(n.field('mode'),'airflow');assert(n.field('airflow-base').textContent.includes('21.00')&&n.field('airflow-correction').textContent.includes('1.00'),'Viewed A Airflow not bounded');
      change(n.field('focus'),b);await wait();
      assert(n.field('sigma').textContent==='141.42'&&n.field('rmse').textContent==='223.61'&&n.field('in-band').textContent==='0.0%'&&n.field('airflow-base').textContent.includes('25.00'),'Viewed B evidence stale');
      const before=requests,reads=f.calls.length;
      n.view.element.querySelector('svg').dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));
      const paths=()=>[...n.view.element.querySelectorAll('[data-idle-trace]')].map(p=>p.getAttribute('d')).join('|'),viewport=paths();
      change(rows()[1].querySelector('[data-purpose]'),'raised');rows()[1].querySelector('[data-edit=label]').value='B renamed';rows()[1].querySelector('[data-manager=edit]').click();await wait();
      assert(requests===before&&f.calls.length===reads&&paths()===viewport&&n.field('metrics-scope').textContent.includes('B renamed')&&n.field('assessment').textContent.includes('Raised-RPM'),'Presentation edit recomputed, reset viewport or failed label/purpose');
      const include=rows()[1].querySelector('[data-include]');include.checked=false;include.dispatchEvent(new Event('change',{bubbles:true}));await wait();
      assert(n.field('samples').textContent==='2'&&requests===before&&!rows()[1].querySelector('[data-include]').checked,'Excluded Viewed altered numeric authority');
      n.view.element.querySelector(`[data-region-id="${a}"].idle-region-marker`).click();await wait();assert(n.field('rmse').textContent==='70.71','Timeline marker failed Viewed analysis');
      change(n.field('scope'),'regions');await wait();const combined=requests;change(n.field('focus'),b);await wait();
      assert(n.field('rmse').textContent==='70.71'&&requests===combined,'Combined graph focus changed numeric scope');
      change(n.field('scope'),'viewed');await wait();assert(n.field('rmse').textContent==='223.61','Returning Viewed failed excluded selection');
      rows()[1].querySelector('[data-manager=remove]').click();await wait();assert(n.field('samples').textContent==='—'&&n.field('assessment').textContent.includes('Recorded evidence required'),'Deleted selection retained evidence');
      change(n.field('focus'),a);await wait();const retained=requests;n.view.setActive(false);n.view.setContext({...f.context});n.view.setActive(true);await wait();assert(n.field('rmse').textContent==='70.71'&&requests===retained,'Navigation discarded retained Viewed evidence');
      n.view.setContext({...f.context,source:{...f.context.source,identity:{}}});await wait();assert(n.field('scope').value==='viewed'&&n.field('samples').textContent==='—','Replacement source silently analyzed Full Log');
    }finally{n.close();}
  });
  await check('Viewed split/merge changes selected bounds and a Logger command explicitly leaves Viewed',async()=>{
    const f=fixture([900,1000,1100,1300,1500,1700]),m=mount();let commits=0;
    f.context.setAnalysisRange=({startMs,endMs})=>{commits++;f.context={...f.context,aTimeMs:startMs,bTimeMs:endMs};m.view.setContext(f.context);return true;};
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager'),rows=()=>[...d.querySelectorAll('tbody tr')];
      d.querySelector('[data-new=start]').value='0';d.querySelector('[data-new=end]').value='.5';d.querySelector('[data-manager=add]').click();rows()[0].querySelector('[data-manager=focus]').click();change(m.field('scope'),'viewed');await wait();
      rows()[0].querySelector('[data-edit=split]').value='.2';rows()[0].querySelector('[data-manager=split]').click();await wait();
      assert(m.field('samples').textContent==='3'&&m.field('rmse').textContent==='81.65','Selected split kept pre-split evidence');
      rows()[1].querySelector('[data-manager=focus]').click();await wait();assert(m.field('samples').textContent==='4','Second split focus did not analyze actual bounds');
      const retainedId=rows()[0].dataset.regionId;change(rows()[0].querySelector('[data-merge-target]'),rows()[1].dataset.regionId);rows()[0].querySelector('[data-manager=merge]').click();await wait();
      assert(m.field('focus').value===retainedId&&m.field('samples').textContent==='6'&&f.calls.length===1,'Merged focus/evidence/source cache incorrect');
      d.querySelector('[data-manager=close]').click();const track=m.field('range-track'),r=track.getBoundingClientRect();track.setPointerCapture=()=>{};
      for(const [type,x]of[['pointerdown',.2],['pointermove',.4],['pointerup',.4]])track.dispatchEvent(new PointerEvent(type,{pointerId:92,button:0,shiftKey:true,bubbles:true,cancelable:true,clientX:r.left+r.width*x,clientY:r.top+8}));
      await wait();assert(commits===1&&m.field('scope').value==='ab'&&m.field('focus').value==='logger'&&rows().length===1&&m.field('metrics-scope').textContent.includes('Current A/B'),'Viewed drag did not visibly transition to real Logger A/B');
      change(m.field('scope'),'viewed');change(m.field('focus'),retainedId);change(m.field('candidate-duration'),'.1');m.field('discover').click();await wait();
      const regionCount=rows().length;change(m.field('candidates'),'0');await wait();
      assert(commits===2&&m.field('scope').value==='ab'&&m.field('focus').value==='logger'&&f.context.aTimeMs===0&&f.context.bTimeMs===200&&rows().length===regionCount,'Discovery command resized managed region or failed real A/B transition');
    }finally{m.close();}
  });
  await check('Viewed rejects late interval work and hidden completions at the existing generation boundary',async()=>{
    const f=fixture([900,1000,1100,1300]),m=mount(),pending=[];let deferred=false;
    f.context.loadTraces=async()=>deferred?new Promise(resolve=>pending.push(resolve)):f.traces;
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager'),rows=()=>[...d.querySelectorAll('tbody tr')];
      for(const [a,b]of[[0,.1],[.2,.3]]){d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-manager=add]').click();}
      const a=rows()[0].dataset.regionId,b=rows()[1].dataset.regionId;change(m.field('scope'),'viewed');
      deferred=true;const replacement={...f.context,channels:f.context.channels.map(c=>({...c,displayName:c.displayName+' revised'}))};m.view.setContext(replacement);
      change(m.field('focus'),a);change(m.field('focus'),b);assert(pending.length===2,'Test did not hold two independent requests');
      pending[1](f.traces);await wait();assert(m.field('rmse').textContent==='223.61','Latest B did not accept');pending[0](f.traces);await wait();assert(m.field('rmse').textContent==='223.61','Late A replaced B');
      m.view.setContext({...replacement,channels:replacement.channels.map(c=>({...c,displayName:c.displayName+' new'}))});assert(pending.length===3,'Replacement not pending');m.view.setActive(false);pending[2](f.traces);await wait();assert(m.field('samples').textContent==='—','Hidden completion accepted');
      deferred=false;m.view.setActive(true);await wait();assert(m.field('rmse').textContent==='223.61','Resume failed current Viewed interval');
    }finally{m.close();}
  });
  await check('Viewed applies qualification to candidates and only explicitly bypasses eligible manual bounds',async()=>{
    const f=fixture(new Float64Array(6).fill(1000)),m=mount();const checked=(name,value)=>{m.field(name).checked=value;m.field(name).dispatchEvent(new Event('change',{bubbles:true}));};
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('candidate-duration'),'.1');m.field('discover').click();await wait();
      const id=[...m.field('focus').options].find(o=>o.value.startsWith('region:'))?.value;assert(id,'Candidate missing');change(m.field('focus'),id);change(m.field('scope'),'viewed');await wait();
      checked('qual-enabled',true);checked('qual-bypass',true);await wait();assert(m.field('samples').textContent==='—'&&m.field('status').textContent.includes('Qualification unavailable'),'Untouched excluded candidate bypassed missing coolant');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager');change(d.querySelector('[data-purpose]'),'idle');d.querySelector('[data-edit=label]').value='Renamed';d.querySelector('[data-manager=edit]').click();await wait();assert(m.field('samples').textContent==='—','Rename or purpose granted bypass');
      d.querySelector('[data-edit=end]').value='.4';d.querySelector('[data-manager=edit]').click();await wait();assert(m.field('samples').textContent==='5'&&m.field('assessment').textContent.includes('5 valid records manually bypassed')&&!d.querySelector('[data-include]').checked,'Edited excluded candidate not explicitly bypassed');
      checked('qual-bypass',false);await wait();assert(m.field('samples').textContent==='—','Disabling bypass retained old evidence');
    }finally{m.close();}
  });
  await check('DC Valve Tracking loads lazily, shows signed paired evidence and reuses calculations across modes/tabs',async()=>{
    const f=valveFixture(),events=[],m=mount({record:event=>events.push(event)}),requests=()=>events.filter(e=>e.name==='idle.valve.request').length;
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();assert(f.calls.length===1&&!f.calls[0].ids.includes('dc-request'),'Inactive valve mode decoded its channels');
      change(m.field('mode'),'valve');await wait();assert(f.calls.length===2&&f.calls[1].ids.length===3&&requests()===1,'Valve did not load missing channels once');
      assert(m.field('valve-rmse').textContent==='3.32'&&m.field('valve-error').textContent==='1.50'&&m.field('valve-motor').textContent==='-1.50'&&m.field('valve-reference').textContent==='75.0%','Wrong measured-minus-requested or signed motor reference facts');
      assert(m.view.element.querySelector('svg').textContent.includes('DC VALVE')&&m.view.element.querySelector('[data-trace-label="Error · measured − requested"]'),'Valve graphs retained RPM labels or missing error trace');
      assert(m.view.element.querySelector('[data-trace-label="Signed motor duty"]').dataset.valueAxis==='right'&&m.view.element.querySelector('.idle-plot-y-axis-right').children.length===5,'Motor and position error share an unlabelled scale');
      m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('4 valid, 0 invalid, 0 unavailable')&&m.field('assessment').textContent.includes('not a firmware saturation limit'),'Evidence coverage/reference qualification missing');
      change(m.field('mode'),'stability');change(m.field('mode'),'airflow');change(m.field('mode'),'valve');m.view.element.querySelector('[data-idle-tab=next]').click();m.view.element.querySelector('[data-idle-tab=diagnosis]').click();assert(requests()===1&&f.calls.length===2,'Mode/tab transitions repeated valve analysis or reads');
      change(m.field('motor-reference'),'100');await wait();assert(m.field('valve-reference').textContent==='25.0%'&&m.field('valve-rmse').textContent==='3.32'&&f.calls.length===2,'Motor reference ineffective, changed tracking or reread data');
      change(m.field('motor-reference'),'0');await wait();assert(m.field('valve-rmse').textContent==='—'&&m.field('assessment').textContent.includes('above 0'),'Invalid threshold left stale healthy metrics');change(m.field('motor-reference'),'95');await wait();
      const before=requests();m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();assert(requests()===before&&f.calls.length===2&&m.field('valve-rmse').textContent==='3.32','Navigation destroyed retained valve authority');
      change(m.field('dcPosition'),'');await wait();assert(m.field('valve-rmse').textContent==='Unavailable'&&m.field('valve-motor').textContent==='-1.50'&&m.field('assessment').textContent.includes('Map compatible'),'Missing feedback fabricated perfect tracking or lost independent motor evidence');
      change(m.field('dcPosition'),'dc-measured');await wait();assert(m.field('valve-rmse').textContent==='3.32'&&f.calls.length===2,'Restored mapping reread retained columns');
    }finally{m.close();}
  });
  await check('Valve Viewed/combined scope, qualification and misalignment share accepted original source selection',async()=>{
    const f=valveFixture(),m=mount();f.traces.find(t=>t.channel.id==='dc-measured').range.timeMs=Float64Array.from([0,100,201,300]);
    const channel={id:'clt',sourceName:'coolant',displayName:'Coolant',unit:'deg C',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:Float64Array.from([80,80,60,60])}});
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'valve');await wait();m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('3 valid, 0 invalid, 1 unavailable'),'Timestamp mismatch counted as valid tracking');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager'),rows=()=>[...d.querySelectorAll('tbody tr')];
      for(const [a,b,label]of[[0,.1,'A'],[.2,.3,'B']]){d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-new=label]').value=label;d.querySelector('[data-manager=add]').click();}
      const a=rows()[0].dataset.regionId,b=rows()[1].dataset.regionId;change(m.field('focus'),a);change(m.field('scope'),'viewed');await wait();assert(m.field('valve-rmse').textContent==='2.00'&&m.field('valve-reference').textContent==='100.0%','Viewed valve A not bounded');
      change(m.field('focus'),b);await wait();assert(m.field('valve-rmse').textContent==='0.00'&&m.field('valve-reference').textContent==='50.0%'&&m.field('assessment').textContent.includes('1 valid, 0 invalid, 1 unavailable'),'Viewed B reused A or hid unavailable pairing');
      change(m.field('scope'),'regions');await wait();const combined=m.field('valve-rmse').textContent;change(m.field('focus'),a);await wait();assert(m.field('valve-rmse').textContent===combined,'Combined valve numbers followed graph focus');
      m.field('qual-enabled').checked=true;m.field('qual-enabled').dispatchEvent(new Event('change',{bubbles:true}));await wait();assert(m.field('valve-rmse').textContent==='2.00'&&m.field('valve-reference').textContent==='100.0%','Valve bypassed accepted coolant qualification');
    }finally{m.close();}
  });
  await check('Valve stale reads cannot complete into a newer mapping, source or inactive view',async()=>{
    const f=valveFixture(),m=mount(),pending=[];const original=f.context.loadTraces;let hold=true;
    f.context.loadTraces=(ids,a,b)=>ids.includes('dc-measured')&&hold?new Promise(resolve=>pending.push(resolve)):original(ids,a,b);
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'valve');assert(pending.length===1,'Valve read not pending');change(m.field('dcPosition'),'');await wait();const current=m.field('valve-rmse').textContent;pending[0](f.traces);await wait();assert(m.field('valve-rmse').textContent===current&&current==='Unavailable','Old mapping completed into newer evidence');
      change(m.field('dcPosition'),'dc-measured');assert(pending.length===2,'New feedback read not pending');change(m.field('mode'),'stability');pending[1](f.traces);await wait();assert(m.field('mode').value==='stability'&&m.field('valve-rmse').textContent==='—','Inactive valve completion published');
      change(m.field('mode'),'valve');assert(pending.length===3,'Returning mode did not request current evidence');m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:1}});await wait();assert(pending.length===4,'Replacement valve source not independently requested');hold=false;pending[3](f.traces.map(t=>t.channel.id==='dc-measured'?{...t,range:{...t.range,values:Float64Array.from([10,20,30,40])}}:t));await wait();assert(m.field('valve-rmse').textContent==='0.00','New source failed acceptance');pending[2](f.traces);await wait();assert(m.field('valve-rmse').textContent==='0.00','Old source overwrote current tracking');
      hold=true;m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:2}});await wait();assert(pending.length===5,'Hidden-owner test did not hold a read');m.view.setActive(false);pending[4](f.traces);await wait();assert(m.field('valve-rmse').textContent==='—','Hidden owner published valve completion');hold=false;m.view.setActive(true);await wait();assert(m.field('valve-rmse').textContent==='3.32','Resuming owner did not load current valve evidence');
    }finally{m.close();}
  });
  await check('320459-sample native Valve mode retains bounded graph DOM and source columns',async()=>{
    const f=valveFixture(320459),m=mount();try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'valve');await wait();assert(m.field('valve-rmse').textContent==='2.00'&&m.field('valve-error').textContent==='2.00'&&m.field('valve-reference').textContent==='100.0%','Large valve reference facts failed');
      m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('320459 valid')&&m.view.element.querySelectorAll('svg *').length<150,'Large evidence count or DOM unbounded');m.view.element.querySelector('svg').dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));const axisTimes=()=>[...m.view.element.querySelectorAll('svg text')].map(e=>e.textContent).filter(t=>t.endsWith(' s')).join('|'),viewport=axisTimes();change(m.field('mode'),'stability');change(m.field('mode'),'valve');await wait();assert(f.calls.length===2&&axisTimes()===viewport,'Large mode revisit reread source or reset viewport');
    }finally{m.close();}
  });
  await check('Valve full-column retention never promotes partial RPM context or drops independent cached columns',async()=>{
    const f=valveFixture(),m=mount(),original=f.context.loadTraces;let first=true;
    f.context.loadTraces=async(ids,a,b)=>{if(first){first=false;f.calls.push({ids,start:a,end:b});return f.traces.filter(t=>ids.includes(t.channel.id)).map(t=>({...t,complete:false,range:{...t.range,values:t.range.values.slice(0,2),timeMs:t.range.timeMs.slice(0,2),validity:t.range.validity.slice(0,2)}}));}return original(ids,a,b);};
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();assert(m.field('samples').textContent==='2','Partial fixture did not start partial');change(m.field('mode'),'valve');await wait();
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager');d.querySelector('[data-new=start]').value='0';d.querySelector('[data-new=end]').value='.3';d.querySelector('[data-manager=add]').click();d.querySelector('[data-manager=analyze]').click();await wait();
      assert(m.field('samples').textContent==='4'&&m.field('valve-rmse').textContent==='3.32','Partial RPM columns were promoted to authoritative full source');
      assert(f.calls.length===3&&f.calls[2].ids.includes('rpm')&&!f.calls[2].ids.includes('dc-measured'),'Base refresh lost retained valve columns or failed to obtain complete RPM');
    }finally{m.close();}
  });
  await check('Valve channel remapping does not retain every previously selected full-log column',async()=>{
    const f=valveFixture(),m=mount();
    for(let i=0;i<4;i++){const channel={id:`feedback-${i}`,sourceName:`Alternate feedback ${i}`,displayName:`Alternate feedback ${i}`,unit:'%',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:new Float64Array(4).fill(20+i)}});}
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'valve');await wait();
      for(let i=0;i<4;i++){change(m.field('dcPosition'),`feedback-${i}`);await wait();}
      const before=f.calls.length;change(m.field('dcPosition'),'dc-measured');await wait();
      assert(f.calls.length===before+1&&f.calls.at(-1).ids.join(',')==='dc-measured'&&m.field('valve-rmse').textContent==='3.32','Retired feedback columns accumulated or current motor/request columns were lost');
      const reads=f.calls.length;change(m.field('dcPosition'),'');await wait();change(m.field('dcPosition'),'dc-measured');await wait();assert(f.calls.length===reads,'Clearing/restoring the last role lost its bounded retained column');
    }finally{m.close();}
  });
  await check('RPM PID lazily loads outer terms and reuses raw/output/applied evidence without assuming their sum',async()=>{
    const f=pidFixture(),events=[],m=mount({record:event=>events.push(event)}),requests=()=>events.filter(e=>e.name==='idle.pid.request').length;
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();assert(f.calls.length===1&&!f.calls[0].ids.includes('pid-p'),'Inactive PID mode decoded its channels');
      change(m.field('mode'),'pid');await wait();assert(f.calls.length===2&&f.calls[1].ids.length===4&&requests()===1,'PID did not batch missing roles once');
      assert(m.field('pid-p').textContent==='3.00'&&m.field('pid-i').textContent==='2.50'&&m.field('pid-d').textContent==='4.00'&&m.field('pid-applied').textContent==='1.50','PID reference arithmetic incorrect');
      assert(m.field('pid-p-label').textContent.includes('unspecified')&&m.field('assessment').textContent.includes('not assumed to equal P + I + D'),'Raw units or output stage were fabricated');
      assert(m.view.element.querySelector('[data-trace-label="Applied correction"]').dataset.valueAxis==='right'&&m.view.element.querySelector('svg').textContent.includes('raw; units unspecified'),'Raw and applied curves share a misleading engineering scale');
      m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('17.50')&&m.field('assessment').textContent.includes('4 valid, 0 invalid, 0 unavailable'),'Output or independent coverage missing');
      change(m.field('mode'),'valve');await wait();const reads=f.calls.length;change(m.field('mode'),'airflow');change(m.field('mode'),'pid');m.view.element.querySelector('[data-idle-tab=next]').click();m.view.element.querySelector('[data-idle-tab=diagnosis]').click();await wait();
      assert(requests()===1&&f.calls.length===reads&&m.field('pid-p').textContent==='3.00','Mode/tab transitions repeated PID calculation/read');
      const before=requests();m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();assert(requests()===before&&f.calls.length===reads,'Unchanged navigation invalidated PID');
      change(m.field('p'),'');await wait();assert(m.field('pid-p').textContent==='Unavailable'&&m.field('pid-p-label').textContent.includes('unit unavailable')&&m.field('pid-i').textContent==='2.50','Missing P became zero or blocked independent I');change(m.field('p'),'pid-p');await wait();assert(m.field('pid-p').textContent==='3.00'&&f.calls.length===reads,'Restoring last P mapping reread source');
    }finally{m.close();}
  });
  await check('RPM PID uses Viewed/combined qualification and keeps mixed engineering units out of a shared axis',async()=>{
    const f=pidFixture(),m=mount();f.traces.find(t=>t.channel.id==='pid-p').range.timeMs=Float64Array.from([0,100,201,300]);
    for(const [id,name,unit,values]of[['clt','coolant','deg C',[80,80,60,60]],['known-p','Known P','pp',[2,2,2,2]]]){const channel={id,sourceName:name,displayName:name,unit,valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:Float64Array.from(values)}});}
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'pid');await wait();m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('3 valid, 0 invalid, 1 unavailable'),'PID timestamp mismatch counted as aligned');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager'),rows=()=>[...d.querySelectorAll('tbody tr')];for(const [a,b]of[[0,.1],[.2,.3]]){d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-manager=add]').click();}
      const a=rows()[0].dataset.regionId,b=rows()[1].dataset.regionId;change(m.field('focus'),a);change(m.field('scope'),'viewed');await wait();assert(m.field('pid-i').textContent==='1.50'&&m.field('pid-applied').textContent==='0.50','Viewed PID A not bounded');
      change(m.field('focus'),b);await wait();assert(m.field('pid-i').textContent==='3.50'&&m.field('pid-applied').textContent==='2.50','Viewed PID B retained A');change(m.field('scope'),'regions');await wait();const mean=m.field('pid-i').textContent;change(m.field('focus'),a);await wait();assert(m.field('pid-i').textContent===mean,'Combined PID followed graph focus');
      m.field('qual-enabled').checked=true;m.field('qual-enabled').dispatchEvent(new Event('change',{bubbles:true}));await wait();assert(m.field('pid-i').textContent==='1.50','PID ignored accepted qualification');
      change(m.field('p'),'known-p');await wait();assert(m.field('pid-p').textContent==='2.00'&&!m.view.element.querySelector('path[data-trace-label="Logged RPM I"]'),'Mixed units overlaid or independent metric lost');
      assert(m.field('assessment').textContent.includes('Missing or mixed term units')&&m.view.element.querySelector('[data-trace-label="Applied correction"]'),'Mixed-unit graph reason or independent applied trace missing');
    }finally{m.close();}
  });
  await check('RPM PID rejects obsolete mapping/source/hidden work; inactive Valve settings cannot cancel it',async()=>{
    const f=pidFixture(),m=mount(),pending=[];const original=f.context.loadTraces;let hold=true;
    f.context.loadTraces=(ids,a,b)=>ids.includes('pid-p')&&hold?new Promise(resolve=>pending.push(resolve)):original(ids,a,b);
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'pid');assert(pending.length===1,'PID not pending');change(m.field('motor-reference'),'0');pending[0](f.traces);await wait();assert(m.field('pid-p').textContent==='3.00','Inactive Valve setting cancelled PID evidence');
      const next={...f.context,source:{...f.context.source,identity:{},revision:1}};m.view.setContext(next);await wait();assert(pending.length===2,'Replacement PID not pending');change(m.field('p'),'');await wait();pending[1](f.traces);await wait();assert(m.field('pid-p').textContent==='Unavailable','Old mapping replaced missing P');
      change(m.field('p'),'pid-p');assert(pending.length===3,'New P read not pending');m.view.setActive(false);pending[2](f.traces);await wait();assert(m.field('pid-p').textContent==='—','Hidden PID completion published');hold=false;m.view.setActive(true);await wait();assert(m.field('pid-p').textContent==='3.00','PID resume failed');
      hold=true;m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:2}});await wait();assert(pending.length===4,'Old-source test not pending');m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:3}});await wait();assert(pending.length===5,'New source not independently pending');
      pending[4](f.traces.map(t=>t.channel.id==='pid-p'?{...t,range:{...t.range,values:new Float64Array(4).fill(9)}}:t));await wait();pending[3](f.traces);await wait();assert(m.field('pid-p').textContent==='9.00','Obsolete source replaced accepted PID');
    }finally{m.close();}
  });
  await check('RPM PID columns stay bounded across repeated remapping without losing current Valve roles',async()=>{
    const f=pidFixture(),m=mount();for(let i=0;i<4;i++){const channel={id:`p-${i}`,sourceName:`Mapped P ${i}`,displayName:`Mapped P ${i}`,unit:'pp',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:new Float64Array(4).fill(2)}});}
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'valve');await wait();change(m.field('mode'),'pid');await wait();for(let i=0;i<4;i++){change(m.field('p'),`p-${i}`);await wait();}
      const reads=f.calls.length;change(m.field('p'),'pid-p');await wait();assert(f.calls.length===reads+1&&f.calls.at(-1).ids.join(',')==='pid-p','Retired PID columns accumulated or current role columns lost');const before=f.calls.length;change(m.field('mode'),'valve');await wait();assert(f.calls.length===before&&m.field('valve-rmse').textContent==='3.32','PID retention evicted current Valve facts');
    }finally{m.close();}
  });
  await check('320459-sample native RPM PID preserves raw units, bounded graph DOM and retained viewport',async()=>{
    const f=pidFixture(320459),m=mount();try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'pid');await wait();assert(m.field('pid-p').textContent==='3.00'&&m.field('pid-i').textContent==='2.00'&&m.field('pid-d').textContent==='4.00'&&m.field('pid-applied').textContent==='5.00','Large PID reference facts failed');
      m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('320459 valid')&&m.view.element.querySelectorAll('svg *').length<170,'Large PID lost source counts or bounded DOM');
      m.view.element.querySelector('svg').dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));const times=()=>[...m.view.element.querySelectorAll('svg text')].map(e=>e.textContent).filter(t=>t.endsWith(' s')).join('|'),viewport=times();change(m.field('mode'),'stability');change(m.field('mode'),'pid');await wait();assert(f.calls.length===2&&times()===viewport,'PID mode transition reread source or reset viewport');
    }finally{m.close();}
  });
  await check('RPM PID remains descriptive without a logged RPM target and never invents missing terms/output',async()=>{
    const f=pidFixture(),m=mount();f.context.channels=f.context.channels.filter(c=>c.id!=='target'&&c.id!=='pid-output');f.traces.splice(0,f.traces.length,...f.traces.filter(t=>t.channel.id!=='target'&&t.channel.id!=='pid-output'));
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'pid');await wait();assert(m.field('pid-p').textContent==='3.00'&&m.field('rmse').textContent==='Unavailable','Absent target blocked independent terms or invented RPM error');
      m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('unit unavailable')&&m.field('assessment').textContent.includes('RMSE Unavailable RPM'),'Missing logged output or target authority was fabricated');
    }finally{m.close();}
  });
  await check('DC Bias/Position PID loads lazily and reuses retained Valve position evidence across modes and reference changes',async()=>{
    const f=biasFixture(),events=[],m=mount({record:event=>events.push(event)}),positions=()=>events.filter(e=>e.name==='idle.position.request').length,biasRuns=()=>events.filter(e=>e.name==='idle.bias.request').length;
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();assert(f.calls.length===1&&!f.calls[0].ids.includes('inner-feed'),'Inactive Bias mode loaded its channels');change(m.field('mode'),'valve');await wait();const first=positions();
      change(m.field('mode'),'bias');await wait();assert(f.calls.length===3&&f.calls[2].ids.length===4&&positions()===first&&biasRuns()===1,'Bias duplicated position analysis or did not batch missing terms');
      assert(m.field('bias-i').textContent==='0.00'&&m.field('bias-feed').textContent==='16.00'&&m.field('bias-motor').textContent==='-1.50'&&m.field('bias-tracking').textContent==='3.32','Inner PID/feed-forward reference facts incorrect');
      assert(m.field('bias-i-label').textContent.includes('unspecified')&&m.view.element.querySelector('[data-trace-label="Signed motor duty"]').dataset.valueAxis==='right','Duty/raw units or independent axis incorrect');
      m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('Tune-derived DC bias')&&m.field('assessment').textContent.includes('Unverified')&&m.field('assessment').textContent.includes('4 valid, 0 invalid, 0 unavailable'),'Tune/actuator authority or role coverage missing');
      const reads=f.calls.length;change(m.field('motor-reference'),'0');await wait();assert(m.field('bias-tracking').textContent==='3.32'&&positions()===first&&biasRuns()===1,'Unused motor reference invalidated Bias or shared pairing');change(m.field('mode'),'pid');await wait();const afterPid=f.calls.length;change(m.field('mode'),'bias');m.view.element.querySelector('[data-idle-tab=next]').click();m.view.element.querySelector('[data-idle-tab=diagnosis]').click();assert(f.calls.length===afterPid&&positions()===first&&biasRuns()===1,'Mode/tabs repeated accepted Bias work');
      change(m.field('motor-reference'),'95');change(m.field('mode'),'valve');await wait();assert(m.field('valve-rmse').textContent==='3.32'&&positions()===first&&f.calls.length===afterPid,'Return to Valve recomputed position or reread columns');change(m.field('mode'),'bias');
      m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();assert(positions()===first&&biasRuns()===1&&f.calls.length===afterPid&&reads===3,'Navigation destroyed retained shared evidence');
    }finally{m.close();}
  });
  await check('Inner PID follows Viewed/combined qualification, detects per-term misalignment, and preserves independent position/motor facts',async()=>{
    const f=biasFixture(),m=mount();f.traces.find(t=>t.channel.id==='inner-i').range.timeMs=Float64Array.from([0,100,201,300]);
    for(const [id,name,unit,values]of [['clt','coolant','deg C',[80,80,60,60]],['known-feed','Declared feed-forward','%',[40,40,40,40]]]){const channel={id,sourceName:name,displayName:name,unit,valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:Float64Array.from(values)}});}
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'bias');await wait();m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('3 valid, 0 invalid, 1 unavailable'),'Inner timestamp mismatch counted as valid');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager'),rows=()=>[...d.querySelectorAll('tbody tr')];for(const [a,b]of [[0,.1],[.2,.3]]){d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-manager=add]').click();}
      const a=rows()[0].dataset.regionId,b=rows()[1].dataset.regionId;change(m.field('focus'),a);change(m.field('scope'),'viewed');await wait();assert(m.field('bias-i').textContent==='-2.00'&&m.field('bias-feed').textContent==='12.00'&&m.field('bias-tracking').textContent==='2.00','Viewed inner A not bounded');
      change(m.field('focus'),b);await wait();assert(m.field('bias-i').textContent==='3.00'&&m.field('bias-feed').textContent==='20.00','Viewed inner B retained A or borrowed mismatched I');change(m.field('scope'),'regions');await wait();const combined=m.field('bias-i').textContent;change(m.field('focus'),a);await wait();assert(m.field('bias-i').textContent===combined,'Combined Bias followed graph focus');
      m.field('qual-enabled').checked=true;m.field('qual-enabled').dispatchEvent(new Event('change',{bubbles:true}));await wait();assert(m.field('bias-i').textContent==='-2.00'&&m.field('bias-feed').textContent==='12.00','Bias ignored accepted qualification');
      change(m.field('dcPosition'),'');await wait();assert(m.field('bias-tracking').textContent==='Unavailable'&&m.field('bias-feed').textContent==='12.00','Missing feedback became zero tracking or blocked independent feed-forward');change(m.field('dcPosition'),'dc-measured');await wait();assert(m.field('bias-tracking').textContent==='2.00','Restored feedback did not invalidate shared position');
      change(m.field('dcBiasOutput'),'known-feed');await wait();assert(m.field('bias-feed').textContent==='40.00'&&!m.view.element.querySelector('path[data-trace-label="Inner position I"]')&&m.view.element.querySelector('path[data-trace-label="Signed motor duty"]')&&m.field('assessment').textContent.includes('Missing or mixed term units'),'Mixed raw/duty units overlaid or independent motor lost');
    }finally{m.close();}
  });
  await check('Bias rejects stale mapping/source/hidden completions while inactive outer PID and motor references cannot cancel it',async()=>{
    const f=biasFixture(),m=mount(),pending=[];const original=f.context.loadTraces;let hold=true;
    f.context.loadTraces=(ids,a,b)=>ids.includes('inner-feed')&&hold?new Promise(resolve=>pending.push(resolve)):original(ids,a,b);
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'bias');assert(pending.length===1,'Bias not pending');change(m.field('p'),'');change(m.field('motor-reference'),'0');pending[0](f.traces);await wait();assert(m.field('bias-feed').textContent==='16.00'&&m.field('bias-tracking').textContent==='3.32','Inactive settings cancelled Bias/shared position work');
      m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:1}});await wait();assert(pending.length===2,'Replacement Bias not pending');change(m.field('dcBiasOutput'),'');await wait();pending[1](f.traces);await wait();assert(m.field('bias-feed').textContent==='Unavailable','Obsolete mapping replaced missing feed-forward');
      change(m.field('dcBiasOutput'),'inner-feed');assert(pending.length===3,'Restored feed-forward not pending');m.view.setActive(false);pending[2](f.traces);await wait();assert(m.field('bias-feed').textContent==='—','Hidden Bias accepted a completion');hold=false;m.view.setActive(true);await wait();assert(m.field('bias-feed').textContent==='16.00','Bias resume failed');
      hold=true;m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:2}});await wait();m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:3}});await wait();assert(pending.length===5,'Overlapping source loads not held');pending[4](f.traces.map(t=>t.channel.id==='inner-feed'?{...t,range:{...t.range,values:new Float64Array(4).fill(99)}}:t));await wait();pending[3](f.traces);await wait();assert(m.field('bias-feed').textContent==='99.00','Old source overwrote latest feed-forward');
    }finally{m.close();}
  });
  await check('Inner PID remapping retires old columns without repeating position calculations or evicting current Valve roles',async()=>{
    const f=biasFixture(),events=[],m=mount({record:event=>events.push(event)}),positions=()=>events.filter(e=>e.name==='idle.position.request').length;
    for(let i=0;i<4;i++){const channel={id:`inner-${i}`,sourceName:`Mapped inner I ${i}`,displayName:`Mapped inner I ${i}`,unit:'%',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:new Float64Array(4).fill(2+i)}});}
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'valve');await wait();change(m.field('mode'),'bias');await wait();const paired=positions();for(let i=0;i<4;i++){change(m.field('dcI'),`inner-${i}`);await wait();}
      const reads=f.calls.length;change(m.field('dcI'),'inner-i');await wait();assert(f.calls.length===reads+1&&f.calls.at(-1).ids.join(',')==='inner-i'&&positions()===paired,'Inner columns accumulated or pairing repeated');const before=f.calls.length;change(m.field('mode'),'valve');await wait();assert(f.calls.length===before&&m.field('valve-rmse').textContent==='3.32'&&positions()===paired,'Bias retention evicted/recomputed Valve authority');
    }finally{m.close();}
  });
  await check('320459-sample native Bias shares position/error evidence, keeps bounded DOM and preserves viewport across Valve navigation',async()=>{
    const f=biasFixture(320459),events=[],m=mount({record:event=>events.push(event)}),positions=()=>events.filter(e=>e.name==='idle.position.request').length;
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'valve');await wait();change(m.field('mode'),'bias');await wait();assert(m.field('bias-i').textContent==='3.00'&&m.field('bias-feed').textContent==='10.00'&&m.field('bias-motor').textContent==='-95.00'&&m.field('bias-tracking').textContent==='2.00'&&positions()===1,'Large Bias facts or shared pairing failed');
      m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('320459 valid')&&m.view.element.querySelectorAll('svg *').length<170,'Large Bias lost counts or bounded DOM');
      m.view.element.querySelector('svg').dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));const times=()=>[...m.view.element.querySelectorAll('svg text')].map(e=>e.textContent).filter(t=>t.endsWith(' s')).join('|'),viewport=times(),reads=f.calls.length;change(m.field('mode'),'valve');change(m.field('motor-reference'),'100');await wait();change(m.field('mode'),'bias');await wait();assert(positions()===1&&f.calls.length===reads&&times()===viewport,'Large mode/reference navigation repeated position work, reads or viewport reset: '+JSON.stringify({positions:positions(),reads:f.calls.length,expectedReads:reads,viewport,actualViewport:times()}));
    }finally{m.close();}
  });
  await check('Bias keeps missing inner terms/feed-forward/motor/feedback explicitly unavailable without erasing independent evidence',async()=>{
    const f=biasFixture(),m=mount();f.context.channels=f.context.channels.filter(c=>!['dc-measured','dc-motor','inner-feed'].includes(c.id));f.traces.splice(0,f.traces.length,...f.traces.filter(t=>!['dc-measured','dc-motor','inner-feed'].includes(t.channel.id)));
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'bias');await wait();assert(m.field('bias-i').textContent==='0.00'&&m.field('bias-feed').textContent==='Unavailable'&&m.field('bias-feed-label').textContent.includes('unit unavailable')&&m.field('bias-motor').textContent==='Unavailable'&&m.field('bias-tracking').textContent==='Unavailable','Absent roles became healthy zeros or blocked valid inner I');
      change(m.field('dcI'),'');await wait();assert(m.field('bias-i').textContent==='Unavailable'&&m.field('assessment').textContent.includes('actuator assignment remains unverified'),'Missing I or actuator authority fabricated');
    }finally{m.close();}
  });
  await check('Dedicated DC H-bridge duty wins over unitless PID debug output; absent verified motor remains unavailable',async()=>{
    for(const actual of [false,true]){
      const f=biasFixture(),m=mount();delete f.traces.find(t=>t.channel.id==='dc-motor').channel.unit;
      if(actual){const channel={id:'actual-motor',sourceName:'dcIdleDutyCycle',displayName:'DC idle valve H-bridge duty',unit:'%',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:Float64Array.from([-10,10,20,-20])}});}
      try{
        m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'bias');await wait();
        assert(m.field('dcOutput').value===(actual?'actual-motor':'')&&m.field('bias-motor').textContent===(actual?'0.00':'Unavailable')&&m.field('bias-tracking').textContent==='3.32','PID debug output was silently promoted to H-bridge percent or independent position lost');
      }finally{m.close();}
    }
  });
  await check('Ignition loads only its missing channels, separates absolute/correction/lambda facts and retains them across modes/tabs',async()=>{
    const f=ignitionFixture(),events=[],m=mount({record:event=>events.push(event)}),runs=()=>events.filter(e=>e.name==='idle.ignition.request').length;
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();assert(f.calls.length===1&&!f.calls[0].ids.includes('spark-advance'),'Inactive ignition decoded its channels');change(m.field('mode'),'ignition');await wait();assert(f.calls.length===2&&f.calls[1].ids.length===3&&runs()===1,'Ignition did not batch missing roles once');
      assert(m.field('ignition-advance').textContent==='16.00'&&m.field('ignition-correction').textContent==='0.00'&&m.field('ignition-rmse').textContent==='165.83'&&m.field('ignition-lambda').textContent==='1.000','Ignition reference arithmetic or RPM context incorrect');
      assert(m.view.element.querySelector('svg').textContent.includes('IGNITION')&&m.view.element.querySelector('[data-trace-label="Logged signed idle timing correction"]'),'Wrong graph source/labels');m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('4 valid, 0 invalid, 0 unavailable')&&m.field('assessment').textContent.includes('No assumption reconstructs final advance'),'Coverage or signal separation missing');
      change(m.field('mode'),'bias');await wait();const reads=f.calls.length;change(m.field('mode'),'ignition');m.view.element.querySelector('[data-idle-tab=next]').click();m.view.element.querySelector('[data-idle-tab=diagnosis]').click();await wait();assert(f.calls.length===reads&&runs()===1,'Mode/tab transition repeated ignition calculation/read');
      m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();assert(f.calls.length===reads&&runs()===1&&m.field('ignition-advance').textContent==='16.00','Navigation discarded ignition evidence');
    }finally{m.close();}
  });
  await check('Ignition follows Viewed/combined qualification and independently counts correction timestamp failures',async()=>{
    const f=ignitionFixture(),m=mount();f.traces.find(t=>t.channel.id==='spark-correction').range.timeMs=Float64Array.from([0,100,201,300]);const channel={id:'clt',sourceName:'coolant',displayName:'Coolant',unit:'deg C',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:Float64Array.from([80,80,60,60])}});
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'ignition');await wait();m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('3 valid, 0 invalid, 1 unavailable'),'Unaligned correction counted as valid');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager'),rows=()=>[...d.querySelectorAll('tbody tr')];for(const [a,b]of [[0,.1],[.2,.3]]){d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-manager=add]').click();}const a=rows()[0].dataset.regionId,b=rows()[1].dataset.regionId;
      change(m.field('focus'),a);change(m.field('scope'),'viewed');await wait();assert(m.field('ignition-advance').textContent==='12.00'&&m.field('ignition-correction').textContent==='-3.00'&&m.field('ignition-lambda').textContent==='0.950','Viewed angular A not bounded');change(m.field('focus'),b);await wait();assert(m.field('ignition-advance').textContent==='20.00'&&m.field('ignition-correction').textContent==='4.00'&&m.field('ignition-lambda').textContent==='1.050','Viewed B reused A or borrowed correction times');
      change(m.field('scope'),'regions');await wait();const advance=m.field('ignition-advance').textContent;change(m.field('focus'),a);await wait();assert(m.field('ignition-advance').textContent===advance,'Combined ignition followed graph focus');m.field('qual-enabled').checked=true;m.field('qual-enabled').dispatchEvent(new Event('change',{bubbles:true}));await wait();assert(m.field('ignition-advance').textContent==='12.00'&&m.field('ignition-correction').textContent==='-3.00'&&m.field('ignition-lambda').textContent==='0.950','Ignition ignored accepted qualification');
      const reads=f.calls.length;change(m.field('ignitionCorrection'),'');await wait();assert(m.field('ignition-correction').textContent==='Unavailable'&&m.field('ignition-advance').textContent==='12.00','Missing correction became zero or erased advance');change(m.field('ignitionCorrection'),'spark-correction');await wait();assert(f.calls.length===reads&&m.field('ignition-correction').textContent==='-3.00','Restoring last correction reread source');
    }finally{m.close();}
  });
  await check('Ignition actual lambda excludes target/AFR and invalid nonpositive measurements without changing angular scope',async()=>{
    const f=ignitionFixture(),m=mount();f.traces.find(t=>t.channel.id==='actual-lambda').range.values.set([0,-1,1.1,1]);
    for(const [id,name,unit]of [['lambda-target','targetLambda','lambda'],['afr','afrGasolineScale','AFR'],['base-angle','baseIgnitionAdvance','deg'],['all-corrections','ignitionAdvanceCorrections','deg']]){const channel={id,sourceName:name,displayName:name,unit,valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:new Float64Array(4).fill(99)}});}
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();assert(m.field('ignitionAdvance').value==='spark-advance'&&m.field('ignitionCorrection').value==='spark-correction'&&m.field('ignitionLambda').value==='actual-lambda','Wrong automatic source role');assert(![...m.field('ignitionLambda').options].some(o=>o.value==='lambda-target'||o.value==='afr'),'Target/AFR offered as actual lambda');
      change(m.field('mode'),'ignition');await wait();assert(m.field('ignition-advance').textContent==='16.00'&&m.field('samples').textContent==='4'&&m.field('ignition-lambda').textContent==='1.050','Invalid mixture altered angle scope or was averaged as zero');m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('2 valid, 2 invalid, 0 unavailable'),'Invalid lambda denominator missing');
      change(m.field('ignitionLambda'),'');await wait();assert(m.field('ignition-lambda').textContent==='Unavailable'&&m.field('ignition-advance').textContent==='16.00','Missing lambda became inferred AFR conversion');
    }finally{m.close();}
  });
  await check('Ignition stale mapping/source/hidden completions cannot override newer evidence; inactive controls do not cancel it',async()=>{
    const f=ignitionFixture(),m=mount(),pending=[];const original=f.context.loadTraces;let hold=true;f.context.loadTraces=(ids,a,b)=>ids.includes('spark-advance')&&hold?new Promise(resolve=>pending.push(resolve)):original(ids,a,b);
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'ignition');assert(pending.length===1,'Ignition not pending');change(m.field('motor-reference'),'0');change(m.field('dcI'),'');pending[0](f.traces);await wait();assert(m.field('ignition-advance').textContent==='16.00','Inactive controller setting cancelled ignition');
      m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:1}});await wait();assert(pending.length===2,'Replacement ignition not pending');change(m.field('ignitionAdvance'),'');await wait();pending[1](f.traces);await wait();assert(m.field('ignition-advance').textContent==='Unavailable','Old mapping overwrote missing advance');change(m.field('ignitionAdvance'),'spark-advance');assert(pending.length===3,'Restored advance not pending');m.view.setActive(false);pending[2](f.traces);await wait();assert(m.field('ignition-advance').textContent==='—','Hidden ignition completion published');hold=false;m.view.setActive(true);await wait();assert(m.field('ignition-advance').textContent==='16.00','Ignition resume failed');
      hold=true;m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:2}});await wait();m.view.setContext({...f.context,source:{...f.context.source,identity:{},revision:3}});await wait();assert(pending.length===5,'Two source loads not held');pending[4](f.traces.map(t=>t.channel.id==='spark-advance'?{...t,range:{...t.range,values:new Float64Array(4).fill(99)}}:t));await wait();pending[3](f.traces);await wait();assert(m.field('ignition-advance').textContent==='99.00','Old source replaced latest advance');
    }finally{m.close();}
  });
  await check('Ignition channel remapping remains bounded and does not evict/recalculate accepted shared position evidence',async()=>{
    const f=ignitionFixture(),events=[],m=mount({record:event=>events.push(event)}),positions=()=>events.filter(e=>e.name==='idle.position.request').length;
    for(let i=0;i<4;i++){const channel={id:`angle-${i}`,sourceName:`Mapped angle ${i}`,displayName:`Mapped angle ${i}`,unit:'deg',valueType:'number'};f.context.channels.push(channel);f.traces.push({channel,complete:true,color:'#abc',range:{...f.traces[0].range,values:new Float64Array(4).fill(2+i)}});}
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'bias');await wait();change(m.field('mode'),'ignition');await wait();const paired=positions();for(let i=0;i<4;i++){change(m.field('ignitionAdvance'),`angle-${i}`);await wait();}const reads=f.calls.length;change(m.field('ignitionAdvance'),'spark-advance');await wait();assert(f.calls.length===reads+1&&f.calls.at(-1).ids.join(',')==='spark-advance'&&positions()===paired,'Old angular columns accumulated or unrelated position calculation repeated');const before=f.calls.length;change(m.field('mode'),'bias');await wait();assert(f.calls.length===before&&positions()===paired&&m.field('bias-tracking').textContent==='3.32','Ignition remapping evicted position/Bias authority');
    }finally{m.close();}
  });
  await check('320459-sample native ignition keeps aligned counts, bounded graph DOM and retained viewport without repeated source reads',async()=>{
    const f=ignitionFixture(320459),m=mount();try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'bias');await wait();change(m.field('mode'),'ignition');await wait();assert(m.field('ignition-advance').textContent==='16.00'&&m.field('ignition-correction').textContent==='-2.00'&&m.field('ignition-rmse').textContent==='0.00'&&m.field('ignition-lambda').textContent==='1.010','Large ignition reference facts failed');m.view.element.querySelector('[data-idle-tab=evidence]').click();assert(m.field('assessment').textContent.includes('320459 valid')&&m.view.element.querySelectorAll('svg *').length<170,'Large ignition counts or DOM unbounded');
      m.view.element.querySelector('svg').dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));const times=()=>[...m.view.element.querySelectorAll('svg text')].map(e=>e.textContent).filter(t=>t.endsWith(' s')).join('|'),viewport=times(),reads=f.calls.length;change(m.field('mode'),'bias');change(m.field('mode'),'ignition');await wait();assert(f.calls.length===reads&&times()===viewport,'Large mode navigation reread source or reset viewport');
    }finally{m.close();}
  });
  await check('Ignition missing optional correction/lambda/target and unsupported absolute units never produce healthy defaults',async()=>{
    for(const unsupported of [false,true]){
      const f=ignitionFixture(),m=mount();f.context.channels=f.context.channels.filter(c=>!['target','spark-correction','actual-lambda'].includes(c.id));f.traces.splice(0,f.traces.length,...f.traces.filter(t=>!['target','spark-correction','actual-lambda'].includes(t.channel.id)));if(unsupported)f.traces.find(t=>t.channel.id==='spark-advance').channel.unit='ms';
      try{
        m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'ignition');await wait();assert(m.field('ignition-advance').textContent===(unsupported?'Unavailable':'16.00')&&m.field('ignition-correction').textContent==='Unavailable'&&m.field('ignition-lambda').textContent==='Unavailable'&&m.field('ignition-rmse').textContent==='Unavailable','Missing role/units/target became false numeric evidence or blocked independent advance');
      }finally{m.close();}
    }
  });
  await check('Recovery reuses shared Valve/Bias position authority, matches final HTML cards/traces, and preserves event work on actuator remapping',async()=>{
    const f=valveFixture(),events=[],m=mount({record:e=>events.push(e)}),positions=()=>events.filter(e=>e.name==='idle.position.request').length,eventRuns=()=>events.filter(e=>e.name==='idle.recovery.events.request').length;f.traces[0].range.values[0]=900;
    try{m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'valve');await wait();const reads=f.calls.length,p=positions();change(m.field('mode'),'recovery');await wait();assert(positions()===p&&f.calls.length===reads,'Recovery repeated shared position/reads');assert(m.field('recovery-worst').textContent==='100.00'&&m.field('recovery-tracking').textContent==='3.32'&&m.view.element.querySelector('[data-trace-label="Valve requested"]')&&m.view.element.querySelector('[data-trace-label="Signed motor duty"]'),'Final HTML Recovery metrics/actuator traces missing');
      const e=eventRuns();change(m.field('dcOutput'),'');await wait();assert(eventRuns()===e&&m.field('recovery-tracking').textContent==='3.32','Motor remap rescanned events or erased valid position tracking');change(m.field('dcOutput'),'dc-motor');await wait();change(m.field('recovery-dwell'),'200');await wait();assert(eventRuns()===e+1&&positions()===p+2,'Reference update repeated position calculation or failed event invalidation');
      m.view.setActive(false);change(m.field('recovery-band'),'20');const hidden=eventRuns();await wait();assert(eventRuns()===hidden,'Hidden Recovery calculated');m.view.setActive(true);await wait();assert(eventRuns()===hidden+1,'Active Recovery did not apply deferred reference');
    }finally{m.close();}
  });
  await check('Recovery computes onset/dwell evidence lazily and retains facts through tabs, modes, zoom and navigation without reads',async()=>{
    const f=fixture([1000,850,880,1000,1000,1000,1000,1000,1000]),events=[],m=mount({record:e=>events.push(e)}),runs=()=>events.filter(e=>e.name==='idle.recovery.request').length;
    try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();const reads=f.calls.length;assert(runs()===0,'Hidden recovery calculated');change(m.field('mode'),'recovery');await wait();assert(m.field('recovery-count').textContent==='1'&&m.field('recovery-summary').textContent.includes('1 confirmed')&&m.field('assessment').textContent.includes('Recovery 200.00 ms from onset'),'Onset/dwell reference failed');m.field('recovery-references').click();assert(m.field('recovery-settings').open&&m.field('recovery-settings').getBoundingClientRect().height>0,'Recovery references inaccessible');m.field('recovery-references').click();const count=runs();
      for(const tab of ['evidence','next','diagnosis'])m.view.element.querySelector(`[data-idle-tab=${tab}]`).click();m.field('recovery-view').click();m.field('recovery-all').click();change(m.field('mode'),'stability');change(m.field('mode'),'recovery');m.view.setActive(false);m.view.setContext({...f.context});m.view.setActive(true);await wait();assert(runs()===count&&f.calls.length===reads,'Presentation/navigation repeated recovery or reread source');
      change(m.field('recovery-dwell'),'500');assert(runs()===count,'Unchanged reference recalculated');change(m.field('recovery-dwell'),'600');assert(runs()===count+1&&m.field('recovery-summary').textContent.includes('1 censored'),'Dwell change failed to invalidate');change(m.field('recovery-gap'),'0');assert(m.field('assessment').textContent.includes('maximum gap > 0')&&!m.view.element.querySelector('svg path'),'Invalid settings retained old graph/evidence');
    }finally{m.close();}
  });
  await check('Recovery missing target is unavailable; invalid attempts and canonical physical-loss markers censor events',async()=>{
    for(const kind of ['missing','invalid','integrity']){const f=fixture([1000,850,880,1000,1000,1000,1000,1000,1000],kind!=='missing'),m=mount();if(kind==='invalid')f.traces[0].range.validity[4]=0;if(kind==='integrity')f.context.sourceIntegrity=[{timeMs:350,kind:'delivery-loss',breaksContinuity:true,count:1,message:'display text is irrelevant'}];try{m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'recovery');assert(kind==='missing'?m.field('recovery-count').textContent==='Unavailable':m.field('recovery-summary').textContent.includes('1 censored'),'Missing/invalid/integrity became healthy evidence');}finally{m.close();}}
  });
  await check('Recovery follows Viewed scope and deduplicated included union, without borrowing settling beyond the interval',async()=>{
    const f=fixture([1000,850,880,1000,1000,1000,1000,1000,1000]),m=mount();const coolant={id:'clt',sourceName:'coolant',displayName:'Coolant',unit:'deg C',valueType:'number'};f.context.channels.push(coolant);f.traces.push({channel:coolant,complete:true,color:'#abc',range:{...f.traces[0].range,values:Float64Array.from([80,80,80,80,60,80,80,80,80])}});try{
      m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'recovery');change(m.field('scope'),'ab');await wait();assert(m.field('recovery-summary').textContent.includes('1 censored'),'Logger A/B borrowed later settling');change(m.field('scope'),'full');await wait();assert(m.field('recovery-summary').textContent.includes('1 confirmed'),'Full scope failed to restore evidence');
      m.field('manage-regions').click();const d=m.view.element.querySelector('.idle-region-manager');for(const [a,b]of [[0,.8],[.1,.8]]){d.querySelector('[data-new=start]').value=String(a);d.querySelector('[data-new=end]').value=String(b);d.querySelector('[data-manager=add]').click();}const rows=[...d.querySelectorAll('tbody tr')],first=rows[0].dataset.regionId;change(m.field('scope'),'regions');await wait();assert(m.field('recovery-count').textContent==='1'&&m.field('recovery-summary').textContent.includes('9 valid aligned pairs'),'Overlapping scope duplicated event/pairs');change(m.field('focus'),first);const facts=m.field('recovery-summary').textContent;m.field('recovery-view').click();assert(m.field('recovery-summary').textContent===facts,'Event view changed analysis');change(m.field('scope'),'viewed');await wait();assert(m.field('recovery-count').textContent==='1','Viewed scope failed');
      change(m.field('qual-coolant'),'clt');m.field('qual-enabled').checked=true;m.field('qual-enabled').dispatchEvent(new Event('change',{bubbles:true}));await wait();assert(m.field('recovery-summary').textContent.includes('1 censored'),'Qualification recovery outcome: '+m.field('recovery-summary').textContent+' | '+m.field('status').textContent+' | '+m.field('assessment').textContent);
    }finally{m.close();}
  });
  await check('Recovery rejects delayed retired source completions and updates canonical integrity semantics',async()=>{
    const f=fixture([1000,850,880,1000,1000,1000,1000,1000,1000]),m=mount(),pending=[];const load=f.context.loadTraces;f.context.loadTraces=async(...args)=>new Promise(resolve=>pending.push(()=>load(...args).then(resolve)));try{
      m.view.setContext(f.context);m.view.setActive(true);change(m.field('mode'),'recovery');await wait();const replacement=fixture([1000,1000,1000]);m.view.setContext(replacement.context);await wait();for(const done of pending)done();await wait();assert(m.field('recovery-count').textContent==='0','Old source published recovery');
      m.view.setContext({...f.context,loadTraces:load});await wait();assert(m.field('recovery-summary').textContent.includes('1 confirmed'),'New source evidence failed');m.view.setContext({...f.context,loadTraces:load,sourceIntegrity:[{timeMs:350,kind:'delivery-loss',breaksContinuity:true,count:1,message:'x'}]});await wait();assert(m.field('recovery-summary').textContent.includes('1 censored'),'Changed continuity metadata reused stale recovery');const reads=f.calls.length;m.view.setContext({...f.context,loadTraces:load,sourceIntegrity:[{timeMs:350,kind:'delivery-loss',breaksContinuity:true,count:1,message:'different display wording'}]});await wait();assert(f.calls.length===reads,'Diagnostic display wording invalidated semantic evidence');
    }finally{m.close();}
  });
  await check('Recovery >320k records and many events retain bounded DOM and constant-size selected event detail',async()=>{
    const n=320459,f=fixture(),m=mount();for(const trace of f.traces)trace.range={startSampleIndex:10,timeMs:Float64Array.from({length:n},(_,i)=>i*100),values:Float64Array.from({length:n},(_,i)=>trace.channel.id==='rpm'&&i%8===0?850:1000),validity:new Uint8Array(n).fill(1)};f.context.source.sampleCount=n;f.context.sourceTimeRange.endMs=(n-1)*100;
    try{m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'recovery');assert(m.field('recovery-count').textContent===String(Math.ceil(n/8))&&m.view.element.querySelectorAll('svg *').length<170,'Large recovery counts or graph failed');change(m.field('recovery-event'),String(Math.ceil(n/8)));assert(m.field('assessment').textContent.includes('Censored'),'Last event inaccessible');m.field('recovery-view').click();assert(m.view.element.querySelectorAll('svg *').length<170,'Event focus built unbounded DOM');}finally{m.close();}
  });
  await check('Idle related tune is lazy, read-only and independent of retained recorded analysis with exact reference lookup',async()=>{
    const f=biasFixture(),events=[],m=mount({record:e=>events.push(e)}),projections=()=>events.filter(e=>e.name==='idle.tune.projected').length;
    const tune=normalizeMsqTune(parseMsq('<msq><versionInfo signature="reference-only"/><page number="0"><constant name="dcIdleBiasBins" rows="3" cols="1" units="target idle position">10 18 30</constant><constant name="dcIdleBiasValues" rows="3" cols="1" units="DC idle duty bias">-20 35 30</constant></page></msq>')),before=JSON.stringify(tune.entries);
    try{m.view.setTuneModel(tune,'reference.msq');m.view.setContext(f.context);m.view.setActive(true);await wait();change(m.field('mode'),'bias');await wait();assert(projections()===0,'Closed tune context projected');const reads=f.calls.length,counters=events.filter(e=>e.name.endsWith('.request')).length,metrics=m.field('bias-i').textContent;
      m.field('tune-tables').click();const dialog=m.view.element.querySelector('.idle-tune-dialog'),field=name=>dialog.querySelector(`[data-idle-tune=${name}]`);assert(projections()===1&&field('panel').value==='bias'&&field('identity').textContent.includes('reference.msq')&&field('authority').textContent.includes('unverified'),'Related context/default/authority missing');field('x').value='20';field('x').dispatchEvent(new Event('input',{bubbles:true}));assert(field('lookup').textContent.startsWith('34.167'),'Independent reference interpolation incorrect');const button=dialog.querySelector('[data-idle-tune-row="0"][data-idle-tune-col="1"]');button.textContent='99999';button.click();assert(field('cell').textContent.includes('value 35 ')&&!field('cell').textContent.includes('99999'),'Rendered text became tune authority');assert(JSON.stringify(tune.entries)===before&&!dialog.querySelector('[contenteditable]'),'Read-only table mutated tune');
      m.view.setTuneModel(tune,'renamed.msq');m.view.setContext({...f.context});await wait();assert(projections()===1&&field('lookup').textContent.startsWith('34.167')&&field('identity').textContent.includes('renamed.msq'),'Rename/unchanged context rebuilt tune reference');field('close').click();m.field('tune-tables').click();assert(projections()===1&&f.calls.length===reads&&events.filter(e=>e.name.endsWith('.request')).length===counters&&m.field('bias-i').textContent===metrics,'Tune viewing repeated log calculations/reads or changed metrics');
      m.view.setTuneModel(undefined);assert(!dialog.querySelector('[data-idle-tune-row]')&&field('entries').textContent.includes('missing')&&m.field('bias-i').textContent===metrics,'Tune unload retained stale table or erased recorded facts');
    }finally{m.close();}
  });
  await check('Idle tune replacement defers hidden projection and withdraws duplicate/bad geometry without repairing it',async()=>{
    const f=fixture(),events=[],m=mount({record:e=>events.push(e)}),projections=()=>events.filter(e=>e.name==='idle.tune.projected').length;
    const valid=normalizeMsqTune(parseMsq('<msq><page><constant name="dcIdleBiasBins" rows="2" cols="1">0 100</constant><constant name="dcIdleBiasValues" rows="2" cols="1">-40 40</constant></page></msq>'));
    try{m.view.setContext(f.context);m.view.setActive(true);await wait();m.view.setTuneModel(valid,'one.msq');m.field('tune-tables').click();const d=m.view.element.querySelector('.idle-tune-dialog'),p=d.querySelector('[data-idle-tune=panel]');change(p,'bias');const initial=projections();m.view.setActive(false);const html=d.innerHTML;m.view.setTuneModel({...valid,entries:[...valid.entries,{...valid.entries[0],pageNumber:2}]},'duplicate.msq');assert(d.innerHTML===html&&projections()===initial&&!d.open,'Hidden tune update rebuilt/opened dialog');m.view.setActive(true);await wait();m.field('tune-tables').click();change(p,'bias');assert(projections()===initial+1&&!d.querySelector('[data-idle-tune-row]')&&d.querySelector('[data-idle-tune=entries]').textContent.includes('ambiguous'),'Duplicate page selected a last-name-wins curve');
      m.view.setTuneModel({...valid,entries:[{...valid.entries[0],numericValues:[100,0]},valid.entries[1]]},'descending.msq');assert(!d.querySelector('[data-idle-tune-row]')&&d.querySelector('[data-idle-tune=geometry]').textContent.includes('strictly increasing'),'Bad axes silently sorted');
    }finally{m.close();}
  });
  return { passed: checks.length, checks };
}

export async function runIdleShellChecks() {
  const root = document.querySelector('.idle-analyzer-view');
  const select = document.querySelector('.analyzer-header-view-select');
  assert(root && select, 'Native Idle entry missing');
  const sharedHeader = document.querySelector('.app-header'), sharedFooter = document.querySelector('.status-bar');
  // Open the real Analyzer route using its shell control; file inputs were loaded by acceptance runner.
  document.querySelector('[data-epicscope-mode=analyzer]').click();
  change(select, 'idle-stability');
  for (let i = 0; i < 100 && !['Recorded evidence', 'Partial recorded evidence', 'No valid RPM evidence'].includes(root.querySelector('[data-idle=status]').textContent); i++) await wait();
  const source = root.querySelector('[data-idle=source]').textContent;
  assert(!root.hidden && source.includes('navigation.mlg'), 'Real canonical recording not bound to native Idle');
  assert(root.querySelector('[data-idle=samples]').textContent !== '—', 'No real imported evidence');
  assert(root.querySelectorAll('[data-idle-trace]').length >= 1, 'Real recording graph missing');
  assert(sharedHeader === document.querySelector('.app-header') && sharedFooter === document.querySelector('.status-bar')
    && document.querySelectorAll('.app-header').length === 1 && document.querySelectorAll('.status-bar').length === 1
    && !root.querySelector('.app-header,.status-bar'), 'Idle replaced or copied the shared shell menus');
  assert(getComputedStyle(root.closest('.analyzer-page').querySelector('.analyzer-head')).display === 'none', 'Redundant Analyzer title banner consumes workspace');
  const footerTop = sharedFooter.getBoundingClientRect().top;
  assert(root.getBoundingClientRect().bottom <= footerTop + 1, 'Desktop workspace scrolls past shared bottom interface');
  assert([...select.options].some(option => option.value === 'idle'), 'Existing Idle Control Diagnostics removed');
  change(select, 'idle'); await wait(); change(select, 'idle-stability'); await wait();
  assert(root.querySelector('[data-idle=source]').textContent === source, 'Navigation changed source');
  return { passed: 4, checks: ['real-shell MLG import binds canonical source and native stability graphs', 'shared EpicScope header/footer are retained once and desktop workspace fits between them', 'existing Idle Control Diagnostics remains available', 'Idle route round trip retains source evidence'], observed: { source, samples: root.querySelector('[data-idle=samples]').textContent, status: root.querySelector('[data-idle=status]').textContent } };
}

export function runIdleNarrowChecks() {
  const root = document.querySelector('.idle-analyzer-view');
  assert(root && !root.hidden && innerWidth === 390, 'Expected active native Idle at 390px');
  assert(document.documentElement.scrollWidth <= innerWidth, 'Native Idle expanded application grid beyond viewport');
  assert(root.getBoundingClientRect().right <= innerWidth, 'Native Idle controls escaped narrow viewport');
  const frame=root.querySelector('.idle-plot-frame').getBoundingClientRect(),plot=root.querySelector('svg').getBoundingClientRect();
  for(const tick of root.querySelectorAll('.idle-plot-y-axis span')) {
    const rect=tick.getBoundingClientRect();assert(rect.left>=frame.left-1&&rect.right<plot.left,'Narrow Y-axis label clipped or overlaps trace');
  }
  assert(plot.left-frame.left===40,'Y-axis gutter scaled with viewport instead of native layout');
  change(root.querySelector('[data-idle=mode]'),'recovery');
  const note=root.querySelector('[data-idle=recovery-view-note]').getBoundingClientRect();
  assert(note.width>=250&&document.documentElement.scrollWidth<=innerWidth,'Recovery event controls squeeze explanations into thin columns or overflow');
  root.querySelector('[data-idle=tune-tables]').click();const dialog=root.querySelector('.idle-tune-dialog');assert(dialog.open&&dialog.getBoundingClientRect().left>=0&&dialog.getBoundingClientRect().right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth,'Idle related tune dialog escaped 390px');dialog.close();
  return { passed: 3, checks: ['native Idle controls and uncut Y-axis labels fit 390px after live resize without redraw','Recovery event controls wrap with a readable full-width explanation at 390px','Related tune context opens inside the 390px shared shell'] };
}
