import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
import { loadVeTableToolPreferences, saveVeTableToolPreferences } from '../../apps/web/src/state/ve-table-tool-preferences';

const assert = (ok, message) => { if (!ok) throw Error(message); };
const near = (actual, expected, message) => assert(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
const settle = async () => { for (let i = 0; i < 2; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
const count = 32, positions = Array.from({ length: count * count }, (_, i) => ({ row: Math.floor(i / count), col: i % count }));

export async function runVeInterpolationStrengthChecks() {
  const checks = [], preferences = loadVeTableToolPreferences('delay');
  const savedResult = localStorage.getItem('epicscope.veAnalyzer.resultView');
  localStorage.setItem('epicscope.veAnalyzer.resultView', 'proposal');
  const rpm = Array.from({ length: count }, (_, i) => 1000 + i * 100), load = Array.from({ length: count }, (_, i) => 10 + i);
  const tune = normalizeMsqTune(parseMsq(`<msq><page>
    <constant name="veRpmBins" rows="1" cols="32">${rpm.join(' ')}</constant>
    <constant name="veLoadBins" rows="32" cols="1">${load.join(' ')}</constant>
    <constant name="veTable" rows="32" cols="32">${positions.map(() => 100).join(' ')}</constant>
  </page></msq>`));
  const source = [...tune.byName.get('veTable').numericValues];
  const view = createVeAnalyzerView(), root = view.element;
  const host = document.createElement('section'); host.className = 'analyzer-page'; host.append(root); document.body.append(host); root.hidden = false;
  let reads = 0;
  try {
    view.setContext({ source: { identity: {}, sampleCount: 0, revision: 0 }, channels: [], traces: [], savedRanges: [], loadTraces: async () => { reads++; return []; } });
    view.setTuneModel(tune, 'interpolation.msq'); await settle();
    const input = root.querySelector('[data-ve-analyzer="load-delay-file"]');
    const text = serializeVeDelayTable({ rows: count, cols: count, rpmBins: rpm, loadBins: load, origin: 'saved-file', cells: positions.map(position => ({ ...position, state: 'measured', recommendedMs: 100, workingMs: 100, workingProvenance: 'measured-recommendation', confidence: 'moderate', eventCount: 3, sourceEvents: [] })) });
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'interpolation-delay.json', text: async () => text }] });
    input.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    assert(veDelayEditOwner(root).snapshot()?.rows === count, '32×32 delay fixture was not accepted');
    for (const kind of ['Working VE', 'Lambda Delay']) {
      if (kind === 'Lambda Delay') { root.querySelector('.ve-v50-lambda-tool-trigger').click(); await settle(); }
      const delay = kind === 'Lambda Delay', owner = delay ? veDelayEditOwner(root) : veProposalEditOwner(root);
      const toolbar = root.querySelector(delay ? '.ve-delay-shared-toolbar' : '.ve-proposal-shared-toolbar');
      const tool = prefix => [...toolbar.querySelectorAll('button')].find(button => button.getAttribute('aria-label')?.startsWith(prefix));
      const cell = ({ row, col }) => root.querySelector(delay ? `td[data-delay-row="${row}"][data-delay-col="${col}"]` : `td[data-ve-row="${row}"][data-ve-col="${col}"]`);
      const clickCell = (position, shiftKey = false) => {
        const node = cell(position); assert(node, `${kind}: missing cell`); node.setPointerCapture = () => {};
        for (const type of ['pointerdown', 'pointerup']) node.dispatchEvent(new PointerEvent(type, { pointerId: 29, pointerType: 'mouse', bubbles: true, cancelable: true, shiftKey }));
      };
      const select = (a, b) => { clickCell(a); clickCell(b, true); };
      const set = async (values) => { owner.applyValues(values.map(({ row, col, value }) => delay ? { row, col, workingMs: value } : { row, col, value })); await settle(); };
      const value = position => owner.snapshot().values[position.row * count + position.col];
      const configure = async (axis, method, strength, shouldClamp = true) => {
        const button = tool(`Interpolate ${axis === 'both' ? 'both directions' : axis === 'horizontal' ? 'horizontally' : 'vertically'}`);
        button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        const popup = document.querySelector('.ve-table-tool-options'); assert(popup, `${kind}: configuration missing`);
        const methodField = popup.querySelector('select'), strengthField = popup.querySelector('input[type=number]'), clamp = popup.querySelector('input[type=checkbox]');
        methodField.value = method; methodField.dispatchEvent(new Event('change', { bubbles: true }));
        strengthField.value = String(strength); strengthField.dispatchEvent(new Event('change', { bubbles: true }));
        clamp.checked = shouldClamp; clamp.dispatchEvent(new Event('change', { bubbles: true }));
        // Use the configuration owner's existing Escape handler, not DOM removal.
        popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle(); return button;
      };
      const apply = async (button, before, expected, name) => {
        const revision = view.sessionRevision;
        const generation = owner.snapshot().authorityGeneration;
        button.click(); await settle();
        for (const entry of expected) entry.value === undefined ? assert(value(entry) === undefined, `${kind}: zero strength filled a blank`) : near(value(entry), entry.value, `${kind} ${name} [${entry.row},${entry.col}]`);
        const changed = expected.some(entry => !Object.is(before.find(p => p.row === entry.row && p.col === entry.col)?.value, entry.value));
        assert(owner.snapshot().authorityGeneration === generation + (changed ? 1 : 0), `${kind} ${name}: must publish once or remain a no-op`);
        assert(view.sessionRevision === revision + (delay && changed ? 1 : 0), `${kind} ${name}: unexpected analytical invalidation`);
        if (changed) {
          tool('Undo').click(); await settle();
          for (const entry of before) entry.value === undefined ? assert(value(entry) === undefined, 'Undo lost empty cell') : near(value(entry), entry.value, 'Undo');
          tool('Redo').click(); await settle();
          for (const entry of expected) entry.value === undefined ? assert(value(entry) === undefined, 'Redo lost empty cell') : near(value(entry), entry.value, 'Redo');
        }
        assert(reads === 0 && JSON.stringify(tune.byName.get('veTable').numericValues) === JSON.stringify(source), `${kind}: interpolation read log data or mutated source tune`);
        checks.push(`${kind}: ${name}, exact semantic values, one publication and Undo/Redo`);
      };
      for (const axis of ['horizontal', 'vertical']) for (const method of ['linear', 'shape']) for (const strength of [0, 0.5, 1]) {
        const line = Array.from({ length: count }, (_, i) => ({ row: axis === 'horizontal' ? 0 : i, col: axis === 'horizontal' ? i : 0, value: i === 0 ? 200 : i === count - 1 ? 150 : 100 }));
        await set(line); select(line[0], line[count - 1]);
        const button = await configure(axis, method, strength);
        await apply(button, line, line.map((entry, i) => ({ ...entry, value: i === 0 || i === count - 1 ? entry.value : 100 + (100 - 50 * i / 31) * strength })), `${axis}/${method}, 32 cells, strength ${strength}`);
      }
      for (const method of ['bilinear', 'boundary']) for (const strength of [0, 0.5, 1]) {
        const initial = [200, 180, 150, 200, 100, 150, 200, 180, 150].map((value, i) => ({ row: Math.floor(i / 3), col: i % 3, value }));
        await set(initial); select(initial[0], initial[8]);
        const button = await configure('both', method, strength);
        const expected = initial.map(entry => {
          const target = method === 'bilinear' ? 200 - 25 * entry.col : entry.row === 1 && entry.col === 1 ? 180 : entry.value;
          return { ...entry, value: entry.value + (target - entry.value) * strength };
        });
        await apply(button, initial, expected, `both/${method}, strength ${strength}`);
      }
      for (const axis of ['horizontal', 'vertical']) for (const method of ['linear', 'shape']) {
        const initial = [0, 1, 100, 3, 6].map((value, i) => ({ row: axis === 'horizontal' ? 2 : i, col: axis === 'horizontal' ? i : 2, value }));
        await set(initial); select(initial[1], initial[3]);
        const button = await configure(axis, method, 0.5);
        await apply(button, initial.slice(1, 4), initial.slice(1, 4).map((entry, i) => ({ ...entry, value: i === 1 ? (100 + (method === 'linear' ? 2 : 63 / 34)) / 2 : entry.value })), `${axis}/${method}, curved outside neighbors, half strength`);
      }
      // No numerical origin exists for a blank: any positive strength fills it
      // with the complete target. Zero strength must preserve the blank.
      for (const method of ['linear', 'shape']) for (const strength of [0, 0.5]) {
        const initial = [200, undefined, 150].map((value, col) => ({ row: 5, col, value }));
        // Both outside-neighbor values are absent, deliberately exercising the
        // two-anchor shape fallback on this selected span.
        await set([...initial, { row: 5, col: 3, value: undefined }]); select(initial[0], initial[2]);
        const button = await configure('horizontal', method, strength);
        await apply(button, initial, initial.map((entry, i) => ({ ...entry, value: i === 1 && strength > 0 ? 175 : entry.value })), `${method} blank cell, strength ${strength}`);
      }
      for (const shouldClamp of [false, true]) {
        const initial = [10, 100, 20, 100, 1000, 100, 30, 100, 40].map((value, i) => ({ row: Math.floor(i / 3) + 8, col: i % 3, value }));
        await set(initial); select(initial[0], initial[8]);
        const button = await configure('both', 'boundary', 0.5, shouldClamp);
        await apply(button, initial, initial.map((entry, i) => ({ ...entry, value: i === 4 ? (shouldClamp ? 550 : 587.5) : entry.value })), `boundary overshoot, clamp ${shouldClamp}, half strength`);
      }
      const pinned = [200, 100, 180, 100, 150].map((value, col) => ({ row: 6, col, value }));
      await set(pinned); clickCell(pinned[2]); tool('Pin or unpin').click(); select(pinned[0], pinned[4]);
      const button = await configure('horizontal', 'linear', 0.5);
      await apply(button, pinned, [200, 145, 180, 132.5, 150].map((value, col) => ({ row: 6, col, value })), 'pinned interior anchor retained at half strength');
      clickCell(pinned[2]); tool('Pin or unpin').click();
    }
    return { passed: checks.length, checks };
  } finally {
    view.dispose(); host.remove(); saveVeTableToolPreferences('delay', preferences);
    if (savedResult === null) localStorage.removeItem('epicscope.veAnalyzer.resultView'); else localStorage.setItem('epicscope.veAnalyzer.resultView', savedResult);
  }
}
