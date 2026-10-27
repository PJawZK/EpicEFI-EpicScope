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
function mount() {
  const view = createIdleAnalyzerView(); view.element.hidden = false;
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
      assert([...m.field('mode').options].filter(o=>!o.disabled).length===1,'Unimplemented modes became active');
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
    } finally { m.close(); }
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
  return { passed: 1, checks: ['native Idle controls and uncut Y-axis labels fit 390px after live resize without redraw'] };
}
