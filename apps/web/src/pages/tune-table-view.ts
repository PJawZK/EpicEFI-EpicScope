import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { TuneModel, TuneEntry } from '../../../../core/tune/tune-model';
import {
  correlateNumericSamplesToTuneTable,
  createTuneTable2D,
  type TuneTableCorrelationResult,
} from '../../../../core/tune/table-correlation';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';

export interface TuneTableViewController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  setTuneModel(model: TuneModel | undefined, sourceName?: string): void;
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

function numericCandidates(model: TuneModel | undefined): readonly TuneEntry[] {
  return model?.entries.filter((entry) => entry.numericValues !== undefined) ?? [];
}

function tableCandidates(model: TuneModel | undefined): readonly TuneEntry[] {
  return model?.entries.filter((entry) => entry.kind === 'table' && entry.numericValues !== undefined) ?? [];
}

export function createTuneTableView(): TuneTableViewController {
  let context: LoggerAnalysisContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let tuneModel: TuneModel | undefined;
  let tuneSourceName: string | undefined;
  let currentResult: TuneTableCorrelationResult | undefined;

  const root = document.createElement('section');
  root.className = 'tune-table-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="tune-table-identity">
      <div><span>Tune</span><strong data-tune-table="source">No MSQ loaded</strong></div>
      <div><span>Signature</span><strong data-tune-table="signature">—</strong></div>
      <div><span>Compatibility</span><strong>Not verified against INI</strong></div>
    </div>
    <div class="tune-table-controls">
      <label><span>Table</span><select class="tune-table-table"></select></label>
      <label><span>X axis</span><select class="tune-table-x-axis"></select></label>
      <label><span>Y axis</span><select class="tune-table-y-axis"></select></label>
      <label><span>X channel</span><select class="tune-table-x-channel"></select></label>
      <label><span>Y channel</span><select class="tune-table-y-channel"></select></label>
      <label><span>Observed</span><select class="tune-table-observed-channel"></select></label>
      <label><span>Scope</span><select class="tune-table-scope"></select></label>
      <label class="tune-table-error-toggle"><input type="checkbox" class="tune-table-error" /><span>Observed − Tune</span></label>
      <button type="button" class="tune-table-refresh">Refresh</button>
    </div>
    <div class="tune-table-note">Table-to-axis relationships are explicit in this first pass. Select the MSQ table and its X/Y axis entries rather than relying on name guessing.</div>
    <div class="tune-table-empty">
      <strong>Tune Table needs an MSQ tune, active decoded traces, and a valid scope.</strong>
      <span>Load an MSQ from Load Data, keep the required X/Y/observed channels active in Logger, and select A/B or a saved range.</span>
    </div>
    <div class="tune-table-content" hidden>
      <div class="tune-table-summary">
        <div><span>Scope</span><strong data-tune-table="scope">—</strong></div>
        <div><span>Coverage</span><strong data-tune-table="coverage">—</strong></div>
        <div><span>Input</span><strong data-tune-table="input">0</strong></div>
        <div><span>Mapped</span><strong data-tune-table="mapped">0</strong></div>
        <div><span>Invalid</span><strong data-tune-table="invalid">0</strong></div>
        <div><span>Unavailable</span><strong data-tune-table="unavailable">0</strong></div>
      </div>
      <div class="tune-table-result-wrap">
        <table class="tune-table-result">
          <thead>
            <tr><th>Row</th><th>Col</th><th>X</th><th>Y</th><th>Tune cell</th><th>Samples</th><th>Observed mean</th><th>Std dev</th><th>Mean interp tune</th><th class="tune-table-error-head" hidden>Mean error</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  const tableSelect = root.querySelector<HTMLSelectElement>('.tune-table-table');
  const xAxisSelect = root.querySelector<HTMLSelectElement>('.tune-table-x-axis');
  const yAxisSelect = root.querySelector<HTMLSelectElement>('.tune-table-y-axis');
  const xChannelSelect = root.querySelector<HTMLSelectElement>('.tune-table-x-channel');
  const yChannelSelect = root.querySelector<HTMLSelectElement>('.tune-table-y-channel');
  const observedSelect = root.querySelector<HTMLSelectElement>('.tune-table-observed-channel');
  const scopeSelect = root.querySelector<HTMLSelectElement>('.tune-table-scope');
  const errorToggle = root.querySelector<HTMLInputElement>('.tune-table-error');
  const refreshButton = root.querySelector<HTMLButtonElement>('.tune-table-refresh');
  const empty = root.querySelector<HTMLElement>('.tune-table-empty');
  const content = root.querySelector<HTMLElement>('.tune-table-content');
  const tbody = root.querySelector<HTMLTableSectionElement>('.tune-table-result tbody');
  const errorHead = root.querySelector<HTMLElement>('.tune-table-error-head');
  if (!tableSelect || !xAxisSelect || !yAxisSelect || !xChannelSelect || !yChannelSelect || !observedSelect || !scopeSelect || !errorToggle || !refreshButton || !empty || !content || !tbody || !errorHead) {
    throw new Error('Tune Table view structure is incomplete.');
  }

  const field = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-tune-table="${name}"]`);
    if (!node) throw new Error(`Tune Table field is missing: ${name}`);
    return node;
  };

  const traceFor = (channelId: string): LoggerAnalysisTraceContext | undefined =>
    context.traces.find((trace) => trace.channel.id === channelId);

  const selectedScope = (): { label: string; startMs: number; endMs: number } | undefined => {
    if (scopeSelect.value === 'ab') {
      if (context.aTimeMs === undefined || context.bTimeMs === undefined || context.aTimeMs === context.bTimeMs) return undefined;
      return { label: 'Current A/B', startMs: context.aTimeMs, endMs: context.bTimeMs };
    }
    if (!scopeSelect.value.startsWith('saved:')) return undefined;
    const index = Number(scopeSelect.value.slice('saved:'.length));
    const saved = Number.isInteger(index) ? context.savedRanges[index] : undefined;
    return saved ? { label: saved.label, startMs: saved.startMs, endMs: saved.endMs } : undefined;
  };

  const fillTraceSelect = (select: HTMLSelectElement, preferred: string, fallbackIndex: number): void => {
    select.replaceChildren();
    for (const trace of context.traces) select.add(new Option(channelLabel(trace), trace.channel.id));
    if (context.traces.some((trace) => trace.channel.id === preferred)) select.value = preferred;
    else if (context.traces[fallbackIndex]) select.value = context.traces[fallbackIndex]!.channel.id;
  };

  const fillScopeSelect = (preferred: string): void => {
    scopeSelect.replaceChildren();
    const hasAb = context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;
    if (hasAb) scopeSelect.add(new Option('Current A/B', 'ab'));
    context.savedRanges.forEach((range, index) => scopeSelect.add(new Option(range.label, `saved:${index}`)));
    const values = [...scopeSelect.options].map((option) => option.value);
    if (values.includes(preferred)) scopeSelect.value = preferred;
  };

  const fillTuneSelectors = (preferredTable: string, preferredX: string, preferredY: string): void => {
    tableSelect.replaceChildren();
    xAxisSelect.replaceChildren();
    yAxisSelect.replaceChildren();
    for (const entry of tableCandidates(tuneModel)) tableSelect.add(new Option(entry.name, entry.name));
    for (const entry of numericCandidates(tuneModel)) {
      xAxisSelect.add(new Option(entry.name, entry.name));
      yAxisSelect.add(new Option(entry.name, entry.name));
    }
    if ([...tableSelect.options].some((option) => option.value === preferredTable)) tableSelect.value = preferredTable;
    if ([...xAxisSelect.options].some((option) => option.value === preferredX)) xAxisSelect.value = preferredX;
    if ([...yAxisSelect.options].some((option) => option.value === preferredY)) yAxisSelect.value = preferredY;
    syncAxisCandidates();
  };

  const syncAxisCandidates = (): void => {
    const selected = tuneModel?.byName.get(tableSelect.value);
    if (!selected || selected.kind !== 'table') return;
    const previousX = xAxisSelect.value;
    const previousY = yAxisSelect.value;
    const candidates = numericCandidates(tuneModel);
    const xCandidates = candidates.filter((entry) => entry.numericValues?.length === selected.cols);
    const yCandidates = candidates.filter((entry) => entry.numericValues?.length === selected.rows);
    xAxisSelect.replaceChildren(...xCandidates.map((entry) => new Option(entry.name, entry.name)));
    yAxisSelect.replaceChildren(...yCandidates.map((entry) => new Option(entry.name, entry.name)));
    if (xCandidates.some((entry) => entry.name === previousX)) xAxisSelect.value = previousX;
    if (yCandidates.some((entry) => entry.name === previousY)) yAxisSelect.value = previousY;
  };

  const render = (): void => {
    field('source').textContent = tuneSourceName ?? 'No MSQ loaded';
    field('signature').textContent = tuneModel?.identity.signature ?? tuneModel?.identity.firmwareInfo ?? '—';

    const scope = selectedScope();
    const xTrace = traceFor(xChannelSelect.value) ?? context.traces[0];
    const yTrace = traceFor(yChannelSelect.value) ?? context.traces[1] ?? context.traces[0];
    const observedTrace = traceFor(observedSelect.value) ?? context.traces[2] ?? context.traces[0];
    if (!tuneModel || !scope || !xTrace || !yTrace || !observedTrace || !tableSelect.value || !xAxisSelect.value || !yAxisSelect.value) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      refreshButton.disabled = true;
      return;
    }

    let table;
    try {
      table = createTuneTable2D(tuneModel, {
        tableName: tableSelect.value,
        xAxisName: xAxisSelect.value,
        yAxisName: yAxisSelect.value,
      });
    } catch (error) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      empty.querySelector('strong')!.textContent = error instanceof Error ? error.message : 'Tune table mapping is invalid.';
      refreshButton.disabled = false;
      return;
    }

    const startMs = Math.min(scope.startMs, scope.endMs);
    const endMs = Math.max(scope.startMs, scope.endMs);
    const channels = new Map([[xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete }]]);
    const scoped = qualifyNumericSamples({
      referenceChannelId: xTrace.channel.id,
      channels,
      conditions: [],
      timeRange: { startMs, endMs },
    });
    const yComplete = yTrace.complete || numericRangeCoversTime(yTrace.range, startMs, endMs);
    const observedComplete = observedTrace.complete || numericRangeCoversTime(observedTrace.range, startMs, endMs);

    currentResult = correlateNumericSamplesToTuneTable(
      table,
      xTrace.range,
      yTrace.range,
      observedTrace.range,
      {
        sampleIndices: scoped.eligibleSampleIndices,
        complete: scoped.complete && yComplete && observedComplete,
        valueRelation: errorToggle.checked ? 'observed-minus-tune' : 'none',
      },
    );

    empty.hidden = true;
    content.hidden = false;
    refreshButton.disabled = false;
    field('scope').textContent = `${scope.label} · ${((endMs - startMs) / 1000).toFixed(3)} s`;
    field('coverage').textContent = currentResult.complete ? 'Complete' : 'Partial decoded';
    field('input').textContent = currentResult.inputSampleCount.toLocaleString();
    field('mapped').textContent = currentResult.mappedSampleCount.toLocaleString();
    field('invalid').textContent = currentResult.invalidSampleCount.toLocaleString();
    field('unavailable').textContent = currentResult.unavailableSampleCount.toLocaleString();

    errorHead.hidden = !errorToggle.checked;
    const rows = currentResult.cells.filter((cell) => cell.sampleCount > 0);
    tbody.replaceChildren(...rows.map((cell) => {
      const tr = document.createElement('tr');
      const x = table.xAxis[cell.col];
      const y = table.yAxis[cell.row];
      const errorCell = errorToggle.checked ? `<td>${formatNumber(cell.meanError)}</td>` : '';
      tr.innerHTML = `
        <td>${cell.row}</td><td>${cell.col}</td>
        <td>${formatNumber(x)}</td><td>${formatNumber(y)}</td>
        <td>${formatNumber(cell.tuneValue)}</td><td>${cell.sampleCount.toLocaleString()}</td>
        <td>${formatNumber(cell.observedMean)}</td><td>${formatNumber(cell.observedStandardDeviation)}</td>
        <td>${formatNumber(cell.meanInterpolatedTuneValue)}</td>${errorCell}
      `;
      return tr;
    }));
  };

  const setContext = (nextContext: LoggerAnalysisContext): void => {
    const previousX = xChannelSelect.value;
    const previousY = yChannelSelect.value;
    const previousObserved = observedSelect.value;
    const previousScope = scopeSelect.value;
    context = nextContext;
    fillTraceSelect(xChannelSelect, previousX, 0);
    fillTraceSelect(yChannelSelect, previousY, 1);
    fillTraceSelect(observedSelect, previousObserved, 2);
    fillScopeSelect(previousScope);
    render();
  };

  const setTuneModel = (model: TuneModel | undefined, sourceName?: string): void => {
    const previousTable = tableSelect.value;
    const previousX = xAxisSelect.value;
    const previousY = yAxisSelect.value;
    tuneModel = model;
    tuneSourceName = sourceName;
    fillTuneSelectors(previousTable, previousX, previousY);
    render();
  };

  tableSelect.addEventListener('change', () => { syncAxisCandidates(); render(); });
  xAxisSelect.addEventListener('change', render);
  yAxisSelect.addEventListener('change', render);
  xChannelSelect.addEventListener('change', render);
  yChannelSelect.addEventListener('change', render);
  observedSelect.addEventListener('change', render);
  scopeSelect.addEventListener('change', render);
  errorToggle.addEventListener('change', render);
  refreshButton.addEventListener('click', render);

  return { element: root, setContext, setTuneModel, refresh: render };
}
