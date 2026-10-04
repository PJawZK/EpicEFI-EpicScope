import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';
import { buildNumericHistogram, type NumericHistogramResult } from '../../../../core/analysis/histogram';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { createHeatmapView } from './heatmap-view';
import { createScatterView } from './scatter-view';

export interface HistogramTraceContext {
  readonly channel: ChannelDefinition;
  readonly range: NumericChannelRange;
  readonly complete: boolean;
  readonly color: string;
}

export interface HistogramPageContext {
  readonly traces: readonly HistogramTraceContext[];
  readonly aTimeMs: number | undefined;
  readonly bTimeMs: number | undefined;
}

export interface HistogramPageController {
  readonly element: HTMLElement;
  setContext(context: HistogramPageContext): void;
  refresh(): void;
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

export function createHistogramPage(): HistogramPageController {
  let context: HistogramPageContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined };
  let currentResult: NumericHistogramResult | undefined;
  let activeView: 'distribution' | 'heatmap' | 'scatter' = 'distribution';
  const heatmapView = createHeatmapView();
  const scatterView = createScatterView();

  const page = document.createElement('main');
  page.className = 'histogram-page';
  page.hidden = true;
  page.innerHTML = `
    <section class="histogram-surface-head">
      <div>
        <span class="histogram-eyebrow">Histogram</span>
        <h1 class="histogram-title">Selected range distribution</h1>
        <p class="histogram-description">Distribution of one active decoded channel inside the current Logger A/B range.</p>
      </div>
      <div class="histogram-head-actions">
        <div class="histogram-view-switch" role="group" aria-label="Histogram analysis view">
          <button type="button" class="histogram-view-choice histogram-view-choice--active" data-histogram-view="distribution" aria-pressed="true">Distribution</button>
          <button type="button" class="histogram-view-choice" data-histogram-view="heatmap" aria-pressed="false">Heatmap</button>
          <button type="button" class="histogram-view-choice" data-histogram-view="scatter" aria-pressed="false">Scatter</button>
        </div>
        <div class="histogram-controls">
          <label>
            <span>Channel</span>
            <select class="histogram-channel"></select>
          </label>
          <label>
            <span>Bins</span>
            <select class="histogram-bin-count">
              <option value="10">10</option>
              <option value="20" selected>20</option>
              <option value="30">30</option>
              <option value="40">40</option>
              <option value="60">60</option>
            </select>
          </label>
          <button type="button" class="histogram-refresh">Refresh</button>
        </div>
      </div>
    </section>
    <section class="histogram-empty histogram-distribution-surface">
      <strong>Histogram needs a selected range.</strong>
      <span>Return to Logger, set A and B, and keep the channel you want to analyze active in the current graph pane.</span>
    </section>
    <section class="histogram-content histogram-distribution-surface" hidden>
      <div class="histogram-summary">
        <div><span>Scope</span><strong data-summary="scope">—</strong></div>
        <div><span>Coverage</span><strong data-summary="coverage">—</strong></div>
        <div><span>Input</span><strong data-summary="input">0</strong></div>
        <div><span>Binned</span><strong data-summary="binned">0</strong></div>
        <div><span>Invalid</span><strong data-summary="invalid">0</strong></div>
        <div><span>Unavailable</span><strong data-summary="unavailable">0</strong></div>
      </div>
      <div class="histogram-chart-wrap">
        <canvas class="histogram-chart" aria-label="Histogram distribution chart"></canvas>
      </div>
      <div class="histogram-range-summary">
        <span>Range <strong data-summary="range">—</strong></span>
        <span>Bin width <strong data-summary="width">—</strong></span>
        <span>Outside range <strong data-summary="outside">0</strong></span>
      </div>
      <div class="histogram-table-wrap">
        <table class="histogram-table">
          <thead><tr><th>Bin</th><th>Range</th><th>Samples</th><th>%</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
  page.append(heatmapView.element, scatterView.element);

  const title = page.querySelector<HTMLElement>('.histogram-title');
  const description = page.querySelector<HTMLElement>('.histogram-description');
  const channelSelect = page.querySelector<HTMLSelectElement>('.histogram-channel');
  const binCountSelect = page.querySelector<HTMLSelectElement>('.histogram-bin-count');
  const refreshButton = page.querySelector<HTMLButtonElement>('.histogram-refresh');
  const controls = page.querySelector<HTMLElement>('.histogram-controls');
  const empty = page.querySelector<HTMLElement>('.histogram-empty');
  const content = page.querySelector<HTMLElement>('.histogram-content');
  const canvas = page.querySelector<HTMLCanvasElement>('.histogram-chart');
  const tableBody = page.querySelector<HTMLTableSectionElement>('.histogram-table tbody');
  const viewChoices = [...page.querySelectorAll<HTMLButtonElement>('[data-histogram-view]')];
  if (!title || !description || !channelSelect || !binCountSelect || !refreshButton || !controls || !empty || !content || !canvas || !tableBody) {
    throw new Error('Histogram surface structure is incomplete.');
  }

  const summary = (name: string): HTMLElement => {
    const node = page.querySelector<HTMLElement>(`[data-summary="${name}"]`);
    if (!node) throw new Error(`Histogram summary field is missing: ${name}`);
    return node;
  };

  const selectedTrace = (): HistogramTraceContext | undefined =>
    context.traces.find((trace) => trace.channel.id === channelSelect.value) ?? context.traces[0];

  const hasValidRange = (): boolean =>
    context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;

  const renderChart = (result: NumericHistogramResult, color: string): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (result.bins.length === 0) return;

    const padLeft = 48;
    const padRight = 16;
    const padTop = 18;
    const padBottom = 28;
    const chartWidth = Math.max(1, width - padLeft - padRight);
    const chartHeight = Math.max(1, height - padTop - padBottom);
    const maxCount = Math.max(1, ...result.bins.map((bin) => bin.count));
    const slotWidth = chartWidth / result.bins.length;

    ctx.strokeStyle = 'rgba(91, 118, 136, .42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + chartHeight);
    ctx.lineTo(padLeft + chartWidth, padTop + chartHeight);
    ctx.stroke();

    ctx.fillStyle = '#78909e';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(maxCount), padLeft - 6, padTop + 4);
    ctx.fillText('0', padLeft - 6, padTop + chartHeight);

    ctx.fillStyle = color || '#58aef6';
    result.bins.forEach((bin, index) => {
      const ratio = bin.count / maxCount;
      const barHeight = ratio * chartHeight;
      const x = padLeft + slotWidth * index + Math.max(1, slotWidth * .08);
      const barWidth = Math.max(1, slotWidth * .84);
      const y = padTop + chartHeight - barHeight;
      ctx.fillRect(x, y, barWidth, barHeight);
    });

    ctx.fillStyle = '#78909e';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(formatNumber(result.rangeMin), padLeft, padTop + chartHeight + 7);
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(result.rangeMax), padLeft + chartWidth, padTop + chartHeight + 7);
  };

  const renderTable = (result: NumericHistogramResult, unit: string | undefined): void => {
    const rows = result.bins.map((bin) => {
      const row = document.createElement('tr');
      const percent = result.binnedSampleCount > 0 ? (bin.count / result.binnedSampleCount) * 100 : 0;
      const bracket = bin.includesUpperBound ? ']' : ')';
      row.innerHTML = `
        <td>${bin.index + 1}</td>
        <td>${formatNumber(bin.lowerBound)} – ${formatNumber(bin.upperBound)}${unit ? ` ${unit}` : ''} ${bracket}</td>
        <td>${bin.count.toLocaleString()}</td>
        <td>${percent.toFixed(1)}%</td>
      `;
      return row;
    });
    tableBody.replaceChildren(...rows);
  };

  const renderDistribution = (): void => {
    const trace = selectedTrace();
    if (!trace || !hasValidRange()) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      refreshButton.disabled = true;
      return;
    }

    refreshButton.disabled = false;
    const startMs = Math.min(context.aTimeMs!, context.bTimeMs!);
    const endMs = Math.max(context.aTimeMs!, context.bTimeMs!);
    const channels = new Map([[trace.channel.id, { range: trace.range, complete: trace.complete }]]);
    const qualified = qualifyNumericSamples({
      referenceChannelId: trace.channel.id,
      channels,
      conditions: [],
      timeRange: { startMs, endMs },
    });
    const binCount = Number(binCountSelect.value);
    currentResult = buildNumericHistogram(trace.range, {
      sampleIndices: qualified.eligibleSampleIndices,
      binCount: Number.isFinite(binCount) ? binCount : 20,
    });

    empty.hidden = true;
    content.hidden = false;
    summary('scope').textContent = `${((endMs - startMs) / 1000).toFixed(3)} s`;
    summary('coverage').textContent = qualified.complete ? 'Complete' : 'Partial decoded';
    summary('input').textContent = qualified.inputSampleCount.toLocaleString();
    summary('binned').textContent = currentResult.binnedSampleCount.toLocaleString();
    summary('invalid').textContent = (qualified.invalidSampleCount + currentResult.invalidSampleCount).toLocaleString();
    summary('unavailable').textContent = (qualified.unavailableSampleCount + currentResult.unavailableSampleCount).toLocaleString();
    summary('range').textContent = currentResult.rangeMin === undefined || currentResult.rangeMax === undefined
      ? '—'
      : `${formatNumber(currentResult.rangeMin)} – ${formatNumber(currentResult.rangeMax)}${trace.channel.unit ? ` ${trace.channel.unit}` : ''}`;
    summary('width').textContent = currentResult.binWidth === undefined
      ? '—'
      : `${formatNumber(currentResult.binWidth)}${trace.channel.unit ? ` ${trace.channel.unit}` : ''}`;
    summary('outside').textContent = (currentResult.belowRangeSampleCount + currentResult.aboveRangeSampleCount).toLocaleString();
    renderChart(currentResult, trace.color);
    renderTable(currentResult, trace.channel.unit);
  };

  const renderActiveView = (): void => {
    if (activeView === 'heatmap') heatmapView.refresh();
    else if (activeView === 'scatter') scatterView.refresh();
    else renderDistribution();
  };

  const setActiveView = (nextView: 'distribution' | 'heatmap' | 'scatter'): void => {
    activeView = nextView;
    const distributionActive = activeView === 'distribution';
    const heatmapActive = activeView === 'heatmap';
    const scatterActive = activeView === 'scatter';
    controls.hidden = !distributionActive;
    empty.classList.toggle('histogram-view-hidden', !distributionActive);
    content.classList.toggle('histogram-view-hidden', !distributionActive);
    heatmapView.element.hidden = !heatmapActive;
    scatterView.element.hidden = !scatterActive;

    if (heatmapActive) {
      title.textContent = 'Selected range heatmap';
      description.textContent = 'Two-dimensional sample density across two active decoded channels inside the current Logger A/B range.';
    } else if (scatterActive) {
      title.textContent = 'Selected range scatter';
      description.textContent = 'Aligned X/Y sample pairs across two active decoded channels inside the current Logger A/B range.';
    } else {
      title.textContent = 'Selected range distribution';
      description.textContent = 'Distribution of one active decoded channel inside the current Logger A/B range.';
    }

    for (const choice of viewChoices) {
      const selected = choice.dataset.histogramView === activeView;
      choice.classList.toggle('histogram-view-choice--active', selected);
      choice.setAttribute('aria-pressed', String(selected));
    }
    renderActiveView();
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    const previousChannel = channelSelect.value;
    context = nextContext;
    channelSelect.replaceChildren();
    for (const trace of context.traces) {
      channelSelect.add(new Option(trace.channel.displayName || trace.channel.sourceName, trace.channel.id));
    }
    if (previousChannel && context.traces.some((trace) => trace.channel.id === previousChannel)) {
      channelSelect.value = previousChannel;
    }
    heatmapView.setContext(nextContext);
    scatterView.setContext(nextContext);
    renderActiveView();
  };

  channelSelect.addEventListener('change', renderDistribution);
  binCountSelect.addEventListener('change', renderDistribution);
  refreshButton.addEventListener('click', renderDistribution);
  viewChoices.forEach((choice) => {
    choice.addEventListener('click', () => {
      const view = choice.dataset.histogramView;
      if (view === 'distribution' || view === 'heatmap' || view === 'scatter') setActiveView(view);
    });
  });
  new ResizeObserver(() => {
    if (activeView === 'distribution' && currentResult && !content.hidden && !page.hidden) renderDistribution();
  }).observe(canvas);

  heatmapView.setContext(context);
  scatterView.setContext(context);
  setActiveView('distribution');

  return {
    element: page,
    setContext,
    refresh: renderActiveView,
  };
}
