import { createOwnerEvidence } from '../observability/producers/owner';
import type { ObservabilityRecorder } from '../observability/recorder';
import type { Origin } from '../observability/record';
import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { IniTableEditorDefinition } from '../../../../core/parsers/ini/ini-table-editor-parser';
import { createHistogramTableGeneratorView } from './histogram-table-generator-view';
import { createHistogramDistributionView } from './histogram-distribution-view';
import { createScatterView } from './scatter-view';
import { createHistogramMathChannelsView } from './histogram-math-channels-view';
import { installHistogramHelp } from './histogram-help';
import {
  createHistogramLogicalContext,
  HISTOGRAM_CALCULATED_FIELDS_CHANGED_EVENT,
} from './histogram-logical-context';
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
  setTuneModel(model: TuneModel | undefined, sourceName?: string): void;
  refresh(): void;
}

type HistogramView = 'table' | 'distribution' | 'scatter' | 'math-channels';

export function createHistogramPage(observability?: ObservabilityRecorder): HistogramPageController {
  let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };
  let logicalAnalysisContext = createHistogramLogicalContext(context);
  const ownerEvidence = createOwnerEvidence(observability, 'histogram-router');
  let activeView: HistogramView = 'table';
  let lastIniMappedTable = '';
  let suppressImmediateRefresh = false;
  let contextUpdateGeneration = 0;

  const tableGeneratorView = createHistogramTableGeneratorView(observability);
  const distributionView = createHistogramDistributionView(observability);
  const scatterView = createScatterView(observability);
  const mathChannelsView = createHistogramMathChannelsView(observability);

  const headerControl = document.createElement('label');
  headerControl.className = 'histogram-header-view';
  headerControl.innerHTML = `
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
  page.innerHTML = '<div class="histogram-workspace-body"></div>';

  const body = page.querySelector<HTMLElement>('.histogram-workspace-body');
  const viewSelect = headerControl.querySelector<HTMLSelectElement>('.histogram-view-select');
  if (!body || !viewSelect) throw new Error('Histogram workspace structure is incomplete.');

  body.append(tableGeneratorView.element, distributionView.element, scatterView.element, mathChannelsView.element);
  installHistogramHelp(page);

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

  const refreshLogicalAnalysisContext = (): void => {
    logicalAnalysisContext = createHistogramLogicalContext(context);
  };

  const refreshActive = (): void => {
    ownerEvidence.event('histogram.refresh', { view: activeView }, { visibility: page.hidden ? 'hidden' : 'active' });
    if (activeView === 'table') tableGeneratorView.refresh();
    else if (activeView === 'distribution') distributionView.refresh();
    else if (activeView === 'scatter') scatterView.refresh();
    else mathChannelsView.refresh();
  };

  const setActiveContext = (): void => {
    ownerEvidence.event('histogram.context.deliver', { view: activeView, channels: context.channels.length }, { visibility: page.hidden ? 'hidden' : 'active' });
    if (activeView === 'table') tableGeneratorView.setContext(context);
    else if (activeView === 'distribution') distributionView.setContext(logicalAnalysisContext);
    else if (activeView === 'scatter') scatterView.setContext(logicalAnalysisContext);
    else mathChannelsView.setContext(context);
  };

  const setActiveView = (view: HistogramView, origin: Origin = 'programmatic'): void => {
    if (activeView !== view) observability?.record({ recordKind: 'event', subsystem: 'navigation', component: 'histogram', name: 'navigation.domain.changed', origin, activeView: view, visibility: page.hidden ? 'hidden' : 'active', metadata: { previous: activeView, next: view } });
    activeView = view;
    viewSelect.value = view;
    tableGeneratorView.element.hidden = view !== 'table';
    distributionView.element.hidden = view !== 'distribution';
    scatterView.element.hidden = view !== 'scatter';
    mathChannelsView.setActive(view === 'math-channels');
    if (view === 'distribution' || view === 'scatter') refreshLogicalAnalysisContext();
    setActiveContext();
    if (view === 'table') applyIniTableAxisAuthority(false);
    else if (view === 'math-channels') mathChannelsView.refresh();
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    if (context.tuneTableDefinitions !== nextContext.tuneTableDefinitions || context.tuneModel !== nextContext.tuneModel) lastIniMappedTable = '';
    const generation = ++contextUpdateGeneration;
    suppressImmediateRefresh = true;
    queueMicrotask(() => {
      if (generation === contextUpdateGeneration) suppressImmediateRefresh = false;
    });
    context = nextContext;
    refreshLogicalAnalysisContext();
    setActiveContext();
    if (activeView === 'table') applyIniTableAxisAuthority(false);
  };

  viewSelect.addEventListener('change', (event) => {
    const value = viewSelect.value;
    if (value === 'table' || value === 'distribution' || value === 'scatter' || value === 'math-channels') setActiveView(value, event.isTrusted ? 'user' : 'programmatic');
  });

  page.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.matches('.histogram-table-msq-table')) applyIniTableAxisAuthority(true);
    else if (target.matches('.histogram-table-axis-source') && target.value === 'msq') applyIniTableAxisAuthority(true);
  });

  window.addEventListener(INI_TABLE_DEFINITIONS_CHANGED_EVENT, () => {
    // Explicit context is authoritative. This event remains for standalone
    // callers using the retained storage/cache fallback.
    if (context.tuneTableDefinitions !== undefined) return;
    lastIniMappedTable = '';
    if (activeView === 'table') applyIniTableAxisAuthority(true);
  });

  window.addEventListener(HISTOGRAM_CALCULATED_FIELDS_CHANGED_EVENT, () => {
    refreshLogicalAnalysisContext();
    if (activeView === 'distribution' || activeView === 'scatter') setActiveContext();
  });

  setActiveView('table');

  return {
    element: page,
    headerControl,
    setContext,
    setTuneModel: (model, sourceName) => {
      if (context.tuneModel === model && context.tuneSourceName === sourceName) return;
      const { tuneModel: _previousModel, tuneSourceName: _previousName, ...base } = context;
      const nextContext = {
        ...base,
        ...(model ? { tuneModel: model } : {}),
        ...(sourceName ? { tuneSourceName: sourceName } : {}),
      };
      lastIniMappedTable = '';
      if (activeView === 'table') setContext(nextContext);
      else {
        // Only Table Generator consumes the tune. Retain it for entry without
        // restarting Distribution, Scatter or an unrelated Math preview.
        context = nextContext;
        refreshLogicalAnalysisContext();
      }
    },
    refresh: () => {
      if (suppressImmediateRefresh) {
        suppressImmediateRefresh = false;
        return;
      }
      refreshActive();
    },
  };
}
