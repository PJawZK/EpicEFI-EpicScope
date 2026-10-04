import { compareNumericCohorts, type NumericCompareResult } from '../../../../core/analysis/numeric-compare';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import type { SavedTimelineRangeState } from '../state/workspace-state';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';

export interface AnalyzerPageController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  refresh(): void;
}

function channelLabel(trace: LoggerAnalysisTraceContext): string {
  return trace.channel.displayName || trace.channel.sourceName;
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const percent = value * 100;
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function formatDuration(range: SavedTimelineRangeState): string {
  const seconds = Math.abs(range.endMs - range.startMs) / 1000;
  return seconds < 60 ? `${seconds.toFixed(3)} s` : `${(seconds / 60).toFixed(2)} min`;
}

export function createAnalyzerPage(): AnalyzerPageController {
  let context: LoggerAnalysisContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let currentResult: NumericCompareResult | undefined;

  const root = document.createElement('main');
  root.className = 'analyzer-page';
  root.hidden = true;
  root.innerHTML = `
    <section class="analyzer-head">
      <div>
        <span class="analyzer-eyebrow">Analyzer</span>
        <h1>Saved range comparison</h1>
        <p>Compare one active decoded channel across two saved Logger ranges.</p>
      </div>
      <div class="analyzer-controls">
        <label><span>Channel</span><select class="analyzer-channel"></select></label>
        <label><span>Left range</span><select class="analyzer-left-range"></select></label>
        <label><span>Right range</span><select class="analyzer-right-range"></select></label>
        <button type="button" class="analyzer-refresh">Refresh</button>
      </div>
    </section>
    <section class="analyzer-empty">
      <strong>Analyzer needs one active channel and two saved ranges.</strong>
      <span>Return to Logger, keep the channel active in the current pane, and save at least two A/B ranges.</span>
    </section>
    <section class="analyzer-content" hidden>
      <div class="analyzer-side analyzer-side--left">
        <span>Left</span><strong data-analyzer="left-label">—</strong><small data-analyzer="left-scope">—</small>
      </div>
      <div class="analyzer-side analyzer-side--right">
        <span>Right</span><strong data-analyzer="right-label">—</strong><small data-analyzer="right-scope">—</small>
      </div>
      <div class="analyzer-evidence analyzer-evidence--left">
        <div><span>Input</span><strong data-analyzer="left-input">0</strong></div>
        <div><span>Valid</span><strong data-analyzer="left-valid">0</strong></div>
        <div><span>Invalid</span><strong data-analyzer="left-invalid">0</strong></div>
        <div><span>Unavailable</span><strong data-analyzer="left-unavailable">0</strong></div>
        <div><span>Coverage</span><strong data-analyzer="left-coverage">—</strong></div>
      </div>
      <div class="analyzer-evidence analyzer-evidence--right">
        <div><span>Input</span><strong data-analyzer="right-input">0</strong></div>
        <div><span>Valid</span><strong data-analyzer="right-valid">0</strong></div>
        <div><span>Invalid</span><strong data-analyzer="right-invalid">0</strong></div>
        <div><span>Unavailable</span><strong data-analyzer="right-unavailable">0</strong></div>
        <div><span>Coverage</span><strong data-analyzer="right-coverage">—</strong></div>
      </div>
      <div class="analyzer-table-wrap">
        <table class="analyzer-table">
          <thead><tr><th>Metric</th><th>Left</th><th>Right</th><th>Δ</th><th>Relative</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="analyzer-foot">
        <span>Comparison coverage <strong data-analyzer="coverage">—</strong></span>
        <span>Delta convention <strong>Right − Left</strong></span>
      </div>
    </section>
  `;

  const channelSelect = root.querySelector<HTMLSelectElement>('.analyzer-channel');
  const leftSelect = root.querySelector<HTMLSelectElement>('.analyzer-left-range');
  const rightSelect = root.querySelector<HTMLSelectElement>('.analyzer-right-range');
  const refreshButton = root.querySelector<HTMLButtonElement>('.analyzer-refresh');
  const empty = root.querySelector<HTMLElement>('.analyzer-empty');
  const content = root.querySelector<HTMLElement>('.analyzer-content');
  const tableBody = root.querySelector<HTMLTableSectionElement>('.analyzer-table tbody');
  if (!channelSelect || !leftSelect || !rightSelect || !refreshButton || !empty || !content || !tableBody) {
    throw new Error('Analyzer page structure is incomplete.');
  }

  const field = (name: string): HTMLElement => {
    const element = root.querySelector<HTMLElement>(`[data-analyzer="${name}"]`);
    if (!element) throw new Error(`Analyzer field is missing: ${name}`);
    return element;
  };

  const selectedTrace = (): LoggerAnalysisTraceContext | undefined =>
    context.traces.find((trace) => trace.channel.id === channelSelect.value) ?? context.traces[0];

  const selectedRange = (select: HTMLSelectElement): SavedTimelineRangeState | undefined => {
    const index = Number(select.value);
    return Number.isInteger(index) ? context.savedRanges[index] : undefined;
  };

  const render = (): void => {
    const trace = selectedTrace();
    const leftRange = selectedRange(leftSelect);
    const rightRange = selectedRange(rightSelect);
    if (!trace || !leftRange || !rightRange || context.savedRanges.length < 2) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      refreshButton.disabled = true;
      return;
    }

    refreshButton.disabled = false;
    const channels = new Map([[trace.channel.id, { range: trace.range, complete: trace.complete }]]);
    const leftScope = qualifyNumericSamples({
      referenceChannelId: trace.channel.id,
      channels,
      conditions: [],
      timeRange: { startMs: leftRange.startMs, endMs: leftRange.endMs },
    });
    const rightScope = qualifyNumericSamples({
      referenceChannelId: trace.channel.id,
      channels,
      conditions: [],
      timeRange: { startMs: rightRange.startMs, endMs: rightRange.endMs },
    });

    currentResult = compareNumericCohorts(
      { range: trace.range, sampleIndices: leftScope.eligibleSampleIndices, complete: leftScope.complete },
      { range: trace.range, sampleIndices: rightScope.eligibleSampleIndices, complete: rightScope.complete },
    );

    empty.hidden = true;
    content.hidden = false;
    field('left-label').textContent = leftRange.label;
    field('right-label').textContent = rightRange.label;
    field('left-scope').textContent = formatDuration(leftRange);
    field('right-scope').textContent = formatDuration(rightRange);
    field('left-input').textContent = currentResult.left.inputSampleCount.toLocaleString();
    field('left-valid').textContent = currentResult.left.validSampleCount.toLocaleString();
    field('left-invalid').textContent = currentResult.left.invalidSampleCount.toLocaleString();
    field('left-unavailable').textContent = currentResult.left.unavailableSampleCount.toLocaleString();
    field('left-coverage').textContent = leftScope.complete ? 'Complete' : 'Partial decoded';
    field('right-input').textContent = currentResult.right.inputSampleCount.toLocaleString();
    field('right-valid').textContent = currentResult.right.validSampleCount.toLocaleString();
    field('right-invalid').textContent = currentResult.right.invalidSampleCount.toLocaleString();
    field('right-unavailable').textContent = currentResult.right.unavailableSampleCount.toLocaleString();
    field('right-coverage').textContent = rightScope.complete ? 'Complete' : 'Partial decoded';
    field('coverage').textContent = currentResult.complete ? 'Complete' : 'Partial decoded';

    const unit = trace.channel.unit ? ` ${trace.channel.unit}` : '';
    const rows: Array<{ label: string; key: 'count' | 'mean' | 'min' | 'max' | 'standard-deviation'; unit: string }> = [
      { label: 'Valid samples', key: 'count', unit: '' },
      { label: 'Mean', key: 'mean', unit },
      { label: 'Minimum', key: 'min', unit },
      { label: 'Maximum', key: 'max', unit },
      { label: 'Std dev', key: 'standard-deviation', unit },
    ];
    tableBody.replaceChildren(...rows.map((row) => {
      const metric = currentResult!.metrics[row.key];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <th>${row.label}</th>
        <td>${formatNumber(metric.left)}${metric.left === undefined ? '' : row.unit}</td>
        <td>${formatNumber(metric.right)}${metric.right === undefined ? '' : row.unit}</td>
        <td>${metric.delta !== undefined && metric.delta > 0 ? '+' : ''}${formatNumber(metric.delta)}${metric.delta === undefined ? '' : row.unit}</td>
        <td>${formatPercent(metric.relativeDelta)}</td>
      `;
      return tr;
    }));
  };

  const fillChannelSelect = (preferred: string): void => {
    channelSelect.replaceChildren();
    for (const trace of context.traces) channelSelect.add(new Option(channelLabel(trace), trace.channel.id));
    if (context.traces.some((trace) => trace.channel.id === preferred)) channelSelect.value = preferred;
  };

  const fillRangeSelect = (select: HTMLSelectElement, preferredIndex: number, fallbackIndex: number): void => {
    select.replaceChildren();
    context.savedRanges.forEach((range, index) => select.add(new Option(range.label, String(index))));
    const chosen = context.savedRanges[preferredIndex] ? preferredIndex : fallbackIndex;
    if (context.savedRanges[chosen]) select.value = String(chosen);
  };

  const setContext = (nextContext: LoggerAnalysisContext): void => {
    const previousChannel = channelSelect.value;
    const previousLeft = Number(leftSelect.value);
    const previousRight = Number(rightSelect.value);
    context = nextContext;
    fillChannelSelect(previousChannel);
    fillRangeSelect(leftSelect, previousLeft, 0);
    fillRangeSelect(rightSelect, previousRight, context.savedRanges.length > 1 ? 1 : 0);
    render();
  };

  channelSelect.addEventListener('change', render);
  leftSelect.addEventListener('change', render);
  rightSelect.addEventListener('change', render);
  refreshButton.addEventListener('click', render);

  return { element: root, setContext, refresh: render };
}
