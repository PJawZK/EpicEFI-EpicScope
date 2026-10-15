// Browser regression module: with Vite running, import this file through its /@fs/ URL
// in Chromium and await runVeAnalyzerLifecycleChecks(). No DOM emulator is used.
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { createVeAnalyzerView as createOwner } from '../../apps/web/src/pages/ve-analyzer-view-v2';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
import { updateVeActualMixtureOptions } from '../../apps/web/src/pages/analyzer-channel-roles';

const tune = () => normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="2">1000 2000</constant>
<constant name="veLoadBins" rows="2" cols="1">50 100</constant>
<constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant>
<constant name="afrLoadBins" rows="2" cols="1">50 100</constant>
<constant name="veTable" rows="2" cols="2" units="%">70 70 70 70</constant>
<constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant>
</page></msq>`));
const channels = [
  ['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['pw', 'PW', 'ms'],
].map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));
const traces = channels.map((channel, index) => ({
  channel, complete: true, color: '#58aef6', range: {
    startSampleIndex: 0, timeMs: Float64Array.from({ length: 60 }, (_, i) => i * 100),
    values: new Float64Array(60).fill([1000, 50, 15, 4][index]), validity: new Uint8Array(60).fill(1),
  },
}));
function delayFile(value = 100) {
  return serializeVeDelayTable({
    rpmBins: [1000, 2000], loadBins: [50, 100], rows: 2, cols: 2, origin: 'saved-file',
    cells: Array.from({ length: 4 }, (_, i) => ({
      row: Math.floor(i / 2), col: i % 2, state: 'measured', workingMs: value,
      recommendedMs: value, workingProvenance: 'measured-recommendation',
      eventCount: 5, confidence: 'moderate', sourceEvents: [],
    })),
  });
}
const settle = async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); };
function assert(ok, message) { if (!ok) throw new Error(message); }
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function change(root, role, value) {
  const control = root.querySelector(`select[data-role="${role}"]`);
  assert(control, `Missing ${role}`); control.value = value;
  control.dispatchEvent(new Event('change', { bubbles: true }));
}
function loadFile(root, text) {
  const input = root.querySelector('[data-ve-analyzer="load-delay-file"]');
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'delays.json', text }] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
async function setup(factory = createVeAnalyzerView, fixture = {}) {
  let gate;
  let loadCount = 0;
  const model = tune();
  const context = {
    source: { identity: {}, sampleCount: 60, revision: 0 }, channels: fixture.channels ?? channels, traces: [],
    loadTraces: async (ids) => { loadCount += 1; return gate ? gate.promise : (fixture.traces ?? traces).filter((trace) => ids.includes(trace.channel.id)); },
    aTimeMs: 0, bTimeMs: 3000, savedRanges: [{ label: 'saved', startMs: 0, endMs: 2000 }],
  };
  const view = factory();
  const host = document.createElement('section'); host.className = 'analyzer-page';
  host.append(view.element); document.body.append(host);
  view.setContext(context); view.setTuneModel(model, 'test.msq');
  change(view.element, 'rpm', 'rpm'); change(view.element, 'load', 'map');
  change(view.element, 'actual', 'afr'); change(view.element, 'fuelCommand', 'pw');
  loadFile(view.element, () => Promise.resolve(delayFile())); await settle();
  const run = () => view.element.querySelector('.ve-workbench-run').click();
  assert(!view.element.querySelector('.ve-workbench-run').disabled, 'Fixture must be ready to run');
  return { view, root: view.element, host, context, model, run, reads: () => loadCount, hold: () => { gate = deferred(); return gate; } };
}
function summary(root) { return root.querySelector('[data-ve-analyzer="summary"]').textContent; }
function measured(root) { return [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find((cell) => cell.title.startsWith('Measured proposal')); }

async function completed(s) {
  const deadline = performance.now() + 10000;
  while (!s.view.getPrimaryAnalysis()) {
    if (performance.now() > deadline) throw Error('VE did not complete: ' + s.root.querySelector('[data-ve-analyzer="stage"]').textContent);
    await settle();
  }
}

export async function runVeAnalyzerLifecycleChecks() {
  const passed = [];
  const check = async (name, test) => { await test(); passed.push(name); };
  await check('new catalog cannot invalidate a hidden VE owner whose selector is still empty', async () => {
    const view = createVeAnalyzerView();
    view.setTuneModel(tune(), 'loaded-before-log.msq');
    const revision = view.sessionRevision;
    const table = view.element.querySelector('[data-ve-analyzer="ve-table-view"] table');
    updateVeActualMixtureOptions(view.element.querySelector('select[data-role="actual"]'), channels, 'afr');
    updateVeActualMixtureOptions(view.element.querySelector('select[data-role="actual"]'), channels, 'afr');
    await settle();
    assert(view.sessionRevision === revision, 'Unavailable preferred channel dispatched a spurious change');
    assert(view.element.querySelector('[data-ve-analyzer="ve-table-view"] table') === table, 'Empty hidden selector rebuilt its table');
  });
  await check('mixture fallback uses an eligible option present in this selector', async () => {
    const root = document.createElement('section');
    root.innerHTML = '<div class="ve-analyzer-view"><select data-role="mixture-scale"><option value="afr">AFR</option></select><select data-role="actual"><option value="">None</option><option value="afr">AFR</option></select></div>';
    const catalog = [...channels, { ...channels[2], id: 'preferred-absent', sourceName: 'afrGasolineScale' }];
    updateVeActualMixtureOptions(root.querySelector('[data-role="actual"]'), catalog, 'afr');
    const actual = root.querySelector('[data-role="actual"]');
    assert(actual.value === 'afr', 'Global preference suppressed the available local AFR option');
    updateVeActualMixtureOptions(root.querySelector('[data-role="actual"]'), catalog, 'afr');
    assert(actual.value === 'afr', 'Repeated decoration changed an eligible mapping');
  });
  for (const [name, factory] of [['v2 owner', createOwner], ['complete controller chain', createVeAnalyzerView]]) {
    await check(`${name}: unchanged updates preserve primary authority and edited delay`, async () => {
      const s = await setup(factory);
      const delay = s.root.querySelector('[data-ve-analyzer="delay-table"] td[data-delay-row="0"][data-delay-col="0"]');
      delay.onclick.call(delay, new PointerEvent('click'));
      s.root.querySelector('[data-ve-analyzer="delay-cell-working"]').value = '125';
      s.root.querySelector('[data-ve-analyzer="delay-cell-apply"]').click();
      s.run(); await completed(s); assert(measured(s.root), 'Initial proposal missing');
      const oldSummary = summary(s.root), oldTable = s.root.querySelector('[data-ve-analyzer="ve-table-view"] table');
      const oldRevision = s.view.sessionRevision;
      const primary = s.view.getPrimaryAnalysis();
      assert(primary, 'Completed primary analysis missing');
      assert(s.view.setContext({ ...s.context, loadTraces: async (ids) => traces.filter((t) => ids.includes(t.channel.id)), openSamplesInLogger: () => {} }) === false, 'Equivalent context reset');
      assert(s.view.setTuneModel(s.model, 'test.msq') === false, 'Same tune reset');
      await settle();
      assert(s.view.sessionRevision === oldRevision, 'Unchanged session revision advanced');
      assert(s.view.getPrimaryAnalysis() === primary, 'Unchanged update replaced retained primary analysis');
      assert(s.root.querySelector('[data-ve-analyzer="ve-table-view"] table') === oldTable, 'Unchanged table rebuilt');
      assert(summary(s.root) === oldSummary, 'Primary result/proposal lost');
      assert(s.root.querySelector('[data-delay-row="0"][data-delay-col="0"]').dataset.delayValue === '125', 'Working delay edit lost');
      s.host.remove();
    });
  }
  await check('Full Log survives unrelated A/B changes; selected A/B invalidates on changed bounds', async () => {
    const s = await setup(); s.run(); await completed(s);
    assert(s.view.setContext({ ...s.context, aTimeMs: 500, bTimeMs: 2500 }) === false, 'Unused A/B reset Full Log');
    change(s.root, 'scope', 'ab'); s.run(); await completed(s); assert(measured(s.root), 'A/B proposal missing');
    const rev = s.view.sessionRevision;
    assert(s.view.setContext({ ...s.context, aTimeMs: 800, bTimeMs: 2000 }) === true, 'Changed selected A/B preserved stale evidence');
    assert(s.view.sessionRevision > rev && !measured(s.root) && summary(s.root) === '', 'Scope invalidation failed');
    s.host.remove();
  });
  for (const kind of ['source', 'catalog', 'sample-count', 'validity-revision', 'tune', 'selected-saved-range']) {
    await check(`${kind} change invalidates and rejects an old pending analysis`, async () => {
      const s = await setup();
      if (kind === 'selected-saved-range') change(s.root, 'scope', 'saved:0');
      const pending = s.hold(); s.run(); await settle();
      if (kind === 'tune') s.view.setTuneModel(tune(), 'replacement.msq');
      else {
        const next = { ...s.context };
        if (kind === 'source') next.source = { ...s.context.source, identity: {} };
        if (kind === 'catalog') next.channels = channels.map((c) => ({ ...c, displayName: `${c.displayName} revised` }));
        if (kind === 'sample-count') next.source = { ...s.context.source, sampleCount: 61 };
        if (kind === 'validity-revision') next.source = { ...s.context.source, revision: 1 };
        if (kind === 'selected-saved-range') next.savedRanges = [{ label: 'saved', startMs: 500, endMs: 2500 }];
        assert(s.view.setContext(next) === true, `${kind} was not detected`);
      }
      pending.resolve(traces); await settle();
      assert(!measured(s.root) && summary(s.root) === '' && !s.view.getPrimaryAnalysis(), 'Old analysis wrote into new session');
      assert(s.root.querySelector('[data-ve-analyzer="save-delay"]').disabled, 'Old working delay survived replacement');
      s.host.remove();
    });
  }
  await check('rejected old analysis cannot overwrite newer session status', async () => {
    const s = await setup(), pending = s.hold(); s.run(); await settle();
    s.view.setTuneModel(tune(), 'new.msq'); const stage = s.root.querySelector('[data-ve-analyzer="stage"]').textContent;
    pending.reject(new Error('old load failed')); await settle();
    assert(s.root.querySelector('[data-ve-analyzer="stage"]').textContent === stage, 'Old rejection changed new status');
    s.host.remove();
  });
  await check('old delay discovery cannot populate a replacement source', async () => {
    const s = await setup(), pending = s.hold();
    s.root.querySelector('[data-ve-analyzer="grab-delay"]').click(); await settle();
    s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } });
    const title = s.root.querySelector('[data-ve-analyzer="delay-result-title"]').textContent;
    pending.resolve(traces); await settle();
    assert(s.root.querySelector('[data-ve-analyzer="delay-result-title"]').textContent === title, 'Old discovery committed');
    assert(s.root.querySelector('[data-ve-analyzer="use-delay"]').disabled, 'Old recommendation available');
    s.host.remove();
  });
  await check('pending delay-file reads reject replacement sessions and newer file selections', async () => {
    const s = await setup(), old = deferred(); loadFile(s.root, () => old.promise);
    s.view.setTuneModel(tune(), 'new.msq'); old.resolve(delayFile(125)); await settle();
    assert(s.root.querySelector('[data-ve-analyzer="save-delay"]').disabled, 'Old file reactivated working authority');
    const first = deferred(); loadFile(s.root, () => first.promise);
    loadFile(s.root, () => Promise.resolve(delayFile(200))); await settle();
    first.resolve(delayFile(125)); await settle();
    assert(s.root.querySelector('[data-delay-row="0"][data-delay-col="0"]').dataset.delayValue === '200', 'Older file overwrote newer selection');
    s.host.remove();
  });
  await check('cell detail reuses retained primary objects without loading traces and closes on replacement', async () => {
    const s = await setup(); s.run(); await completed(s);
    const primary = s.view.getPrimaryAnalysis(), reads = s.reads();
    assert(primary, 'Missing retained primary result');
    let request;
    s.view.setContext({ ...s.context, openSamplesInLogger: (next) => { request = next; } });
    const measuredCells = [...s.root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].filter((c) => c.title.startsWith('Measured proposal'));
    for (const cell of [measuredCells[0], measuredCells.at(-1), measuredCells[0]]) {
      cell.click(); await settle();
      assert(!s.host.querySelector('.ve-cell-detail-popover').hidden, 'Popup failed to open');
      assert(s.host.querySelector('.ve-evidence-detail-grid'), 'Retained evidence not rendered');
      assert(s.view.getPrimaryAnalysis() === primary && s.reads() === reads, 'Popup reloaded/replaced primary analysis');
    }
    s.host.querySelector('.ve-evidence-detail-actions button').click();
    assert(request?.sampleIndices.length > 0 && request.timeMs.length > 0, 'Logger visit callback missing');
    assert(request.sampleIndices.every((i) => primary.evidence.cells[0].sampleIndices.includes(i)), 'Visit differs from retained evidence');
    s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } });
    assert(!s.view.getPrimaryAnalysis() && s.host.querySelector('.ve-cell-detail-popover').hidden, 'Replacement retained stale result/detail');
    s.host.remove();
  });
  await check('popup before a primary run does not load or analyze the log', async () => {
    const s = await setup(), reads = s.reads();
    s.root.querySelector('[data-ve-analyzer="ve-table-view"] td').click(); await settle();
    assert(s.host.querySelector('.ve-evidence-detail-loading')?.textContent.includes('valid VE analysis'), 'Missing run guidance');
    assert(s.reads() === reads && !s.view.getPrimaryAnalysis(), 'Popup started implicit analysis');
    s.host.remove();
  });
  await check('rerun withdraws old primary authority until the newer run completes', async () => {
    const s = await setup(); s.run(); await completed(s);
    const old = s.view.getPrimaryAnalysis(), pending = s.hold();
    s.run(); await settle();
    assert(!s.view.getPrimaryAnalysis(), 'Old snapshot exposed during a pending rerun');
    s.root.querySelector('[data-ve-analyzer="ve-table-view"] td').click(); await settle();
    assert(s.host.querySelector('.ve-evidence-detail-loading')?.textContent.includes('valid VE analysis'), 'Old popup evidence used during rerun');
    const reads = s.reads(); pending.resolve(traces); await completed(s);
    const current = s.view.getPrimaryAnalysis();
    assert(current && current !== old && current.evidence !== old.evidence && current.proposal !== old.proposal, 'New run did not replace primary result');
    measured(s.root).click(); await settle();
    assert(s.host.querySelector('.ve-evidence-detail-grid') && s.reads() === reads, 'New result not reused');
    s.host.remove();
  });
  await check('popup uses primary CLT/TPS-qualified evidence and timestamps without a second qualification pass', async () => {
    const extra = [
      { id: 'clt', sourceName: 'CLT', displayName: 'CLT', unit: 'C', valueType: 'number' },
      { id: 'tps', sourceName: 'TPS', displayName: 'TPS', unit: '%', valueType: 'number' },
    ];
    const extraTraces = extra.map((channel, index) => ({ ...traces[0], channel, range: { ...traces[0].range, values: Float64Array.from({ length: 60 }, (_, i) => index === 0 ? i < 20 ? 50 : 90 : i >= 40 ? 80 : 20) } }));
    const s = await setup(createVeAnalyzerView, { channels: [...channels, ...extra], traces: [...traces, ...extraTraces] });
    const maxTps = s.root.querySelector('[data-ve-quick="max-tps"]');
    maxTps.value = '30'; maxTps.dispatchEvent(new Event('change', { bubbles: true }));
    s.run(); await completed(s);
    const primary = s.view.getPrimaryAnalysis(), reads = s.reads();
    assert(primary && primary.actualRange.validity[0] === 0 && primary.actualRange.validity[25] === 1 && primary.actualRange.validity[59] === 0, 'Primary qualification fixture failed');
    assert(traces[2].range.validity[0] === 1, 'Source validity mutated');
    measured(s.root).click(); await settle();
    const metrics = Object.fromEntries([...s.host.querySelectorAll('.ve-evidence-detail-metric')].map((el) => [el.querySelector('span').textContent, el.querySelector('strong').textContent]));
    assert(metrics.Samples === primary.evidence.cells[0].sampleCount.toLocaleString(), 'Popup sample count differs from qualified primary evidence');
    assert(metrics['Proposal state'] === primary.proposal.cells[0].state, 'Popup proposal differs from primary');
    assert(s.reads() === reads && s.view.getPrimaryAnalysis() === primary, 'Popup repeated loading/analysis');
    s.host.remove();
  });
  await check('all Result Views, layouts and refresh preserve open cached detail and primary identity', async () => {
    const s = await setup(); s.run(); await completed(s); measured(s.root).click(); await settle();
    const primary = s.view.getPrimaryAnalysis(), reads = s.reads();
    const panel = s.host.querySelector('.ve-cell-detail-popover');
    const grid = panel.querySelector('.ve-evidence-detail-grid'), visit = panel.querySelector('.ve-evidence-detail-visit');
    let notifications = 0; const unsubscribe = s.view.onPrimaryAnalysisChange(() => { notifications += 1; });
    const resultView = s.root.querySelector('select[aria-label="VE Analyzer result view"]');
    for (const option of resultView.options) {
      resultView.value = option.value; resultView.dispatchEvent(new Event('change', { bubbles: true })); await settle();
      assert(!panel.hidden && panel.querySelector('.ve-evidence-detail-grid') === grid && panel.querySelector('.ve-evidence-detail-visit') === visit, `Result View ${option.value} invalidated detail`);
      assert(s.view.getPrimaryAnalysis() === primary && s.reads() === reads && notifications === 0, 'Presentation invalidated primary authority');
    }
    const layout = s.root.querySelector('select[aria-label="VE Analyzer table view"]');
    for (const value of ['single', 'side-by-side']) { layout.value = value; layout.dispatchEvent(new Event('change', { bubbles: true })); await settle(); }
    const discovery = s.root.querySelector('input[data-role="delay-command-threshold"]');
    discovery.value = String(Number(discovery.value) + 0.1); discovery.dispatchEvent(new Event('change', { bubbles: true }));
    s.view.refresh(); await settle();
    assert(!panel.hidden && panel.querySelector('.ve-evidence-detail-grid') === grid && s.view.getPrimaryAnalysis() === primary && notifications === 0, 'Refresh/layout/recommendation-only settings invalidated detail');
    panel.querySelector('header button').click(); measured(s.root).click(); await settle();
    assert(!panel.hidden && panel.querySelector('.ve-evidence-detail-grid') === grid && panel.querySelector('.ve-evidence-detail-visit') === visit, 'Reopening cell rebuilt cached detail');
    let request;
    s.view.setContext({ ...s.context, openSamplesInLogger: (next) => { request = next; } });
    const open = panel.querySelector('.ve-evidence-detail-actions button');
    assert(!open.disabled && s.view.getPrimaryAnalysis() === primary && notifications === 0, 'Callback-only update invalidated cache or left navigation disabled');
    open.click(); assert(request?.sampleIndices.length > 0, 'Cached visit did not use current Logger callback');
    unsubscribe(); s.view.setTuneModel(tune(), 'different.msq');
    assert(notifications === 0, 'Unsubscribed owner listener fired');
    s.host.remove();
  });
  for (const kind of ['qualification', 'delay-edit', 'delay-file', 'scope', 'tune', 'source']) {
    await check(`${kind} invalidates open detail and its per-cell cache at the owner`, async () => {
      const s = await setup(); s.run(); await completed(s); measured(s.root).click(); await settle();
      const panel = s.host.querySelector('.ve-cell-detail-popover');
      let notifications = 0; const unsubscribe = s.view.onPrimaryAnalysisChange(() => { notifications += 1; });
      if (kind === 'qualification') {
        const input = s.root.querySelector('[data-ve-quick="min-tps"]'); input.value = '10'; input.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (kind === 'delay-edit') {
        const cell = s.root.querySelector('[data-delay-row="0"][data-delay-col="0"]'); cell.onclick.call(cell, new PointerEvent('click'));
        s.root.querySelector('[data-ve-analyzer="delay-cell-working"]').value = '175'; s.root.querySelector('[data-ve-analyzer="delay-cell-apply"]').click();
      } else if (kind === 'delay-file') loadFile(s.root, () => Promise.resolve(delayFile(200)));
      else if (kind === 'scope') change(s.root, 'scope', 'ab');
      else if (kind === 'tune') s.view.setTuneModel(tune(), 'replacement.msq');
      else s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } });
      await settle();
      assert(panel.hidden && !panel.querySelector('.ve-evidence-detail-grid') && !s.view.getPrimaryAnalysis() && notifications === 1, 'Semantic change retained stale detail or duplicated owner notifications');
      unsubscribe(); s.host.remove();
    });
  }
  await check('rerun start closes existing detail and completed rerun generates new cell detail', async () => {
    const s = await setup(); s.run(); await completed(s); measured(s.root).click(); await settle();
    const panel = s.host.querySelector('.ve-cell-detail-popover'), oldGrid = panel.querySelector('.ve-evidence-detail-grid');
    const pending = s.hold(); s.run();
    assert(panel.hidden && !panel.querySelector('.ve-evidence-detail-grid'), 'Rerun left old detail active');
    pending.resolve(traces); await completed(s); measured(s.root).click(); await settle();
    assert(!panel.hidden && panel.querySelector('.ve-evidence-detail-grid') !== oldGrid, 'Rerun reused invalidated cell detail');
    s.host.remove();
  });
  return { passed: passed.length, checks: passed };
}
