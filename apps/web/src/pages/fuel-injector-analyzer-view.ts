import { analyzeFuelPressureArchitecture, type FuelPressureArchitecture } from '../../../../core/analysis/fuel-pressure-architecture';
import { analyzeFuelPressureInjector } from '../../../../core/analysis/specialized-analyzers';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { suggestAnalyzerChannel } from './analyzer-channel-roles';

export interface FuelInjectorAnalyzerViewController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  refresh(): void;
}

type RoleKey = 'reference' | 'fuelPressure' | 'railDiff' | 'fuelPressureHigh' | 'pw' | 'duty' | 'deadtime';

const ROLES: readonly { key: RoleKey; label: string; required?: boolean }[] = [
  { key: 'reference', label: 'Reference sample grid', required: true },
  { key: 'fuelPressure', label: 'Low-side fuel pressure' },
  { key: 'railDiff', label: 'Rail differential' },
  { key: 'fuelPressureHigh', label: 'High-side / GDI fuel pressure' },
  { key: 'pw', label: 'Injector PW' },
  { key: 'duty', label: 'Injector duty' },
  { key: 'deadtime', label: 'Injector deadtime' },
];

function numberText(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function timeText(ms: number): string {
  return `${(ms / 1000).toFixed(3)} s`;
}

export function createFuelInjectorAnalyzerView(): FuelInjectorAnalyzerViewController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let generation = 0;
  const remembered = new Map<string, string>();

  const root = document.createElement('section');
  root.className = 'specialized-analyzer-view fuel-injector-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="specialized-analyzer-banner">
      <div><strong>Fuel Pressure / Injector · Experimental</strong><span>Architecture-aware pressure and injector evidence. Conventional systems use rail differential; GDI systems use high-side rail pressure while retaining low-side supply context.</span></div>
      <span class="specialized-analyzer-badge">EXP</span>
    </div>
    <div class="specialized-analyzer-controls"></div>
    <div class="specialized-analyzer-guidance"><strong data-fuel-injector="guidance-title"></strong><span data-fuel-injector="guidance-text"></span></div>
    <details class="specialized-analyzer-options" open>
      <summary>Analysis thresholds</summary>
      <div class="specialized-analyzer-options-grid">
        <label><span>Conventional min rail differential</span><input type="number" step="any" data-option="conventionalMinimum" placeholder="optional"></label>
        <label><span>GDI min high-side pressure</span><input type="number" step="any" data-option="gdiMinimum" placeholder="optional"></label>
        <label><span>High duty threshold</span><input type="number" step="0.1" data-option="highDuty" value="90"></label>
      </div>
    </details>
    <div class="specialized-analyzer-empty">
      <strong>Select the reference sample grid before analyzing.</strong>
      <span>Optional channels can remain unselected. Pressure verdicts are only produced from the pressure domain required by the selected fuel-system architecture.</span>
    </div>
    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary"></div>
      <section class="specialized-analyzer-events">
        <header><strong>Pressure / injector review events</strong><span data-fuel-injector="event-count">0</span></header>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table"><thead></thead><tbody></tbody></table>
        </div>
      </section>
    </div>
  `;

  const controls = root.querySelector<HTMLElement>('.specialized-analyzer-controls');
  const summary = root.querySelector<HTMLElement>('.specialized-analyzer-summary');
  const empty = root.querySelector<HTMLElement>('.specialized-analyzer-empty');
  const content = root.querySelector<HTMLElement>('.specialized-analyzer-content');
  const tableHead = root.querySelector<HTMLTableSectionElement>('.specialized-analyzer-table thead');
  const tableBody = root.querySelector<HTMLTableSectionElement>('.specialized-analyzer-table tbody');
  const conventionalMinimum = root.querySelector<HTMLInputElement>('input[data-option="conventionalMinimum"]');
  const gdiMinimum = root.querySelector<HTMLInputElement>('input[data-option="gdiMinimum"]');
  const highDuty = root.querySelector<HTMLInputElement>('input[data-option="highDuty"]');
  if (!controls || !summary || !empty || !content || !tableHead || !tableBody || !conventionalMinimum || !gdiMinimum || !highDuty) throw new Error('Fuel / Injector analyzer structure is incomplete.');

  const field = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-fuel-injector="${name}"]`);
    if (!node) throw new Error(`Fuel / Injector analyzer field missing: ${name}`);
    return node;
  };

  const roleSelect = (key: RoleKey): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>(`select[data-role="${key}"]`) ?? undefined;
  const architectureSelect = (): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>('select[data-role="fuel-system"]') ?? undefined;

  const optionNumber = (input: HTMLInputElement, fallback?: number): number | undefined => {
    const text = input.value.trim();
    if (!text) return fallback;
    const value = Number(text);
    return Number.isFinite(value) ? value : fallback;
  };

  const currentArchitecture = (): FuelPressureArchitecture => architectureSelect()?.value === 'gdi' ? 'gdi' : 'conventional';

  const updateModeUi = (): void => {
    const architecture = currentArchitecture();
    conventionalMinimum.disabled = architecture !== 'conventional';
    gdiMinimum.disabled = architecture !== 'gdi';
    field('guidance-title').textContent = architecture === 'gdi' ? 'GDI / high-pressure mode' : 'Conventional / port-injection mode';
    field('guidance-text').textContent = architecture === 'gdi'
      ? 'High-side rail pressure is the active pressure evidence. Low-side pressure remains supply context. Rail differential is shown as context but is not used to create GDI low-pressure events.'
      : 'Rail differential is the active pressure evidence. High-side/GDI pressure is shown as context only and cannot create conventional low-pressure events.';
  };

  const selectedScopeInfo = (reference: LoggerAnalysisTraceContext, selected: readonly LoggerAnalysisTraceContext[]) => {
    const scopeSelect = controls.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    const scope = scopeSelect ? selectedAnalyzerScope(scopeSelect, context) : undefined;
    if (!scope) return undefined;
    const { startMs, endMs } = analyzerScopeBounds(scope);
    const channels = new Map([[reference.channel.id, { range: reference.range, complete: reference.complete }]]);
    const qualified = qualifyNumericSamples({
      referenceChannelId: reference.channel.id,
      channels,
      conditions: [],
      ...(startMs !== undefined && endMs !== undefined ? { timeRange: { startMs, endMs } } : {}),
    });
    const complete = qualified.complete && selected.every((trace) => {
      if (startMs === undefined || endMs === undefined) return trace.complete;
      return trace.complete || numericRangeCoversTime(trace.range, startMs, endMs);
    });
    return { scope, sampleIndices: qualified.eligibleSampleIndices, complete, startMs, endMs };
  };

  const renderSummary = (items: readonly [string, string][]): void => {
    summary.replaceChildren(...items.map(([label, value]) => {
      const div = document.createElement('div');
      const caption = document.createElement('span');
      caption.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      div.append(caption, strong);
      return div;
    }));
  };

  const renderEvents = (events: readonly { type: string; event: { startSampleIndex: number; endSampleIndex: number; startTimeMs: number; endTimeMs: number; durationMs: number; extremeValue: number } }[]): void => {
    field('event-count').textContent = events.length.toLocaleString();
    const headers = ['#', 'Type', 'Start', 'End', 'Duration', 'Extreme'];
    const headerRow = document.createElement('tr');
    for (const header of headers) {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.append(th);
    }
    tableHead.replaceChildren(headerRow);
    if (!events.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = headers.length;
      cell.textContent = 'No pressure or high-duty review events were found for the selected architecture and thresholds.';
      row.append(cell);
      tableBody.replaceChildren(row);
      return;
    }
    tableBody.replaceChildren(...events.slice(0, 200).map(({ type, event }, index) => {
      const row = document.createElement('tr');
      const values = [String(index + 1), type, timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.extremeValue)];
      for (const value of values) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      if (context.openSamplesInLogger) {
        row.classList.add('specialized-analyzer-event-row--navigable');
        row.tabIndex = 0;
        row.title = 'Double-click or press Enter to open this event in Logger';
        const open = (): void => context.openSamplesInLogger?.({
          sampleIndices: event.startSampleIndex === event.endSampleIndex ? [event.startSampleIndex] : [event.startSampleIndex, event.endSampleIndex],
          timeMs: event.startTimeMs === event.endTimeMs ? [event.startTimeMs] : [event.startTimeMs, event.endTimeMs],
          label: `${type} ${index + 1}`,
        });
        row.addEventListener('dblclick', open);
        row.addEventListener('keydown', (keyEvent) => {
          if (keyEvent.key === 'Enter') { keyEvent.preventDefault(); open(); }
        });
      }
      return row;
    }));
  };

  const analyze = async (): Promise<void> => {
    const run = ++generation;
    const selected = new Map<RoleKey, string>();
    for (const role of ROLES) {
      const id = roleSelect(role.key)?.value;
      if (id) selected.set(role.key, id);
      if (role.required && !id) {
        empty.hidden = false;
        content.hidden = true;
        return;
      }
    }
    const referenceId = selected.get('reference');
    if (!referenceId) return;
    const scopeSelect = controls.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    const scope = scopeSelect ? selectedAnalyzerScope(scopeSelect, context) : undefined;
    if (!scope) return;
    const bounds = analyzerScopeBounds(scope);
    const loaded = await context.loadTraces([...selected.values()], bounds.startMs, bounds.endMs);
    if (run !== generation) return;
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const traces = new Map<RoleKey, LoggerAnalysisTraceContext>();
    for (const [key, id] of selected) {
      const trace = byId.get(id);
      if (trace) traces.set(key, trace);
    }
    const reference = traces.get('reference');
    if (!reference) return;
    const scoped = selectedScopeInfo(reference, [...traces.values()]);
    if (!scoped) return;

    const lowSide = traces.get('fuelPressure');
    const railDiff = traces.get('railDiff');
    const highSide = traces.get('fuelPressureHigh');
    const pw = traces.get('pw');
    const duty = traces.get('duty');
    const deadtime = traces.get('deadtime');
    const architecture = currentArchitecture();

    const injector = analyzeFuelPressureInjector({
      reference: reference.range,
      ...(pw ? { injectorPulseWidth: pw.range } : {}),
      ...(duty ? { injectorDuty: duty.range } : {}),
      ...(deadtime ? { injectorDeadtime: deadtime.range } : {}),
    }, {
      sampleIndices: scoped.sampleIndices,
      complete: scoped.complete,
      highDutyThreshold: optionNumber(highDuty, 90) ?? 90,
    });

    const pressure = analyzeFuelPressureArchitecture({
      architecture,
      sampleIndices: scoped.sampleIndices,
      ...(lowSide ? { lowSidePressure: lowSide.range } : {}),
      ...(railDiff ? { railDifferential: railDiff.range } : {}),
      ...(highSide ? { highSidePressure: highSide.range } : {}),
      ...(optionNumber(conventionalMinimum) !== undefined ? { conventionalMinimumDifferential: optionNumber(conventionalMinimum)! } : {}),
      ...(optionNumber(gdiMinimum) !== undefined ? { gdiMinimumPressure: optionNumber(gdiMinimum)! } : {}),
    });

    const dutyMax = injector.injectorDuty?.max;
    const headroom = dutyMax === undefined ? '—' : `${numberText(100 - dutyMax, 1)}%`;
    const activePressureLabel = pressure.pressureRole === 'rail-differential'
      ? 'Rail differential'
      : pressure.pressureRole === 'high-side'
        ? 'High-side / GDI rail'
        : 'Required pressure channel unavailable';

    renderSummary([
      ['Fuel system', architecture === 'gdi' ? 'GDI / high-pressure' : 'Conventional / port injection'],
      ['Scope', scoped.scope.label],
      ['Coverage', scoped.complete ? 'Complete' : 'Partial decoded'],
      ['Active pressure evidence', activePressureLabel],
      ['Active pressure mean / min', `${numberText(pressure.activePressure?.mean)} / ${numberText(pressure.activePressure?.min)}`],
      ['Pressure threshold', pressure.threshold === undefined ? 'Not set' : numberText(pressure.threshold)],
      ['Pressure events', String(pressure.pressureEvents.length)],
      ['Low-side mean / min', `${numberText(pressure.lowSidePressure?.mean)} / ${numberText(pressure.lowSidePressure?.min)}`],
      ['Rail diff mean / min', `${numberText(pressure.railDifferential?.mean)} / ${numberText(pressure.railDifferential?.min)}`],
      ['GDI high-side mean / min', `${numberText(pressure.highSidePressure?.mean)} / ${numberText(pressure.highSidePressure?.min)}`],
      ['Injector PW mean', numberText(injector.injectorPulseWidth?.mean)],
      ['Injector duty mean / max', `${numberText(injector.injectorDuty?.mean)} / ${numberText(dutyMax)}`],
      ['Minimum duty headroom', headroom],
      ['High duty events', String(injector.highDutyEvents.length)],
      ['Deadtime mean', numberText(injector.injectorDeadtime?.mean)],
    ]);

    const pressureType = architecture === 'gdi' ? 'Low GDI rail pressure' : 'Low rail differential';
    renderEvents([
      ...pressure.pressureEvents.map((event) => ({ type: pressureType, event })),
      ...injector.highDutyEvents.map((event) => ({ type: 'High injector duty', event })),
    ]);
    empty.hidden = true;
    content.hidden = false;
  };

  const rebuild = (): void => {
    controls.replaceChildren();
    const architectureLabel = document.createElement('label');
    const architectureCaption = document.createElement('span');
    architectureCaption.textContent = 'Fuel system';
    const architecture = document.createElement('select');
    architecture.dataset.role = 'fuel-system';
    architecture.add(new Option('Conventional / port injection', 'conventional'));
    architecture.add(new Option('GDI / high-pressure', 'gdi'));
    const rememberedArchitecture = remembered.get('architecture');
    const hasLow = Boolean(suggestAnalyzerChannel('fuel-injector', 'fuelPressure', context.channels) || suggestAnalyzerChannel('fuel-injector', 'railDiff', context.channels));
    const hasHigh = Boolean(suggestAnalyzerChannel('fuel-injector', 'fuelPressureHigh', context.channels));
    architecture.value = rememberedArchitecture ?? (!hasLow && hasHigh ? 'gdi' : 'conventional');
    architecture.addEventListener('change', () => {
      remembered.set('architecture', architecture.value);
      updateModeUi();
      void analyze();
    });
    architectureLabel.append(architectureCaption, architecture);
    controls.append(architectureLabel);

    for (const role of ROLES) {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      caption.textContent = role.label;
      const select = document.createElement('select');
      select.dataset.role = role.key;
      select.add(new Option(role.required ? '(select channel)' : '(none)', ''));
      for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));
      const rememberedValue = remembered.get(role.key);
      if (rememberedValue && [...select.options].some((option) => option.value === rememberedValue)) select.value = rememberedValue;
      else {
        const suggested = suggestAnalyzerChannel('fuel-injector', role.key, context.channels);
        if (suggested) select.value = suggested.id;
      }
      select.addEventListener('change', () => {
        remembered.set(role.key, select.value);
        void analyze();
      });
      label.append(caption, select);
      controls.append(label);
    }

    const scopeLabel = document.createElement('label');
    const scopeCaption = document.createElement('span');
    scopeCaption.textContent = 'Scope';
    const scopeSelect = document.createElement('select');
    scopeSelect.dataset.role = 'scope';
    populateAnalyzerScopeSelect(scopeSelect, context, remembered.get('scope') ?? 'full');
    scopeSelect.addEventListener('change', () => {
      remembered.set('scope', scopeSelect.value);
      void analyze();
    });
    scopeLabel.append(scopeCaption, scopeSelect);
    controls.append(scopeLabel);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Analyze';
    button.addEventListener('click', () => { void analyze(); });
    controls.append(button);
    updateModeUi();
    void analyze();
  };

  for (const input of [conventionalMinimum, gdiMinimum, highDuty]) input.addEventListener('change', () => { void analyze(); });

  return {
    element: root,
    setContext(nextContext) { context = nextContext; rebuild(); },
    refresh: () => { void analyze(); },
  };
}
