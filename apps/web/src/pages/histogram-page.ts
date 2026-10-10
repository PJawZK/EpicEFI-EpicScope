import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { IniTableEditorDefinition } from '../../../../core/parsers/ini/ini-table-editor-parser';
import { createHistogramTableGeneratorView } from './histogram-table-generator-view';
import { createHistogramDistributionView } from './histogram-distribution-view';
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

export function createHistogramPage(): HistogramPageController {
  let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };
  let activeView: HistogramView = 'table';
  let lastIniMappedTable = '';

  const tableGeneratorView = createHistogramTableGeneratorView();
  const distributionView = createHistogramDistributionView();
  const scatterView = createScatterView();
  const mathChannelsView = createHistogramMathChannelsView();

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

  const refreshActive = (): void => {
    if (activeView === 'table') tableGeneratorView.refresh();
    else if (activeView === 'distribution') distributionView.refresh();
    else if (activeView === 'scatter') scatterView.refresh();
    else mathChannelsView.refresh();
  };

  const setActiveContext = (): void => {
    if (activeView === 'table') tableGeneratorView.setContext(context);
    else if (activeView === 'distribution') distributionView.setContext(context);
    else if (activeView === 'scatter') scatterView.setContext(context);
    else mathChannelsView.setContext(context);
  };

  const setActiveView = (view: HistogramView): void => {
    activeView = view;
    viewSelect.value = view;
    tableGeneratorView.element.hidden = view !== 'table';
    distributionView.element.hidden = view !== 'distribution';
    scatterView.element.hidden = view !== 'scatter';
    mathChannelsView.element.hidden = view !== 'math-channels';
    setActiveContext();
    if (view === 'table') applyIniTableAxisAuthority(false);
    else if (view === 'math-channels') mathChannelsView.refresh();
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    context = nextContext;
    setActiveContext();
    if (activeView === 'table') applyIniTableAxisAuthority(false);
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

  setActiveView('table');

  return {
    element: page,
    headerControl,
    setContext,
    refresh: refreshActive,
  };
}
