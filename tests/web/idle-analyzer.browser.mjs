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
      assert(m.field('samples').textContent === '2' && f.calls.at(-1).start === 100, 'Manual bounds not applied');
      m.field('start').value = '-1'; m.field('apply-region').click(); await wait();
      assert(m.field('samples').textContent === '2' && f.calls.length === 2 && m.field('status').textContent.includes('Previous region retained'), 'Invalid region replaced accepted state');
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
      change(m.field('candidates'),'0'); await wait();
      assert(commits===1 && f.calls.length===1 && m.field('scope').value==='ab' && f.context.aTimeMs===0 && f.context.bTimeMs===12000, 'Candidate bypassed Logger or redundantly analyzed identical bounds');
      m.field('discover').click(); await wait(); assert(f.calls.length===1, 'Repeated discovery reread source');
      change(m.field('candidate-rpm'),'850'); assert(m.field('candidates').disabled, 'Changed thresholds retained stale candidates');
      m.field('discover').click(); await wait(); assert(m.field('candidates').disabled && m.field('scope-note').textContent.includes('0 RPM-only'), 'RPM setting did not affect discovery');
      assert(m.field('samples').textContent==='121','Discovery altered accepted metrics');
    } finally { m.close(); }
  });
  await check('candidate reads reject hidden, replaced and configuration-obsolete completions', async () => {
    const f = fixture(new Float64Array(121).fill(900)), m = mount();
    try {
      m.view.setContext(f.context); m.view.setActive(true); await wait(); change(m.field('scope'),'ab'); await wait();
      let release; f.context.loadTraces = () => new Promise(resolve => { release = resolve; }); m.view.setContext({...f.context});
      m.field('discover').click(); await wait();
      change(m.field('candidate-duration'),'9'); release(f.traces); await wait();
      assert(m.field('candidates').disabled,'Obsolete discovery completed after setting change');
      m.field('discover').click(); await wait(); m.view.setActive(false); const html=m.view.element.innerHTML; release(f.traces); await wait();
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
      change(m.field('candidate-rpm'),'');m.field('discover').click();await wait();assert(f.calls.length===1&&m.field('status').textContent.includes('positive'),'Invalid settings read source');
    } finally {m.close();}
  });
  await check('320459-sample browser analysis renders bounded SVG evidence without argument-limit failure', async () => {
    const values = new Float64Array(320459).fill(1000), f = fixture(values), m = mount(); try {
      m.view.setContext(f.context); m.view.setActive(true); await wait();
      assert(m.field('samples').textContent.replaceAll(',', '') === '320459' && m.field('rmse').textContent === '0.00', 'Large browser analysis failed');
      const svg=m.view.element.querySelector('svg'), path=()=>svg.querySelector('[data-idle-trace="0"]');
      assert(path().dataset.traceMode==='envelope'&&(path().getAttribute('d').match(/M/g)||[]).length===1,'Dense trace lost flat-line continuity');
      for(let i=0;i<40;i++)svg.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));
      assert(path().dataset.traceMode==='raw'&&path().getAttribute('d').includes('L'),'Zoomed trace did not switch to original raw samples');
      assert(f.calls.length===1,'Graph zoom reread source');m.field('fit').click();
      assert(m.view.element.querySelectorAll('svg path').length === 2 && m.view.element.querySelectorAll('svg *').length < 100, 'Unbounded graph DOM');
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
