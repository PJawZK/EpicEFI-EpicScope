import { createHistogramPage } from '../../apps/web/src/pages/histogram-page';
import { loadHistogramCalculatedFields, saveHistogramCalculatedFields } from '../../apps/web/src/state/histogram-table-storage';

const assert = (condition, message) => { if (!condition) throw Error(message); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(predicate, label) {
  const end = performance.now() + 10000;
  while (!predicate()) {
    if (performance.now() > end) throw Error(label);
    await pause(20);
  }
}
const channel = (id, name, unit) => ({ id, sourceName: name, displayName: name, valueType: 'number', unit });
const rpm = channel('rpm', 'RPM', 'rpm');
const map = channel('map', 'MAP', 'kPa');
const range = values => ({ startSampleIndex: 25, values: Float64Array.from(values), timeMs: Float64Array.from([100, 200, 300, 400]), validity: Uint8Array.from([1, 1, 1, 1]) });
const field = { id: 'pipeline-change', name: 'RPM Change', expression: '[RPM] - [RPM-1]', unit: 'rpm/sample' };

export async function runHistogramFormulaPipelineChecks() {
  const checks = [];
  const previous = loadHistogramCalculatedFields();
  const requests = [];
  const traces = [
    { channel: rpm, range: range([1000, 1100, 1300, 1600]), color: '#112233', complete: false },
    { channel: map, range: range([80, 90, 100, 110]), color: '#445566', complete: false },
  ];
  const context = {
    channels: [rpm, map], traces: [], aTimeMs: 400, bTimeMs: 100,
    loadTraces: async (ids, start, end) => {
      requests.push({ ids: [...ids], start, end });
      return traces.filter(trace => ids.includes(trace.channel.id));
    },
  };
  saveHistogramCalculatedFields([field]);
  const page = createHistogramPage();
  const host = document.createElement('section');
  host.style.cssText = 'position:fixed;inset:0;background:#111;z-index:9999;overflow:auto';
  page.element.hidden = false;
  host.append(page.headerControl, page.element);
  document.body.append(host);
  const root = page.element;
  const change = (selector, value, event = 'change') => {
    const control = host.querySelector(selector);
    assert(control, `Missing control ${selector}`);
    control.value = value;
    control.dispatchEvent(new Event(event, { bubbles: true }));
  };
  const view = value => change('.histogram-view-select', value);
  const stat = name => root.querySelector(`[data-hist-table-summary="${name}"]`).textContent;
  const readyTable = async () => {
    await wait(() => !root.querySelector('.histogram-table-export').disabled || !root.querySelector('.histogram-table-empty').hidden, 'Table did not finish');
    assert(!root.querySelector('.histogram-table-export').disabled, 'Historical formula failed in Table Generator: ' + root.querySelector('.histogram-table-empty').textContent);
  };
  try {
    page.setContext(context);
    change('.histogram-table-x', 'formula:pipeline-change');
    change('.histogram-table-y', 'map');
    change('.histogram-table-z', 'formula:pipeline-change');
    change('.histogram-table-aggregation', 'mean');
    await pause(100);
    await readyTable();
    assert(stat('binned') === '3' && stat('coverage') === 'Complete', `Historical Table values/coverage changed: ${stat('binned')}, ${stat('coverage')}`);
    assert(requests.length === 1 && requests[0].ids.join(',') === 'rpm,map' && requests[0].start === 100 && requests[0].end === 400, 'Table did not deduplicate dependencies or normalize scope');
    checks.push('Table Generator evaluates saved historical formulas with one physical load and scoped completeness');

    change('.histogram-table-delta', 'rpm');
    root.querySelector('.histogram-add-filter').click();
    change('.histogram-filter-channel', 'formula:pipeline-change');
    change('.histogram-filter-value', '150', 'input');
    const before = requests.length;
    await wait(() => stat('eligible') === '2', 'Calculated qualification did not select two samples');
    assert(stat('binned') === '2' && requests.length === before + 1 && new Set(requests.at(-1).ids).size === 2, 'Formula used as X/Z/filter or delta repeated dependency loads');
    assert(root.querySelector('[data-hist-table-summary="cell"]').textContent.includes('RPM Change'), 'Calculated name/unit metadata lost');
    checks.push('formula axes, values, delta and qualification share deduplicated materialization');
    root.querySelector('.histogram-filter-remove').click();
    await wait(() => stat('eligible') !== '2', 'Filter removal did not refresh');

    view('math-channels');
    change('.math-channel-name', 'Preview Change', 'input');
    change('.math-channel-formula', field.expression, 'input');
    await wait(() => root.querySelector('.math-channel-validation').textContent.startsWith('Formula valid'), 'Math preview failed');
    assert(root.querySelector('[data-math-stat="count"]').textContent === '3' && root.querySelector('[data-math-stat="mean"]').textContent === '200', 'Math historical preview values differ');
    assert(requests.at(-1).ids.join(',') === 'rpm' && requests.at(-1).start === 100 && requests.at(-1).end === 400, 'Preview scope/dependency mismatch');
    checks.push('Math preview uses shared historical binding and preserves finite-sample statistics');

    // Legacy manager still validates and saves through the same physical resolver.
    change('.histogram-formula-name', 'Legacy History');
    change('.histogram-formula-expression', '[RPM] - [RPM-1]');
    root.querySelector('.histogram-formula-save').click();
    assert(loadHistogramCalculatedFields().some(item => item.name === 'Legacy History'), 'Legacy formula validation rejected historical references');
    checks.push('legacy calculated-field manager uses the same validation policy');

    view('distribution');
    change('.distribution-channel', 'formula:pipeline-change');
    const distributionMean = () => [...root.querySelectorAll('.distribution-stats dt')].find(node => node.textContent === 'Mean')?.nextElementSibling?.textContent;
    await wait(() => distributionMean() === '200', 'Distribution formula mean was not 200');
    assert(root.querySelector('.distribution-channel').selectedOptions[0].textContent.includes('RPM Change'), 'Distribution lost formula label');
    checks.push('Distribution retains historical formula values and labels through page routing');

    view('scatter');
    change('.scatter-pane-x', 'formula:pipeline-change');
    change('.scatter-pane-y', 'map');
    await wait(() => root.querySelector('.scatter-pane-status').textContent.startsWith('3 pairs'), 'Scatter did not retain three valid formula pairs');
    checks.push('Scatter retains historical formula validity/alignment through page routing');

    view('math-channels');
    change('.math-channel-formula', '[missing]', 'input');
    await wait(() => root.querySelector('.math-channel-validation').textContent === 'Channel not found: [missing]', 'Math missing-reference feedback changed');
    change('.math-channel-formula', field.expression, 'input');
    page.setContext({ ...context, loadTraces: async () => [] });
    await wait(() => root.querySelector('.math-channel-validation').textContent === 'Preview data unavailable for [RPM]', 'Math missing-data feedback changed');
    page.setContext(context);
    await wait(() => root.querySelector('.math-channel-validation').textContent.startsWith('Formula valid'), 'Math failed to recover after missing data');
    checks.push('Math owns missing-reference/data feedback and recovers on valid source replacement');

    let release;
    const held = new Promise(resolve => { release = resolve; });
    page.setContext({ ...context, loadTraces: () => held });
    const replacement = { ...traces[0], range: range([1000, 1900, 2800, 3700]) };
    page.setContext({ ...context, loadTraces: async () => [replacement] });
    await wait(() => root.querySelector('[data-math-stat="mean"]').textContent === '900', 'Replacement preview did not publish');
    release([traces[0]]);
    await pause(50);
    assert(root.querySelector('[data-math-stat="mean"]').textContent === '900', 'Obsolete preview overwrote a newer source');
    checks.push('existing Math preview generation rejects obsolete loaded data before evaluation/publication');
    return { passed: checks.length, checks };
  } finally {
    host.remove();
    saveHistogramCalculatedFields(previous);
    window.dispatchEvent(new CustomEvent('epicscope-histogram-calculated-fields-changed'));
  }
}
