import { analyzeFuelInjectorHeadroomContext, type FuelInjectorEventContext } from '../../../../core/analysis/fuel-injector-headroom';
import { analyzeFuelPressureArchitecture, type FuelPressureArchitecture, type FuelPressureEvidenceQuality } from '../../../../core/analysis/fuel-pressure-architecture';
import { analyzeFuelPressureInjector } from '../../../../core/analysis/specialized-analyzers';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { suggestAnalyzerChannel } from './analyzer-channel-roles';
import { isFuelPressureChannelEligible, suggestFuelPressureChannel, type FuelPressureChannelRole } from './fuel-pressure-channel-selection';

export interface FuelInjectorAnalyzerViewController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  refresh(): void;
}

type RoleKey = 'reference' | 'map' | 'fuelPressure' | 'railDiff' | 'fuelPressureHigh' | 'pw' | 'duty' | 'deadtime';

const ROLES: readonly { key: RoleKey; label: string; required?: boolean }[] = [
  { key: 'reference', label: 'Reference sample grid', required: true },
  { key: 'map', label: 'MAP / load context' },
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

function channelUnit(trace: LoggerAnalysisTraceContext | undefined): string {
  return trace?.channel.unit?.trim() ?? '';
}

function valueWithUnit(value: number | undefined, unit: string, precision = 3): string {
  const text = numberText(value, precision);
  return text === '—' || !unit ? text : `${text} ${unit}`;
}

function rangeWithUnit(mean: number | undefined, min: number | undefined, unit: string): string {
  const text = `${numberText(mean)} / ${numberText(min)}`;
  return !unit || text === '— / —' ? text : `${text} ${unit}`;
}

function pressureRoleForKey(key: RoleKey): FuelPressureChannelRole | undefined {
  if (key === 'fuelPressure') return 'low-side';
  if (key === 'fuelPressureHigh') return 'high-side';
  return undefined;
}

function optionText(channel: ChannelDefinition): string {
  const name = channel.displayName || channel.sourceName;
  return channel.unit ? `${name} [${channel.unit}]` : name;
}

function pressureQualityLabel(quality: FuelPressureEvidenceQuality | undefined): string {
  if (!quality) return 'Unavailable';
  if (quality.state === 'usable') return 'Usable';
  if (quality.state === 'constant') return 'Constant / limited variation';
  if (quality.state === 'constant-zero') return 'Unavailable — constant zero';
  return 'Unavailable — no valid samples';
}

function pressureQualityMessages(
  active: FuelPressureEvidenceQuality | undefined,
  lowSide: FuelPressureEvidenceQuality | undefined,
  activeLabel: string,
): string[] {
  const messages: string[] = [];
  if (active?.state === 'constant-zero') messages.push(`${activeLabel} is constant at 0 across the qualified samples, so it is not used as pressure-fault evidence.`);
  else if (active?.state === 'constant') messages.push(`${activeLabel} has effectively no variation in the qualified samples. Threshold evidence is retained, but verify that the channel is live and meaningful.`);
  else if (active?.state === 'no-valid-samples') messages.push(`${activeLabel} has no valid samples after pressure qualification.`);
  if (active && active.negativeSampleCount > 0) messages.push(`${activeLabel} contains ${active.negativeSampleCount.toLocaleString()} negative calibrated values; verify channel calibration and units before drawing pressure conclusions.`);
  if (lowSide && lowSide.negativeSampleCount > 0) messages.push(`Low-side fuel pressure contains ${lowSide.negativeSampleCount.toLocaleString()} negative calibrated values; verify sensor calibration and units.`);
  return messages;
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
    <div class="specialized-analyzer-guidance" data-fuel-injector="quality-guidance" hidden><strong>Pressure evidence quality</strong><span data-fuel-injector="quality-text"></span></div>
    <details class="specialized-analyzer-options" open>
      <summary>Analysis thresholds</summary>
      <div class="specialized-analyzer-options-grid">
        <label><span>Minimum RPM for pressure events</span><input type="number" min="0" step="50" data-option="minimumRunningRpm" value="300"></label>
        <label><span>Conventional min rail differential</span><input type="number" step="any" data-option="conventionalMinimum" placeholder="optional"></label>
        <label><span>GDI min high-side pressure</span><input type="number" step="any" data-option="gdiMinimum" placeholder="optional"></label>
        <label><span>High duty threshold</span><input type="number" step="0.1" data-option="highDuty" value="90"></label>
      </div>
    </details>
    <div class="specialized-analyzer-empty">
      <strong>Select the reference sample grid before analyzing.</strong>
      <span>Optional channels can remain unselected. Raw electrical pressure inputs are not offered as calibrated pressure evidence.</span>
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
  const minimumRunningRpm = root.querySelector<HTMLInputElement>('input[data-option="minimumRunningRpm"]');
  const conventionalMinimum = root.querySelector<HTMLInputElement>('input[data-option="conventionalMinimum"]');
  const gdiMinimum = root.querySelector<HTMLInputElement>('input[data-option="gdiMinimum"]');
  const highDuty = root.querySelector<HTMLInputElement>('input[data-option="highDuty"]');
  if (!controls || !summary || !empty || !content || !tableHead || !tableBody || !minimumRunningRpm || !conventionalMinimum || !gdiMinimum || !highDuty) throw new Error('Fuel / Injector analyzer structure is incomplete.');

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
      ? 'High-side calibrated rail pressure is the active pressure evidence. Low-side calibrated pressure remains supply context. Raw electrical pressure inputs are intentionally excluded.'
      : 'Rail differential is the active pressure evidence. Calibrated low-side pressure is supply context; raw electrical pressure inputs are intentionally excluded.';
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

  const renderEvents = (
    events: readonly FuelInjectorEventContext[],
    units: { readonly rpm: string; readonly load: string; readonly lowSide: string; readonly activePressure: string; readonly duty: string; readonly pw: string; readonly deadtime: string },
    architecture: FuelPressureArchitecture,
  ): void => {
    field('event-count').textContent = events.length.toLocaleString();
    const headers = ['#', 'Type', 'Extreme time', 'Duration', 'RPM', 'MAP / load', 'Low-side', 'Active pressure', 'Duty', 'PW', 'Deadtime'];
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
      cell.textContent = 'No usable pressure or high-duty review events were found for the selected architecture, qualification and thresholds.';
      row.append(cell);
      tableBody.replaceChildren(row);
      return;
    }
    tableBody.replaceChildren(...events.slice(0, 200).map((item, index) => {
      const { event } = item;
      const type = item.type === 'high-duty'
        ? 'High injector duty'
        : architecture === 'gdi'
          ? 'Low GDI rail pressure'
          : 'Low rail differential';
      const activePressureAtExtreme = architecture === 'gdi' ? item.highSidePressureAtExtreme : item.railDifferentialAtExtreme;
      const values = [
        String(index + 1),
        type,
        timeText(event.extremeTimeMs),
        `${event.durationMs.toFixed(0)} ms`,
        valueWithUnit(item.rpmAtExtreme, units.rpm),
        valueWithUnit(item.loadAtExtreme, units.load),
        valueWithUnit(item.fuelPressureAtExtreme, units.lowSide),
        valueWithUnit(activePressureAtExtreme, units.activePressure),
        valueWithUnit(item.injectorDutyAtExtreme, units.duty),
        valueWithUnit(item.injectorPulseWidthAtExtreme, units.pw),
        valueWithUnit(item.injectorDeadtimeAtExtreme, units.deadtime),
      ];
      const row = document.createElement('tr');
      for (const value of values) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      if (context.openSamplesInLogger) {
        row.classList.add('specialized-analyzer-event-row--navigable');
        row.tabIndex = 0;
        row.title = 'Double-click or press Enter to open this event and its extreme sample in Logger';
        const open = (): void => {
          const evidencePoints = [
            { sampleIndex: event.startSampleIndex, timeMs: event.startTimeMs },
            { sampleIndex: event.extremeSampleIndex, timeMs: event.extremeTimeMs },
            { sampleIndex: event.endSampleIndex, timeMs: event.endTimeMs },
          ].filter((point, pointIndex, points) => points.findIndex((candidate) => candidate.sampleIndex === point.sampleIndex) === pointIndex);
          context.openSamplesInLogger?.({
            sampleIndices: evidencePoints.map((point) => point.sampleIndex),
            timeMs: evidencePoints.map((point) => point.timeMs),
            label: `${type} ${index + 1}`,
          });
        };
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

    const map = traces.get('map');
    const lowSide = traces.get('fuelPressure');
    const railDiff = traces.get('railDiff');
    const highSide = traces.get('fuelPressureHigh');
    const pw = traces.get('pw');
    const duty = traces.get('duty');
    const deadtime = traces.get('deadtime');
    const architecture = currentArchitecture();
    const highDutyThreshold = optionNumber(highDuty, 90) ?? 90;
    const runningRpmThreshold = optionNumber(minimumRunningRpm, 300) ?? 300;

    const injector = analyzeFuelPressureInjector({
      reference: reference.range,
      ...(pw ? { injectorPulseWidth: pw.range } : {}),
      ...(duty ? { injectorDuty: duty.range } : {}),
      ...(deadtime ? { injectorDeadtime: deadtime.range } : {}),
    }, {
      sampleIndices: scoped.sampleIndices,
      complete: scoped.complete,
      highDutyThreshold,
    });

    const pressure = analyzeFuelPressureArchitecture({
      architecture,
      rpm: reference.range,
      sampleIndices: scoped.sampleIndices,
      minimumRunningRpm: runningRpmThreshold,
      ...(lowSide ? { lowSidePressure: lowSide.range } : {}),
      ...(railDiff ? { railDifferential: railDiff.range } : {}),
      ...(highSide ? { highSidePressure: highSide.range } : {}),
      ...(optionNumber(conventionalMinimum) !== undefined ? { conventionalMinimumDifferential: optionNumber(conventionalMinimum)! } : {}),
      ...(optionNumber(gdiMinimum) !== undefined ? { gdiMinimumPressure: optionNumber(gdiMinimum)! } : {}),
    });

    const contextual = analyzeFuelInjectorHeadroomContext(injector, {
      reference: reference.range,
      rpm: reference.range,
      ...(map ? { load: map.range } : {}),
      ...(lowSide ? { fuelPressure: lowSide.range } : {}),
      ...(railDiff ? { railDifferential: railDiff.range } : {}),
      ...(highSide ? { highSidePressure: highSide.range } : {}),
      ...(pw ? { injectorPulseWidth: pw.range } : {}),
      ...(duty ? { injectorDuty: duty.range } : {}),
      ...(deadtime ? { injectorDeadtime: deadtime.range } : {}),
    }, {
      sampleIndices: scoped.sampleIndices,
      highDutyThreshold,
      pressureEvents: pressure.pressureEvents,
    });

    const dutyMax = injector.injectorDuty?.max;
    const dutyUnit = channelUnit(duty) || '%';
    const minimumHeadroom = contextual.headroom?.minimumHeadroomPercent;
    const headroom = minimumHeadroom === undefined ? '—' : `${numberText(minimumHeadroom, 1)}%`;
    const highDutySamples = contextual.headroom
      ? `${contextual.headroom.highDutySampleCount.toLocaleString()} (${numberText(contextual.headroom.highDutySamplePercent, 2)}%)`
      : '—';
    const saturationSamples = contextual.headroom ? contextual.headroom.saturationSampleCount.toLocaleString() : '—';
    const activePressureTrace = architecture === 'gdi' ? highSide : railDiff;
    const activePressureUnit = channelUnit(activePressureTrace);
    const activePressureName = architecture === 'gdi' ? 'High-side / GDI rail pressure' : 'Rail differential';
    const activePressureLabel = pressure.pressureRole === 'rail-differential'
      ? 'Rail differential'
      : pressure.pressureRole === 'high-side'
        ? 'High-side / GDI rail'
        : pressure.activePressureQuality?.state === 'constant-zero'
          ? `${activePressureName} unavailable — constant zero`
          : 'Required calibrated pressure evidence unavailable';
    const qualityMessages = pressureQualityMessages(pressure.activePressureQuality, pressure.lowSidePressureQuality, activePressureName);
    const qualityGuidance = field('quality-guidance');
    qualityGuidance.hidden = qualityMessages.length === 0;
    field('quality-text').textContent = qualityMessages.join(' ');

    renderSummary([
      ['Fuel system', architecture === 'gdi' ? 'GDI / high-pressure' : 'Conventional / port injection'],
      ['Scope', scoped.scope.label],
      ['Coverage', scoped.complete ? 'Complete' : 'Partial decoded'],
      ['Pressure RPM gate', `≥ ${numberText(runningRpmThreshold, 0)} RPM`],
      ['Pressure-qualified samples', `${pressure.pressureQualifiedSampleCount.toLocaleString()} · ${pressure.excludedByRunningGateCount.toLocaleString()} excluded`],
      ['Active pressure evidence', activePressureLabel],
      ['Active pressure quality', pressureQualityLabel(pressure.activePressureQuality)],
      ['Active pressure mean / min', rangeWithUnit(pressure.activePressure?.mean, pressure.activePressure?.min, activePressureUnit)],
      ['Pressure threshold', pressure.threshold === undefined ? 'Not set' : valueWithUnit(pressure.threshold, activePressureUnit)],
      ['Pressure events', String(pressure.pressureEvents.length)],
      ['Low-side quality', pressureQualityLabel(pressure.lowSidePressureQuality)],
      ['Low-side mean / min', rangeWithUnit(pressure.lowSidePressure?.mean, pressure.lowSidePressure?.min, channelUnit(lowSide))],
      ['Rail diff mean / min', rangeWithUnit(pressure.railDifferential?.mean, pressure.railDifferential?.min, channelUnit(railDiff))],
      ['GDI high-side mean / min', rangeWithUnit(pressure.highSidePressure?.mean, pressure.highSidePressure?.min, channelUnit(highSide))],
      ['Injector PW mean', valueWithUnit(injector.injectorPulseWidth?.mean, channelUnit(pw))],
      ['Injector duty mean / max', rangeWithUnit(injector.injectorDuty?.mean, dutyMax, dutyUnit)],
      ['Minimum duty headroom', headroom],
      ['High duty events', String(injector.highDutyEvents.length)],
      ['High duty samples', highDutySamples],
      ['Duty ≥ 100% samples', saturationSamples],
      ['Deadtime mean', valueWithUnit(injector.injectorDeadtime?.mean, channelUnit(deadtime))],
    ]);

    renderEvents(contextual.events, {
      rpm: channelUnit(reference),
      load: channelUnit(map),
      lowSide: channelUnit(lowSide),
      activePressure: activePressureUnit,
      duty: dutyUnit,
      pw: channelUnit(pw),
      deadtime: channelUnit(deadtime),
    }, architecture);
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
    const hasLow = Boolean(suggestFuelPressureChannel('low-side', context.channels) || suggestAnalyzerChannel('fuel-injector', 'railDiff', context.channels));
    const hasHigh = Boolean(suggestFuelPressureChannel('high-side', context.channels));
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
      const pressureRole = pressureRoleForKey(role.key);
      const availableChannels = pressureRole
        ? context.channels.filter((channel) => isFuelPressureChannelEligible(pressureRole, channel))
        : context.channels;
      for (const channel of availableChannels) select.add(new Option(optionText(channel), channel.id));
      const rememberedValue = remembered.get(role.key);
      if (rememberedValue && [...select.options].some((option) => option.value === rememberedValue)) select.value = rememberedValue;
      else {
        const suggested = pressureRole
          ? suggestFuelPressureChannel(pressureRole, context.channels)
          : suggestAnalyzerChannel('fuel-injector', role.key, context.channels);
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

  for (const input of [minimumRunningRpm, conventionalMinimum, gdiMinimum, highDuty]) input.addEventListener('change', () => { void analyze(); });

  return {
    element: root,
    setContext(nextContext) { context = nextContext; rebuild(); },
    refresh: () => { void analyze(); },
  };
}
