import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { IniTableEditorDefinition } from '../../../../core/parsers/ini/ini-table-editor-parser';
import { buildNumericHistogram, type NumericHistogramResult } from '../../../../core/analysis/histogram';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { createHistogramTableGeneratorView } from './histogram-table-generator-view';
import { createScatterView } from './scatter-view';
import { createHistogramMathChannelsView } from './histogram-math-channels-view';
import {
  INI_TABLE_DEFINITIONS_CHANGED_EVENT,
  loadIniTableEditorDefinitions,
} from '../state/ini-table-editor-storage';

export interface HistogramTraceContext {
  readonly channel: ChannelDefinition;
  readonly range: NumericChannelRange;
  readonly complete: boolean;
  readonly color: string;
}

export interface HistogramPageContext {
  readonly traces: readonly HistogramTraceContext[];
  readonly channels: readonly ChannelDefinition[];
  readonly loadTraces: (channelIds: readonly string[], startMs?: number, endMs?: number) => Promise<readonly HistogramTraceContext[]>;
  readonly aTimeMs: number | undefined;
  readonly bTimeMs: number | undefined;
  readonly savedRanges?: readonly import('../state/workspace-state').SavedTimelineRangeState[];
  readonly tuneModel?: TuneModel;
  readonly tuneSourceName?: string;
  readonly tuneTableDefinitions?: readonly IniTableEditorDefinition[];
  readonly openSamplesInLogger?: (request: {
    readonly sampleIndices: readonly number[];
    readonly timeMs: readonly number[];
    readonly label: string;
  }) => void | Promise<void>;
}

export interface HistogramPageController {
  readonly element: HTMLElement;
  readonly headerControl: HTMLElement;
  setContext(context: HistogramPageContext): void;
  refresh(): void;
}

type HistogramView = 'table' | 'distribution' | 'scatter' | 'math-channels';

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

export function createHistogramPage(): HistogramPageController {
  let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };
  let currentResult: NumericHistogramResult | undefined;
  let currentTrace: HistogramTraceContext | undefined;
  let activeView: HistogramView = 'table';
  let lastIniMappedTable = '';
  const tableGeneratorView = createHistogramTableGeneratorView();
  const scatterView = createScatterView();
  const mathChannelsView = createHistogramMathChannelsView();

  const headerControl = document.createElement('label');
  headerControl.className = 'histogram-header-view';
  headerControl.innerHTML = `
    <span>Analysis</span>
    <select class="histogram-view-select" aria-label="Histogram analysis view">
      <option value="table" selected>Table Generator</option>
      <option value="distribution">Distribution</option>
      <option value="scatter">Scatter</option>
      <option value="math-channels">Math Channels</option>
    </select>
  `;

  const page = document.createElement('main');
  page.className = 'histogram-page histogram-page--workspace';
  page.hidden = true;
  page.innerHTML = `
    <div class="histogram-workspace-bar">
      <div class="histogram-distribution-controls" hidden>
        <label><span>Channel</span><select class="histogram-channel"></select></label>
        <label><span>Bins</span><select class="histogram-bin-count"><option>10</option><option selected>20</option><option>30</option><option>40</option><option>60</option></select></label>
      </div>
      <div class="histogram-workspace-hint">MLV-style table generation · all available log channels · selected channels decode on demand</div>
    </div>
    <div class="histogram-workspace-body">
      <section class="histogram-distribution-stage" hidden>
        <div class="histogram-empty">
          <strong>Distribution needs a selected range.</strong>
          <span>Set A and B in Logger, then select any available log channel here.</span>
        </div>
        <canvas class="histogram-chart" aria-label="Histogram distribution chart"></canvas>
        <div class="histogram-stage-status" hidden>
          <span data-summary="scope">—</span>
          <span data-summary="coverage">—</span>
          <span>Input <strong data-summary="input">0</strong></span>
          <span>Binned <strong data-summary="binned">0</strong></span>
          <span>Range <strong data-summary="range">—</strong></span>
          <span>Bin <strong data-summary="width">—</strong></span>
        </div>
      </section>
    </div>
  `;

  const body = page.querySelector<HTMLElement>('.histogram-workspace-body');
  const viewSelect = headerControl.querySelector<HTMLSelectElement>('.histogram-view-select');
  const distributionControls = page.querySelector<HTMLElement>('.histogram-distribution-controls');
  const distributionStage = page.querySelector<HTMLElement>('.histogram-distribution-stage');
  const channelSelect = page.querySelector<HTMLSelectElement>('.histogram-channel');
  const binCountSelect = page.querySelector<HTMLSelectElement>('.histogram-bin-count');
  const empty = distributionStage?.querySelector<HTMLElement>('.histogram-empty');
  const status = distributionStage?.querySelector<HTMLElement>('.histogram-stage-status');
  const canvas = distributionStage?.querySelector<HTMLCanvasElement>('.histogram-chart');
  if (!body || !viewSelect || !distributionControls || !distributionStage || !channelSelect || !binCountSelect || !empty || !status || !canvas) {
    throw new Error('Histogram workspace structure is incomplete.');
  }
  body.append(tableGeneratorView.element, scatterView.element, mathChannelsView.element);

  const summary = (name: string): HTMLElement => {
    const node = distributionStage.querySelector<HTMLElement>(`[data-summary="${name}"]`);
    if (!node) throw new Error(`Histogram summary field is missing: ${name}`);
    return node;
  };

  const hasValidRange = (): boolean => context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;

  const setSelectValueCaseInsensitive = (select: HTMLSelectElement, wanted: string): boolean => {
    const lowered = wanted.toLocaleLowerCase();
    const option = [...select.options].find((candidate) => candidate.value.toLocaleLowerCase() === lowered);
    if (!option) return false;
    select.value = option.value;
    return true;
  };

  const applyIniTableAxisAuthority = (force = false): void => {
    if (!context.tuneModel || !context.channels.some((channel) => channel.id.startsWith('ini:'))) return;
    const tableSelect = page.querySelector<HTMLSelectElement>('.histogram-table-msq-table');
    const xAxisSelect = page.querySelector<HTMLSelectElement>('.histogram-table-msq-x-axis');
    const yAxisSelect = page.querySelector<HTMLSelectElement>('.histogram-table-msq-y-axis');
    if (!tableSelect?.value || !xAxisSelect || !yAxisSelect) return;
    if (!force && lastIniMappedTable === tableSelect.value) return;

    const definitions = context.tuneTableDefinitions ?? loadIniTableEditorDefinitions();
    const tableName = tableSelect.value;
    const loweredTable = tableName.toLocaleLowerCase();
    const definition = definitions.find((candidate) => candidate.zBins === tableName)
      ?? definitions.find((candidate) => candidate.zBins.toLocaleLowerCase() === loweredTable);
    if (!definition) {
      lastIniMappedTable = tableName;
      return;
    }

    const xResolved = setSelectValueCaseInsensitive(xAxisSelect, definition.xBins);
    const yResolved = setSelectValueCaseInsensitive(yAxisSelect, definition.yBins);

    lastIniMappedTable = tableName;
    if (xResolved) xAxisSelect.dispatchEvent(new Event('change'));
    if (yResolved) yAxisSelect.dispatchEvent(new Event('change'));
  };

  const renderChart = (result: NumericHistogramResult, trace: HistogramTraceContext): void => {
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

    const padLeft = 50;
    const padRight = 14;
    const padTop = 18;
    const padBottom = 38;
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

    result.bins.forEach((bin, index) => {
      const ratio = bin.count / maxCount;
      const barHeight = ratio * chartHeight;
      const x = padLeft + slotWidth * index + Math.max(1, slotWidth * .06);
      const barWidth = Math.max(1, slotWidth * .88);
      const y = padTop + chartHeight - barHeight;
      ctx.fillStyle = trace.color || '#58aef6';
      ctx.globalAlpha = .86;
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.globalAlpha = 1;
      if (barWidth >= 22 && bin.count > 0) {
        ctx.fillStyle = '#eaf5fa';
        ctx.font = '600 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(bin.count.toLocaleString(), x + barWidth / 2, Math.max(padTop + 10, y - 3), barWidth + 10);
      }
    });

    ctx.fillStyle = '#78909e';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(maxCount.toLocaleString(), padLeft - 6, padTop + 4);
    ctx.fillText('0', padLeft - 6, padTop + chartHeight);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(formatNumber(result.rangeMin), padLeft, padTop + chartHeight + 6);
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(result.rangeMax), padLeft + chartWidth, padTop + chartHeight + 6);
    ctx.textAlign = 'center';
    ctx.fillText(`${trace.channel.displayName || trace.channel.sourceName}${trace.channel.unit ? ` · ${trace.channel.unit}` : ''}`, padLeft + chartWidth / 2, padTop + chartHeight + 21);
  };

  const renderDistribution = async (): Promise<void> => {
    const channelId = channelSelect.value || context.channels[0]?.id;
    if (!channelId || !hasValidRange()) {
      currentResult = undefined;
      currentTrace = undefined;
      empty.hidden = false;
      canvas.hidden = true;
      status.hidden = true;
      return;
    }

    const startMs = Math.min(context.aTimeMs!, context.bTimeMs!);
    const endMs = Math.max(context.aTimeMs!, context.bTimeMs!);
    const [trace] = await context.loadTraces([channelId], startMs, endMs);
    if (!trace) {
      currentResult = undefined;
      currentTrace = undefined;
      empty.hidden = false;
      canvas.hidden = true;
      status.hidden = true;
      return;
    }
    const channels = new Map([[trace.channel.id, { range: trace.range, complete: trace.complete }]]);
    const qualified = qualifyNumericSamples({ referenceChannelId: trace.channel.id, channels, conditions: [], timeRange: { startMs, endMs } });
    const binCount = Number(binCountSelect.value);
    currentResult = buildNumericHistogram(trace.range, { sampleIndices: qualified.eligibleSampleIndices, binCount: Number.isFinite(binCount) ? binCount : 20 });
    currentTrace = trace;

    empty.hidden = true;
    canvas.hidden = false;
    status.hidden = false;
    summary('scope').textContent = `A/B ${((endMs - startMs) / 1000).toFixed(3)} s`;
    summary('coverage').textContent = qualified.complete ? 'Complete' : 'Partial decoded';
    summary('input').textContent = qualified.inputSampleCount.toLocaleString();
    summary('binned').textContent = currentResult.binnedSampleCount.toLocaleString();
    summary('range').textContent = currentResult.rangeMin === undefined || currentResult.rangeMax === undefined
      ? '—'
      : `${formatNumber(currentResult.rangeMin)}–${formatNumber(currentResult.rangeMax)}${trace.channel.unit ? ` ${trace.channel.unit}` : ''}`;
    summary('width').textContent = currentResult.binWidth === undefined ? '—' : `${formatNumber(currentResult.binWidth)}${trace.channel.unit ? ` ${trace.channel.unit}` : ''}`;
    renderChart(currentResult, trace);
  };

  const refreshActive = (): void => {
    if (activeView === 'table') tableGeneratorView.refresh();
    else if (activeView === 'distribution') void renderDistribution();
    else if (activeView === 'scatter') scatterView.refresh();
    else mathChannelsView.refresh();
  };

  const setActiveView = (view: HistogramView): void => {
    activeView = view;
    viewSelect.value = view;
    const distribution = view === 'distribution';
    distributionControls.hidden = !distribution;
    distributionStage.hidden = !distribution;
    tableGeneratorView.element.hidden = view !== 'table';
    scatterView.element.hidden = view !== 'scatter';
    mathChannelsView.element.hidden = view !== 'math-channels';
    refreshActive();
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    const previousChannel = channelSelect.value;
    context = nextContext;
    channelSelect.replaceChildren();
    for (const channel of context.channels) channelSelect.add(new Option(channel.displayName || channel.sourceName, channel.id));
    if (previousChannel && context.channels.some((channel) => channel.id === previousChannel)) channelSelect.value = previousChannel;
    tableGeneratorView.setContext(nextContext);
    scatterView.setContext(nextContext);
    mathChannelsView.setContext(nextContext);
    applyIniTableAxisAuthority(false);
    refreshActive();
  };

  viewSelect.addEventListener('change', () => {
    const value = viewSelect.value;
    if (value === 'table' || value === 'distribution' || value === 'scatter' || value === 'math-channels') setActiveView(value);
  });
  page.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.matches('.histogram-table-msq-table')) applyIniTableAxisAuthority(true);
    else if (target.matches('.histogram-table-axis-source') && target.value === 'msq') applyIniTableAxisAuthority(true);
  });
  window.addEventListener(INI_TABLE_DEFINITIONS_CHANGED_EVENT, () => {
    lastIniMappedTable = '';
    applyIniTableAxisAuthority(true);
  });
  channelSelect.addEventListener('change', () => { void renderDistribution(); });
  binCountSelect.addEventListener('change', () => { void renderDistribution(); });
  new ResizeObserver(() => {
    if (activeView === 'distribution' && currentResult && currentTrace && !canvas.hidden && !page.hidden) renderChart(currentResult, currentTrace);
  }).observe(canvas);

  tableGeneratorView.setContext(context);
  scatterView.setContext(context);
  mathChannelsView.setContext(context);
  setActiveView('table');

  return { element: page, headerControl, setContext, refresh: refreshActive };
}
