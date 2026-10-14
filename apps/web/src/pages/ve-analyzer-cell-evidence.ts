import { buildVeEvidenceMapWithDelayTable } from '../../../../core/analysis/ve-delay-aligned-evidence';
import { buildVeProposal, type VeProposalResult } from '../../../../core/analysis/ve-proposal';
import type { VeEvidenceMapResult } from '../../../../core/analysis/ve-evidence-map';
import type { VeDelayTable, VeDelayTableCell, VeDelayCellState, VeDelayWorkingProvenance } from '../../../../core/analysis/ve-delay-table';
import type { NumericChannelRange } from '../../../../core/log-model/log-types';
import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';
import { analyzerScopeBounds, selectedAnalyzerScope } from './analyzer-scope';
import { applyVeQualificationValidity, type VeQuickQualificationSettings } from './ve-analyzer-qualification';
import { assessVeFuelCorrection, type VeFuelCorrectionMode } from './ve-fuel-correction';
import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import '../styles/ve-analyzer-cell-evidence.css';

interface VeEvidenceReviewCache {
  readonly evidence: VeEvidenceMapResult;
  readonly proposal: VeProposalResult;
  readonly veTable: TuneEntry;
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  readonly actualRange: NumericChannelRange;
  readonly qualificationLabel: string;
  readonly stateExcludedCount: number;
}

export interface VeEvidenceVisit {
  readonly sampleIndices: readonly number[];
  readonly timeMs: readonly number[];
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly durationMs: number | undefined;
}

const ROLE_KEYS = [
  'rpm', 'load', 'actual', 'stft', 'dfco', 'fuelCutReason', 'aeActive', 'decelActive',
] as const;

type RoleKey = typeof ROLE_KEYS[number];

function finite(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tableEntry(model: TuneModel | undefined, name: string): TuneEntry | undefined {
  const entry = model?.byName.get(name);
  return entry?.kind === 'table' && entry.numericValues !== undefined ? entry : undefined;
}

function axisValues(model: TuneModel | undefined, name: string): readonly number[] | undefined {
  return model?.byName.get(name)?.numericValues;
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

function rangeTime(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const local = sampleIndex - range.startSampleIndex;
  if (local < 0 || local >= range.timeMs.length) return undefined;
  const value = range.timeMs[local];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

/** Pick the longest contiguous source visit; ties prefer the longer time span. */
export function strongestVeEvidenceVisit(
  sampleIndices: ArrayLike<number>,
  timeForSample: (sampleIndex: number) => number | undefined,
  maxGapSamples = 1,
): VeEvidenceVisit | undefined {
  const sorted = Array.from({ length: sampleIndices.length }, (_, index) => sampleIndices[index]!)
    .filter(Number.isSafeInteger)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return undefined;

  const runs: number[][] = [];
  let current: number[] = [sorted[0]!];
  for (let index = 1; index < sorted.length; index += 1) {
    const sample = sorted[index]!;
    const previous = current[current.length - 1]!;
    if (sample - previous <= Math.max(1, maxGapSamples)) current.push(sample);
    else {
      runs.push(current);
      current = [sample];
    }
  }
  runs.push(current);

  const timed = runs.map((run) => {
    const times = run.map(timeForSample).filter((value): value is number => value !== undefined);
    const durationMs = times.length > 1 ? Math.max(...times) - Math.min(...times) : times.length === 1 ? 0 : undefined;
    return { run, times, durationMs };
  }).filter((entry) => entry.times.length > 0);
  if (timed.length === 0) return undefined;

  timed.sort((left, right) => right.run.length - left.run.length || (right.durationMs ?? -1) - (left.durationMs ?? -1));
  const best = timed[0]!;
  return {
    sampleIndices: best.run,
    timeMs: best.times,
    startSampleIndex: best.run[0]!,
    endSampleIndex: best.run[best.run.length - 1]!,
    durationMs: best.durationMs,
  };
}

function quickQualification(root: HTMLElement): VeQuickQualificationSettings {
  const select = (name: string) => root.querySelector<HTMLSelectElement>(`select[data-ve-quick="${name}"]`);
  const input = (name: string) => finite(root.querySelector<HTMLInputElement>(`input[data-ve-quick="${name}"]`)?.value);
  const minimumClt = input('min-clt');
  const minimumTps = input('min-tps');
  const maximumTps = input('max-tps');
  const cltChannelId = select('clt-source')?.value || undefined;
  const tpsChannelId = select('tps-source')?.value || undefined;
  return {
    ...(minimumClt !== undefined && cltChannelId ? { cltChannelId } : {}),
    ...(minimumClt !== undefined ? { minimumClt } : {}),
    ...((minimumTps !== undefined || maximumTps !== undefined) && tpsChannelId ? { tpsChannelId } : {}),
    ...(minimumTps !== undefined ? { minimumTps } : {}),
    ...(maximumTps !== undefined ? { maximumTps } : {}),
  };
}

function delayState(value: string | undefined): VeDelayCellState {
  return value === 'measured' || value === 'interpolated' || value === 'insufficient' ? value : 'insufficient';
}

function delayProvenance(value: string | undefined): VeDelayWorkingProvenance | undefined {
  return value === 'measured-recommendation' || value === 'interpolated-recommendation' || value === 'user-edited' ? value : undefined;
}

function workingDelayTableFromDom(root: HTMLElement): VeDelayTable | undefined {
  const host = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]');
  const table = host?.querySelector<HTMLTableElement>('.ve-delay-table');
  const header = table?.tHead?.rows[0];
  const body = table?.tBodies[0];
  if (!host || host.dataset.mode !== 'working' || !table || !header || !body) return undefined;

  const rpmBins = [...header.cells].slice(1)
    .map((cell) => finite(cell.textContent?.trim()))
    .filter((value): value is number => value !== undefined);
  if (rpmBins.length === 0) return undefined;

  const rows = [...body.rows].map((row) => {
    const load = finite(row.cells[0]?.textContent?.trim());
    if (load === undefined) return undefined;
    const cells = [...row.cells].slice(1).map((node, col): VeDelayTableCell => {
      const cell = node as HTMLTableCellElement;
      const workingMs = finite(cell.dataset.delayValue) ?? finite(cell.textContent?.trim());
      const recommendedMs = finite(cell.dataset.delayRecommended);
      return {
        row: 0,
        col,
        state: delayState(cell.dataset.delayState),
        recommendedMs,
        workingMs,
        workingProvenance: delayProvenance(cell.dataset.delayProvenance),
        eventCount: 0,
        p10Ms: undefined,
        p90Ms: undefined,
        spreadMs: undefined,
        confidence: 'none',
        sourceEvents: [],
      };
    });
    return { load, cells };
  }).filter((row): row is { load: number; cells: VeDelayTableCell[] } => row !== undefined)
    .sort((left, right) => left.load - right.load);
  if (rows.length === 0) return undefined;

  const cells = rows.flatMap((row, rowIndex) => row.cells.map((cell, col) => ({ ...cell, row: rowIndex, col })));
  return {
    rpmBins,
    loadBins: rows.map((row) => row.load),
    rows: rows.length,
    cols: rpmBins.length,
    cells,
    origin: 'log-discovery',
    originLabel: 'active working table',
  };
}

function stateFilteredIndices(
  reference: NumericChannelRange,
  traces: ReadonlyMap<string, NumericChannelRange>,
  ids: ReadonlyMap<RoleKey, string>,
  preset: string,
): { indices: number[]; excluded: number } {
  const useStateExclusions = preset !== 'custom';
  const range = (key: RoleKey) => {
    const id = ids.get(key);
    return id ? traces.get(id) : undefined;
  };
  const dfco = range('dfco');
  const fuelCut = range('fuelCutReason');
  const ae = range('aeActive');
  const decel = range('decelActive');
  const indices: number[] = [];
  let excluded = 0;
  for (let local = 0; local < reference.values.length; local += 1) {
    const sampleIndex = reference.startSampleIndex + local;
    if (reference.validity[local] !== 1) continue;
    if (useStateExclusions && (active(dfco, sampleIndex) || active(fuelCut, sampleIndex) || active(ae, sampleIndex) || active(decel, sampleIndex))) {
      excluded += 1;
      continue;
    }
    indices.push(sampleIndex);
  }
  return { indices, excluded };
}

function selectedCellCoordinates(root: HTMLElement, cell: HTMLTableCellElement, model: TuneModel | undefined): { row: number; col: number; rpm: number; load: number } | undefined {
  const table = cell.closest<HTMLTableElement>('table');
  const rowElement = cell.parentElement as HTMLTableRowElement | null;
  const header = table?.tHead?.rows[0];
  if (!table || !rowElement || !header) return undefined;
  const colDom = cell.cellIndex - 1;
  if (colDom < 0) return undefined;
  const rpm = finite(header.cells[cell.cellIndex]?.textContent?.trim());
  const load = finite(rowElement.cells[0]?.textContent?.trim());
  if (rpm === undefined || load === undefined) return undefined;

  const rpmAxisName = root.querySelector<HTMLSelectElement>('select[data-role="rpm-axis"]')?.value ?? '';
  const loadAxisName = root.querySelector<HTMLSelectElement>('select[data-role="load-axis"]')?.value ?? '';
  const rpmBins = axisValues(model, rpmAxisName);
  const loadBins = axisValues(model, loadAxisName);
  const col = rpmBins?.findIndex((value) => Math.abs(value - rpm) < 1e-9) ?? -1;
  const row = loadBins?.findIndex((value) => Math.abs(value - load) < 1e-9) ?? -1;
  return row >= 0 && col >= 0 ? { row, col, rpm, load } : undefined;
}

function format(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(digits).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function signed(value: number | undefined, digits = 2, suffix = ''): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${format(value, digits)}${suffix}`;
}

function percentFromRatio(value: number | undefined): string {
  return value === undefined ? '—' : signed((value - 1) * 100, 1, '%');
}

function ensureDetailPanel(root: HTMLElement): { panel: HTMLElement; heading: HTMLElement; body: HTMLElement } {
  const page = root.closest<HTMLElement>('.analyzer-page') ?? root.parentElement ?? root;
  let panel = page.querySelector<HTMLElement>('.ve-cell-detail-popover');
  if (!panel) {
    panel = document.createElement('aside');
    panel.className = 've-cell-detail-popover';
    panel.hidden = true;
    panel.innerHTML = '<header><strong>VE cell evidence</strong><button type="button" aria-label="Close cell detail">×</button></header><div></div>';
    panel.querySelector<HTMLButtonElement>('button')!.onclick = () => { panel!.hidden = true; };
    page.append(panel);
  }
  const heading = panel.querySelector<HTMLElement>('header strong')!;
  const body = panel.querySelector<HTMLElement>(':scope > div')!;
  return { panel, heading, body };
}

function metric(label: string, value: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 've-evidence-detail-metric';
  const name = document.createElement('span');
  name.textContent = label;
  const data = document.createElement('strong');
  data.textContent = value;
  item.append(name, data);
  return item;
}

export function installVeAnalyzerCellEvidence(
  inner: VeAnalyzerViewController,
): VeAnalyzerViewController {
  const root = inner.element;
  let context: LoggerAnalysisContext = {
    traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [],
  };
  let tuneModel: TuneModel | undefined;
  let cache: Promise<VeEvidenceReviewCache | undefined> | undefined;
  let detailGeneration = 0;

  const invalidate = (): void => { cache = undefined; };

  const buildCache = async (): Promise<VeEvidenceReviewCache | undefined> => {
    const delayTable = workingDelayTableFromDom(root);
    if (!delayTable || !tuneModel) return undefined;
    const select = (role: string) => root.querySelector<HTMLSelectElement>(`select[data-role="${role}"]`);
    const number = (role: string) => finite(root.querySelector<HTMLInputElement>(`input[data-role="${role}"]`)?.value);
    const scopeSelect = select('scope');
    const scope = scopeSelect ? selectedAnalyzerScope(scopeSelect, context) : undefined;
    const ve = tableEntry(tuneModel, select('ve-table')?.value ?? '');
    const target = tableEntry(tuneModel, select('target-table')?.value ?? '');
    const rpmBins = axisValues(tuneModel, select('rpm-axis')?.value ?? '');
    const loadBins = axisValues(tuneModel, select('load-axis')?.value ?? '');
    const targetRpm = axisValues(tuneModel, select('target-rpm-axis')?.value ?? '');
    const targetLoad = axisValues(tuneModel, select('target-load-axis')?.value ?? '');
    if (!scope || !ve?.numericValues || !target?.numericValues || !rpmBins || !loadBins || !targetRpm || !targetLoad) return undefined;

    const ids = new Map<RoleKey, string>();
    for (const key of ROLE_KEYS) {
      const id = select(key)?.value;
      if (id) ids.set(key, id);
    }
    const quick = quickQualification(root);
    const requested = [...new Set([...ids.values(), quick.cltChannelId, quick.tpsChannelId].filter((id): id is string => Boolean(id)))];
    const bounds = analyzerScopeBounds(scope);
    const loaded = await context.loadTraces(requested, bounds.startMs, bounds.endMs);
    const raw = new Map(loaded.map((trace) => [trace.channel.id, trace.range]));
    const clt = quick.cltChannelId ? raw.get(quick.cltChannelId) : undefined;
    const tps = quick.tpsChannelId ? raw.get(quick.tpsChannelId) : undefined;
    const ranges = new Map(loaded.map((trace) => [trace.channel.id, applyVeQualificationValidity(trace.range, quick, clt, tps)]));

    const rpmId = ids.get('rpm');
    const loadId = ids.get('load');
    const actualId = ids.get('actual');
    if (!rpmId || !loadId || !actualId) return undefined;
    const rpm = ranges.get(rpmId);
    const load = ranges.get(loadId);
    const actual = ranges.get(actualId);
    if (!rpm || !load || !actual) return undefined;

    const preset = select('preset')?.value ?? 'recommended';
    const filtered = stateFilteredIndices(rpm, ranges, ids, preset);
    const correctionId = ids.get('stft');
    const correctionChannel = correctionId ? context.channels.find((channel) => channel.id === correctionId) : undefined;
    const correctionModeValue = select('fuel-correction-mode')?.value;
    const correctionMode: VeFuelCorrectionMode = correctionModeValue === 'off' || correctionModeValue === 'percent' ? correctionModeValue : 'auto';
    const correctionAssessment = assessVeFuelCorrection(correctionChannel, correctionMode);
    const correctionRange = correctionId ? ranges.get(correctionId) : undefined;
    if (correctionAssessment.applicable && !correctionRange) return undefined;

    const evidence = buildVeEvidenceMapWithDelayTable({
      actualMixture: actual,
      rpm,
      load,
      target: { rpmBins: targetRpm, loadBins: targetLoad, values: target.numericValues, rows: target.rows, cols: target.cols },
      veRpmBins: rpmBins,
      veLoadBins: loadBins,
      sampleIndices: filtered.indices,
      delayTable,
      ...(correctionAssessment.applicable && correctionRange ? { fuelCorrectionPercent: correctionRange } : {}),
    }, {
      ...(number('min-rpm') !== undefined ? { minimumRpm: number('min-rpm')! } : {}),
      ...(number('max-rpm') !== undefined ? { maximumRpm: number('max-rpm')! } : {}),
      ...(number('min-load') !== undefined ? { minimumLoad: number('min-load')! } : {}),
      ...(number('max-load') !== undefined ? { maximumLoad: number('max-load')! } : {}),
      minimumStableDurationMs: number('stable-ms') ?? 300,
      compensateFuelCorrectionPercent: correctionAssessment.applicable,
    });

    const proposal = buildVeProposal(ve.numericValues, ve.rows, ve.cols, evidence, {
      priorWeight: number('prior-weight') ?? 20,
      minimumEvidenceWeight: number('min-evidence-weight') ?? 5,
      maximumAbsoluteChange: number('max-absolute-change') ?? 50,
      maximumPercentChange: number('max-percent-change') ?? 50,
    });

    return {
      evidence,
      proposal,
      veTable: ve,
      rpmBins,
      loadBins,
      actualRange: actual,
      qualificationLabel: select('preset')?.selectedOptions[0]?.textContent?.trim() || preset,
      stateExcludedCount: filtered.excluded,
    };
  };

  const reviewCache = (): Promise<VeEvidenceReviewCache | undefined> => cache ??= buildCache();

  const showDetail = async (cell: HTMLTableCellElement): Promise<void> => {
    const coords = selectedCellCoordinates(root, cell, tuneModel);
    if (!coords) return;
    const generation = ++detailGeneration;
    const { panel, heading, body } = ensureDetailPanel(root);
    heading.textContent = `VE evidence · ${format(coords.rpm, 0)} RPM / ${format(coords.load, 0)} load`;
    body.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 've-evidence-detail-loading';
    loading.textContent = 'Resolving retained evidence…';
    body.append(loading);
    panel.hidden = false;

    const resolved = await reviewCache();
    if (generation !== detailGeneration || !resolved) {
      if (generation === detailGeneration) loading.textContent = 'Evidence is unavailable until a valid VE analysis has been run with an active working delay table.';
      return;
    }

    const index = coords.row * resolved.veTable.cols + coords.col;
    const evidenceCell = resolved.evidence.cells[index];
    const proposalCell = resolved.proposal.cells[index];
    const current = resolved.veTable.numericValues?.[index];
    if (!evidenceCell || !proposalCell || current === undefined) return;

    const grid = document.createElement('div');
    grid.className = 've-evidence-detail-grid';
    grid.append(
      metric('Original VE', format(current, resolved.veTable.digits)),
      metric('Proposed VE', format(proposalCell.proposedValue, resolved.veTable.digits)),
      metric('VE change', signed(proposalCell.changeValue, 2)),
      metric('VE change %', signed(proposalCell.changePercent, 1, '%')),
      metric('Mixture error', signed(evidenceCell.correctionPercent, 1, '%')),
      metric('Samples', evidenceCell.sampleCount.toLocaleString()),
      metric('Evidence weight', format(evidenceCell.totalWeight, 3)),
      metric('Confidence', evidenceCell.confidence),
      metric('P10 correction', percentFromRatio(evidenceCell.correctionP10Ratio)),
      metric('P90 correction', percentFromRatio(evidenceCell.correctionP90Ratio)),
      metric('Spread', evidenceCell.correctionSpreadPercent === undefined ? '—' : `${format(evidenceCell.correctionSpreadPercent, 1)}%`),
      metric('Proposal state', proposalCell.state),
    );

    const contextLine = document.createElement('div');
    contextLine.className = 've-evidence-detail-context';
    contextLine.textContent = `${resolved.qualificationLabel} · ${resolved.stateExcludedCount.toLocaleString()} samples excluded by state filters before stability/range qualification. This cell retains ${evidenceCell.sampleCount.toLocaleString()} contributing source samples.`;

    const visit = strongestVeEvidenceVisit(evidenceCell.sampleIndices, (sampleIndex) => rangeTime(resolved.actualRange, sampleIndex));
    const actions = document.createElement('div');
    actions.className = 've-evidence-detail-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Open strongest visit in Logger';
    open.disabled = !visit || !context.openSamplesInLogger;
    if (visit) {
      const visitText = document.createElement('span');
      visitText.className = 've-evidence-detail-visit';
      visitText.textContent = `Strongest contiguous visit: ${visit.sampleIndices.length.toLocaleString()} samples${visit.durationMs !== undefined ? ` · ${(visit.durationMs / 1000).toFixed(visit.durationMs >= 1000 ? 2 : 3)} s` : ''} · #${visit.startSampleIndex.toLocaleString()}–#${visit.endSampleIndex.toLocaleString()}`;
      actions.append(visitText);
      open.onclick = () => context.openSamplesInLogger?.({
        sampleIndices: visit.sampleIndices,
        timeMs: visit.timeMs,
        label: `VE ${format(coords.rpm, 0)} RPM / ${format(coords.load, 0)} load · strongest evidence visit`,
      });
    } else {
      const visitText = document.createElement('span');
      visitText.className = 've-evidence-detail-visit';
      visitText.textContent = 'No timestamped contributing visit is available for Logger navigation.';
      actions.append(visitText);
    }
    actions.append(open);
    body.replaceChildren(grid, contextLine, actions);
  };

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const cell = target.closest<HTMLTableCellElement>('[data-ve-analyzer="ve-table-view"] tbody td');
    if (!cell) return;
    // Capture the richer native VE evidence review instead of the legacy title-only popover.
    event.stopPropagation();
    void showDetail(cell);
  }, { capture: true });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof HTMLTableCellElement) || !target.closest('[data-ve-analyzer="ve-table-view"]')) return;
    event.preventDefault();
    event.stopPropagation();
    void showDetail(target);
  }, { capture: true });

  root.addEventListener('change', invalidate);
  root.addEventListener('input', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('.ve-delay-inline-input')) return;
    invalidate();
  });
  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]');
  if (delayHost) new MutationObserver(invalidate).observe(delayHost, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-delay-value', 'data-delay-provenance', 'data-mode'] });

  return {
    element: root,
    setContext(next) {
      context = next;
      invalidate();
      inner.setContext(next);
    },
    setTuneModel(model, sourceName) {
      tuneModel = model;
      invalidate();
      inner.setTuneModel(model, sourceName);
    },
    refresh() {
      inner.refresh();
    },
  };
}
