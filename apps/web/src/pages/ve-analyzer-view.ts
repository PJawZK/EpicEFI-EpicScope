import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { analyzerChannelOptionLabel, suggestAnalyzerChannel } from './analyzer-channel-roles';
import {
  preferredVeAxisName,
  preferredVeTableName,
  veAxisCandidates,
  veTableCandidates,
} from './ve-analyzer-model';

export interface VeAnalyzerViewController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  setTuneModel(model: TuneModel | undefined, sourceName?: string): void;
  refresh(): void;
}

type RoleKey =
  | 'rpm'
  | 'load'
  | 'actual'
  | 'target'
  | 've'
  | 'fuelCommand'
  | 'dfco'
  | 'fuelCutReason'
  | 'aeActive'
  | 'decelActive'
  | 'totalCorrection'
  | 'stft'
  | 'ltft';

interface VeRoleDefinition {
  readonly key: RoleKey;
  readonly label: string;
  readonly required: boolean;
  readonly purpose: 'Primary calculation' | 'Qualification / context';
}

const ROLES: readonly VeRoleDefinition[] = [
  { key: 'rpm', label: 'RPM', required: true, purpose: 'Primary calculation' },
  { key: 'load', label: 'VE-table load', required: true, purpose: 'Primary calculation' },
  { key: 'actual', label: 'Actual mixture', required: true, purpose: 'Primary calculation' },
  { key: 'target', label: 'Target mixture', required: true, purpose: 'Primary calculation' },
  { key: 've', label: 'Effective / runtime VE', required: false, purpose: 'Primary calculation' },
  { key: 'fuelCommand', label: 'Fuel command / injector PW', required: false, purpose: 'Qualification / context' },
  { key: 'dfco', label: 'DFCO state', required: false, purpose: 'Qualification / context' },
  { key: 'fuelCutReason', label: 'Fuel-cut reason', required: false, purpose: 'Qualification / context' },
  { key: 'aeActive', label: 'AE state', required: false, purpose: 'Qualification / context' },
  { key: 'decelActive', label: 'Decel state', required: false, purpose: 'Qualification / context' },
  { key: 'totalCorrection', label: 'Total fuel correction', required: false, purpose: 'Qualification / context' },
  { key: 'stft', label: 'STFT / EGO correction', required: false, purpose: 'Qualification / context' },
  { key: 'ltft', label: 'LTFT correction', required: false, purpose: 'Qualification / context' },
];

const PRESETS = [
  ['recommended', 'Recommended VE Analysis'],
  ['steady', 'Steady-state only'],
  ['warm', 'Warm engine only'],
  ['cruise', 'Cruise / light load'],
  ['boost', 'Boost / high load'],
  ['custom', 'Custom'],
] as const;

function sameChannelCatalog(left: LoggerAnalysisContext['channels'], right: LoggerAnalysisContext['channels']): boolean {
  return left.length === right.length && left.every((channel, index) => channel === right[index]);
}

function selectedText(select: HTMLSelectElement): string {
  return select.selectedOptions[0]?.textContent?.trim() || '—';
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let tuneModel: TuneModel | undefined;
  let tuneSourceName: string | undefined;
  let generation = 0;
  const remembered = new Map<string, string>();

  const root = document.createElement('section');
  root.className = 'specialized-analyzer-view ve-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="specialized-analyzer-banner">
      <div><strong>VE Analyzer · Experimental</strong><span>Evidence-first VE analysis foundation. This shell validates tune-table mapping, semantic log inputs and source coverage before recommendation math is enabled.</span></div>
      <span class="specialized-analyzer-badge">EXP</span>
    </div>
    <div class="specialized-analyzer-guidance">
      <strong>Current implementation stage</strong>
      <span>No VE recommendation is calculated or applied yet. Analyze currently validates the selected evidence contract only; tune/ECU state is never mutated.</span>
    </div>
    <div class="specialized-analyzer-controls" data-ve-analyzer="controls"></div>
    <div class="specialized-analyzer-empty">
      <strong>VE Analyzer needs a loaded log and an MSQ VE-table mapping.</strong>
      <span>Required roles are RPM, load, actual mixture and target mixture. Optional state/correction roles degrade visibly when unavailable.</span>
    </div>
    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary" data-ve-analyzer="summary"></div>
      <section class="specialized-analyzer-events">
        <header><strong>Input readiness</strong><span data-ve-analyzer="readiness">Not ready</span></header>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table">
            <thead><tr><th>Input</th><th>Purpose</th><th>Requirement</th><th>Resolved source</th><th>Status</th></tr></thead>
            <tbody data-ve-analyzer="readiness-body"></tbody>
          </table>
        </div>
      </section>
      <details class="specialized-analyzer-options">
        <summary>Lambda Delay · next implementation stage</summary>
        <div class="specialized-analyzer-guidance">
          <strong>No delay discovery has run</strong>
          <span>VE Analyzer will support single-value, RPM-curve and RPM×load-table working models. Expensive discovery will run only from the explicit Grab lambda delays from log action.</span>
        </div>
        <div class="specialized-analyzer-options-grid">
          <label><span>Working model</span><select disabled><option>Single value</option><option>RPM curve</option><option>RPM × load table</option></select></label>
          <button type="button" disabled>Grab lambda delays from log</button>
        </div>
      </details>
    </div>
  `;

  const controls = root.querySelector<HTMLElement>('[data-ve-analyzer="controls"]');
  const summary = root.querySelector<HTMLElement>('[data-ve-analyzer="summary"]');
  const empty = root.querySelector<HTMLElement>('.specialized-analyzer-empty');
  const content = root.querySelector<HTMLElement>('.specialized-analyzer-content');
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]');
  const readinessBody = root.querySelector<HTMLTableSectionElement>('[data-ve-analyzer="readiness-body"]');
  if (!controls || !summary || !empty || !content || !readiness || !readinessBody) throw new Error('VE Analyzer structure is incomplete.');

  const roleSelect = (key: RoleKey): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>(`select[data-role="${key}"]`) ?? undefined;
  const tableSelect = (): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>('select[data-role="ve-table"]') ?? undefined;
  const rpmAxisSelect = (): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>('select[data-role="rpm-axis"]') ?? undefined;
  const loadAxisSelect = (): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>('select[data-role="load-axis"]') ?? undefined;
  const scopeSelect = (): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>('select[data-role="scope"]') ?? undefined;
  const presetSelect = (): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>('select[data-role="preset"]') ?? undefined;

  const addLabeledSelect = (labelText: string, role: string): HTMLSelectElement => {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = labelText;
    const select = document.createElement('select');
    select.dataset.role = role;
    label.append(caption, select);
    controls.append(label);
    return select;
  };

  const fillAxisSelectors = (): void => {
    const table = tableSelect();
    const rpmAxis = rpmAxisSelect();
    const loadAxis = loadAxisSelect();
    if (!table || !rpmAxis || !loadAxis) return;
    const tableName = table.value;
    const previousRpm = remembered.get('rpm-axis') ?? rpmAxis.value;
    const previousLoad = remembered.get('load-axis') ?? loadAxis.value;
    const rpmCandidates = veAxisCandidates(tuneModel, tableName, 'rpm');
    const loadCandidates = veAxisCandidates(tuneModel, tableName, 'load');
    rpmAxis.replaceChildren(new Option('(select RPM axis)', ''), ...rpmCandidates.map((entry) => new Option(entry.name, entry.name)));
    loadAxis.replaceChildren(new Option('(select load axis)', ''), ...loadCandidates.map((entry) => new Option(entry.name, entry.name)));
    const preferredRpm = rpmCandidates.some((entry) => entry.name === previousRpm) ? previousRpm : preferredVeAxisName(tuneModel, tableName, 'rpm');
    const preferredLoad = loadCandidates.some((entry) => entry.name === previousLoad) ? previousLoad : preferredVeAxisName(tuneModel, tableName, 'load');
    if (preferredRpm) rpmAxis.value = preferredRpm;
    if (preferredLoad) loadAxis.value = preferredLoad;
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

  const renderReadiness = (loadedById?: ReadonlyMap<string, LoggerAnalysisTraceContext>): boolean => {
    const rows: HTMLTableRowElement[] = [];
    let ready = true;

    const addRow = (input: string, purpose: string, requirement: string, source: string, status: string, ok: boolean): void => {
      const row = document.createElement('tr');
      for (const value of [input, purpose, requirement, source, status]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      rows.push(row);
      if (!ok && requirement === 'Required') ready = false;
    };

    const table = tableSelect();
    const rpmAxis = rpmAxisSelect();
    const loadAxis = loadAxisSelect();
    addRow('MSQ VE table', 'Tune geometry', 'Required', table ? selectedText(table) : '—', table?.value ? 'Resolved' : 'Missing', Boolean(table?.value));
    addRow('MSQ RPM axis', 'Tune geometry', 'Required', rpmAxis ? selectedText(rpmAxis) : '—', rpmAxis?.value ? 'Resolved' : 'Missing', Boolean(rpmAxis?.value));
    addRow('MSQ load axis', 'Tune geometry', 'Required', loadAxis ? selectedText(loadAxis) : '—', loadAxis?.value ? 'Resolved' : 'Missing', Boolean(loadAxis?.value));

    for (const role of ROLES) {
      const select = roleSelect(role.key);
      const id = select?.value ?? '';
      const selected = id ? context.channels.find((channel) => channel.id === id) : undefined;
      const loaded = id && loadedById ? loadedById.has(id) : undefined;
      const requirement = role.required ? 'Required' : 'Optional';
      const source = selected ? analyzerChannelOptionLabel(selected) : '—';
      const status = selected
        ? loaded === false ? 'Selected · unavailable in scope' : loaded === true ? 'Resolved · loaded' : 'Resolved'
        : role.required ? 'Missing' : 'Unavailable optional';
      const ok = Boolean(selected) && loaded !== false;
      addRow(role.label, role.purpose, requirement, source, status, ok);
    }

    readinessBody.replaceChildren(...rows);
    readiness.textContent = ready ? 'Ready for evidence-map stage' : 'Missing required inputs';
    return ready;
  };

  const analyze = async (): Promise<void> => {
    const run = ++generation;
    const scopeControl = scopeSelect();
    const scope = scopeControl ? selectedAnalyzerScope(scopeControl, context) : undefined;
    const preset = presetSelect();
    const selected = new Map<RoleKey, string>();
    for (const role of ROLES) {
      const value = roleSelect(role.key)?.value;
      if (value) selected.set(role.key, value);
    }

    renderReadiness();
    if (!scope) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    const requested = [...new Set(selected.values())];
    const bounds = analyzerScopeBounds(scope);
    const loaded = requested.length > 0 ? await context.loadTraces(requested, bounds.startMs, bounds.endMs) : [];
    if (run !== generation) return;
    const loadedById = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const ready = renderReadiness(loadedById);

    const rpmId = selected.get('rpm');
    const rpmTrace = rpmId ? loadedById.get(rpmId) : undefined;
    let referenceSamples = 0;
    let complete = loaded.every((trace) => {
      if (bounds.startMs === undefined || bounds.endMs === undefined) return trace.complete;
      return trace.complete || numericRangeCoversTime(trace.range, bounds.startMs, bounds.endMs);
    });
    if (rpmTrace) {
      const channels = new Map([[rpmTrace.channel.id, { range: rpmTrace.range, complete: rpmTrace.complete }]]);
      const qualified = qualifyNumericSamples({
        referenceChannelId: rpmTrace.channel.id,
        channels,
        conditions: [],
        ...(bounds.startMs !== undefined && bounds.endMs !== undefined ? { timeRange: { startMs: bounds.startMs, endMs: bounds.endMs } } : {}),
      });
      referenceSamples = qualified.eligibleSampleCount;
      complete = complete && qualified.complete;
    } else {
      complete = false;
    }

    const resolvedPrimary = ROLES.filter((role) => role.purpose === 'Primary calculation' && roleSelect(role.key)?.value).length;
    const resolvedContext = ROLES.filter((role) => role.purpose === 'Qualification / context' && roleSelect(role.key)?.value).length;
    renderSummary([
      ['Tune source', tuneSourceName ?? 'No MSQ loaded'],
      ['VE table', tableSelect()?.value || 'Not selected'],
      ['Scope', scope.label],
      ['Qualification preset', preset ? selectedText(preset) : '—'],
      ['Primary roles resolved', `${resolvedPrimary} / ${ROLES.filter((role) => role.purpose === 'Primary calculation').length}`],
      ['Context roles resolved', `${resolvedContext} / ${ROLES.filter((role) => role.purpose === 'Qualification / context').length}`],
      ['Reference samples in scope', referenceSamples.toLocaleString()],
      ['Coverage', complete ? 'Complete' : 'Partial / unresolved'],
      ['Recommendation state', 'Not calculated — shell only'],
      ['Tune mutation', 'None'],
    ]);

    empty.hidden = true;
    content.hidden = false;
    readiness.textContent = ready ? 'Ready for evidence-map stage' : 'Missing required inputs';
  };

  const rebuild = (): void => {
    const previousContext = context;
    controls.replaceChildren();

    const table = addLabeledSelect('VE table', 've-table');
    table.add(new Option('(select VE table)', ''));
    for (const entry of veTableCandidates(tuneModel)) table.add(new Option(entry.name, entry.name));
    const rememberedTable = remembered.get('ve-table');
    const preferredTable = rememberedTable && [...table.options].some((option) => option.value === rememberedTable)
      ? rememberedTable
      : preferredVeTableName(tuneModel);
    if (preferredTable) table.value = preferredTable;

    const rpmAxis = addLabeledSelect('RPM axis', 'rpm-axis');
    const loadAxis = addLabeledSelect('Load axis', 'load-axis');
    fillAxisSelectors();

    table.addEventListener('change', () => {
      remembered.set('ve-table', table.value);
      fillAxisSelectors();
      void analyze();
    });
    rpmAxis.addEventListener('change', () => { remembered.set('rpm-axis', rpmAxis.value); void analyze(); });
    loadAxis.addEventListener('change', () => { remembered.set('load-axis', loadAxis.value); void analyze(); });

    for (const role of ROLES) {
      const select = addLabeledSelect(role.label, role.key);
      select.add(new Option(role.required ? '(select required channel)' : '(none)', ''));
      for (const channel of context.channels) select.add(new Option(analyzerChannelOptionLabel(channel), channel.id));
      const rememberedValue = remembered.get(role.key);
      if (rememberedValue && context.channels.some((channel) => channel.id === rememberedValue)) select.value = rememberedValue;
      else {
        const suggested = suggestAnalyzerChannel('fueling', role.key, context.channels);
        if (suggested) select.value = suggested.id;
      }
      select.addEventListener('change', () => {
        remembered.set(role.key, select.value);
        void analyze();
      });
    }

    const scope = addLabeledSelect('Scope', 'scope');
    populateAnalyzerScopeSelect(scope, context, remembered.get('scope') ?? 'full');
    scope.addEventListener('change', () => { remembered.set('scope', scope.value); void analyze(); });

    const preset = addLabeledSelect('Qualification preset', 'preset');
    for (const [value, label] of PRESETS) preset.add(new Option(label, value));
    preset.value = remembered.get('preset') ?? 'recommended';
    preset.addEventListener('change', () => { remembered.set('preset', preset.value); void analyze(); });

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Analyze evidence readiness';
    button.addEventListener('click', () => { void analyze(); });
    controls.append(button);

    const channelsChanged = !sameChannelCatalog(previousContext.channels, context.channels);
    if (channelsChanged || tuneModel || context.channels.length > 0) void analyze();
  };

  return {
    element: root,
    setContext(nextContext) {
      context = nextContext;
      rebuild();
    },
    setTuneModel(model, sourceName) {
      tuneModel = model;
      tuneSourceName = sourceName;
      rebuild();
    },
    refresh: () => { void analyze(); },
  };
}
