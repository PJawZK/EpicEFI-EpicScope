import { importIniFile } from '../../apps/web/src/adapters/ini-file-import';
import { loadIniTableEditorDefinitions, saveIniTableEditorDefinitions } from '../../apps/web/src/state/ini-table-editor-storage';
import { parseIniTableEditorDefinitions } from '../../core/parsers/ini/ini-table-editor-parser';
import { createHistogramPage } from '../../apps/web/src/pages/histogram-page';
import { prepareMsqCandidate } from '../../apps/web/src/adapters/msq-candidate';

const key = 'epicscope.ini-table-editor-definitions.v1';
const table = prefix => `\n[TableEditor]\ntable = authority, authorityMap, "Authority", 1\nxBins = ${prefix}RpmBins, rpm\nyBins = ${prefix}LoadBins, map\nzBins = veTable\n`;
const assert = (value, message) => { if (!value) throw Error(message); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(predicate, message) {
  const end = performance.now() + 15000;
  while (!predicate()) { if (performance.now() > end) throw Error(message); await pause(20); }
  await pause(20);
}
export async function runIniTableAuthorityChecks({ iniSource, msqSource }) {
  const checks = [];
  const app = document.querySelector('#app');
  const control = selector => app.querySelector(selector);
  const change = (selector, value) => { const node = control(selector); node.value = value; node.dispatchEvent(new Event('change', { bubbles: true })); };
  const mode = async value => { control(`[data-epicscope-mode="${value}"]`).click(); await pause(30); };
  const pick = file => {
    const input = control('input[accept=".ini,text/plain"]');
    Object.defineProperty(input, 'files', { configurable: true, value: { item: () => file } });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const load = async (name, text) => {
    pick(new File([text], name));
    await wait(() => control('.settings-ini-status').textContent.includes(name) && ['success', 'issue'].includes(control('.load-ini').dataset.loadState), 'INI acceptance failed: ' + name);
  };
  const axis = () => control('.histogram-table-msq-x-axis').value;
  const originalGet = Storage.prototype.getItem, originalSet = Storage.prototype.setItem;
  let denied = false, reads = 0;
  Storage.prototype.getItem = function(name) { if (name === key) reads++; return originalGet.call(this, name); };
  Storage.prototype.setItem = function(name, value) { if (denied && name === key) throw new DOMException('Injected definition quota failure', 'QuotaExceededError'); return originalSet.call(this, name, value); };
  const a = parseIniTableEditorDefinitions(table('ve'));
  const b = parseIniTableEditorDefinitions(table('afr'));
  let component;
  try {
    await load('authority-a.ini', iniSource + table('ve'));
    await mode('histogram');
    change('.histogram-table-msq-table', 'veTable');
    change('.histogram-table-axis-source', 'msq');
    assert(axis() === 'veRpmBins', 'Accepted A did not map its axes: ' + axis() + ' / ' + JSON.stringify(loadIniTableEditorDefinitions()));
    checks.push('accepted INI definitions reach Histogram through the shell context');

    await importIniFile(new File([iniSource + table('afr')], 'candidate-only.ini'));
    assert(loadIniTableEditorDefinitions()[0]?.xBins === 'veRpmBins' && axis() === 'veRpmBins', 'Import preparation published unaccepted definitions');
    checks.push('preparing a different INI cannot alter active definitions or table axes');

    const durableA = originalGet.call(localStorage, key);
    denied = true; reads = 0;
    await load('authority-b.ini', iniSource + table('afr'));
    assert(axis() === 'afrRpmBins' && loadIniTableEditorDefinitions()[0]?.xBins === 'afrRpmBins', 'Quota failure left stale A axes authoritative');
    assert(originalGet.call(localStorage, key) === durableA, 'Fault injection did not retain old durable definitions');
    checks.push('accepted replacement maps new axes despite a failed storage write and stale disk definitions');
    for (let i = 0; i < 3; i++) { await mode('analyzer'); await mode('histogram'); }
    assert(axis() === 'afrRpmBins' && reads === 0, 'Navigation reread storage or reverted accepted axes');
    checks.push('repeated navigation uses the retained snapshot without table-definition storage reads');

    const unreadable = new File(['broken'], 'unreadable-authority.ini');
    unreadable.text = async () => { throw Error('Injected INI read failure'); };
    pick(unreadable);
    await wait(() => control('.load-ini').dataset.loadState === 'issue', 'INI failure was not reported');
    assert(loadIniTableEditorDefinitions()[0]?.xBins === 'afrRpmBins' && axis() === 'afrRpmBins', 'Failed import replaced accepted table authority');
    checks.push('rejected INI read leaves the current definitions and axes intact');

    await load('authority-empty.ini', iniSource);
    assert(loadIniTableEditorDefinitions().length === 0, 'Empty definitions revived stale persisted A');
    await mode('logger'); await mode('histogram');
    assert(reads === 0, 'Empty accepted snapshot fell back to storage');
    checks.push('an accepted INI without tables explicitly clears definitions even when persistence fails');

    await load('authority-before-unload.ini', iniSource + table('afr'));
    control('.setting-unload-ini').click();
    await wait(() => control('.setting-unload-ini').disabled, 'INI unload did not complete');
    assert(loadIniTableEditorDefinitions().length === 0 && reads === 0, 'INI unload retained definitions or reread stale storage');
    checks.push('INI unload clears session table authority despite failed persistence');

    denied = false;
    component = createHistogramPage();
    document.body.append(component.headerControl, component.element); component.element.hidden = false;
    const context = { channels: [{ id: 'ini:rpm', sourceName: 'RPM', displayName: 'RPM', valueType: 'number' }], traces: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, tuneModel: prepareMsqCandidate(msqSource), tuneTableDefinitions: a };
    component.setContext(context);
    const x = component.element.querySelector('.histogram-table-msq-x-axis');
    assert(x.value === 'veRpmBins', 'Explicit context A was not mapped');
    component.setContext({ ...context, tuneTableDefinitions: b });
    assert(x.value === 'afrRpmBins', 'Changed definitions on the same tune/table were skipped');
    x.value = 'veRpmBins';
    component.setContext({ ...context, tuneTableDefinitions: b, tuneModel: prepareMsqCandidate(msqSource) });
    assert(x.value === 'afrRpmBins', 'Tune replacement skipped accepted axis mapping');
    saveIniTableEditorDefinitions(a);
    assert(x.value === 'afrRpmBins', 'Fallback cache event overrode explicit context');
    checks.push('definition/tune changes invalidate the existing mapping guard while fallback events cannot override explicit context');
    x.value = 'veRpmBins';
    saveIniTableEditorDefinitions(b);
    component.setContext({ ...context, tuneTableDefinitions: [] });
    assert(x.value === 'veRpmBins', 'Explicit empty context adopted unrelated fallback definitions');
    checks.push('explicit empty context prevents fallback and preserves manual axis choices');
    return { passed: checks.length, checks };
  } finally {
    Storage.prototype.getItem = originalGet; Storage.prototype.setItem = originalSet;
    component?.element.remove(); component?.headerControl.remove();
    await load('authority-restored.ini', iniSource);
    await mode('logger');
  }
}
