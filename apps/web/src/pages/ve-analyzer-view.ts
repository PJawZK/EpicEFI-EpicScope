import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { analyzerChannelOptionLabel, suggestAnalyzerChannel } from './analyzer-channel-roles';
import {
  assessTargetMixtureTable,
  inferTuneMixtureScale,
  preferredTargetMixtureTableName,
  preferredVeAxisName,
  preferredVeTableName,
  targetMixtureTableCandidates,
  veAxisCandidates,
  veTableCandidates,
  type VeMixtureScale,
} from './ve-analyzer-model';

export interface VeAnalyzerViewController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  setTuneModel(model: TuneModel | undefined, sourceName?: string): void;
  refresh(): void;
}

type RoleKey = 'rpm' | 'load' | 'actual' | 'target' | 've' | 'fuelCommand' | 'dfco' | 'fuelCutReason' | 'aeActive' | 'decelActive' | 'totalCorrection' | 'stft' | 'ltft';
type Purpose = 'Primary calculation' | 'Qualification / context';
interface RoleDef { readonly key: RoleKey; readonly label: string; readonly required: boolean; readonly purpose: Purpose; }

const ROLES: readonly RoleDef[] = [
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

function sameChannels(a: LoggerAnalysisContext['channels'], b: LoggerAnalysisContext['channels']): boolean {
  return a.length === b.length && a.every((channel, index) => channel === b[index]);
}

function selectedText(select: HTMLSelectElement | undefined): string {
  return select?.selectedOptions[0]?.textContent?.trim() || '—';
}

function formatValue(value: number, digits?: number): string {
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

function level(value: number, min: number, max: number): string {
  return !Number.isFinite(value) || min === max ? '0.5' : String(Math.max(0, Math.min(1, (value - min) / (max - min))));
}

function displayScale(scale: VeMixtureScale): string {
  return scale === 'afr' ? 'AFR' : scale === 'lambda' ? 'Lambda' : 'Unknown';
}

function channelMixtureScale(channel: ChannelDefinition | undefined): VeMixtureScale {
  if (!channel) return 'unknown';
  const identity = `${channel.id} ${channel.sourceName} ${channel.displayName ?? ''} ${channel.unit ?? ''}`.toLowerCase();
  if (/lambda|\blam\b/.test(identity)) return 'lambda';
  if (/\bafr\b|air.?fuel/.test(identity)) return 'afr';
  return 'unknown';
}

function preferredActualMixtureChannel(
  channels: readonly ChannelDefinition[],
  scale: Exclude<VeMixtureScale, 'unknown'>,
): ChannelDefinition | undefined {
  const suggested = suggestAnalyzerChannel('fueling', 'actual', channels);
  if (suggested && channelMixtureScale(suggested) === scale) return suggested;
  return channels.find((channel) => channelMixtureScale(channel) === scale);
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let tuneModel: TuneModel | undefined;
  let tuneSourceName: string | undefined;
  let generation = 0;
  let mixtureScaleManuallySelected = false;
  const remembered = new Map<string, string>();

  const root = document.createElement('section');
  root.className = 'specialized-analyzer-view ve-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="specialized-analyzer-banner ve-workbench-banner">
      <div><strong>VE Analyzer · Experimental</strong><span>Two-table workbench with current VE and selected target-mixture table visible throughout analysis.</span></div>
      <span class="specialized-analyzer-badge">EXP</span>
    </div>
    <div class="ve-workbench">
      <section class="ve-workbench-panel">
        <header><div><strong>VE / proposal table</strong><span>Current MSQ VE table; future proposals stay in these coordinates.</span></div><select data-role="ve-table"></select></header>
        <div class="ve-workbench-table-wrap" data-ve-analyzer="ve-table-view"></div>
      </section>
      <section class="ve-workbench-panel">
        <header><div><strong>Target mixture table</strong><span>The selected tune table is shown exactly as stored; AFR and Lambda are not relabeled or silently converted.</span></div><select data-role="target-table"></select></header>
        <div class="ve-workbench-table-wrap" data-ve-analyzer="target-table-view"></div>
      </section>
    </div>
    <div class="ve-workbench-actionbar">
      <button type="button" class="ve-workbench-run">Run Analysis</button>
      <label><span>Mixture scale</span><select data-role="mixture-scale"><option value="afr">AFR</option><option value="lambda">Lambda</option></select></label>
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
    <div class="specialized-analyzer-guidance ve-mixture-warning" data-ve-analyzer="mixture-warning" hidden>
      <strong>Mixture selection needs attention</strong><span></span>
    </div>
    <div class="specialized-analyzer-guidance ve-workbench-guidance"><strong>Current implementation stage</strong><span>Run Analysis validates evidence and scope only. VE recommendations, table mutation and tune writes remain disabled.</span></div>
    <div class="specialized-analyzer-empty"><strong>VE Analyzer needs a loaded log plus VE and target-mixture tune tables.</strong><span>RPM, VE-table load and actual mixture are required log inputs. The selected AFR/Lambda scale must agree with the target table and actual-mixture source.</span></div>
    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary" data-ve-analyzer="summary"></div>
      <details class="specialized-analyzer-options ve-workbench-advanced"><summary>Advanced inputs, qualification and readiness</summary>
        <div class="specialized-analyzer-controls" data-ve-analyzer="controls"></div>
        <section class="specialized-analyzer-events"><header><strong>Input readiness</strong><span data-ve-analyzer="advanced-readiness">Not ready</span></header>
          <div class="specialized-analyzer-table-wrap"><table class="specialized-analyzer-table"><thead><tr><th>Input</th><th>Purpose</th><th>Requirement</th><th>Resolved source</th><th>Status</th></tr></thead><tbody data-ve-analyzer="readiness-body"></tbody></table></div>
        </section>
      </details>
      <details class="specialized-analyzer-options"><summary>Lambda Delay · next implementation stage</summary>
        <div class="specialized-analyzer-guidance"><strong>No delay discovery has run</strong><span>Single-value, RPM-curve and RPM×load-table models remain planned. Discovery will run only from an explicit action.</span></div>
        <div class="specialized-analyzer-options-grid"><label><span>Working model</span><select disabled><option>Single value</option><option>RPM curve</option><option>RPM × load table</option></select></label><button type="button" disabled>Grab lambda delays from log</button></div>
      </details>
    </div>`;

  const controls = root.querySelector<HTMLElement>('[data-ve-analyzer="controls"]')!;
  const summary = root.querySelector<HTMLElement>('[data-ve-analyzer="summary"]')!;
  const empty = root.querySelector<HTMLElement>('.specialized-analyzer-empty')!;
  const content = root.querySelector<HTMLElement>('.specialized-analyzer-content')!;
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]')!;
  const advancedReadiness = root.querySelector<HTMLElement>('[data-ve-analyzer="advanced-readiness"]')!;
  const readinessBody = root.querySelector<HTMLTableSectionElement>('[data-ve-analyzer="readiness-body"]')!;
  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]')!;
  const targetHost = root.querySelector<HTMLElement>('[data-ve-analyzer="target-table-view"]')!;
  const warning = root.querySelector<HTMLElement>('[data-ve-analyzer="mixture-warning"]')!;
  const warningText = warning.querySelector<HTMLElement>('span')!;
  const runButton = root.querySelector<HTMLButtonElement>('.ve-workbench-run')!;

  const select = (role: string): HTMLSelectElement | undefined => root.querySelector<HTMLSelectElement>(`select[data-role="${role}"]`) ?? undefined;
  const roleSelect = (key: RoleKey): HTMLSelectElement | undefined => select(key) ?? controls.querySelector<HTMLSelectElement>(`select[data-role="${key}"]`) ?? undefined;
  const selectedScale = (): Exclude<VeMixtureScale, 'unknown'> => select('mixture-scale')?.value === 'lambda' ? 'lambda' : 'afr';

  const addAdvanced = (role: RoleDef): HTMLSelectElement => {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = role.label;
    const control = document.createElement('select');
    control.dataset.role = role.key;
    label.append(caption, control);
    controls.append(label);
    return control;
  };

  const renderTable = (host: HTMLElement, entry: TuneEntry | undefined, x?: readonly number[], y?: readonly number[]): void => {
    if (!entry?.numericValues) {
      host.innerHTML = '<div class="ve-workbench-table-empty">No table selected</div>';
      return;
    }
    const finite = entry.numericValues.filter(Number.isFinite);
    const min = finite.length ? Math.min(...finite) : 0;
    const max = finite.length ? Math.max(...finite) : 1;
    const table = document.createElement('table');
    table.className = 've-workbench-table';
    const head = document.createElement('tr');
    const corner = document.createElement('th');
    corner.textContent = entry.units ?? '';
    head.append(corner);
    for (let col = 0; col < entry.cols; col += 1) {
      const th = document.createElement('th');
      th.textContent = x?.[col] !== undefined ? formatValue(x[col]!, 0) : String(col + 1);
      head.append(th);
    }
    const thead = document.createElement('thead');
    thead.append(head);
    const tbody = document.createElement('tbody');
    for (let row = 0; row < entry.rows; row += 1) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = y?.[row] !== undefined ? formatValue(y[row]!, 0) : String(row + 1);
      tr.append(th);
      for (let col = 0; col < entry.cols; col += 1) {
        const td = document.createElement('td');
        const value = entry.numericValues[row * entry.cols + col];
        if (value !== undefined) {
          td.textContent = formatValue(value, entry.digits);
          td.style.setProperty('--ve-cell-level', level(value, min, max));
        } else td.textContent = '—';
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(thead, tbody);
    host.replaceChildren(table);
  };

  const renderTables = (): void => {
    const ve = tableEntry(tuneModel, select('ve-table')?.value ?? '');
    const target = tableEntry(tuneModel, select('target-table')?.value ?? '');
    const rpm = axisValues(tuneModel, select('rpm-axis')?.value ?? '');
    const load = axisValues(tuneModel, select('load-axis')?.value ?? '');
    renderTable(veHost, ve, rpm, load);
    const sameGeometry = Boolean(ve && target && ve.rows === target.rows && ve.cols === target.cols);
    renderTable(targetHost, target, sameGeometry ? rpm : undefined, sameGeometry ? load : undefined);
  };

  const mixtureAssessment = (): { readonly valid: boolean; readonly messages: readonly string[]; readonly targetScale: VeMixtureScale; readonly actualScale: VeMixtureScale } => {
    const target = tableEntry(tuneModel, select('target-table')?.value ?? '');
    const assessment = assessTargetMixtureTable(target, selectedScale(), select('ve-table')?.value);
    const actualChannel = context.channels.find((channel) => channel.id === roleSelect('actual')?.value);
    const actualScale = channelMixtureScale(actualChannel);
    const messages = [...assessment.messages];
    if (actualScale !== 'unknown' && actualScale !== selectedScale()) {
      messages.push(`Actual mixture channel looks like ${displayScale(actualScale)}, but VE Analyzer is set to ${displayScale(selectedScale())}.`);
    }
    warning.hidden = messages.length === 0;
    warningText.textContent = messages.join(' ');
    return {
      valid: assessment.status !== 'invalid' && !(actualScale !== 'unknown' && actualScale !== selectedScale()),
      messages,
      targetScale: assessment.scale,
      actualScale,
    };
  };

  const fillAxes = (): void => {
    const veName = select('ve-table')?.value ?? '';
    const rpmSelect = select('rpm-axis');
    const loadSelect = select('load-axis');
    if (!rpmSelect || !loadSelect) return;
    const rpmCandidates = veAxisCandidates(tuneModel, veName, 'rpm');
    const loadCandidates = veAxisCandidates(tuneModel, veName, 'load');
    const rememberedRpm = remembered.get('rpm-axis');
    const rememberedLoad = remembered.get('load-axis');
    rpmSelect.replaceChildren(new Option('(select RPM axis)', ''), ...rpmCandidates.map((entry) => new Option(entry.name, entry.name)));
    loadSelect.replaceChildren(new Option('(select load axis)', ''), ...loadCandidates.map((entry) => new Option(entry.name, entry.name)));
    rpmSelect.value = rememberedRpm && rpmCandidates.some((entry) => entry.name === rememberedRpm) ? rememberedRpm : preferredVeAxisName(tuneModel, veName, 'rpm') ?? '';
    loadSelect.value = rememberedLoad && loadCandidates.some((entry) => entry.name === rememberedLoad) ? rememberedLoad : preferredVeAxisName(tuneModel, veName, 'load') ?? '';
    renderTables();
  };

  const fillRole = (control: HTMLSelectElement, role: RoleDef): void => {
    control.replaceChildren(new Option(role.required ? '(select required channel)' : '(none)', ''), ...context.channels.map((channel) => new Option(analyzerChannelOptionLabel(channel), channel.id)));
    const old = remembered.get(role.key);
    const suggested = role.key === 'actual'
      ? preferredActualMixtureChannel(context.channels, selectedScale())
      : suggestAnalyzerChannel('fueling', role.key, context.channels);
    control.value = old && context.channels.some((channel) => channel.id === old) ? old : suggested?.id ?? '';
    control.onchange = () => {
      remembered.set(role.key, control.value);
      void analyze();
    };
  };

  const renderSummary = (items: readonly [string, string][]): void => {
    summary.replaceChildren(...items.map(([label, value]) => {
      const div = document.createElement('div');
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      div.append(span, strong);
      return div;
    }));
  };

  const renderReadiness = (loaded?: ReadonlyMap<string, LoggerAnalysisTraceContext>): boolean => {
    let ready = true;
    const rows: HTMLTableRowElement[] = [];
    const add = (input: string, purpose: string, requirement: string, source: string, status: string, ok: boolean) => {
      const tr = document.createElement('tr');
      for (const text of [input, purpose, requirement, source, status]) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      rows.push(tr);
      if (!ok && requirement === 'Required') ready = false;
    };

    const mapping = [
      ['ve-table', 'MSQ VE table', 'Tune geometry'],
      ['target-table', 'MSQ target mixture table', 'Target authority'],
      ['rpm-axis', 'MSQ RPM axis', 'Tune geometry'],
      ['load-axis', 'MSQ load axis', 'Tune geometry'],
    ] as const;
    for (const [role, label, purpose] of mapping) {
      const control = select(role);
      add(label, purpose, 'Required', selectedText(control), control?.value ? 'Resolved' : 'Missing', Boolean(control?.value));
    }

    const mixture = mixtureAssessment();
    const target = tableEntry(tuneModel, select('target-table')?.value ?? '');
    add('Mixture scale', 'Target / actual compatibility', 'Required', displayScale(selectedScale()), mixture.valid ? `Resolved · target ${displayScale(mixture.targetScale)}` : 'Mismatch / verify selection', mixture.valid);
    if (target) {
      add('Target table identity', 'Target authority', 'Required', `${target.name}${target.units ? ` [${target.units}]` : ''}`, mixture.valid ? 'Plausible for selected scale' : 'Needs verification', mixture.valid);
    }

    for (const role of ROLES) {
      const control = roleSelect(role.key);
      const id = control?.value ?? '';
      const channel = id ? context.channels.find((candidate) => candidate.id === id) : undefined;
      const loadedState = id && loaded ? loaded.has(id) : undefined;
      let status = channel ? loadedState === false ? 'Selected · unavailable in scope' : loadedState === true ? 'Resolved · loaded' : 'Resolved' : role.required ? 'Missing' : 'Unavailable optional';
      let ok = Boolean(channel) && loadedState !== false;
      if (role.key === 'actual' && channel) {
        const scale = channelMixtureScale(channel);
        if (scale !== 'unknown' && scale !== selectedScale()) {
          status = `Scale mismatch · ${displayScale(scale)}`;
          ok = false;
        }
      }
      add(role.label, role.purpose, role.required ? 'Required' : 'Optional', channel ? analyzerChannelOptionLabel(channel) : '—', status, ok);
    }

    readinessBody.replaceChildren(...rows);
    const text = ready ? 'Ready for evidence-map stage' : 'Missing / incompatible required inputs';
    readiness.textContent = text;
    advancedReadiness.textContent = text;
    return ready;
  };

  async function analyze(): Promise<void> {
    const run = ++generation;
    renderTables();
    renderReadiness();
    const scopeControl = select('scope');
    const scope = scopeControl ? selectedAnalyzerScope(scopeControl, context) : undefined;
    if (!scope) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    const selected = new Map<RoleKey, string>();
    for (const role of ROLES) {
      const value = roleSelect(role.key)?.value;
      if (value) selected.set(role.key, value);
    }
    const bounds = analyzerScopeBounds(scope);
    const requested = [...new Set(selected.values())];
    const traces = requested.length ? await context.loadTraces(requested, bounds.startMs, bounds.endMs) : [];
    if (run !== generation) return;
    const byId = new Map(traces.map((trace) => [trace.channel.id, trace]));
    const ready = renderReadiness(byId);
    const rpmTrace = selected.get('rpm') ? byId.get(selected.get('rpm')!) : undefined;
    let samples = 0;
    let complete = traces.every((trace) => bounds.startMs === undefined || bounds.endMs === undefined ? trace.complete : trace.complete || numericRangeCoversTime(trace.range, bounds.startMs, bounds.endMs));
    if (rpmTrace) {
      const channels = new Map([[rpmTrace.channel.id, { range: rpmTrace.range, complete: rpmTrace.complete }]]);
      const qualified = qualifyNumericSamples({ referenceChannelId: rpmTrace.channel.id, channels, conditions: [], ...(bounds.startMs !== undefined && bounds.endMs !== undefined ? { timeRange: { startMs: bounds.startMs, endMs: bounds.endMs } } : {}) });
      samples = qualified.eligibleSampleCount;
      complete = complete && qualified.complete;
    } else complete = false;

    const target = tableEntry(tuneModel, select('target-table')?.value ?? '');
    const actualChannel = context.channels.find((channel) => channel.id === roleSelect('actual')?.value);
    renderSummary([
      ['Tune source', tuneSourceName ?? 'No MSQ loaded'],
      ['VE table', select('ve-table')?.value || 'Not selected'],
      ['Target table', target?.name || 'Not selected'],
      ['Mixture scale', displayScale(selectedScale())],
      ['Target table scale', displayScale(inferTuneMixtureScale(target))],
      ['Actual mixture scale', displayScale(channelMixtureScale(actualChannel))],
      ['Scope', scope.label],
      ['Qualification', selectedText(select('preset'))],
      ['Reference samples', samples.toLocaleString()],
      ['Coverage', complete ? 'Complete' : 'Partial / unresolved'],
      ['Recommendation', ready ? 'Not calculated — workbench only' : 'Blocked — fix required inputs'],
      ['Tune mutation', 'None'],
    ]);
    empty.hidden = ready;
    content.hidden = false;
  }

  const rebuild = (): void => {
    const oldContext = context;
    controls.replaceChildren();
    const veSelect = select('ve-table')!;
    const targetSelect = select('target-table')!;
    const scaleSelect = select('mixture-scale')!;
    const rpmSelect = select('rpm-axis')!;
    const loadSelect = select('load-axis')!;
    const scopeSelect = select('scope')!;
    const presetSelect = select('preset')!;

    veSelect.replaceChildren(new Option('(select VE table)', ''), ...veTableCandidates(tuneModel).map((entry) => new Option(entry.name, entry.name)));
    const oldVe = remembered.get('ve-table');
    veSelect.value = oldVe && [...veSelect.options].some((option) => option.value === oldVe) ? oldVe : preferredVeTableName(tuneModel) ?? '';

    targetSelect.replaceChildren(
      new Option('(select target mixture table)', ''),
      ...targetMixtureTableCandidates(tuneModel).map((entry) => new Option(`${entry.name}${entry.units ? ` [${entry.units}]` : ''}`, entry.name)),
    );
    const oldTarget = remembered.get('target-table');
    targetSelect.value = oldTarget && [...targetSelect.options].some((option) => option.value === oldTarget) ? oldTarget : preferredTargetMixtureTableName(tuneModel, veSelect.value) ?? '';

    const inferredTargetScale = inferTuneMixtureScale(tableEntry(tuneModel, targetSelect.value));
    const rememberedScale = remembered.get('mixture-scale');
    scaleSelect.value = rememberedScale === 'lambda' || rememberedScale === 'afr'
      ? rememberedScale
      : inferredTargetScale === 'lambda' ? 'lambda' : 'afr';

    fillAxes();
    veSelect.onchange = () => {
      remembered.set('ve-table', veSelect.value);
      fillAxes();
      if (!remembered.get('target-table')) {
        targetSelect.value = preferredTargetMixtureTableName(tuneModel, veSelect.value) ?? '';
        const inferred = inferTuneMixtureScale(tableEntry(tuneModel, targetSelect.value));
        if (inferred !== 'unknown' && !mixtureScaleManuallySelected) scaleSelect.value = inferred;
      }
      void analyze();
    };
    targetSelect.onchange = () => {
      remembered.set('target-table', targetSelect.value);
      mixtureScaleManuallySelected = false;
      const inferred = inferTuneMixtureScale(tableEntry(tuneModel, targetSelect.value));
      if (inferred !== 'unknown') {
        scaleSelect.value = inferred;
        remembered.set('mixture-scale', inferred);
      }
      const actual = select('actual');
      if (actual) {
        const current = context.channels.find((channel) => channel.id === actual.value);
        if (!current || channelMixtureScale(current) !== selectedScale()) {
          actual.value = preferredActualMixtureChannel(context.channels, selectedScale())?.id ?? '';
          remembered.set('actual', actual.value);
        }
      }
      void analyze();
    };
    scaleSelect.onchange = () => {
      mixtureScaleManuallySelected = true;
      remembered.set('mixture-scale', scaleSelect.value);
      const actual = select('actual');
      if (actual) {
        const current = context.channels.find((channel) => channel.id === actual.value);
        if (!current || channelMixtureScale(current) !== selectedScale()) {
          actual.value = preferredActualMixtureChannel(context.channels, selectedScale())?.id ?? '';
          remembered.set('actual', actual.value);
        }
      }
      void analyze();
    };
    rpmSelect.onchange = () => { remembered.set('rpm-axis', rpmSelect.value); void analyze(); };
    loadSelect.onchange = () => { remembered.set('load-axis', loadSelect.value); void analyze(); };

    populateAnalyzerScopeSelect(scopeSelect, context, remembered.get('scope') ?? 'full');
    scopeSelect.onchange = () => { remembered.set('scope', scopeSelect.value); void analyze(); };
    presetSelect.replaceChildren(...PRESETS.map(([value, label]) => new Option(label, value)));
    presetSelect.value = remembered.get('preset') ?? 'recommended';
    presetSelect.onchange = () => { remembered.set('preset', presetSelect.value); void analyze(); };

    fillRole(select('actual')!, ROLES.find((role) => role.key === 'actual')!);
    fillRole(select('stft')!, ROLES.find((role) => role.key === 'stft')!);
    for (const role of ROLES.filter((item) => item.key !== 'actual' && item.key !== 'stft')) fillRole(addAdvanced(role), role);

    runButton.onclick = () => { void analyze(); };
    renderTables();
    if (!sameChannels(oldContext.channels, context.channels) || tuneModel || context.channels.length) void analyze();
  };

  return {
    element: root,
    setContext(next) { context = next; rebuild(); },
    setTuneModel(model, sourceName) { tuneModel = model; tuneSourceName = sourceName; rebuild(); },
    refresh: () => { void analyze(); },
  };
}
