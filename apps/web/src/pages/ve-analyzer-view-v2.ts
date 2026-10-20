import { veAnalysisAxisIssue } from '../../../../core/analysis/ve-axis-validation';
import { registerVeDelayPresentationOwner } from './ve-analyzer-delay-presentation-owner';
import { projectVeTable, publishVeTableProjection, veSourceHeatLevel } from './ve-analyzer-table-projection';
import { createOwnerEvidence, rejectOwnerCompletion } from '../observability/producers/owner';
import type { Origin } from '../observability/record';
import type { Operation } from '../observability/operation';
import type { ObservabilityRecorder } from '../observability/recorder';
import { decorateAnalyzerControls } from './analyzer-presentation';
import { createVeReadiness, veNumericSettingIssue, type VeReadinessState, type VeReadinessRow } from './ve-analyzer-readiness';
import { analyzeAfrDelay, type AfrDelayAnalyzerResult } from '../../../../core/analysis/afr-delay-analyzer';
import { type VeEvidenceMapResult } from '../../../../core/analysis/ve-evidence-map';
import { buildVeEvidenceMapWithDelayTableAsync } from '../../../../core/analysis/ve-delay-aligned-evidence';
import { buildVeProposal, type VeProposalResult } from '../../../../core/analysis/ve-proposal';
import { buildVeDelayTable, type VeDelayTable } from '../../../../core/analysis/ve-delay-table';
import {
  activateVeDelayRecommendation,
  editVeDelayCells,
  editVeDelayCellValues,
  type VeDelayCellPosition,
  type VeDelayEdit,
} from '../../../../core/analysis/ve-delay-table-editing';
import { parseVeDelayTableFile, serializeVeDelayTable } from '../../../../core/analysis/ve-delay-table-storage';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';
import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { analyzerChannelOptionLabel, suggestAnalyzerChannel, preferredVeActualMixtureChannel, updateVeActualMixtureOptions } from './analyzer-channel-roles';
import { assessVeFuelCorrection, type VeFuelCorrectionMode } from './ve-fuel-correction';
import { registerVeDelayEditOwner, type VeDelayCellValueEdit } from './ve-analyzer-delay-edit-owner';
import { registerVeProposalEditOwner, type VeProposalCellValueEdit } from './ve-analyzer-proposal-edit-owner';
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

/** Borrowed, read-only primary run data. Consumers must not mutate these references. */
export interface VeAnalyzerPrimaryAnalysis {
  readonly evidence: VeEvidenceMapResult;
  readonly proposal: VeProposalResult;
  readonly veTable: TuneEntry;
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  readonly actualRange: NumericChannelRange;
  readonly qualificationLabel: string;
  readonly stateExcludedCount: number;
}

export interface VeAnalyzerViewController {
  readonly element: HTMLElement;
  getReadiness(): VeReadinessState;
  onReadinessChange(listener: () => void): () => void;
  setActive(active: boolean): void;
  /** Terminal lifetime boundary; cancels pending authority and releases owned resources. */
  dispose(): void;
  readonly sessionRevision: number;
  /** Current completed run only; undefined while invalidated or a new run is pending. */
  getPrimaryAnalysis(): VeAnalyzerPrimaryAnalysis | undefined;
  /** Owner notification when completed-run authority is withdrawn or replaced. */
  onPrimaryAnalysisChange(listener: () => void): () => void;
  /** Return true only when semantic session inputs changed. */
  setContext(context: LoggerAnalysisContext): boolean;
  setTuneModel(model: TuneModel | undefined, sourceName?: string): boolean;
  /** One semantic edit, regardless of selection size; false for inactive/no-op requests. */
  editDelayCells(positions: readonly VeDelayCellPosition[], edit: VeDelayEdit): boolean;
  refresh(): void;
}

export function sameVeSourceContext(left: LoggerAnalysisContext, right: LoggerAnalysisContext): boolean {
  if ((left.source?.identity ?? left.loadTraces) !== (right.source?.identity ?? right.loadTraces)
    || left.source?.sampleCount !== right.source?.sampleCount
    || left.source?.revision !== right.source?.revision
    || left.channels.length !== right.channels.length) return false;
  return left.channels.every((channel, index) => {
    const other = right.channels[index]!;
    return channel.id === other.id && channel.sourceName === other.sourceName
      && channel.displayName === other.displayName && channel.valueType === other.valueType
      && channel.unit === other.unit && channel.category === other.category && channel.precision === other.precision;
  });
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

function delayTableCounts(table: VeDelayTable | undefined): { measured: number; interpolated: number; insufficient: number; userEdited: number } {
  const counts = { measured: 0, interpolated: 0, insufficient: 0, userEdited: 0 };
  for (const cell of table?.cells ?? []) {
    counts[cell.state] += 1;
    if (cell.workingProvenance === 'user-edited') counts.userEdited += 1;
  }
  return counts;
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let viewActive = true;
  let disposed = false;
  let pendingContext: LoggerAnalysisContext | undefined;
  let pendingTune: readonly [TuneModel | undefined, string | undefined] | undefined;
  let tuneModel: TuneModel | undefined;
  let tuneSourceName: string | undefined;
  const ownerEvidence = createOwnerEvidence(observability, 've');
  let analysisOperation: Operation | undefined;
  let runGeneration = 0;
  let analysisPending = false;
  let cancelledAnalysis = false;
  let readinessState = createVeReadiness([], { active: true, pending: false, proposed: false, delayState: 'missing' });
  const readinessListeners = new Set<() => void>();
  let readinessRowsKey = '';

  let delayGeneration = 0;
  let delayDiscoveryFeedback: { generation: number; title: string; text: string } | undefined;
  let delayLoadGeneration = 0;
  let sessionRevision = 0;
  let delaySurfaceGeneration = 0;
  let primaryAnalysis: VeAnalyzerPrimaryAnalysis | undefined;
  const primaryAnalysisListeners = new Set<() => void>();
  const publishPrimaryAnalysis = (next: VeAnalyzerPrimaryAnalysis | undefined): void => {
    if (primaryAnalysis === next) return;
    primaryAnalysis = next;
    ownerEvidence.event('ve.primary.dispatch', { listeners: primaryAnalysisListeners.size, available: Boolean(next) }, { stateRevision: sessionRevision });
    for (const listener of primaryAnalysisListeners) listener();
  };
  let result: VeEvidenceMapResult | undefined;
  let proposal: VeProposalResult | undefined;
  let delayDiscovery: AfrDelayAnalyzerResult | undefined;
  let delayRecommendation: VeDelayTable | undefined;
  let workingDelayTable: VeDelayTable | undefined;
  let selectedDelayCell: { row: number; col: number } | undefined;
  let veReviewAuthorityGeneration = 0;
  let veReviewState: {
    readonly key: string;
    readonly model: TuneModel | undefined;
    readonly proposal: VeProposalResult | undefined;
    readonly rows: number;
    readonly cols: number;
    readonly rpmBins: readonly number[];
    readonly loadBins: readonly number[];
    readonly baselineValues: readonly (number | undefined)[];
    readonly values: readonly (number | undefined)[];
    readonly digits: number | undefined;
    readonly authorityGeneration: number;
  } | undefined;
  const remembered = new Map<string, string>();

  const root = document.createElement('section');
  root.className = 'specialized-analyzer-view ve-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="ve-workbench">
      <section class="ve-workbench-panel"><header><div><strong>VE / proposal table</strong><span>Original MSQ VE stays immutable; evidence and guarded proposals are overlaid after Run Analysis.</span></div><select data-role="ve-table"></select></header><div class="ve-workbench-table-wrap" data-ve-analyzer="ve-table-view"></div></section>
      <section class="ve-workbench-panel"><header><div><strong>Target mixture table</strong><span>Exact MSQ target table and its own axes; AFR/Lambda are not relabeled or silently converted.</span></div><select data-role="target-table"></select></header><div class="ve-workbench-table-wrap" data-ve-analyzer="target-table-view"></div></section>
    </div>
    <div class="ve-workbench-actionbar">
      <button type="button" class="ve-workbench-run" disabled>Run Analysis</button>
      <button type="button" data-ve-analyzer="cancel-analysis" hidden>Cancel analysis</button>
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
      <label><span>Prior weight</span><input data-role="prior-weight" type="number" value="20" min="0"></label>
      <label><span>Min evidence weight</span><input data-role="min-evidence-weight" type="number" value="5" min="0"></label>
      <label><span>Max VE change</span><input data-role="max-absolute-change" type="number" value="50" min="0"></label>
      <label><span>Max VE change %</span><input data-role="max-percent-change" type="number" value="50" min="0"></label>
    </div>
    <div class="specialized-analyzer-guidance ve-mixture-warning" data-ve-analyzer="mixture-warning" hidden><strong>Mixture selection needs attention</strong><span></span></div>
    <div class="specialized-analyzer-guidance ve-workbench-guidance"><strong>Proposal stage</strong><span data-ve-analyzer="stage" data-state="idle">Run Analysis uses the working RPM × load delay table by timestamp, builds VE-node evidence, compensates only explicitly understood fuel corrections, and calculates guarded proposals. The original MSQ remains unchanged.</span></div>
    <div class="specialized-analyzer-empty"><strong>VE Analyzer needs a loaded log plus valid VE/target tables, axes, primary channels and a working lambda-delay table.</strong><span>Run Analysis is explicit; changing setup invalidates the prior result instead of recomputing automatically.</span></div>
    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary" data-ve-analyzer="summary"></div>
      <details class="specialized-analyzer-options" open>
        <summary>Lambda Delay Table</summary>
        <div class="specialized-analyzer-options-grid">
          <label><span>Fuel command Δ threshold</span><input data-role="delay-command-threshold" type="number" value="0.2" min="0" step="any"></label>
          <label><span data-ve-analyzer="delay-response-label">AFR response Δ threshold</span><input data-role="delay-response-threshold" type="number" value="0.2" min="0" step="any"></label>
          <label><span>Search window ms</span><input data-role="delay-search-window" type="number" value="1200" min="1"></label>
          <label><span>Minimum event spacing ms</span><input data-role="delay-event-spacing" type="number" value="250" min="0"></label>
          <label><span>Minimum events / measured cell</span><input data-role="delay-min-events" type="number" value="3" min="1" step="1"></label>
          <button type="button" data-ve-analyzer="grab-delay">Grab lambda delays from log</button>
          <button type="button" data-ve-analyzer="use-delay" disabled>Use recommendation</button>
          <button type="button" data-ve-analyzer="save-delay" disabled>Save working table</button>
          <button type="button" data-ve-analyzer="load-delay">Load saved table</button>
          <input type="file" data-ve-analyzer="load-delay-file" accept="application/json,.json" hidden>
        </div>
        <div class="specialized-analyzer-guidance"><strong data-ve-analyzer="delay-result-title">No delay-table recommendation calculated</strong><span data-ve-analyzer="delay-result">Discover from the current log or load a saved working table. Current-log recommendation and working authority remain separate.</span></div>
        <div class="ve-delay-table-shell" data-ve-analyzer="delay-table"></div>
        <section class="ve-delay-cell-editor" data-ve-analyzer="delay-editor" hidden>
          <header><strong>Selected delay cell</strong><span data-ve-analyzer="delay-cell-heading">—</span></header>
          <div class="ve-delay-cell-editor-grid">
            <div><span>Evidence</span><strong data-ve-analyzer="delay-cell-state">—</strong></div>
            <div><span>Recommendation</span><strong data-ve-analyzer="delay-cell-recommendation">—</strong></div>
            <div><span>Working provenance</span><strong data-ve-analyzer="delay-cell-provenance">—</strong></div>
            <label><span>Working delay ms</span><input data-ve-analyzer="delay-cell-working" type="number" min="0" step="1"></label>
            <button type="button" data-ve-analyzer="delay-cell-apply">Apply user edit</button>
            <button type="button" data-ve-analyzer="delay-cell-revert">Revert to recommendation</button>
          </div>
          <div class="ve-delay-source-events" data-ve-analyzer="delay-source-events"></div>
        </section>
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
  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]')!;
  const warning = root.querySelector<HTMLElement>('[data-ve-analyzer="mixture-warning"]')!;
  const warningText = warning.querySelector<HTMLElement>('span')!;
  const stageText = root.querySelector<HTMLElement>('[data-ve-analyzer="stage"]')!;
  const setStage = (state: 'idle' | 'pending' | 'success' | 'error' | 'cancelled', message: string): void => {
    stageText.dataset.state = state;
    stageText.textContent = message;
    root.dispatchEvent(new CustomEvent('ve-analysis-stage-changed', { detail: { state } }));
  };
  const runButton = root.querySelector<HTMLButtonElement>('.ve-workbench-run')!;
  const cancelButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="cancel-analysis"]')!;
  const grabDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]')!;
  const useDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="use-delay"]')!;
  const saveDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="save-delay"]')!;
  const loadDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="load-delay"]')!;
  const loadDelayFile = root.querySelector<HTMLInputElement>('[data-ve-analyzer="load-delay-file"]')!;
  const delayResultTitle = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-result-title"]')!;
  const delayResultText = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-result"]')!;
  const delayResponseLabel = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-response-label"]')!;
  const delayEditor = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-editor"]')!;
  const delayCellHeading = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-cell-heading"]')!;
  const delayCellState = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-cell-state"]')!;
  const delayCellRecommendation = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-cell-recommendation"]')!;
  const delayCellProvenance = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-cell-provenance"]')!;
  const delayCellWorking = root.querySelector<HTMLInputElement>('[data-ve-analyzer="delay-cell-working"]')!;
  const delayCellApply = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="delay-cell-apply"]')!;
  const delayCellRevert = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="delay-cell-revert"]')!;
  const delaySourceEvents = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-source-events"]')!;

  // v7/v50 may re-parent table selectors while synchronizing compact headers.
  // Their semantic identities must survive temporary DOM detachment.
  const originalVeTableSelect = root.querySelector<HTMLSelectElement>('select[data-role="ve-table"]') ?? undefined;
  const originalTargetTableSelect = root.querySelector<HTMLSelectElement>('select[data-role="target-table"]') ?? undefined;
  const select = (role: string) => root.querySelector<HTMLSelectElement>(`select[data-role="${role}"]`)
    ?? (role === 've-table' ? originalVeTableSelect : role === 'target-table' ? originalTargetTableSelect : undefined);
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

  const evidenceDetail = (cell: VeEvidenceMapResult['cells'][number] | undefined): string => {
    if (!cell || !(cell.totalWeight > 0)) return '';
    const p10 = cell.correctionP10Ratio === undefined ? '—' : formatPercent((cell.correctionP10Ratio - 1) * 100);
    const p90 = cell.correctionP90Ratio === undefined ? '—' : formatPercent((cell.correctionP90Ratio - 1) * 100);
    const spread = cell.correctionSpreadPercent === undefined ? '—' : `${cell.correctionSpreadPercent.toFixed(1)}%`;
    return `Robust median ${formatPercent(cell.correctionPercent)}; P10 ${p10}; P90 ${p90}; spread ${spread}; confidence ${cell.confidence}; weight ${cell.totalWeight.toFixed(3)}; samples ${cell.sampleCount}.`;
  };

  const ensureVeReviewState = () => {
    const entry = tableEntry(tuneModel, select('ve-table')?.value ?? '');
    const rpmBins = axisValues(tuneModel, select('rpm-axis')?.value ?? '');
    const loadBins = axisValues(tuneModel, select('load-axis')?.value ?? '');
    if (!entry?.numericValues || !rpmBins || !loadBins || rpmBins.length !== entry.cols || loadBins.length !== entry.rows) {
      veReviewState = undefined;
      return undefined;
    }
    const key = `${entry.name}|${select('rpm-axis')?.value ?? ''}|${select('load-axis')?.value ?? ''}`;
    if (!veReviewState || veReviewState.key !== key || veReviewState.model !== tuneModel || veReviewState.proposal !== proposal
      || veReviewState.rows !== entry.rows || veReviewState.cols !== entry.cols) {
      const baselineValues = entry.numericValues.map((current, index) => {
        const proposalCell = proposal?.cells[index];
        return proposalCell?.state === 'measured' && proposalCell.proposedValue !== undefined && Number.isFinite(proposalCell.proposedValue)
          ? proposalCell.proposedValue : current;
      });
      veReviewState = {
        key,
        model: tuneModel,
        proposal,
        rows: entry.rows,
        cols: entry.cols,
        rpmBins: [...rpmBins],
        loadBins: [...loadBins],
        baselineValues,
        values: [...baselineValues],
        digits: entry.digits,
        authorityGeneration: ++veReviewAuthorityGeneration,
      };
    }
    return veReviewState;
  };

  const renderTable = (host: HTMLElement, entry: TuneEntry | undefined, x?: readonly number[], y?: readonly number[], evidence?: VeEvidenceMapResult, proposed?: VeProposalResult, workingValues?: readonly (number | undefined)[]): void => {
    if (!entry?.numericValues) { host.innerHTML = '<div class="ve-workbench-table-empty">No table selected</div>'; return; }
    const projection = projectVeTable(entry.numericValues, entry.rows, entry.cols, x, y, evidence, proposed);
    const table = document.createElement('table'); table.className = 've-workbench-table';
    publishVeTableProjection(table, projection);
    const thead = document.createElement('thead'); const head = document.createElement('tr'); const corner = document.createElement('th'); corner.textContent = entry.units ?? ''; head.append(corner);
    for (let col = 0; col < entry.cols; col += 1) { const th = document.createElement('th'); th.textContent = x?.[col] !== undefined ? formatValue(x[col]!, 0) : String(col + 1); head.append(th); }
    thead.append(head);
    const tbody = document.createElement('tbody');
    for (let row = entry.rows - 1; row >= 0; row -= 1) {
      const tr = document.createElement('tr'); const rowHead = document.createElement('th'); rowHead.textContent = y?.[row] !== undefined ? formatValue(y[row]!, 0) : String(row + 1); tr.append(rowHead);
      for (let col = 0; col < entry.cols; col += 1) {
        const td = document.createElement('td'); const index = row * entry.cols + col; const current = projection.cells[index]?.current;
        td.dataset.veRow = String(row); td.dataset.veCol = String(col);
        td.dataset.tableRow = String(row); td.dataset.tableCol = String(col);
        if (current !== undefined && Number.isFinite(current)) {
          const proposalCell = proposed?.cells[index]; const main = document.createElement('span');
          const shown = workingValues ? workingValues[index]
            : proposalCell?.state === 'measured' && proposalCell.proposedValue !== undefined ? proposalCell.proposedValue : current;
          main.textContent = shown === undefined ? '—' : formatValue(shown, entry.digits);
          td.append(main); td.style.setProperty('--ve-cell-level', veSourceHeatLevel(projection, current)!);
          const evidenceCell = evidence?.cells[index];
          if (proposalCell && proposalCell.state !== 'no-evidence') {
            const evidenceText = evidenceDetail(evidenceCell);
            td.title = proposalCell.state === 'measured'
              ? `Measured proposal. Current ${formatValue(current, entry.digits)}, proposed ${formatValue(proposalCell.proposedValue!, entry.digits)}, change ${formatPercent(proposalCell.changePercent)}. ${evidenceText}`
              : proposalCell.state === 'weak-evidence'
                ? `Weak evidence only. Raw candidate ${formatValue(proposalCell.evidenceCandidate!, entry.digits)} (${formatPercent(proposalCell.changePercent)}); no proposal is emitted. ${evidenceText}`
                : `Recommendation withheld by configured change limits. Raw candidate ${formatValue(proposalCell.evidenceCandidate!, entry.digits)} (${formatPercent(proposalCell.changePercent)}). ${evidenceText}`;
          } else if (evidenceCell && evidenceCell.totalWeight > 0) td.title = evidenceDetail(evidenceCell);
        } else td.textContent = '—';
        if (td.title) {
          td.setAttribute('aria-label', td.title);
          td.dataset.veHasDetail = 'true';
        }
        td.dataset.veCellRefined = 'true';
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.dataset.veLoadOrigin = 'lower-left';
    table.append(thead, tbody); host.replaceChildren(table);
  };

  const renderSelectedDelayCell = (): void => {
    const table = workingDelayTable ?? delayRecommendation;
    if (!table || !selectedDelayCell) { delayEditor.hidden = true; return; }
    const { row, col } = selectedDelayCell;
    const cell = table.cells[row * table.cols + col];
    if (!cell) { delayEditor.hidden = true; return; }
    delayEditor.hidden = false;
    delayCellHeading.textContent = `${formatValue(table.rpmBins[col]!, 0)} RPM / ${formatValue(table.loadBins[row]!, 0)} load`;
    delayCellState.textContent = `${cell.state} recommendation · ${cell.eventCount} direct local events · ${cell.confidence} confidence`;
    delayCellRecommendation.textContent = cell.recommendedMs === undefined ? '—' : `${Math.round(cell.recommendedMs)} ms${cell.spreadMs !== undefined ? ` · direct local spread ${Math.round(cell.spreadMs)} ms` : ''}`;
    delayCellProvenance.textContent = cell.workingProvenance ?? 'No working authority';
    delayCellWorking.value = cell.workingMs === undefined ? '' : String(Math.round(cell.workingMs));
    delayCellApply.disabled = false;
    delayCellRevert.disabled = cell.workingProvenance !== 'user-edited';
    const events = cell.sourceEvents ?? [];
    if (events.length === 0) {
      delaySourceEvents.innerHTML = '<span>No direct discovery events are attached to this cell. Interpolated/user-filled cells are not presented as measured evidence.</span>';
    } else {
      const rows = events.map((event, index) => `<tr><td>${index + 1}</td><td>${Math.round(event.onsetDelayMs)} ms</td><td>${event.rpm === undefined ? '—' : Math.round(event.rpm)}</td><td>${event.load === undefined ? '—' : formatValue(event.load, 1)}</td><td>${Math.round(event.commandTimeMs)} ms</td><td>${Math.round(event.responseTimeMs)} ms</td></tr>`).join('');
      delaySourceEvents.innerHTML = `<div class="ve-delay-source-events-title">Direct local source events</div><div class="specialized-analyzer-table-wrap"><table class="specialized-analyzer-table"><thead><tr><th>#</th><th>Delay</th><th>RPM</th><th>Load</th><th>Command time</th><th>Response time</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
  };

  // Legacy embedded views render eagerly. The v50 tool explicitly claims
  // visibility at installation; semantic delay authority never depends on it.
  let delayPresentationVisible = true;
  let renderedDelay: { generation: number; working: boolean; node: Element | null } | undefined;
  const renderDelayTable = (): void => {
    if (!viewActive || !delayPresentationVisible) return;
    const tableModel = workingDelayTable ?? delayRecommendation;
    const working = Boolean(workingDelayTable);
    if (renderedDelay && renderedDelay.generation === delaySurfaceGeneration && renderedDelay.working === working
      && renderedDelay.node === delayHost.firstElementChild) return;
    const rememberRender = (): void => {
      renderedDelay = { generation: delaySurfaceGeneration, working, node: delayHost.firstElementChild };
    };
    if (!tableModel) {
      delayHost.innerHTML = '<div class="ve-workbench-table-empty">No delay table calculated or loaded</div>';
      rememberRender();
      selectedDelayCell = undefined;
      renderSelectedDelayCell();
      return;
    }
    const table = document.createElement('table'); table.className = 've-workbench-table ve-delay-table';
    const thead = document.createElement('thead'); const header = document.createElement('tr'); const corner = document.createElement('th'); corner.textContent = 'ms'; header.append(corner);
    for (const rpm of tableModel.rpmBins) { const th = document.createElement('th'); th.textContent = formatValue(rpm, 0); header.append(th); }
    thead.append(header);
    const tbody = document.createElement('tbody');
    for (let row = tableModel.rows - 1; row >= 0; row -= 1) {
      const tr = document.createElement('tr'); const rowHead = document.createElement('th'); rowHead.textContent = formatValue(tableModel.loadBins[row]!, 0); tr.append(rowHead);
      for (let col = 0; col < tableModel.cols; col += 1) {
        const cell = tableModel.cells[row * tableModel.cols + col]!; const td = document.createElement('td');
        td.dataset.delayState = cell.state;
        if (cell.workingProvenance) td.dataset.delayProvenance = cell.workingProvenance;
        td.dataset.delayRow = String(row); td.dataset.delayCol = String(col);
        if (cell.workingMs !== undefined) td.dataset.delayValue = String(cell.workingMs);
        if (cell.recommendedMs !== undefined) td.dataset.delayRecommended = String(cell.recommendedMs);
        const shown = cell.workingMs;
        td.textContent = shown === undefined ? '—' : String(Math.round(shown));
        td.title = `${cell.state} delay cell · ${cell.eventCount} direct local events${cell.recommendedMs !== undefined ? ` · generated recommendation ${Math.round(cell.recommendedMs)} ms` : ''}${cell.workingMs !== undefined ? ` · editable value ${Math.round(cell.workingMs)} ms` : ' · editable value none'}${cell.workingProvenance ? ` · provenance ${cell.workingProvenance}` : ''}${cell.p10Ms !== undefined ? ` · direct local P10 ${Math.round(cell.p10Ms)} ms` : ''}${cell.p90Ms !== undefined ? ` · direct local P90 ${Math.round(cell.p90Ms)} ms` : ''} · confidence ${cell.confidence}`;
        td.onclick = () => { selectedDelayCell = { row, col }; renderSelectedDelayCell(); };
        if (td.title) {
          td.tabIndex = 0;
          td.setAttribute('role', 'button');
          td.setAttribute('aria-label', td.title);
          td.dataset.veHasDetail = 'true';
        }
        td.dataset.veCellRefined = 'true';
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.dataset.veLoadOrigin = 'lower-left';
    table.append(thead, tbody); delayHost.replaceChildren(table);
    rememberRender();
    renderSelectedDelayCell();
  };

  registerVeDelayPresentationOwner(root, {
    get visible() { return delayPresentationVisible; },
    setVisible(visible) {
      if (disposed) return;
      if (delayPresentationVisible === visible) return;
      delayPresentationVisible = visible;
      if (visible) renderDelayTable();
      root.dispatchEvent(new CustomEvent('ve-delay-table-visibility-changed'));
    },
  });

  let vePresentation: {
    model: TuneModel | undefined;
    entry: TuneEntry | undefined;
    rpmBins: readonly number[] | undefined;
    loadBins: readonly number[] | undefined;
    evidence: VeEvidenceMapResult | undefined;
    proposal: VeProposalResult | undefined;
    values: readonly (number | undefined)[] | undefined;
    node: Element | null;
  } | undefined;
  const renderVeTable = (): void => {
    const ve = tableEntry(tuneModel, select('ve-table')?.value ?? '');
    const rpmBins = axisValues(tuneModel, select('rpm-axis')?.value ?? '');
    const loadBins = axisValues(tuneModel, select('load-axis')?.value ?? '');
    const values = ensureVeReviewState()?.values;
    const sameSource = vePresentation && vePresentation.model === tuneModel && vePresentation.entry === ve
      && vePresentation.rpmBins === rpmBins && vePresentation.loadBins === loadBins
      && vePresentation.evidence === result && vePresentation.proposal === proposal
      && vePresentation.node === veHost.firstElementChild;
    if (!sameSource) {
      renderTable(veHost, ve, rpmBins, loadBins, result, proposal, values);
      ownerEvidence.event('ve.tables.render', { generation: runGeneration, proposed: Boolean(proposal) }, { visibility: viewActive ? 'active' : 'hidden', stateRevision: sessionRevision });
    } else if (vePresentation && vePresentation.values !== values && ve) {
      // Review publication changes values, not geometry or generated evidence.
      // Preserve cells, focus and the existing source/generated projection.
      const table = veHost.querySelector<HTMLTableElement>('table.ve-workbench-table');
      if (table && (!table.dataset.veResultView || table.dataset.veResultView === 'proposal')) {
        for (const cell of table.querySelectorAll<HTMLTableCellElement>('td[data-ve-row][data-ve-col]')) {
          const index = Number(cell.dataset.veRow) * ve.cols + Number(cell.dataset.veCol);
          if (vePresentation.values?.[index] === values?.[index]) continue;
          const main = cell.querySelector<HTMLElement>(':scope > span');
          if (!main) continue;
          const value = values?.[index];
          main.textContent = value === undefined ? '—' : ve.digits === undefined ? String(value) : value.toFixed(ve.digits);
          cell.dataset.veResultValue = value === undefined ? '' : String(value);
          cell.classList.toggle('ve-result-missing', value === undefined);
        }
      }
    }
    vePresentation = { model: tuneModel, entry: ve, rpmBins, loadBins, evidence: result, proposal, values, node: veHost.firstElementChild };
    // Refresh interaction authority even when no DOM replacement was needed:
    // broad semantic revision changes still retire obsolete history/drafts.
    root.dispatchEvent(new CustomEvent('ve-proposal-table-rendered'));
  };

  // Source Target presentation has no dependency on proposal/review, analysis,
  // log scope or delay authority. Tune entries and their numeric arrays are
  // immutable; an accepted replacement model supplies a new render identity.
  let targetPresentation: {
    readonly model: TuneModel | undefined;
    readonly entry: TuneEntry | undefined;
    readonly rpmBins: readonly number[] | undefined;
    readonly loadBins: readonly number[] | undefined;
    readonly node: Element | null;
  } | undefined;
  const renderTargetTable = (): void => {
    const entry = tableEntry(tuneModel, select('target-table')?.value ?? '');
    const rpmBins = axisValues(tuneModel, select('target-rpm-axis')?.value ?? '');
    const loadBins = axisValues(tuneModel, select('target-load-axis')?.value ?? '');
    if (targetPresentation && targetPresentation.model === tuneModel && targetPresentation.entry === entry
      && targetPresentation.rpmBins === rpmBins && targetPresentation.loadBins === loadBins
      && targetPresentation.node === targetHost.firstElementChild) return;
    renderTable(targetHost, entry, rpmBins, loadBins);
    targetPresentation = { model: tuneModel, entry, rpmBins, loadBins, node: targetHost.firstElementChild };
  };

  const renderTuneTables = (): void => {
    renderVeTable();
    renderTargetTable();
    // Delay rendering belongs to renderDelayDiscovery/readiness.
  };

  const applyVeReviewValues = (edits: readonly VeProposalCellValueEdit[]): boolean => {
    if (!viewActive || analysisPending || pendingContext || pendingTune || edits.length === 0) return false;
    const state = ensureVeReviewState();
    if (!state) return false;
    const next = [...state.values];
    let changed = false;
    const lastByIndex = new Map<number, number | undefined>();
    for (const edit of edits) {
      if (!Number.isInteger(edit.row) || !Number.isInteger(edit.col) || edit.row < 0 || edit.row >= state.rows || edit.col < 0 || edit.col >= state.cols) return false;
      if (edit.value !== undefined && (!Number.isFinite(edit.value) || edit.value < 0)) return false;
      lastByIndex.set(edit.row * state.cols + edit.col, edit.value);
    }
    for (const [index, value] of lastByIndex) {
      if (next[index] === value) continue;
      next[index] = value;
      changed = true;
    }
    if (!changed) return false;
    veReviewState = { ...state, values: next, authorityGeneration: ++veReviewAuthorityGeneration };
    renderVeTable();
    return true;
  };

  registerVeProposalEditOwner(root, {
    snapshot: () => {
      const state = ensureVeReviewState();
      return state ? {
        revision: sessionRevision,
        authorityGeneration: state.authorityGeneration,
        rows: state.rows,
        cols: state.cols,
        rpmBins: state.rpmBins,
        loadBins: state.loadBins,
        baselineValues: state.baselineValues,
        values: state.values,
        digits: state.digits,
      } : undefined;
    },
    applyValues: applyVeReviewValues,
    revert: (positions) => {
      const state = ensureVeReviewState();
      if (!state) return false;
      return applyVeReviewValues(positions.map(({ row, col }) => ({ row, col, value: state.baselineValues[row * state.cols + col] })));
    },
  });

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

  const delaySettingsValid = (): boolean => positiveSetting('delay-command-threshold') !== undefined && positiveSetting('delay-response-threshold') !== undefined && positiveSetting('delay-search-window') !== undefined && nonNegativeSetting('delay-event-spacing') !== undefined && positiveSetting('delay-min-events') !== undefined;

  const delayCountCache = new WeakMap<VeDelayTable, ReturnType<typeof delayTableCounts>>();
  const emptyDelayCounts = delayTableCounts(undefined);
  const cachedDelayTableCounts = (table: VeDelayTable | undefined): ReturnType<typeof delayTableCounts> => {
    if (!table) return emptyDelayCounts;
    let counts = delayCountCache.get(table);
    if (!counts) { counts = delayTableCounts(table); delayCountCache.set(table, counts); }
    return counts;
  };

  const renderDelayDiscovery = (): void => {
    delayResponseLabel.textContent = `${displayScale(selectedScale())} response Δ threshold`;
    const actual = roleSelect('actual')?.value; const fuel = roleSelect('fuelCommand')?.value;
    const axisIssue = veAnalysisAxisIssue(axisValues(tuneModel, select('rpm-axis')?.value ?? ''))
      ?? veAnalysisAxisIssue(axisValues(tuneModel, select('load-axis')?.value ?? ''));
    grabDelayButton.disabled = !actual || !fuel || !delaySettingsValid() || Boolean(axisIssue);
    grabDelayButton.title = axisIssue ? `Fix VE delay geometry: ${axisIssue}` : '';
    const recommendationCounts = cachedDelayTableCounts(delayRecommendation);
    const workingCounts = cachedDelayTableCounts(workingDelayTable);
    delayHost.dataset.mode = workingDelayTable ? 'working' : delayRecommendation ? 'recommendation' : 'none';
    useDelayButton.disabled = !delayRecommendation || recommendationCounts.measured + recommendationCounts.interpolated === 0;
    saveDelayButton.disabled = !workingDelayTable;
    renderDelayTable();
    if (delayDiscoveryFeedback?.generation === delayGeneration) {
      delayResultTitle.textContent = delayDiscoveryFeedback.title;
      delayResultText.textContent = delayDiscoveryFeedback.text;
      return;
    }
    if (!delayDiscovery || !delayRecommendation) {
      delayResultTitle.textContent = workingDelayTable ? 'Working delay table active' : 'No current-log delay recommendation calculated';
      delayResultText.textContent = workingDelayTable
        ? `${workingDelayTable.origin === 'saved-file' ? `Loaded saved table${workingDelayTable.originLabel ? ` · ${workingDelayTable.originLabel}` : ''}` : 'Working table from current-log recommendation'} · ${workingCounts.userEdited} user-edited cells. A successful re-grab replaces this working table and its edits with the fresh recommendation; a failed discovery keeps it unchanged.`
        : fuel ? 'Discover from the current log or Load saved table. Discovery never replaces working authority until Use recommendation is pressed.' : 'Select a fuel-command / injector-PW source under Advanced inputs before current-log delay discovery, or load a saved table.';
      if (axisIssue) delayResultText.textContent = `${workingDelayTable ? 'Working delay table retained. ' : ''}Current-log discovery unavailable: ${axisIssue} You can load a valid saved table separately.`;
      return;
    }
    delayResultTitle.textContent = `Current-log recommendation · ${recommendationCounts.measured} measured · ${recommendationCounts.interpolated} interpolated · ${recommendationCounts.insufficient} insufficient · ${recommendationCounts.userEdited} user edited`;
    delayResultText.textContent = `${delayDiscovery.usableEventCount}/${delayDiscovery.candidateEventCount} usable response events · ${delayDiscovery.rejectedNoResponseCount} no-response · ${delayDiscovery.rejectedOverlapCount} overlap · ${delayDiscovery.rejectedGapCount} gap rejections. Raw discovered evidence remains preserved when recommendation cells are edited. ${workingDelayTable ? 'Working delay table active. A successful re-grab replaces working values and edits; failed discovery keeps them unchanged.' : 'Recommendation remains separate until Use recommendation is pressed.'}`;
  };

  const invalidate = (): void => {
    if (disposed) return;
    analysisOperation?.finish('superseded', 'semantic-input-change');
    analysisPending = false; cancelledAnalysis = false;
    publishPrimaryAnalysis(undefined);
    sessionRevision += 1;
    delayGeneration += 1;
    delayLoadGeneration += 1;
    runGeneration += 1; result = undefined; proposal = undefined; summary.replaceChildren(); renderTuneTables();
    ownerEvidence.event('ve.invalidate', { generation: runGeneration, scope: select('scope')?.value ?? 'none' }, { stateRevision: sessionRevision });
    setStage('idle', 'Setup changed. Run Analysis to rebuild the delay-table-aligned evidence and guarded VE proposal; no tune state is modified.');
    renderReadiness();
  };

  const editDelayCells = (positions: readonly VeDelayCellPosition[], edit: VeDelayEdit): boolean => {
    if (!viewActive || pendingContext || pendingTune) return false;
    const table = workingDelayTable ?? delayRecommendation;
    if (!table) return false;
    const next = editVeDelayCells(table, positions, edit);
    if (next === table) return false;
    if (workingDelayTable) workingDelayTable = next;
    else delayRecommendation = next;
    delaySurfaceGeneration += 1;
    invalidate();
    return true;
  };

  const applyDelayCellValues = (edits: readonly VeDelayCellValueEdit[]): boolean => {
    if (!viewActive || pendingContext || pendingTune || edits.length === 0) return false;
    const table = workingDelayTable ?? delayRecommendation;
    if (!table) return false;
    let next;
    try {
      next = editVeDelayCellValues(table, edits);
    } catch {
      return false;
    }
    if (next === table) return false;
    if (workingDelayTable) workingDelayTable = next;
    else delayRecommendation = next;
    delaySurfaceGeneration += 1;
    invalidate();
    return true;
  };

  let delayEditSnapshotCache: {
    table: VeDelayTable;
    revision: number;
    authorityGeneration: number;
    values: readonly (number | undefined)[];
  } | undefined;

  registerVeDelayEditOwner(root, {
    snapshot: () => {
      const table = workingDelayTable ?? delayRecommendation;
      if (!table) {
        delayEditSnapshotCache = undefined;
        return undefined;
      }
      if (!delayEditSnapshotCache
        || delayEditSnapshotCache.table !== table
        || delayEditSnapshotCache.revision !== sessionRevision
        || delayEditSnapshotCache.authorityGeneration !== delaySurfaceGeneration) {
        delayEditSnapshotCache = {
          table,
          revision: sessionRevision,
          authorityGeneration: delaySurfaceGeneration,
          values: table.cells.map((cell) => cell.workingMs),
        };
      }
      return {
        revision: sessionRevision,
        authorityGeneration: delaySurfaceGeneration,
        rows: table.rows,
        cols: table.cols,
        rpmBins: table.rpmBins,
        loadBins: table.loadBins,
        values: delayEditSnapshotCache.values,
      };
    },
    applyValues: applyDelayCellValues,
    revert: (positions) => editDelayCells(positions, { kind: 'revert' }),
  });

  const clearDelayRecommendation = (): void => {
    const removesEditableSurface = !workingDelayTable && delayRecommendation !== undefined;
    sessionRevision += 1;
    delayGeneration += 1; delayDiscovery = undefined; delayRecommendation = undefined;
    if (removesEditableSurface) delaySurfaceGeneration += 1;
    // Every caller publishes readiness/invalidation after changing setup.
  };

  const publishReadiness = (next: VeReadinessState): void => {
    readiness.textContent = next.text; readiness.title = next.title;
    advancedReadiness.textContent = next.text;
    runButton.disabled = !next.canRun; cancelButton.hidden = !next.pending;
    if (JSON.stringify(next) === JSON.stringify(readinessState)) return;
    readinessState = next;
    for (const listener of readinessListeners) listener();
  };

  const renderReadiness = (loaded?: ReadonlyMap<string, NumericChannelRange>): boolean => {
    const rows: VeReadinessRow[] = [];
    const add = (id: string, name: string, purpose: string, required: boolean, source: string, status: string, valid: boolean, targetSelector?: string, blockerMessage?: string) => {
      rows.push({ id, name, purpose, required, source, status, valid, ...(targetSelector ? { targetSelector } : {}), ...(blockerMessage ? { blockerMessage } : {}) });
    };
    for (const [role, label] of [['ve-table', 'MSQ VE table'], ['rpm-axis', 'VE RPM axis'], ['load-axis', 'VE load axis'], ['target-table', 'MSQ target mixture table'], ['target-rpm-axis', 'Target RPM axis'], ['target-load-axis', 'Target load axis']] as const) {
      const control = select(role);
      const values = role === 've-table' || role === 'target-table' ? tableEntry(tuneModel, control?.value ?? '')?.numericValues : axisValues(tuneModel, control?.value ?? '');
      const axis = role.endsWith('axis');
      const issue = axis ? veAnalysisAxisIssue(values) : undefined;
      const valid = Boolean(values?.length) && !issue;
      add(role, label, 'Tune geometry', true, selectedText(control), valid ? 'Resolved' : issue ?? 'Missing', valid, `[data-role="${role}"]`, issue ? `${label}: ${issue}` : undefined);
    }
    const scope = select('scope') ? selectedAnalyzerScope(select('scope')!, context) : undefined;
    add('scope', 'Analysis scope', 'Log selection', true, selectedText(select('scope')), scope ? 'Resolved' : 'Missing', Boolean(scope), '[data-role="scope"]');
    const mix = mixtureAssessment();
    add('mixture-scale', 'Mixture scale', 'Target / actual compatibility', true, displayScale(selectedScale()), mix.valid ? `Resolved · target ${displayScale(mix.targetScale)}` : 'Mismatch / verify', mix.valid, '[data-role="mixture-scale"]');
    const delayCounts = cachedDelayTableCounts(workingDelayTable);
    const recommendationCounts = cachedDelayTableCounts(delayRecommendation);
    const recommendationReady = Boolean(delayRecommendation) && recommendationCounts.measured + recommendationCounts.interpolated > 0;
    const delayState = workingDelayTable ? 'working' : recommendationReady ? 'recommendation' : 'missing';
    add(recommendationReady && !workingDelayTable ? 'delay-activate' : 'delay-create', 'Lambda delay table', 'Timestamp alignment', true,
      workingDelayTable ? `${workingDelayTable.origin}${workingDelayTable.originLabel ? ` · ${workingDelayTable.originLabel}` : ''}` : '—',
      workingDelayTable ? `${delayCounts.measured} measured · ${delayCounts.interpolated} interpolated · ${delayCounts.insufficient} insufficient · ${delayCounts.userEdited} user edited` : 'Discover/use recommendation or load a saved working table', Boolean(workingDelayTable),
      recommendationReady ? '[data-ve-analyzer="use-delay"]' : '[data-ve-analyzer="grab-delay"]',
      recommendationReady ? 'Activate the lambda-delay recommendation with Use recommendation.' : 'Create or load a working lambda-delay table.');
    for (const [role, name, purpose, location] of [
      ['prior-weight', 'Prior weight', 'Proposal authority', 'Cell Change preset or Advanced → Prior weight'],
      ['min-evidence-weight', 'Minimum evidence weight', 'Evidence threshold', 'VE controls → Min evidence weight'],
      ['max-absolute-change', 'Max VE change', 'Absolute safety limit', 'VE controls → Max VE change'],
      ['max-percent-change', 'Max VE change %', 'Relative safety limit', 'VE controls → Max VE change %'],
      ['stable-ms', 'Minimum stable duration', 'Qualification stability', 'Advanced → Minimum stable duration'],
    ] as const) {
      const raw = input(role)?.value ?? '';
      const issue = veNumericSettingIssue(name, raw);
      add(role, name, purpose, true, raw.trim() || '—', issue ? `${issue} · ${location}` : `Resolved · ${location}`, !issue, `[data-role="${role}"]`);
    }
    const correctionChannel = selectedChannel('stft');
    const correction = currentFuelCorrection();
    const correctionLoaded = correctionChannel && loaded ? loaded.has(correctionChannel.id) : undefined;
    add('fuel-correction', 'Fuel correction compensation', 'Base-VE attribution', correction.applicable, correctionChannel ? analyzerChannelOptionLabel(correctionChannel) : '—', correction.applicable ? correctionLoaded === false ? 'Required source unavailable in scope' : `${correction.interpretation} · ${correction.reason}` : `Context only · ${correction.reason}`, !correction.applicable || (Boolean(correctionChannel) && correctionLoaded !== false), '[data-role="stft"]');
    for (const role of ROLES) {
      const id = roleSelect(role.key)?.value ?? '';
      const channel = id ? context.channels.find(candidate => candidate.id === id) : undefined;
      const loadState = loaded && id ? loaded.has(id) : undefined;
      add(role.key, role.label, role.purpose, role.required, channel ? analyzerChannelOptionLabel(channel) : '—', channel ? loadState === false ? 'Unavailable in scope' : loadState === true ? 'Resolved · loaded' : 'Resolved' : role.required ? 'Missing' : 'Unavailable optional', Boolean(channel) && loadState !== false, `[data-role="${role.key}"]`);
    }
    const rowsKey = JSON.stringify(rows);
    if (rowsKey !== readinessRowsKey) {
      readinessRowsKey = rowsKey;
      readinessBody.replaceChildren(...rows.map(row => {
        const tr = document.createElement('tr'); tr.dataset.veReadiness = row.id;
        for (const text of [row.name, row.purpose, row.required ? 'Required' : 'Optional', row.source, row.status]) {
          const td = document.createElement('td'); td.textContent = text; tr.append(td);
        }
        return tr;
      }));
    }
    renderDelayDiscovery();
    publishReadiness(createVeReadiness(rows, { active: viewActive, pending: analysisPending, proposed: Boolean(proposal), delayState }));
    return readinessState.ready;
  };

  const fillAxis = (role: 'rpm-axis' | 'load-axis' | 'target-rpm-axis' | 'target-load-axis', tableRole: 've-table' | 'target-table', kind: 'rpm' | 'load') => {
    const control = select(role); if (!control) throw new Error(`VE axis control missing during rebuild: ${role}`); const tableName = select(tableRole)?.value ?? ''; const candidates = veAxisCandidates(tuneModel, tableName, kind); const old = remembered.get(role);
    control.replaceChildren(new Option(`(select ${kind} axis)`, ''), ...candidates.map((entry) => new Option(entry.name, entry.name)));
    control.value = old && candidates.some((entry) => entry.name === old) ? old : preferredVeAxisName(tuneModel, tableName, kind) ?? '';
    control.onchange = () => { remembered.set(role, control.value); if (tableRole === 've-table') clearDelayRecommendation(); invalidate(); };
  };

  const fillRole = (control: HTMLSelectElement, role: RoleDef) => {
    control.replaceChildren(new Option(role.required ? '(select required channel)' : '(none)', ''), ...context.channels.map((channel) => new Option(analyzerChannelOptionLabel(channel), channel.id)));
    const old = remembered.get(role.key); const suggested = role.key === 'actual' ? preferredVeActualMixtureChannel(context.channels, selectedScale()) : suggestAnalyzerChannel('fueling', role.key, context.channels);
    control.value = old && context.channels.some((channel) => channel.id === old) ? old : suggested?.id ?? '';
    if (role.key === 'actual') updateVeActualMixtureOptions(control, context.channels, selectedScale());
    control.onchange = () => { if (role.key === 'actual') updateVeActualMixtureOptions(control, context.channels, selectedScale()); remembered.set(role.key, control.value); if (role.key === 'actual' || role.key === 'fuelCommand' || role.key === 'rpm' || role.key === 'load') clearDelayRecommendation(); invalidate(); };
  };

  const stateFilteredIndices = (reference: NumericChannelRange, traces: ReadonlyMap<string, NumericChannelRange>): { indices: number[]; excluded: number } => {
    const useStateExclusions = (select('preset')?.value ?? 'recommended') !== 'custom'; const ranges = (key: RoleKey) => { const id = roleSelect(key)?.value; return id ? traces.get(id) : undefined; };
    const dfco = ranges('dfco'); const fuelCut = ranges('fuelCutReason'); const ae = ranges('aeActive'); const decel = ranges('decelActive'); const indices: number[] = []; let excluded = 0;
    for (let local = 0; local < reference.values.length; local += 1) { const sampleIndex = reference.startSampleIndex + local; if (reference.validity[local] !== 1) continue; if (useStateExclusions && (active(dfco, sampleIndex) || active(fuelCut, sampleIndex) || active(ae, sampleIndex) || active(decel, sampleIndex))) { excluded += 1; continue; } indices.push(sampleIndex); }
    return { indices, excluded };
  };

  async function runDelayDiscovery(): Promise<void> {
    if (!viewActive) return;
    renderDelayDiscovery(); if (grabDelayButton.disabled) return;
    const actualId = roleSelect('actual')?.value; const fuelId = roleSelect('fuelCommand')?.value; if (!actualId || !fuelId) return;
    const scope = select('scope') ? selectedAnalyzerScope(select('scope')!, context) : undefined; if (!scope) return;
    const rpmId = roleSelect('rpm')?.value; const loadId = roleSelect('load')?.value; const ids = [...new Set([actualId, fuelId, rpmId, loadId].filter((id): id is string => Boolean(id)))];
    const veRpm = axisValues(tuneModel, select('rpm-axis')?.value ?? ''); const veLoad = axisValues(tuneModel, select('load-axis')?.value ?? ''); if (!veRpm || !veLoad) return;
    const hadWorkingTable = workingDelayTable !== undefined;
    const bounds = analyzerScopeBounds(scope); const generation = ++delayGeneration;
    ownerEvidence.event('ve.delay-discovery.started', { generation });
    delayDiscoveryFeedback = { generation, title: 'Analyzing current-log delay evidence…', text: hadWorkingTable
      ? 'Searching isolated fuel-command transitions. Successful discovery replaces the working table and its edits; failure keeps them unchanged.'
      : 'Searching isolated fuel-command transitions. The recommendation requires Use recommendation before becoming working authority.' };
    renderDelayDiscovery();
    let loaded: readonly import('./logger-page').LoggerAnalysisTraceContext[];
    try {
      loaded = await context.loadTraces(ids, bounds.startMs, bounds.endMs);
    } catch (error) {
      if (generation === delayGeneration) {
        ownerEvidence.event('ve.delay-discovery.failed', { generation });
        delayDiscoveryFeedback = { generation, title: 'Could not discover lambda delays', text: error instanceof Error ? error.message : String(error) };
        renderDelayDiscovery();
      }
      return;
    }
    if (generation !== delayGeneration) { ownerEvidence.event('ve.delay-discovery.stale', { generation, currentGeneration: delayGeneration }); return; }
    const ranges = new Map(loaded.map((trace) => [trace.channel.id, trace.range])); const actual = ranges.get(actualId); const fuel = ranges.get(fuelId); if (!actual || !fuel) {
      const removesEditableSurface = !workingDelayTable && delayRecommendation !== undefined;
      delayDiscovery = undefined; delayRecommendation = undefined;
      if (removesEditableSurface) delaySurfaceGeneration += 1;
      delayDiscoveryFeedback = { generation, title: 'Could not discover lambda delays', text: 'Selected actual-mixture or fuel-command data is unavailable in the current scope. Check the selected channels and analysis range, then retry.' };
      renderReadiness(); return;
    }
    delayDiscoveryFeedback = undefined;
    delayDiscovery = analyzeAfrDelay({ actualAfr: actual, fuelCommand: fuel, ...(rpmId && ranges.get(rpmId) ? { rpm: ranges.get(rpmId)! } : {}), ...(loadId && ranges.get(loadId) ? { load: ranges.get(loadId)! } : {}) }, {
      commandDeltaThreshold: positiveSetting('delay-command-threshold')!, afrResponseThreshold: positiveSetting('delay-response-threshold')!, searchWindowMs: positiveSetting('delay-search-window')!, minimumEventSpacingMs: nonNegativeSetting('delay-event-spacing')!, responsePolarity: 'inverse',
    });
    if (generation !== delayGeneration) { ownerEvidence.event('ve.delay-discovery.stale', { generation, currentGeneration: delayGeneration }); return; }
    delayRecommendation = buildVeDelayTable(delayDiscovery.events, veRpm, veLoad, { minimumMeasuredEvents: Math.max(1, Math.floor(positiveSetting('delay-min-events')!)), originLabel: 'current log' });
    if (!workingDelayTable) delaySurfaceGeneration += 1;
    selectedDelayCell = undefined;
    ownerEvidence.event('ve.delay-discovery.published', { generation });
    renderReadiness();
    if (generation === delayGeneration && viewActive && !disposed) {
      root.dispatchEvent(new CustomEvent('ve-delay-discovery-complete', { detail: { hadWorkingTable } }));
    }
  }

  async function runAnalysis(origin: Origin = 'programmatic'): Promise<void> {
    if (!viewActive || analysisPending) return;
    if (!renderReadiness() || !workingDelayTable) return; const run = ++runGeneration; result = undefined; proposal = undefined;
    publishPrimaryAnalysis(undefined);
    const scope = select('scope') ? selectedAnalyzerScope(select('scope')!, context) : undefined; const ve = tableEntry(tuneModel, select('ve-table')?.value ?? ''); const target = tableEntry(tuneModel, select('target-table')?.value ?? '');
    const veRpm = axisValues(tuneModel, select('rpm-axis')?.value ?? ''); const veLoad = axisValues(tuneModel, select('load-axis')?.value ?? ''); const targetRpm = axisValues(tuneModel, select('target-rpm-axis')?.value ?? ''); const targetLoad = axisValues(tuneModel, select('target-load-axis')?.value ?? '');
    if (!scope || !ve?.numericValues || !target?.numericValues || !veRpm || !veLoad || !targetRpm || !targetLoad) return;
    const ids = [...new Set(ROLES.map((role) => roleSelect(role.key)?.value).filter((id): id is string => Boolean(id)))]; const bounds = analyzerScopeBounds(scope);
    const delayTable = workingDelayTable;
    const operation = ownerEvidence.begin('ve.analysis', { generation: run, sessionRevision, channels: ids.length, scope: scope.kind }, origin);
    analysisOperation = operation;
    let accepted = false;
    analysisPending = true;
    renderReadiness(); renderTuneTables(); summary.replaceChildren();
    setStage('pending', 'Loading analysis channels…');
    let resolvedRanges: ReadonlyMap<string, NumericChannelRange> | undefined;
    const reportedPhases = new Set<string>();
    let lastProgressAt = Number.NEGATIVE_INFINITY;
    try {
      const loaded = await context.loadTraces(ids, bounds.startMs, bounds.endMs);
      if (run !== runGeneration || !viewActive) { rejectOwnerCompletion(operation, 'generation-or-hidden'); return; }
      const rangeMap = new Map(loaded.map((trace) => [trace.channel.id, trace.range])); resolvedRanges = rangeMap; if (!renderReadiness(rangeMap)) { setStage('error', 'Required analysis channels are unavailable in the selected scope. Verify the channel mappings and scope, then retry Run Analysis.'); return; }
      const rpm = rangeMap.get(roleSelect('rpm')!.value); const load = rangeMap.get(roleSelect('load')!.value); const actual = rangeMap.get(roleSelect('actual')!.value); if (!rpm || !load || !actual) return;
      const filtered = stateFilteredIndices(rpm, rangeMap); const minimumRpm = readNumber('min-rpm'); const maximumRpm = readNumber('max-rpm'); const minimumLoad = readNumber('min-load'); const maximumLoad = readNumber('max-load');
      const correctionChannel = selectedChannel('stft'); const correctionAssessment = currentFuelCorrection(); const correctionRange = correctionChannel ? rangeMap.get(correctionChannel.id) : undefined; if (correctionAssessment.applicable && !correctionRange) return;

      const nextResult = await buildVeEvidenceMapWithDelayTableAsync({
        actualMixture: actual, rpm, load,
        target: { rpmBins: targetRpm, loadBins: targetLoad, values: target.numericValues, rows: target.rows, cols: target.cols },
        veRpmBins: veRpm, veLoadBins: veLoad, sampleIndices: filtered.indices, delayTable,
        ...(correctionAssessment.applicable && correctionRange ? { fuelCorrectionPercent: correctionRange } : {}),
      }, {
        ...(minimumRpm !== undefined ? { minimumRpm } : {}), ...(maximumRpm !== undefined ? { maximumRpm } : {}), ...(minimumLoad !== undefined ? { minimumLoad } : {}), ...(maximumLoad !== undefined ? { maximumLoad } : {}),
        minimumStableDurationMs: nonNegativeSetting('stable-ms')!, compensateFuelCorrectionPercent: correctionAssessment.applicable,
      }, {
        isCancelled: () => run !== runGeneration || !viewActive,
        onProgress: ({ phase, completed, total }) => {
          const now = performance.now();
          if (run === runGeneration && viewActive && (!reportedPhases.has(phase) || now - lastProgressAt >= 100)) {
            reportedPhases.add(phase); lastProgressAt = now;
            setStage('pending', `${phase} · ${completed.toLocaleString()} / ${total.toLocaleString()}`);
          }
        },
      });
      if (run !== runGeneration || !viewActive) { rejectOwnerCompletion(operation, 'generation-or-hidden'); return; }
      const nextProposal = buildVeProposal(ve.numericValues, ve.rows, ve.cols, nextResult, { priorWeight: nonNegativeSetting('prior-weight')!, minimumEvidenceWeight: nonNegativeSetting('min-evidence-weight')!, maximumAbsoluteChange: nonNegativeSetting('max-absolute-change')!, maximumPercentChange: nonNegativeSetting('max-percent-change')! }); if (run !== runGeneration || !viewActive) { rejectOwnerCompletion(operation, 'generation-or-hidden'); return; }
      result = nextResult; proposal = nextProposal;
      accepted = true;
      publishPrimaryAnalysis({
        evidence: result, proposal, veTable: ve, rpmBins: veRpm, loadBins: veLoad,
        actualRange: actual, qualificationLabel: selectedText(select('preset')), stateExcludedCount: filtered.excluded,
      });
      const complete = loaded.every((trace) => bounds.startMs === undefined || bounds.endMs === undefined ? trace.complete : trace.complete || numericRangeCoversTime(trace.range, bounds.startMs, bounds.endMs)); renderTuneTables();
      const correctionSource = correctionChannel ? analyzerChannelOptionLabel(correctionChannel) : 'None';
      const strongEvidenceCells = result.cells.filter((cell) => cell.confidence === 'strong').length; const moderateEvidenceCells = result.cells.filter((cell) => cell.confidence === 'moderate').length; const limitedEvidenceCells = result.cells.filter((cell) => cell.confidence === 'limited').length; const delayCounts = cachedDelayTableCounts(workingDelayTable);
      const analysisSummaryRows: readonly [string, string][] = [
        ['Tune source', tuneSourceName ?? 'No MSQ loaded'], ['VE table', ve.name], ['Target table', target.name], ['Mixture scale', displayScale(selectedScale())], ['Scope', scope.label], ['Qualification', selectedText(select('preset'))], ['Working delay', `${workingDelayTable.origin === 'saved-file' ? 'Saved file' : 'Current-log table'} · ${delayCounts.measured} measured · ${delayCounts.interpolated} interpolated · ${delayCounts.userEdited} user edited`],
        ['Fuel correction source', correctionSource], ['Fuel correction handling', correctionAssessment.applicable ? 'Compensated · percent fuel applied' : 'Context only'], ['Fuel correction samples', result.fuelCorrectionCompensated ? `${result.fuelCorrectionCompensatedSampleCount.toLocaleString()} compensated · ${result.fuelCorrectionUnavailableSampleCount.toLocaleString()} unavailable` : 'Not applied'],
        ['Input samples', result.inputSampleCount.toLocaleString()], ['State-excluded samples', filtered.excluded.toLocaleString()], ['Delay unavailable', result.delayUnavailableSampleCount.toLocaleString()], ['Stable eligible samples', result.eligibleSampleCount.toLocaleString()], ['Transient rejected', result.transientRejectedSampleCount.toLocaleString()], ['Contributing samples', result.contributingSampleCount.toLocaleString()],
        ['Evidence estimator', 'Weighted median · P10/P90 spread'], ['Evidence confidence', `${strongEvidenceCells} strong · ${moderateEvidenceCells} moderate · ${limitedEvidenceCells} limited`], ['Measured proposal cells', proposal.measuredCellCount.toLocaleString()], ['Weak evidence cells', proposal.weakCellCount.toLocaleString()], ['Withheld by limits', proposal.withheldCellCount.toLocaleString()], ['No-evidence cells', proposal.noEvidenceCellCount.toLocaleString()], ['Prior weight', String(nonNegativeSetting('prior-weight'))], ['Minimum evidence weight', String(nonNegativeSetting('min-evidence-weight'))], ['Change limits', `±${nonNegativeSetting('max-absolute-change')} VE / ±${nonNegativeSetting('max-percent-change')}%`], ['Coverage', complete ? 'Complete' : 'Partial decoded'], ['Tune mutation', 'None'],
      ];
      renderSummary(analysisSummaryRows);
      setStage('success', 'VE analysis complete.');
      root.dispatchEvent(new CustomEvent('ve-analysis-complete', { detail: { rows: analysisSummaryRows } }));
      empty.hidden = true; content.hidden = false;
    } catch (error) {
      if (run !== runGeneration || !viewActive) { rejectOwnerCompletion(operation, 'generation-or-hidden'); return; }
      operation?.finish('failure', 'analysis-failed');
      setStage('error', `Analysis failed: ${error instanceof Error ? error.message : String(error)}. Verify the source and analysis inputs, then retry Run Analysis.`);
    } finally {
      if (operation?.outcome === undefined) operation?.finish(accepted ? 'success' : 'failure', accepted ? 'published' : 'unavailable-or-failed');
      if (analysisOperation === operation) analysisOperation = undefined;
      if (run === runGeneration && viewActive) {
        if (!accepted && stageText.dataset.state === 'pending') {
          setStage('error', 'Analysis could not complete with the available channels. Verify the mappings and selected scope, then retry Run Analysis.');
        }
        analysisPending = false;
        renderReadiness(resolvedRanges);
      }
    }
  }

  const syncDelayResponseDefault = (): void => {
    const field = input('delay-response-threshold'); if (!field) return; const auto = field.dataset.auto !== 'false'; if (auto) field.value = selectedScale() === 'lambda' ? '0.015' : '0.2'; delayResponseLabel.textContent = `${displayScale(selectedScale())} response Δ threshold`;
  };

  const rebuild = (): void => {
    analysisOperation?.finish('superseded', 'source-or-tune-change');
    analysisPending = false; cancelledAnalysis = false;
    publishPrimaryAnalysis(undefined);
    sessionRevision += 1;
    runGeneration += 1;
    delayGeneration += 1;
    delayLoadGeneration += 1;
    ownerEvidence.event('ve.rebuild', { generation: runGeneration }, { visibility: viewActive ? 'active' : 'hidden', stateRevision: sessionRevision });
    summary.replaceChildren();
    setStage('idle', 'Session inputs changed. Verify setup and Run Analysis; no tune state is modified.');
    const hadEditableDelaySurface = Boolean(workingDelayTable ?? delayRecommendation);
    controls.replaceChildren(); result = undefined; proposal = undefined; delayDiscovery = undefined; delayRecommendation = undefined; workingDelayTable = undefined; selectedDelayCell = undefined;
    if (hadEditableDelaySurface) delaySurfaceGeneration += 1;
    const veSelect = select('ve-table')!; const targetSelect = select('target-table')!; const scaleSelect = select('mixture-scale')!; const scopeSelect = select('scope')!; const presetSelect = select('preset')!; const correctionModeSelect = select('fuel-correction-mode')!;
    veSelect.replaceChildren(new Option('(select VE table)', ''), ...veTableCandidates(tuneModel).map((entry) => new Option(entry.name, entry.name))); veSelect.value = remembered.get('ve-table') && [...veSelect.options].some((option) => option.value === remembered.get('ve-table')) ? remembered.get('ve-table')! : preferredVeTableName(tuneModel) ?? '';
    targetSelect.replaceChildren(new Option('(select target mixture table)', ''), ...targetMixtureTableCandidates(tuneModel).map((entry) => new Option(`${entry.name}${entry.units ? ` [${entry.units}]` : ''}`, entry.name))); targetSelect.value = remembered.get('target-table') && [...targetSelect.options].some((option) => option.value === remembered.get('target-table')) ? remembered.get('target-table')! : preferredTargetMixtureTableName(tuneModel, veSelect.value) ?? '';
    const inferred = inferTuneMixtureScale(tableEntry(tuneModel, targetSelect.value)); scaleSelect.value = remembered.get('mixture-scale') === 'lambda' || remembered.get('mixture-scale') === 'afr' ? remembered.get('mixture-scale')! : inferred === 'lambda' ? 'lambda' : 'afr'; syncDelayResponseDefault();
    correctionModeSelect.value = remembered.get('fuel-correction-mode') ?? 'auto';
    fillAxis('rpm-axis', 've-table', 'rpm'); fillAxis('load-axis', 've-table', 'load'); fillAxis('target-rpm-axis', 'target-table', 'rpm'); fillAxis('target-load-axis', 'target-table', 'load');
    veSelect.onchange = () => { remembered.set('ve-table', veSelect.value); clearDelayRecommendation(); fillAxis('rpm-axis', 've-table', 'rpm'); fillAxis('load-axis', 've-table', 'load'); invalidate(); };
    targetSelect.onchange = () => { remembered.set('target-table', targetSelect.value); const scale = inferTuneMixtureScale(tableEntry(tuneModel, targetSelect.value)); if (scale !== 'unknown') { scaleSelect.value = scale; remembered.set('mixture-scale', scale); const actual = roleSelect('actual'); if (actual) { updateVeActualMixtureOptions(actual, context.channels, scale); remembered.set('actual', actual.value); } syncDelayResponseDefault(); clearDelayRecommendation(); } fillAxis('target-rpm-axis', 'target-table', 'rpm'); fillAxis('target-load-axis', 'target-table', 'load'); invalidate(); };
    scaleSelect.onchange = () => { remembered.set('mixture-scale', scaleSelect.value); const actual = select('actual'); if (actual) { updateVeActualMixtureOptions(actual, context.channels, selectedScale()); remembered.set('actual', actual.value); } syncDelayResponseDefault(); clearDelayRecommendation(); invalidate(); };
    correctionModeSelect.onchange = () => { remembered.set('fuel-correction-mode', correctionModeSelect.value); invalidate(); };
    populateAnalyzerScopeSelect(scopeSelect, context, remembered.get('scope') ?? 'full'); scopeSelect.onchange = () => { remembered.set('scope', scopeSelect.value); clearDelayRecommendation(); invalidate(); };
    presetSelect.replaceChildren(...PRESETS.map(([value, label]) => new Option(label, value))); presetSelect.value = remembered.get('preset') ?? 'recommended'; presetSelect.onchange = () => { remembered.set('preset', presetSelect.value); invalidate(); };
    fillRole(select('actual')!, ROLES.find((role) => role.key === 'actual')!); fillRole(select('stft')!, ROLES.find((role) => role.key === 'stft')!); for (const role of ROLES.filter((item) => item.key !== 'actual' && item.key !== 'stft')) fillRole(addAdvanced(role), role);
    // Presentation layers move controls; semantic ownership must not depend on their container.
    for (const role of ['min-rpm', 'max-rpm', 'min-load', 'max-load', 'stable-ms', 'prior-weight', 'min-evidence-weight', 'max-absolute-change', 'max-percent-change'] as const) {
      const field = input(role);
      if (field) {
        let committedInput: string | undefined;
        field.oninput = () => {
          if (committedInput === field.value) return;
          committedInput = field.value; invalidate();
        };
        field.onchange = () => {
          // v3 also uses an explicit change as its qualification invalidation
          // signal. Only suppress the native change following our own input.
          const handled = committedInput !== undefined && committedInput === field.value;
          committedInput = undefined;
          if (!handled) invalidate();
        };
      }
    }
    for (const role of ['delay-command-threshold', 'delay-search-window', 'delay-event-spacing', 'delay-min-events'] as const) { const field = input(role); if (field) field.onchange = () => { clearDelayRecommendation(); renderReadiness(); }; }
    const responseField = input('delay-response-threshold'); if (responseField) responseField.onchange = () => { responseField.dataset.auto = 'false'; clearDelayRecommendation(); renderReadiness(); };
    grabDelayButton.onclick = () => { void runDelayDiscovery(); };
    useDelayButton.onclick = () => { if (!delayRecommendation) return; workingDelayTable = activateVeDelayRecommendation(delayRecommendation); delaySurfaceGeneration += 1; selectedDelayCell = undefined; invalidate(); };
    saveDelayButton.onclick = () => { if (!workingDelayTable) return; downloadText('EpicScope-lambda-delay-table.json', serializeVeDelayTable(workingDelayTable, workingDelayTable.originLabel)); };
    loadDelayButton.onclick = () => { loadDelayFile.value = ''; loadDelayFile.click(); };
    loadDelayFile.onchange = () => {
      if (!viewActive) return;
      const file = loadDelayFile.files?.[0]; if (!file) return;
      const generation = ++delayLoadGeneration;
      ownerEvidence.event('ve.delay-file.started', { generation });
      void file.text().then((text) => {
        if (generation !== delayLoadGeneration) { ownerEvidence.event('ve.delay-file.stale', { generation, currentGeneration: delayLoadGeneration }); return; }
        try {
          const replacement = parseVeDelayTableFile(text, file.name);
          workingDelayTable = replacement;
          delaySurfaceGeneration += 1;
          selectedDelayCell = undefined;
          root.dispatchEvent(new CustomEvent('ve-delay-file-accepted'));
          invalidate();
          ownerEvidence.event('ve.delay-file.published', { generation });
          delayResultTitle.textContent = 'Saved working delay table loaded'; delayResultText.textContent = `${file.name} is active as working authority. Successful re-grab replaces this working table with a fresh log-derived recommendation.`;
        } catch (error) {
          delayResultTitle.textContent = 'Could not load delay table'; delayResultText.textContent = error instanceof Error ? error.message : String(error);
        }
      }).catch((error: unknown) => {
        if (generation !== delayLoadGeneration) { ownerEvidence.event('ve.delay-file.stale', { generation, currentGeneration: delayLoadGeneration }); return; }
        delayResultTitle.textContent = 'Could not load delay table';
        delayResultText.textContent = error instanceof Error ? error.message : String(error);
      });
    };
    delayCellApply.onclick = () => {
      if (!selectedDelayCell) return;
      const raw = delayCellWorking.value.trim();
      const workingMs = raw === '' ? undefined : Number(raw);
      if (workingMs !== undefined && (!Number.isFinite(workingMs) || workingMs < 0)) return;
      editDelayCells([selectedDelayCell], { kind: 'set', workingMs });
    };
    delayCellRevert.onclick = () => {
      if (selectedDelayCell) editDelayCells([selectedDelayCell], { kind: 'revert' });
    };
    cancelButton.onclick = () => {
      analysisOperation?.finish('cancelled', 'user-cancel');
      if (!analysisPending) return;
      runGeneration += 1; analysisPending = false; cancelledAnalysis = false;
      setStage('cancelled', 'Analysis cancelled. Run Analysis to rebuild current evidence.');
      renderReadiness();
    };
    runButton.onclick = (event) => { void runAnalysis(event.isTrusted ? 'user' : 'programmatic'); }; renderTuneTables(); renderReadiness(); content.hidden = false; empty.hidden = false;
  };

  decorateAnalyzerControls(root);

  const controller: VeAnalyzerViewController = {
    element: root,
    getReadiness() { return readinessState; },
    onReadinessChange(listener) { if (disposed) return () => {}; readinessListeners.add(listener); return () => { readinessListeners.delete(listener); }; },
    dispose() {
      if (disposed) return;
      controller.setActive(false);
      disposed = true;
      // Terminal roots must also reject already-queued focus/reveal callbacks.
      root.hidden = true;
      sessionRevision += 1;
      pendingContext = undefined; pendingTune = undefined;
      primaryAnalysis = undefined; result = undefined; proposal = undefined;
      delayDiscovery = undefined; delayRecommendation = undefined; workingDelayTable = undefined;
      primaryAnalysisListeners.clear(); readinessListeners.clear();
      veReviewState = undefined; vePresentation = undefined; targetPresentation = undefined;
      delayEditSnapshotCache = undefined; renderedDelay = undefined;
      tuneModel = undefined; tuneSourceName = undefined;
      context = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
    },
    setActive(next) {
      if (disposed) return;
      if (viewActive === next) { ownerEvidence.event('ve.activity.noop', { active: next }); return; }
      ownerEvidence.event('ve.activity.changed', { active: next, generation: runGeneration }, { visibility: next ? 'active' : 'hidden' });
      viewActive = next;
      if (!viewActive) {
        analysisOperation?.finish('cancelled', 'view-hidden');
        runGeneration += 1; delayGeneration += 1; delayLoadGeneration += 1;
        if (analysisPending) { cancelledAnalysis = true; analysisPending = false; cancelButton.hidden = true; }
        publishReadiness(createVeReadiness(readinessState.rows, { active: false, pending: false, proposed: Boolean(proposal), delayState: readinessState.delayState }));
        return;
      }
      const tune = pendingTune; pendingTune = undefined;
      const nextContext = pendingContext; pendingContext = undefined;
      if (tune) controller.setTuneModel(tune[0], tune[1]);
      if (nextContext) controller.setContext(nextContext);
      if (cancelledAnalysis) {
        cancelledAnalysis = false;
        summary.replaceChildren(); renderTuneTables();
        setStage('cancelled', 'Analysis cancelled after leaving VE. Run Analysis to rebuild current evidence.');
      }
      renderReadiness();
    },
    editDelayCells,
    get sessionRevision() { return sessionRevision; },
    getPrimaryAnalysis() { return primaryAnalysis; },
    onPrimaryAnalysisChange(listener) {
      if (disposed) return () => {};
      primaryAnalysisListeners.add(listener);
      return () => { primaryAnalysisListeners.delete(listener); };
    },
    setContext(next) {
      if (disposed) return false;
      if (!viewActive) { ownerEvidence.event('ve.context.deferred'); pendingContext = next; return false; }
      const sourceChanged = !sameVeSourceContext(context, next);
      const scopeSelect = select('scope')!;
      const scopeKey = (value: LoggerAnalysisContext): string => {
        const scope = selectedAnalyzerScope(scopeSelect, value);
        return scope ? JSON.stringify([scope.kind, ...Object.values(analyzerScopeBounds(scope))]) : 'unavailable';
      };
      const previousScope = scopeKey(context);
      const preferred = scopeSelect.value || remembered.get('scope') || 'full';
      context = next;
      populateAnalyzerScopeSelect(scopeSelect, next, preferred);
      const scopeChanged = previousScope !== scopeKey(next);
      ownerEvidence.event(!sourceChanged && !scopeChanged ? 've.context.noop' : 've.context.changed', { sourceChanged, scopeChanged }, { stateRevision: sessionRevision, sourceRevision: next.source?.revision ?? 0 });
      if (!sourceChanged && !scopeChanged) return false;
      remembered.set('scope', scopeSelect.value);
      rebuild();
      return true;
    },
    setTuneModel(model, sourceName) {
      if (disposed) return false;
      if (!viewActive) { ownerEvidence.event('ve.tune.deferred'); pendingTune = [model, sourceName]; return false; }
      if (model === tuneModel && sourceName === tuneSourceName) { ownerEvidence.event('ve.tune.noop', {}, { stateRevision: sessionRevision }); return false; }
      ownerEvidence.event('ve.tune.changed', {}, { stateRevision: sessionRevision });
      tuneModel = model; tuneSourceName = sourceName; rebuild();
      return true;
    },
    refresh() { if (viewActive) { renderTuneTables(); renderReadiness(); } },
  };
  return controller;
}
