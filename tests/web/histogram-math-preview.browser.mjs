import { createHistogramMathChannelsView } from '../../apps/web/src/pages/histogram-math-channels-view';
import { createHistogramPage } from '../../apps/web/src/pages/histogram-page';
import { createHistogramLogicalContext } from '../../apps/web/src/pages/histogram-logical-context';
import { loadHistogramCalculatedFields, saveHistogramCalculatedFields } from '../../apps/web/src/state/histogram-table-storage';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw Error(message); };
const rpm = { id: 'rpm', sourceName: 'RPM', displayName: 'RPM', unit: 'rpm', valueType: 'number' };
const source = (values, startSampleIndex = 25) => ({ channel: rpm, complete: true, color: '#123456', range: {
  startSampleIndex, values: Float64Array.from(values), timeMs: Float64Array.from(values, (_, index) => index * 10), validity: new Uint8Array(values.length).fill(1),
} });
async function wait(predicate, message) {
  const end = performance.now() + 10000;
  while (!predicate()) { if (performance.now() > end) throw Error(message); await pause(20); }
}
const gate = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

export async function runHistogramMathPreviewChecks() {
  const previous = loadHistogramCalculatedFields();
  saveHistogramCalculatedFields([]);
  const checks = [];
  const view = createHistogramMathChannelsView();
  const root = view.element;
  root.hidden = false;
  document.body.append(root);
  const control = selector => root.querySelector(selector);
  const input = (selector, value) => { control(selector).value = value; control(selector).dispatchEvent(new Event('input', { bubbles: true })); };
  const formula = value => input('.math-channel-formula', value);
  const stat = name => control(`[data-math-stat="${name}"]`).textContent;
  const valid = () => control('.math-channel-validation').textContent.startsWith('Formula valid');
  const requests = [];
  const trace = source([1, 2, 3, 4]);
  const context = { channels: [rpm], traces: [], aTimeMs: undefined, bTimeMs: undefined, loadTraces: async ids => { requests.push([...ids]); return [trace]; } };
  try {
    view.setContext(context);
    input('.math-channel-name', 'Original');
    formula('[RPM]');
    await wait(valid, 'Initial preview did not finish');
    const initial = requests.length;
    const status = control('.math-channel-validation').textContent;
    for (let i = 0; i < 6; i++) { input('.math-channel-name', 'Renamed ' + i); input('.math-channel-unit', 'unit ' + i); }
    control('.math-channel-save').click();
    await pause(250);
    assert(requests.length === initial && stat('mean') === '2.5' && control('.math-channel-validation').textContent === status, 'Metadata edits/save recalculated or disturbed a completed preview');
    assert(loadHistogramCalculatedFields().some(field => field.name === 'Renamed 5' && field.unit === 'unit 5'), 'Metadata changes were not saved');
    checks.push('name/unit typing and metadata save preserve preview without loading/evaluating again');

    const beforeTyping = requests.length;
    for (let i = 1; i <= 4; i++) { formula(`[RPM] * ${i}`); await pause(20); }
    assert(requests.length === beforeTyping && stat('mean') === '—', 'Formula edits started eager calculations or displayed stale stats');
    await wait(() => valid() && stat('mean') === '10', 'Debounced formula did not publish the latest expression');
    assert(requests.length === beforeTyping + 1, 'Typing burst loaded more than once');
    checks.push('formula typing burst coalesces to one calculation of the latest expression');

    const pending = gate();
    let pendingReads = 0;
    view.setContext({ ...context, loadTraces: () => { pendingReads++; return pending.promise; } });
    await wait(() => pendingReads === 1, 'Held preview did not start');
    formula('[RPM] * 8');
    pending.resolve([trace]);
    await pause(40);
    assert(stat('mean') === '—' && !valid(), 'Old read published during the debounce interval');
    view.setContext(context);
    await wait(() => stat('mean') === '20', 'Current preview failed after obsolete read');
    checks.push('new edits invalidate in-flight reads immediately, before the debounce fires');

    const rejected = gate();
    let rejectedReads = 0;
    view.setContext({ ...context, loadTraces: () => { rejectedReads++; return rejected.promise; } });
    await wait(() => rejectedReads === 1, 'Held rejection did not start');
    formula('');
    rejected.reject(Error('obsolete preview failure'));
    await pause(230);
    assert(stat('mean') === '—' && control('.math-channel-validation').textContent === 'Enter a formula to preview the result.', 'Clearing formula allowed an obsolete error');
    view.setContext(context);
    formula('[RPM]');
    control('.math-channel-reset').click();
    await pause(230);
    assert(stat('count') === '—' && control('.math-channel-formula').value === '', 'Reset allowed scheduled work to publish');
    checks.push('clearing/reset cancels queued work and rejects obsolete errors');

    const beforeHelpers = requests.length;
    formula('[RPM]');
    control('[data-insert=" + "]').click();
    control('.math-channel-source-chip').click();
    await wait(() => valid() && stat('mean') === '5', 'Source/helper insertion failed');
    assert(requests.length === beforeHelpers + 1, 'Helper/source insertion bypassed debounce');
    checks.push('formula helper and source insertion share the debounced path');

    const hiddenRead = gate();
    let hiddenReads = 0;
    view.setContext({ ...context, loadTraces: () => { hiddenReads++; return hiddenRead.promise; } });
    await wait(() => hiddenReads === 1, 'Hidden-read fixture did not start');
    view.setActive(false);
    hiddenRead.resolve([trace]);
    await pause(30);
    assert(!valid(), 'Hidden view accepted old completion');
    view.setActive(true);
    view.setContext(context);
    view.refresh();
    const beforeEntry = requests.length;
    await wait(valid, 'Visible re-entry did not calculate');
    assert(requests.length === beforeEntry + 1, 'setContext + refresh duplicated entry work');
    formula('[RPM] * 9');
    root.hidden = true;
    const beforeHidden = requests.length;
    await pause(230);
    assert(requests.length === beforeHidden, 'Hidden root started queued work');
    root.hidden = false;
    view.setContext(context);
    await wait(() => stat('mean') === '22.5', 'Latest expression lost on return');
    checks.push('hidden preview work is rejected/deferred and context plus refresh coalesces on entry');

    const big = source(Float64Array.from({ length: 320459 }, (_, index) => index + 1));
    const bigContext = { ...context, aTimeMs: 0, bTimeMs: 3204580, loadTraces: async () => [big] };
    formula('[RPM] - [RPM-1]');
    view.setContext(bigContext);
    await wait(valid, 'Large preview did not finish');
    assert(stat('count') === (9999).toLocaleString() && stat('mean') === '1' && control('.math-channel-validation').textContent.includes('first ' + (10000).toLocaleString()), 'Large preview was not bounded/labeled or lost history validity');
    assert(big.range.values.length === 320459 && big.range.values.at(-1) === 320459, 'Preview altered its source');
    const logical = createHistogramLogicalContext(bigContext, [{ id: 'full', name: 'Full', expression: '[RPM] - [RPM-1]' }]);
    const full = await logical.loadTraces(['formula:full']);
    assert(full[0].range.values.length === 320459 && full[0].range.validity.at(-1) === 1, 'Preview limit leaked into full analysis');
    checks.push('320459-sample preview evaluates at most 10000 anchor samples without changing full analysis or source arrays');

    const page = createHistogramPage();
    const host = document.createElement('section');
    page.element.hidden = false;
    host.append(page.headerControl, page.element); document.body.append(host);
    try {
      page.setContext(context);
      const select = page.headerControl.querySelector('select');
      select.value = 'math-channels'; select.dispatchEvent(new Event('change'));
      const editor = page.element.querySelector('.math-channel-formula');
      editor.value = '[RPM]'; editor.dispatchEvent(new Event('input'));
      const beforeLeave = requests.length;
      select.value = 'table'; select.dispatchEvent(new Event('change'));
      await pause(230);
      // Table performs its own load; only a late single-channel Math request would include rpm alone.
      assert(!requests.slice(beforeLeave).some(ids => ids.length === 1 && ids[0] === 'rpm'), 'Page navigation failed to cancel queued Math work');
      checks.push('Histogram subview routing explicitly cancels scheduled Math preview on exit');
    } finally { host.remove(); }
    return { passed: checks.length, checks };
  } finally {
    view.setActive?.(false); root.remove();
    saveHistogramCalculatedFields(previous);
    window.dispatchEvent(new CustomEvent('epicscope-histogram-calculated-fields-changed'));
  }
}
