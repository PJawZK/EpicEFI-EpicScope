import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { analyzerChannelOptionLabel, suggestAnalyzerChannel } from './analyzer-channel-roles';
import {
  preferredTargetMixtureTableName,
  preferredVeAxisName,
  preferredVeTableName,
  targetMixtureTableCandidates,
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
  { key: 'target', label: 'Logged target mixture', required: false, purpose: 'Qualification / context' },
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

function formatTuneValue(value: number, digits: number | undefined): string {
  if (!Number.isFinite(value)) return '—';
  const precision = Math.max(0, Math.min(3, digits ?? (Math.abs(value) < 20 ? 2 : 1)));
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function tableEntry(model: TuneModel | undefined, name: string): TuneEntry | undefined {
  const entry = model?.byName.get(name);
  return entry?.kind === 'table' && entry.numericValues !== undefined ? entry : undefined;
}

function axisValues(model: TuneModel | undefined, name: string): readonly number[] | undefined {
  return model?.byName.get(name)?.numericValues;
}

function colorLevel(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return '0.5';
  return String(Math.max(0, Math.min(1, (value - min) / (max - min))));
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
    <div class="specialized-analyzer-banner ve-workbench-banner">
      <div><strong>VE Analyzer · Experimental</strong><span>Two-table VE analysis workbench. Current tune and target mixture remain visible while evidence controls stay close to Run Analysis.</span></div>
      <span class="specialized-analyzer-badge">EXP</span>
    </div>

    <div class="ve-workbench">
      <section class="ve-workbench-panel">
        <header>
          <div><strong>VE / proposal table</strong><span>Current MSQ VE table; future analysis proposals will be reviewed in these same coordinates.</span></div>
          <select data-role="ve-table" aria-label="VE table"></select>
        </header>
        <div class="ve-workbench-table-wrap" data-ve-analyzer="ve-table-view"></div>
      </section>

      <section class="ve-workbench-panel">
        <header>
          <div><strong>Target AFR / lambda table</strong><span>Primary target-mixture authority from the loaded tune.</span></div>
          <select data-role="target-table" aria-label="Target mixture table"></select>
        </header>
        <div class="ve-workbench-table-wrap" data-ve-analyzer="target-table-view"></div>
      </section>
    </div>

    <div class="ve-workbench-actionbar">
      <button type="button" class="ve-workbench-run">Run Analysis</button>
      <label><span>Scope</span><select data-role="scope"></select></label>
      <label><span>Qualification</span><select data-role="preset"></select></label>
      <label><span>Cell change authority</span><select data-role="authority"><option>Normal</option><option>Conservative</option><option>Very conservative</option><option>Responsive</option></select></label>
      <button type="button" class="ve-workbench-delay" disabled>Lambda Delay Table</button>
      <span class="ve-workbench-state" data-ve-analyzer="readiness">Not ready</span>
    </div>

    <div class="ve-workbench-quick-controls">
      <label><span>RPM axis</span><select data-role="rpm-axis"></select></label>
      <label><span>Load axis</span><select data-role="load-axis"></select></label>
      <label><span>Actual mixture</span><select data-role="actual"></select></label>
      <label><span>EGO / STFT correction</span><select data-role="stft"></select></label>
      <label><span>Min RPM</span><input type="number" value="500" disabled></label>
      <label><span>Max RPM</span><input type="number" value="8500" disabled></label>
      <label><span>Min load</span><input type="number" disabled></label>
      <label><span>Max load</span><input type="number" disabled></label>
      <label><span>Min CLT</span><input type="number" disabled></label>
    </div>

    <div class="specialized-analyzer-guidance ve-workbench-guidance">
      <strong>Current implementation stage</strong>
      <span>The workbench and evidence contract are active. Run Analysis validates selected data and scope only; VE recommendations, table mutation and tune writes remain disabled.</span>
    </div>

    <div class="specialized-analyzer-empty">
      <strong>VE Analyzer needs a loaded log plus VE and target-mixture tune tables.</strong>
      <span>RPM, VE-table load and actual mixture are required log inputs. The target AFR/lambda table is the primary target authority; logged target mixture is optional validation context.</span>
    </div>

    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary" data-ve-analyzer="summary"></div>
      <details class="specialized-analyzer-options ve-workbench-advanced">
        <summary>Advanced inputs, qualification and readiness</summary>
        <div class="specialized-analyzer-controls" data-ve-analyzer="controls"></div>
        <section class="specialized-analyzer-events">
          <header><strong>Input readiness</strong><span data-ve-analyzer="advanced-readiness">Not ready</span></header>
          <div class="specialized-analyzer-table-wrap">
            <table class="specialized-analyzer-table">
              <thead><tr><th>Input</th><th>Purpose</th><th>Requirement</th><th>Resolved source</th><th>Status</th></tr></thead>
              <tbody data-ve-analyzer="readiness-body"></tbody>
            </table>
          </div>
        </section>
      </details>
      <details class="specialized-analyzer-options">
        <summary>Lambda Delay · next implementation stage</summary>
        <div class="specialized-analyzer-guidance">
          <strong>No delay discovery has run</strong>
          <span>Single-value, RPM-curve and RPM×load-table working models remain planned. Expensive discovery will run only from the explicit Grab lambda delays from log action.</span>
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
  const advancedReadiness = root.querySelector<HTMLElement>('[data-ve-analyzer="advanced-readiness"]');
  const readinessBody = root.querySelector<HTMLTableSectionElement>('[data-ve-analyzer="readiness-body"]');
  const veTableView = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  const targetTableView = root.querySelector<HTMLElement>('[data-ve-analyzer="target-table-view"]');
  const runButton = root.querySelector<HTMLButtonElement>('.ve-workbench-run');
  if (!controls || !summary || !empty || !content || !readiness || !advancedReadiness || !readinessBody || !veTableView || !targetTableView || !runButton) {
    throw new Error('VE Analyzer workbench structure is incomplete.');
  }

  const workbenchSelect = (role: string): HTMLSelectElement | undefined => root.querySelector<HTMLSelectElement>(`select[data-role="${role}"]`) ?? undefined;
  const roleSelect = (key: RoleKey): HTMLSelectElement | undefined => workbenchSelect(key) ?? controls.querySelector<HTMLSelectElement>(`select[data-role="${key}"]`) ?? undefined;
  const tableSelect = (): HTMLSelectElement | undefined => workbenchSelect('ve-table');
  const targetTableSelect = (): HTMLSelectElement | undefined => workbenchSelect('target-table');
  const rpmAxisSelect = (): HTMLSelectElement | undefined => workbenchSelect('rpm-axis');
  const loadAxisSelect = (): HTMLSelectElement | undefined => workbenchSelect('load-axis');
  const scopeSelect = (): HTMLSelectElement | undefined => workbenchSelect('scope');
  const presetSelect = (): HTMLSelectElement | undefined => workbenchSelect('preset');

  const addAdvancedSelect = (labelText: string, role: string): HTMLSelectElement => {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = labelText;
    const select = document.createElement('select');
    select.dataset.role = role;
    label.append(caption, select);
    controls.append(label);
    return select;
  };

  const renderTuneTable = (host: HTMLElement, entry: TuneEntry | undefined, axisX?: readonly number[], axisY?: readonly number[]): void => {
    if (!entry?.numericValues) {
      host.innerHTML = '<div class="ve-workbench-table-empty">No table selected</div>';
      return;
    }
    const values = entry.numericValues;
    const finite = values.filter(Number.isFinite);
    const min = finite.length ? Math.min(...finite) : 0;
    const max = finite.length ? Math.max(...finite) : 1;
    const table = document.createElement('table');
    table.className = 've-workbench-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.textContent = entry.units ?? '';
    headRow.append(corner);
    for (let col = 0; col < entry.cols; col += 1) {
      const th = document.createElement('th');
      th.textContent = axisX?.[col] !== undefined ? formatTuneValue(axisX[col]!, 0) : String(col + 1);
      headRow.append(th);
    }
    thead.append(headRow);
    const tbody = document.createElement('tbody');
    for (let row = 0; row < entry.rows; row += 1) {
      const tr = document.createElement('tr');
      const rowHead = document.createElement('th');
      rowHead.textContent = axisY?.[row] !== undefined ? formatTuneValue(axisY[row]!, 0) : String(row + 1);
      tr.append(rowHead);
      for (let col = 0; col < entry.cols; col += 1) {
        const value = values[row * entry.cols + col];
        const td = document.createElement('td');
        if (value !== undefined) {
          td.textContent = formatTuneValue(value, entry.digits);
          td.style.setProperty('--ve-cell-level', colorLevel(value, min, max));
        } else td.textContent = '—';
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(thead, tbody);
    host.replaceChildren(table);
  };

  const renderWorkbenchTables = (): void => {
    const veEntry = tableEntry(tuneModel, tableSelect()?.value ?? '');
    const targetEntry = tableEntry(tuneModel, targetTableSelect()?.value ?? '');
    const rpmAxis = axisValues(tuneModel, rpmAxisSelect()?.value ?? '');
    const loadAxis = axisValues(tuneModel, loadAxisSelect()?.value ?? '');
    renderTuneTable(veTableView, veEntry, rpmAxis, loadAxis);
    const targetAxesMatch = Boolean(targetEntry && veEntry && targetEntry.cols === veEntry.cols && targetEntry.rows === veEntry.rows);
    renderTuneTable(targetTableView, targetEntry, targetAxesMatch ? rpmAxis : undefined, targetAxesMatch ? loadAxis : undefined);
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
    renderWorkbenchTables();
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

    const veTable = tableSelect();
    const targetTable = targetTableSelect();
    const rpmAxis = rpmAxisSelect();
    const loadAxis = loadAxisSelect();
    addRow('MSQ VE table', 'Tune geometry', 'Required', veTable ? selectedText(veTable) : '—', veTable?.value ? 'Resolved' : 'Missing', Boolean(veTable?.value));
    addRow('MSQ target AFR/lambda table', 'Target authority', 'Required', targetTable ? selectedText(targetTable) : '—', targetTable?.value ? 'Resolved' : 'Missing', Boolean(targetTable?.value));
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
    const text = ready ? 'Ready for evidence-map stage' : 'Missing required inputs';
    readiness.textContent = text;
    advancedReadiness.textContent = text;
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

    renderWorkbenchTables();
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
    } else complete = false;

    const resolvedPrimary = ROLES.filter((role) => role.purpose === 'Primary calculation' && roleSelect(role.key)?.value).length;
    const resolvedContext = ROLES.filter((role) => role.purpose === 'Qualification / context' && roleSelect(role.key)?.value).length;
    renderSummary([
      ['Tune source', tuneSourceName ?? 'No MSQ loaded'],
      ['VE table', tableSelect()?.value || 'Not selected'],
      ['Target table', targetTableSelect()?.value || 'Not selected'],
      ['Scope', scope.label],
      ['Qualification preset', preset ? selectedText(preset) : '—'],
      ['Primary roles resolved', `${resolvedPrimary} / ${ROLES.filter((role) => role.purpose === 'Primary calculation').length}`],
      ['Context roles resolved', `${resolvedContext} / ${ROLES.filter((role) => role.purpose === 'Qualification / context').length}`],
      ['Reference samples in scope', referenceSamples.toLocaleString()],
      ['Coverage', complete ? 'Complete' : 'Partial / unresolved'],
      ['Recommendation state', 'Not calculated — workbench only'],
      ['Tune mutation', 'None'],
    ]);

    empty.hidden = ready;
    content.hidden = false;
  };

  const fillChannelSelect = (select: HTMLSelectElement, role: VeRoleDefinition): void => {
    select.replaceChildren(new Option(role.required ? '(select required channel)' : '(none)', ''));
    for (const channel of context.channels) select.add(new Option(analyzerChannelOptionLabel(channel), channel.id));
    const rememberedValue = remembered.get(role.key);
    if (rememberedValue && context.channels.some((channel) => channel.id === rememberedValue)) select.value = rememberedValue;
    else {
      const suggested = suggestAnalyzerChannel('fueling', role.key, context.channels);
      if (suggested) select.value = suggested.id;
    }
    select.addEventListener('change', () => { remembered.set(role.key, select.value); void analyze(); });
  };

  const rebuild = (): void => {
    const previousContext = context;
    controls.replaceChildren();

    const veTable = tableSelect();
    const targetTable = targetTableSelect();
    const rpmAxis = rpmAxisSelect();
    const loadAxis = loadAxisSelect();
    const scope = scopeSelect();
    const preset = presetSelect();
    const actual = workbenchSelect('actual');
    const stft = workbenchSelect('stft');
    if (!veTable || !targetTable || !rpmAxis || !loadAxis || !scope || !preset || !actual || !stft) return;

    veTable.replaceChildren(new Option('(select VE table)', ''), ...veTableCandidates(tuneModel).map((entry) => new Option(entry.name, entry.name)));
    const rememberedVe = remembered.get('ve-table');
    const preferredVe = rememberedVe && [...veTable.options].some((option) => option.value === rememberedVe) ? rememberedVe : preferredVeTableName(tuneModel);
    if (preferredVe) veTable.value = preferredVe;

    targetTable.replaceChildren(new Option('(select target AFR/lambda table)', ''), ...targetMixtureTableCandidates(tuneModel).map((entry) => new Option(entry.name, entry.name)));
    const rememberedTarget = remembered.get('target-table');
    const preferredTarget = rememberedTarget && [...targetTable.options].some((option) => option.value === rememberedTarget)
      ? rememberedTarget
      : preferredTargetMixtureTableName(tuneModel, veTable.value);
    if (preferredTarget) targetTable.value = preferredTarget;

    fillAxisSelectors();
    veTable.addEventListener('change', () => {
      remembered.set('ve-table', veTable.value);
      fillAxisSelectors();
      if (!remembered.get('target-table')) {
        const nextTarget = preferredTargetMixtureTableName(tuneModel, veTable.value);
        if (nextTarget) targetTable.value = nextTarget;
      }
      void analyze();
    }, { once: true });
    targetTable.addEventListener('change', () => { remembered.set('target-table', targetTable.value); renderWorkbenchTables(); void analyze(); }, { once: true });
    rpmAxis.addEventListener('change', () => { remembered.set('rpm-axis', rpmAxis.value); renderWorkbenchTables(); void analyze(); }, { once: true });
    loadAxis.addEventListener('change', () => { remembered.set('load-axis', loadAxis.value); renderWorkbenchTables(); void analyze(); }, { once: true });

    populateAnalyzerScopeSelect(scope, context, remembered.get('scope') ?? 'full');
    scope.addEventListener('change', () => { remembered.set('scope', scope.value); void analyze(); }, { once: true });
    preset.replaceChildren(...PRESETS.map(([value, label]) => new Option(label, value)));
    preset.value = remembered.get('preset') ?? 'recommended';
    preset.addEventListener('change', () => { remembered.set('preset', preset.value); void analyze(); }, { once: true });

    const actualRole = ROLES.find((role) => role.key === 'actual')!;
    const stftRole = ROLES.find((role) => role.key === 'stft')!;
    fillChannelSelect(actual, actualRole);
    fillChannelSelect(stft, stftRole);

    for (const role of ROLES.filter((candidate) => candidate.key !== 'actual' && candidate.key !== 'stft')) {
      const select = addAdvancedSelect(role.label, role.key);
      fillChannelSelect(select, role);
    }

    runButton.onclick = () => { void analyze(); };
    renderWorkbenchTables();
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
