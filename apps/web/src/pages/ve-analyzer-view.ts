import { analyzeAfrDelay, type AfrDelayAnalyzerResult } from '../../../../core/analysis/afr-delay-analyzer';
import { buildVeEvidenceMap, type VeEvidenceMapResult } from '../../../../core/analysis/ve-evidence-map';
import { buildVeProposal, type VeProposalResult } from '../../../../core/analysis/ve-proposal';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';
import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { analyzerChannelOptionLabel, suggestAnalyzerChannel } from './analyzer-channel-roles';
import { assessVeFuelCorrection, type VeFuelCorrectionMode } from './ve-fuel-correction';
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
type RolePurpose = 'Primary calculation' | 'Qualification / context' | 'State exclusion';
interface RoleDef { readonly key: RoleKey; readonly label: string; readonly required: boolean; readonly purpose: RolePurpose; }

const ROLES: readonly RoleDef[] = [
  { key: 'rpm', label: 'RPM', required: true, purpose: 'Primary calculation' },
  { key: 'load', label: 'VE-table load', required: true, purpose: 'Primary calculation' },
  { key: 'actual', label: 'Actual mixture', required: true, purpose: 'Primary calculation' },
  { key: 'target', label: 'Logged target mixture', required: false, purpose: 'Qualification / context' },
  { key: 've', label: 'Effective / runtime VE', required: false, purpose: 'Qualification / context' },
  { key: 'fuelCommand', label: 'Fuel command / injector PW', required: false, purpose: 'Qualification / context' },
  { key: 'dfco', label: 'DFCO state', required: false, purpose: 'State exclusion' },
  { key: 'fuelCutReason', label: 'Fuel-cut reason', required: false, purpose: 'State exclusion' },
  { key: 'aeActive', label: 'AE state', required: false, purpose: 'State exclusion' },
  { key: 'decelActive', label: 'Decel state', required: false, purpose: 'State exclusion' },
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

function selectedText(control: HTMLSelectElement | undefined): string {
  return control?.selectedOptions[0]?.textContent?.trim() || '—';
}

function formatValue(value: number, digits?: number): string {
  if (!Number.isFinite(value)) return '—';
  const precision = Math.max(0, Math.min(3, digits ?? (Math.abs(value) < 20 ? 2 : 1)));
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function tableEntry(model: TuneModel | undefined, name: string): TuneEntry | undefined {
  const entry = model?.byName.get(name);
  return entry?.kind === 'table' && entry.numericValues !== undefined ? entry : undefined;
}

function axisValues(model: TuneModel | undefined, name: string): readonly number[] | undefined {
  return model?.byName.get(name)?.numericValues;
}

function displayScale(scale: VeMixtureScale): string {
  return scale === 'afr' ? 'AFR' : scale === 'lambda' ? 'Lambda' : 'Unknown';
}

function scaleFromText(value: string | undefined): VeMixtureScale {
  const text = value?.trim().toLowerCase() ?? '';
  if (/\bafr\b|air.?fuel/.test(text)) return 'afr';
  if (/lambda|\blam\b/.test(text)) return 'lambda';
  return 'unknown';
}

function channelMixtureScale(channel: ChannelDefinition | undefined): VeMixtureScale {
  if (!channel) return 'unknown';
  const unit = scaleFromText(channel.unit);
  if (unit !== 'unknown') return unit;
  return scaleFromText(`${channel.sourceName} ${channel.displayName}`);
}

function preferredActualMixtureChannel(channels: readonly ChannelDefinition[], scale: Exclude<VeMixtureScale, 'unknown'>): ChannelDefinition | undefined {
  const suggested = suggestAnalyzerChannel('fueling', 'actual', channels);
  if (suggested && channelMixtureScale(suggested) === scale) return suggested;
  return channels.find((channel) => channelMixtureScale(channel) === scale);
}

function sampleValue(range: NumericChannelRange | undefined, sampleIndex: number): number | undefined {
  if (!range) return undefined;
  const local = sampleIndex - range.startSampleIndex;
  if (local < 0 || local >= range.values.length || local >= range.validity.length || range.validity[local] !== 1) return undefined;
  const value = range.values[local];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function active(range: NumericChannelRange | undefined, sampleIndex: number): boolean {
  const value = sampleValue(range, sampleIndex);
  return value !== undefined && Math.abs(value) > 0.000001;
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let tuneModel: TuneModel | undefined;
  let tuneSourceName: string | undefined;
  let runGeneration = 0;
  let delayGeneration = 0;
  let result: VeEvidenceMapResult | undefined;
  let proposal: VeProposalResult | undefined;
  let delayDiscovery: AfrDelayAnalyzerResult | undefined;
  const remembered = new Map<string, string>();

  const root = document.createElement('section');
  root.className = 'specialized-analyzer-view ve-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="specialized-analyzer-banner ve-workbench-banner"><div><strong>VE Analyzer · Experimental</strong><span>Target-table-aware VE proposal workbench. Source table/channel names are shown exactly as supplied.</span></div><span class="specialized-analyzer-badge">EXP</span></div>
    <div class="ve-workbench">
      <section class="ve-workbench-panel"><header><div><strong>VE / proposal table</strong><span>Original MSQ VE stays immutable; evidence and guarded proposals are overlaid after Run Analysis.</span></div><select data-role="ve-table"></select></header><div class="ve-workbench-table-wrap" data-ve-analyzer="ve-table-view"></div></section>
      <section class="ve-workbench-panel"><header><div><strong>Target mixture table</strong><span>Exact MSQ target table and its own axes; AFR/Lambda are not relabeled or silently converted.</span></div><select data-role="target-table"></select></header><div class="ve-workbench-table-wrap" data-ve-analyzer="target-table-view"></div></section>
    </div>
    <div class="ve-workbench-actionbar">
      <button type="button" class="ve-workbench-run">Run Analysis</button>
      <label><span>Mixture scale</span><select data-role="mixture-scale"><option value="afr">AFR</option><option value="lambda">Lambda</option></select></label>
      <label><span>Scope</span><select data-role="scope"></select></label>
      <label><span>Qualification</span><select data-role="preset"></select></label>
      <span class="ve-workbench-state" data-ve-analyzer="readiness">Not ready</span>
    </div>
    <div class="ve-workbench-quick-controls">
      <label><span>VE RPM axis</span><select data-role="rpm-axis"></select></label>
      <label><span>VE load axis</span><select data-role="load-axis"></select></label>
      <label><span>Target RPM axis</span><select data-role="target-rpm-axis"></select></label>
      <label><span>Target load axis</span><select data-role="target-load-axis"></select></label>
      <label><span>Actual mixture</span><select data-role="actual"></select></label>
      <label><span>EGO / STFT correction</span><select data-role="stft"></select></label>
      <label><span>Fuel correction handling</span><select data-role="fuel-correction-mode"><option value="auto">Auto · known percent trim only</option><option value="off">Context only</option><option value="percent">Percent fuel applied (+5 = +5%)</option></select></label>
      <label><span>Min RPM</span><input data-role="min-rpm" type="number" value="500"></label>
      <label><span>Max RPM</span><input data-role="max-rpm" type="number" value="8500"></label>
      <label><span>Min load</span><input data-role="min-load" type="number"></label>
      <label><span>Max load</span><input data-role="max-load" type="number"></label>
      <label><span>Stable ms</span><input data-role="stable-ms" type="number" value="300" min="0"></label>
      <label><span>Working delay ms</span><input data-role="delay-ms" type="number" value="0" min="0"></label>
      <label><span>Prior weight</span><input data-role="prior-weight" type="number" value="20" min="0"></label>
      <label><span>Min evidence weight</span><input data-role="min-evidence-weight" type="number" value="5" min="0"></label>
      <label><span>Max VE change</span><input data-role="max-absolute-change" type="number" value="50" min="0"></label>
      <label><span>Max VE change %</span><input data-role="max-percent-change" type="number" value="50" min="0"></label>
    </div>
    <div class="specialized-analyzer-guidance ve-mixture-warning" data-ve-analyzer="mixture-warning" hidden><strong>Mixture selection needs attention</strong><span></span></div>
    <div class="specialized-analyzer-guidance ve-workbench-guidance"><strong>Proposal stage</strong><span data-ve-analyzer="stage">Run Analysis applies the visible working delay by timestamp, builds VE-node evidence, compensates only explicitly understood fuel corrections, and calculates guarded proposals. The original MSQ remains unchanged.</span></div>
    <div class="specialized-analyzer-empty"><strong>VE Analyzer needs a loaded log plus valid VE/target tables, axes and primary channels.</strong><span>Run Analysis is explicit; changing setup invalidates the prior result instead of recomputing automatically.</span></div>
    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary" data-ve-analyzer="summary"></div>
      <details class="specialized-analyzer-options" open>
        <summary>Lambda Delay</summary>
        <div class="specialized-analyzer-options-grid">
          <label><span>Fuel command Δ threshold</span><input data-role="delay-command-threshold" type="number" value="0.2" min="0" step="any"></label>
          <label><span data-ve-analyzer="delay-response-label">AFR response Δ threshold</span><input data-role="delay-response-threshold" type="number" value="0.2" min="0" step="any"></label>
          <label><span>Search window ms</span><input data-role="delay-search-window" type="number" value="1200" min="1"></label>
          <label><span>Minimum event spacing ms</span><input data-role="delay-event-spacing" type="number" value="250" min="0"></label>
          <button type="button" data-ve-analyzer="grab-delay">Grab lambda delays from log</button>
          <button type="button" data-ve-analyzer="use-delay" disabled>Use recommendation</button>
        </div>
        <div class="specialized-analyzer-guidance"><strong data-ve-analyzer="delay-result-title">No delay recommendation calculated</strong><span data-ve-analyzer="delay-result">Discovery uses fuel-command transitions in the selected scope. It does not overwrite the working delay until Use recommendation is pressed.</span></div>
      </details>
      <details class="specialized-analyzer-options ve-workbench-advanced"><summary>Advanced inputs, qualification and readiness</summary><div class="specialized-analyzer-controls" data-ve-analyzer="controls"></div><section class="specialized-analyzer-events"><header><strong>Input readiness</strong><span data-ve-analyzer="advanced-readiness">Not ready</span></header><div class="specialized-analyzer-table-wrap"><table class="specialized-analyzer-table"><thead><tr><th>Input</th><th>Purpose</th><th>Requirement</th><th>Resolved source</th><th>Status</th></tr></thead><tbody data-ve-analyzer="readiness-body"></tbody></table></div></section></details>
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
  const stageText = root.querySelector<HTMLElement>('[data-ve-analyzer="stage"]')!;
  const runButton = root.querySelector<HTMLButtonElement>('.ve-workbench-run')!;
  const grabDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]')!;
  const useDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="use-delay"]')!;
  const delayResultTitle = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-result-title"]')!;
  const delayResultText = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-result"]')!;
  const delayResponseLabel = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-response-label"]')!;

  const select = (role: string) => root.querySelector<HTMLSelectElement>(`select[data-role="${role}"]`) ?? undefined;
  const input = (role: string) => root.querySelector<HTMLInputElement>(`input[data-role="${role}"]`) ?? undefined;
  const roleSelect = (key: RoleKey) => select(key) ?? controls.querySelector<HTMLSelectElement>(`select[data-role="${key}"]`) ?? undefined;
  const selectedScale = (): Exclude<VeMixtureScale, 'unknown'> => select('mixture-scale')?.value === 'lambda' ? 'lambda' : 'afr';
  const fuelCorrectionMode = (): VeFuelCorrectionMode => {
    const value = select('fuel-correction-mode')?.value;
    return value === 'off' || value === 'percent' ? value : 'auto';
  };

  const selectedChannel = (key: RoleKey): ChannelDefinition | undefined => {
    const id = roleSelect(key)?.value;
    return id ? context.channels.find((channel) => channel.id === id) : undefined;
  };

  const currentFuelCorrection = () => assessVeFuelCorrection(selectedChannel('stft'), fuelCorrectionMode());

  const readNumber = (role: string): number | undefined => {
    const raw = input(role)?.value.trim();
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const nonNegativeSetting = (role: string): number | undefined => {
    const value = readNumber(role);
    return value !== undefined && value >= 0 ? value : undefined;
  };

  const positiveSetting = (role: string): number | undefined => {
    const value = readNumber(role);
    return value !== undefined && value > 0 ? value : undefined;
  };

  const addAdvanced = (role: RoleDef): HTMLSelectElement => {
    const label = document.createElement('label');
    const caption = document.createElement('span'); caption.textContent = role.label;
    const control = document.createElement('select'); control.dataset.role = role.key;
    label.append(caption, control); controls.append(label); return control;
  };

  const tableScale = (entry: TuneEntry | undefined): { min: number; max: number } => {
    const finite = entry?.numericValues?.filter(Number.isFinite) ?? [];
    return { min: finite.length ? Math.min(...finite) : 0, max: finite.length ? Math.max(...finite) : 1 };
  };

  const renderTable = (host: HTMLElement, entry: TuneEntry | undefined, x?: readonly number[], y?: readonly number[], evidence?: VeEvidenceMapResult, proposed?: VeProposalResult): void => {
    if (!entry?.numericValues) { host.innerHTML = '<div class="ve-workbench-table-empty">No table selected</div>'; return; }
    const scale = tableScale(entry);
    const table = document.createElement('table'); table.className = 've-workbench-table';
    const thead = document.createElement('thead'); const head = document.createElement('tr'); const corner = document.createElement('th'); corner.textContent = entry.units ?? ''; head.append(corner);
    for (let col = 0; col < entry.cols; col += 1) { const th = document.createElement('th'); th.textContent = x?.[col] !== undefined ? formatValue(x[col]!, 0) : String(col + 1); head.append(th); }
    thead.append(head);
    const tbody = document.createElement('tbody');
    for (let row = 0; row < entry.rows; row += 1) {
      const tr = document.createElement('tr'); const rowHead = document.createElement('th'); rowHead.textContent = y?.[row] !== undefined ? formatValue(y[row]!, 0) : String(row + 1); tr.append(rowHead);
      for (let col = 0; col < entry.cols; col += 1) {
        const td = document.createElement('td'); const index = row * entry.cols + col; const current = entry.numericValues[index];
        if (current !== undefined && Number.isFinite(current)) {
          const proposalCell = proposed?.cells[index]; const main = document.createElement('span');
          main.textContent = proposalCell?.state === 'measured' && proposalCell.proposedValue !== undefined ? `${formatValue(current, entry.digits)} → ${formatValue(proposalCell.proposedValue, entry.digits)}` : formatValue(current, entry.digits);
          td.append(main); td.style.setProperty('--ve-cell-level', scale.min === scale.max ? '0.5' : String(Math.max(0, Math.min(1, (current - scale.min) / (scale.max - scale.min)))));
          const evidenceCell = evidence?.cells[index];
          if (proposalCell && proposalCell.state !== 'no-evidence') {
            const small = document.createElement('small');
            if (proposalCell.state === 'measured') small.textContent = `${formatPercent(proposalCell.changePercent)} · w ${proposalCell.totalWeight.toFixed(1)} · n ${proposalCell.sampleCount}`;
            else if (proposalCell.state === 'weak-evidence') small.textContent = `weak · raw ${formatPercent(proposalCell.changePercent)} · w ${proposalCell.totalWeight.toFixed(1)}`;
            else small.textContent = `withheld · raw ${formatPercent(proposalCell.changePercent)}`;
            small.style.display = 'block'; td.append(small);
            td.title = proposalCell.state === 'measured'
              ? `Measured proposal. Current ${formatValue(current, entry.digits)}, proposed ${formatValue(proposalCell.proposedValue!, entry.digits)}, change ${formatPercent(proposalCell.changePercent)}, weight ${proposalCell.totalWeight.toFixed(3)}, samples ${proposalCell.sampleCount}.`
              : proposalCell.state === 'weak-evidence'
                ? `Weak evidence only. Raw candidate ${formatValue(proposalCell.evidenceCandidate!, entry.digits)} (${formatPercent(proposalCell.changePercent)}); no proposal is emitted.`
                : `Recommendation withheld by configured change limits. Raw candidate ${formatValue(proposalCell.evidenceCandidate!, entry.digits)} (${formatPercent(proposalCell.changePercent)}).`;
          } else if (evidenceCell && evidenceCell.totalWeight > 0) {
            const small = document.createElement('small'); small.textContent = `${formatPercent(evidenceCell.correctionPercent)} · w ${evidenceCell.totalWeight.toFixed(1)} · n ${evidenceCell.sampleCount}`; small.style.display = 'block'; td.append(small);
          }
        } else td.textContent = '—';
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(thead, tbody); host.replaceChildren(table);
  };

  const renderTables = (): void => {
    const ve = tableEntry(tuneModel, select('ve-table')?.value ?? ''); const target = tableEntry(tuneModel, select('target-table')?.value ?? '');
    renderTable(veHost, ve, axisValues(tuneModel, select('rpm-axis')?.value ?? ''), axisValues(tuneModel, select('load-axis')?.value ?? ''), result, proposal);
    renderTable(targetHost, target, axisValues(tuneModel, select('target-rpm-axis')?.value ?? ''), axisValues(tuneModel, select('target-load-axis')?.value ?? ''));
  };

  const mixtureAssessment = () => {
    const target = tableEntry(tuneModel, select('target-table')?.value ?? ''); const assessment = assessTargetMixtureTable(target, selectedScale(), select('ve-table')?.value);
    const actualChannel = selectedChannel('actual'); const actualScale = channelMixtureScale(actualChannel); const messages = [...assessment.messages];
    if (actualScale !== 'unknown' && actualScale !== selectedScale()) messages.push(`Actual mixture source is ${displayScale(actualScale)}, but VE Analyzer is set to ${displayScale(selectedScale())}.`);
    warning.hidden = messages.length === 0; warningText.textContent = messages.join(' ');
    return { valid: assessment.status !== 'invalid' && (actualScale === 'unknown' || actualScale === selectedScale()), targetScale: assessment.scale };
  };

  const renderSummary = (items: readonly [string, string][]) => {
    summary.replaceChildren(...items.map(([label, value]) => { const div = document.createElement('div'); const span = document.createElement('span'); span.textContent = label; const strong = document.createElement('strong'); strong.textContent = value; div.append(span, strong); return div; }));
  };

  const authoritySettingsValid = (): boolean => ['delay-ms', 'prior-weight', 'min-evidence-weight', 'max-absolute-change', 'max-percent-change', 'stable-ms'].every((role) => nonNegativeSetting(role) !== undefined);
  const delaySettingsValid = (): boolean => positiveSetting('delay-command-threshold') !== undefined && positiveSetting('delay-response-threshold') !== undefined && positiveSetting('delay-search-window') !== undefined && nonNegativeSetting('delay-event-spacing') !== undefined;

  const renderDelayDiscovery = (): void => {
    delayResponseLabel.textContent = `${displayScale(selectedScale())} response Δ threshold`;
    const actual = roleSelect('actual')?.value; const fuel = roleSelect('fuelCommand')?.value;
    grabDelayButton.disabled = !actual || !fuel || !delaySettingsValid();
    const distribution = delayDiscovery?.onsetDelay;
    useDelayButton.disabled = !distribution;
    if (!delayDiscovery) {
      delayResultTitle.textContent = 'No delay recommendation calculated';
      delayResultText.textContent = fuel ? 'Discovery uses fuel-command transitions in the selected scope. It does not overwrite the working delay until Use recommendation is pressed.' : 'Select a fuel-command / injector-PW source under Advanced inputs before delay discovery.';
      return;
    }
    if (!distribution) {
      delayResultTitle.textContent = 'No usable delay recommendation';
      delayResultText.textContent = `${delayDiscovery.usableEventCount} usable events from ${delayDiscovery.candidateEventCount} candidates; ${delayDiscovery.rejectedNoResponseCount} no-response, ${delayDiscovery.rejectedOverlapCount} overlap and ${delayDiscovery.rejectedGapCount} gap rejections. Adjust the visible thresholds only if the log evidence justifies it.`;
      return;
    }
    delayResultTitle.textContent = `Recommended single delay ${Math.round(distribution.medianMs)} ms · ${delayDiscovery.evidenceStrength} evidence`;
    delayResultText.textContent = `${delayDiscovery.usableEventCount}/${delayDiscovery.candidateEventCount} usable events · onset P10 ${Math.round(distribution.p10Ms)} ms / median ${Math.round(distribution.medianMs)} ms / P90 ${Math.round(distribution.p90Ms)} ms${delayDiscovery.medianT50Ms !== undefined ? ` · median T50 ${Math.round(delayDiscovery.medianT50Ms)} ms` : ''}${delayDiscovery.medianT90Ms !== undefined ? ` · median T90 ${Math.round(delayDiscovery.medianT90Ms)} ms` : ''}. Recommendation remains separate from the working delay.`;
  };

  const invalidate = (): void => {
    runGeneration += 1; result = undefined; proposal = undefined; renderTables();
    stageText.textContent = 'Setup changed. Run Analysis to rebuild the delayed evidence and guarded VE proposal; no tune state is modified.';
    renderReadiness();
  };

  const clearDelayDiscovery = (): void => { delayGeneration += 1; delayDiscovery = undefined; renderDelayDiscovery(); };

  const renderReadiness = (loaded?: ReadonlyMap<string, NumericChannelRange>): boolean => {
    let ready = true; const rows: HTMLTableRowElement[] = [];
    const add = (name: string, purpose: string, requirement: string, source: string, status: string, ok: boolean) => {
      const tr = document.createElement('tr'); for (const text of [name, purpose, requirement, source, status]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); } rows.push(tr); if (!ok && requirement === 'Required') ready = false;
    };
    for (const [role, label] of [['ve-table', 'MSQ VE table'], ['rpm-axis', 'VE RPM axis'], ['load-axis', 'VE load axis'], ['target-table', 'MSQ target mixture table'], ['target-rpm-axis', 'Target RPM axis'], ['target-load-axis', 'Target load axis']] as const) {
      const control = select(role); add(label, 'Tune geometry', 'Required', selectedText(control), control?.value ? 'Resolved' : 'Missing', Boolean(control?.value));
    }
    const mix = mixtureAssessment(); add('Mixture scale', 'Target / actual compatibility', 'Required', displayScale(selectedScale()), mix.valid ? `Resolved · target ${displayScale(mix.targetScale)}` : 'Mismatch / verify', mix.valid);
    add('Proposal settings', 'Delay / prior / authority', 'Required', `${nonNegativeSetting('delay-ms') ?? '—'} ms delay`, authoritySettingsValid() ? 'Resolved' : 'Enter non-negative numeric values', authoritySettingsValid());

    const correctionChannel = selectedChannel('stft');
    const correction = currentFuelCorrection();
    const correctionLoaded = correctionChannel && loaded ? loaded.has(correctionChannel.id) : undefined;
    const correctionOk = !correction.applicable || (Boolean(correctionChannel) && correctionLoaded !== false);
    add(
      'Fuel correction compensation',
      'Base-VE attribution',
      correction.applicable ? 'Required' : 'Optional',
      correctionChannel ? analyzerChannelOptionLabel(correctionChannel) : '—',
      correction.applicable
        ? correctionLoaded === false ? 'Required source unavailable in scope' : `${correction.interpretation} · ${correction.reason}`
        : `Context only · ${correction.reason}`,
      correctionOk,
    );

    for (const role of ROLES) {
      const control = roleSelect(role.key); const id = control?.value ?? ''; const channel = id ? context.channels.find((candidate) => candidate.id === id) : undefined; const loadState = loaded && id ? loaded.has(id) : undefined; const ok = Boolean(channel) && loadState !== false;
      add(role.label, role.purpose, role.required ? 'Required' : 'Optional', channel ? analyzerChannelOptionLabel(channel) : '—', channel ? loadState === false ? 'Unavailable in scope' : loadState === true ? 'Resolved · loaded' : 'Resolved' : role.required ? 'Missing' : 'Unavailable optional', ok);
    }
    readinessBody.replaceChildren(...rows);
    const text = ready ? proposal ? 'VE proposal calculated' : 'Ready · press Run Analysis' : 'Missing / incompatible required inputs'; readiness.textContent = text; advancedReadiness.textContent = text; runButton.disabled = !ready; renderDelayDiscovery(); return ready;
  };

  const fillAxis = (role: 'rpm-axis' | 'load-axis' | 'target-rpm-axis' | 'target-load-axis', tableRole: 've-table' | 'target-table', kind: 'rpm' | 'load') => {
    const control = select(role)!; const tableName = select(tableRole)?.value ?? ''; const candidates = veAxisCandidates(tuneModel, tableName, kind); const old = remembered.get(role);
    control.replaceChildren(new Option(`(select ${kind} axis)`, ''), ...candidates.map((entry) => new Option(entry.name, entry.name)));
    control.value = old && candidates.some((entry) => entry.name === old) ? old : preferredVeAxisName(tuneModel, tableName, kind) ?? '';
    control.onchange = () => { remembered.set(role, control.value); invalidate(); };
  };

  const fillRole = (control: HTMLSelectElement, role: RoleDef) => {
    control.replaceChildren(new Option(role.required ? '(select required channel)' : '(none)', ''), ...context.channels.map((channel) => new Option(analyzerChannelOptionLabel(channel), channel.id)));
    const old = remembered.get(role.key); const suggested = role.key === 'actual' ? preferredActualMixtureChannel(context.channels, selectedScale()) : suggestAnalyzerChannel('fueling', role.key, context.channels);
    control.value = old && context.channels.some((channel) => channel.id === old) ? old : suggested?.id ?? '';
    control.onchange = () => { remembered.set(role.key, control.value); if (role.key === 'actual' || role.key === 'fuelCommand' || role.key === 'rpm' || role.key === 'load') clearDelayDiscovery(); invalidate(); };
  };

  const stateFilteredIndices = (reference: NumericChannelRange, traces: ReadonlyMap<string, NumericChannelRange>): { indices: number[]; excluded: number } => {
    const useStateExclusions = (select('preset')?.value ?? 'recommended') !== 'custom'; const ranges = (key: RoleKey) => { const id = roleSelect(key)?.value; return id ? traces.get(id) : undefined; };
    const dfco = ranges('dfco'); const fuelCut = ranges('fuelCutReason'); const ae = ranges('aeActive'); const decel = ranges('decelActive'); const indices: number[] = []; let excluded = 0;
    for (let local = 0; local < reference.values.length; local += 1) { const sampleIndex = reference.startSampleIndex + local; if (reference.validity[local] !== 1) continue; if (useStateExclusions && (active(dfco, sampleIndex) || active(fuelCut, sampleIndex) || active(ae, sampleIndex) || active(decel, sampleIndex))) { excluded += 1; continue; } indices.push(sampleIndex); }
    return { indices, excluded };
  };

  async function runDelayDiscovery(): Promise<void> {
    renderDelayDiscovery(); if (grabDelayButton.disabled) return;
    const actualId = roleSelect('actual')?.value; const fuelId = roleSelect('fuelCommand')?.value; if (!actualId || !fuelId) return;
    const scope = select('scope') ? selectedAnalyzerScope(select('scope')!, context) : undefined; if (!scope) return;
    const rpmId = roleSelect('rpm')?.value; const loadId = roleSelect('load')?.value; const ids = [...new Set([actualId, fuelId, rpmId, loadId].filter((id): id is string => Boolean(id)))];
    const bounds = analyzerScopeBounds(scope); const generation = ++delayGeneration; delayResultTitle.textContent = 'Analyzing delay evidence…'; delayResultText.textContent = 'Searching isolated fuel-command transitions and observed mixture responses in the selected scope.';
    const loaded = await context.loadTraces(ids, bounds.startMs, bounds.endMs); if (generation !== delayGeneration) return;
    const ranges = new Map(loaded.map((trace) => [trace.channel.id, trace.range])); const actual = ranges.get(actualId); const fuel = ranges.get(fuelId); if (!actual || !fuel) { delayDiscovery = undefined; renderDelayDiscovery(); return; }
    delayDiscovery = analyzeAfrDelay({ actualAfr: actual, fuelCommand: fuel, ...(rpmId && ranges.get(rpmId) ? { rpm: ranges.get(rpmId)! } : {}), ...(loadId && ranges.get(loadId) ? { load: ranges.get(loadId)! } : {}) }, {
      commandDeltaThreshold: positiveSetting('delay-command-threshold')!, afrResponseThreshold: positiveSetting('delay-response-threshold')!, searchWindowMs: positiveSetting('delay-search-window')!, minimumEventSpacingMs: nonNegativeSetting('delay-event-spacing')!, responsePolarity: 'inverse',
    });
    if (generation !== delayGeneration) return; renderDelayDiscovery();
  }

  async function runAnalysis(): Promise<void> {
    if (!renderReadiness()) return; const run = ++runGeneration; result = undefined; proposal = undefined;
    const scope = select('scope') ? selectedAnalyzerScope(select('scope')!, context) : undefined; const ve = tableEntry(tuneModel, select('ve-table')?.value ?? ''); const target = tableEntry(tuneModel, select('target-table')?.value ?? '');
    const veRpm = axisValues(tuneModel, select('rpm-axis')?.value ?? ''); const veLoad = axisValues(tuneModel, select('load-axis')?.value ?? ''); const targetRpm = axisValues(tuneModel, select('target-rpm-axis')?.value ?? ''); const targetLoad = axisValues(tuneModel, select('target-load-axis')?.value ?? '');
    if (!scope || !ve?.numericValues || !target?.numericValues || !veRpm || !veLoad || !targetRpm || !targetLoad) return;
    const ids = [...new Set(ROLES.map((role) => roleSelect(role.key)?.value).filter((id): id is string => Boolean(id)))]; const bounds = analyzerScopeBounds(scope); const loaded = await context.loadTraces(ids, bounds.startMs, bounds.endMs); if (run !== runGeneration) return;
    const rangeMap = new Map(loaded.map((trace) => [trace.channel.id, trace.range])); if (!renderReadiness(rangeMap)) return;
    const rpm = rangeMap.get(roleSelect('rpm')!.value); const load = rangeMap.get(roleSelect('load')!.value); const actual = rangeMap.get(roleSelect('actual')!.value); if (!rpm || !load || !actual) return;
    const filtered = stateFilteredIndices(rpm, rangeMap); const minimumRpm = readNumber('min-rpm'); const maximumRpm = readNumber('max-rpm'); const minimumLoad = readNumber('min-load'); const maximumLoad = readNumber('max-load'); const delayMs = nonNegativeSetting('delay-ms')!;

    const correctionChannel = selectedChannel('stft');
    const correctionAssessment = currentFuelCorrection();
    const correctionRange = correctionChannel ? rangeMap.get(correctionChannel.id) : undefined;
    if (correctionAssessment.applicable && !correctionRange) return;

    result = buildVeEvidenceMap({
      actualMixture: actual,
      rpm,
      load,
      target: { rpmBins: targetRpm, loadBins: targetLoad, values: target.numericValues, rows: target.rows, cols: target.cols },
      veRpmBins: veRpm,
      veLoadBins: veLoad,
      sampleIndices: filtered.indices,
      ...(correctionAssessment.applicable && correctionRange ? { fuelCorrectionPercent: correctionRange } : {}),
    }, {
      ...(minimumRpm !== undefined ? { minimumRpm } : {}),
      ...(maximumRpm !== undefined ? { maximumRpm } : {}),
      ...(minimumLoad !== undefined ? { minimumLoad } : {}),
      ...(maximumLoad !== undefined ? { maximumLoad } : {}),
      minimumStableDurationMs: nonNegativeSetting('stable-ms')!,
      delayMs,
      compensateFuelCorrectionPercent: correctionAssessment.applicable,
    });

    proposal = buildVeProposal(ve.numericValues, ve.rows, ve.cols, result, { priorWeight: nonNegativeSetting('prior-weight')!, minimumEvidenceWeight: nonNegativeSetting('min-evidence-weight')!, maximumAbsoluteChange: nonNegativeSetting('max-absolute-change')!, maximumPercentChange: nonNegativeSetting('max-percent-change')! }); if (run !== runGeneration) return;
    const complete = loaded.every((trace) => bounds.startMs === undefined || bounds.endMs === undefined ? trace.complete : trace.complete || numericRangeCoversTime(trace.range, bounds.startMs, bounds.endMs)); renderTables();
    const correctionSource = correctionChannel ? analyzerChannelOptionLabel(correctionChannel) : 'None';
    renderSummary([
      ['Tune source', tuneSourceName ?? 'No MSQ loaded'], ['VE table', ve.name], ['Target table', target.name], ['Mixture scale', displayScale(selectedScale())], ['Scope', scope.label], ['Qualification', selectedText(select('preset'))], ['Working delay', `${delayMs} ms`],
      ['Fuel correction source', correctionSource], ['Fuel correction handling', correctionAssessment.applicable ? 'Compensated · percent fuel applied' : 'Context only'], ['Fuel correction samples', result.fuelCorrectionCompensated ? `${result.fuelCorrectionCompensatedSampleCount.toLocaleString()} compensated · ${result.fuelCorrectionUnavailableSampleCount.toLocaleString()} unavailable` : 'Not applied'],
      ['Input samples', result.inputSampleCount.toLocaleString()], ['State-excluded samples', filtered.excluded.toLocaleString()], ['Delay unavailable', result.delayUnavailableSampleCount.toLocaleString()], ['Stable eligible samples', result.eligibleSampleCount.toLocaleString()], ['Transient rejected', result.transientRejectedSampleCount.toLocaleString()], ['Contributing samples', result.contributingSampleCount.toLocaleString()], ['Measured proposal cells', proposal.measuredCellCount.toLocaleString()], ['Weak evidence cells', proposal.weakCellCount.toLocaleString()], ['Withheld by limits', proposal.withheldCellCount.toLocaleString()], ['No-evidence cells', proposal.noEvidenceCellCount.toLocaleString()], ['Prior weight', String(nonNegativeSetting('prior-weight'))], ['Minimum evidence weight', String(nonNegativeSetting('min-evidence-weight'))], ['Change limits', `±${nonNegativeSetting('max-absolute-change')} VE / ±${nonNegativeSetting('max-percent-change')}%`], ['Coverage', complete ? 'Complete' : 'Partial decoded'], ['Tune mutation', 'None'],
    ]);
    stageText.textContent = correctionAssessment.applicable
      ? 'Guarded VE proposal calculated with timestamp delay alignment and known percent fuel-correction compensation. Original MSQ values remain unchanged; weak and over-limit cells are not proposed.'
      : 'Guarded VE proposal calculated with timestamp delay alignment. The selected fuel-correction source is context-only because its applied-fuel semantics were not asserted or recognized. Original MSQ values remain unchanged.';
    empty.hidden = true; content.hidden = false; renderReadiness(rangeMap);
  }

  const syncDelayResponseDefault = (): void => {
    const field = input('delay-response-threshold'); if (!field) return; const auto = field.dataset.auto !== 'false'; if (auto) field.value = selectedScale() === 'lambda' ? '0.015' : '0.2'; delayResponseLabel.textContent = `${displayScale(selectedScale())} response Δ threshold`;
  };

  const rebuild = (): void => {
    controls.replaceChildren(); result = undefined; proposal = undefined; delayDiscovery = undefined;
    const veSelect = select('ve-table')!; const targetSelect = select('target-table')!; const scaleSelect = select('mixture-scale')!; const scopeSelect = select('scope')!; const presetSelect = select('preset')!; const correctionModeSelect = select('fuel-correction-mode')!;
    veSelect.replaceChildren(new Option('(select VE table)', ''), ...veTableCandidates(tuneModel).map((entry) => new Option(entry.name, entry.name))); veSelect.value = remembered.get('ve-table') && [...veSelect.options].some((option) => option.value === remembered.get('ve-table')) ? remembered.get('ve-table')! : preferredVeTableName(tuneModel) ?? '';
    targetSelect.replaceChildren(new Option('(select target mixture table)', ''), ...targetMixtureTableCandidates(tuneModel).map((entry) => new Option(`${entry.name}${entry.units ? ` [${entry.units}]` : ''}`, entry.name))); targetSelect.value = remembered.get('target-table') && [...targetSelect.options].some((option) => option.value === remembered.get('target-table')) ? remembered.get('target-table')! : preferredTargetMixtureTableName(tuneModel, veSelect.value) ?? '';
    const inferred = inferTuneMixtureScale(tableEntry(tuneModel, targetSelect.value)); scaleSelect.value = remembered.get('mixture-scale') === 'lambda' || remembered.get('mixture-scale') === 'afr' ? remembered.get('mixture-scale')! : inferred === 'lambda' ? 'lambda' : 'afr'; syncDelayResponseDefault();
    correctionModeSelect.value = remembered.get('fuel-correction-mode') ?? 'auto';
    fillAxis('rpm-axis', 've-table', 'rpm'); fillAxis('load-axis', 've-table', 'load'); fillAxis('target-rpm-axis', 'target-table', 'rpm'); fillAxis('target-load-axis', 'target-table', 'load');
    veSelect.onchange = () => { remembered.set('ve-table', veSelect.value); fillAxis('rpm-axis', 've-table', 'rpm'); fillAxis('load-axis', 've-table', 'load'); invalidate(); };
    targetSelect.onchange = () => { remembered.set('target-table', targetSelect.value); const scale = inferTuneMixtureScale(tableEntry(tuneModel, targetSelect.value)); if (scale !== 'unknown') { scaleSelect.value = scale; remembered.set('mixture-scale', scale); syncDelayResponseDefault(); clearDelayDiscovery(); } fillAxis('target-rpm-axis', 'target-table', 'rpm'); fillAxis('target-load-axis', 'target-table', 'load'); invalidate(); };
    scaleSelect.onchange = () => { remembered.set('mixture-scale', scaleSelect.value); const actual = select('actual'); if (actual) { actual.value = preferredActualMixtureChannel(context.channels, selectedScale())?.id ?? ''; remembered.set('actual', actual.value); } syncDelayResponseDefault(); clearDelayDiscovery(); invalidate(); };
    correctionModeSelect.onchange = () => { remembered.set('fuel-correction-mode', correctionModeSelect.value); invalidate(); };
    populateAnalyzerScopeSelect(scopeSelect, context, remembered.get('scope') ?? 'full'); scopeSelect.onchange = () => { remembered.set('scope', scopeSelect.value); clearDelayDiscovery(); invalidate(); };
    presetSelect.replaceChildren(...PRESETS.map(([value, label]) => new Option(label, value))); presetSelect.value = remembered.get('preset') ?? 'recommended'; presetSelect.onchange = () => { remembered.set('preset', presetSelect.value); invalidate(); };
    fillRole(select('actual')!, ROLES.find((role) => role.key === 'actual')!); fillRole(select('stft')!, ROLES.find((role) => role.key === 'stft')!); for (const role of ROLES.filter((item) => item.key !== 'actual' && item.key !== 'stft')) fillRole(addAdvanced(role), role);
    for (const field of root.querySelectorAll<HTMLInputElement>('.ve-workbench-quick-controls input')) field.onchange = invalidate;
    for (const role of ['delay-command-threshold', 'delay-search-window', 'delay-event-spacing'] as const) { const field = input(role); if (field) field.onchange = () => { clearDelayDiscovery(); renderReadiness(); }; }
    const responseField = input('delay-response-threshold'); if (responseField) responseField.onchange = () => { responseField.dataset.auto = 'false'; clearDelayDiscovery(); renderReadiness(); };
    grabDelayButton.onclick = () => { void runDelayDiscovery(); };
    useDelayButton.onclick = () => { const recommended = delayDiscovery?.onsetDelay?.medianMs; if (recommended === undefined) return; const field = input('delay-ms'); if (field) field.value = String(Math.round(recommended)); invalidate(); };
    runButton.onclick = () => { void runAnalysis(); }; renderTables(); renderReadiness(); content.hidden = false; empty.hidden = false;
  };

  return {
    element: root,
    setContext(next) { context = next; rebuild(); },
    setTuneModel(model, sourceName) { tuneModel = model; tuneSourceName = sourceName; rebuild(); },
    refresh() { renderTables(); renderReadiness(); },
  };
}
