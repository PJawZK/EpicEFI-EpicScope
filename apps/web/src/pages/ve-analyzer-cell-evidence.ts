import type { ObservabilityRecorder } from '../observability/recorder';
import { createOwnerEvidence } from '../observability/producers/owner';
import type { NumericChannelRange } from '../../../../core/log-model/log-types';
import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import '../styles/ve-analyzer-cell-evidence.css';

export interface VeEvidenceVisit {
  readonly sampleIndices: readonly number[];
  readonly timeMs: readonly number[];
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly durationMs: number | undefined;
}

function finite(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    for (const time of times) {
      minimum = Math.min(minimum, time);
      maximum = Math.max(maximum, time);
    }
    const durationMs = times.length > 1 ? maximum - minimum : times.length === 1 ? 0 : undefined;
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

function selectedCellCoordinates(cell: HTMLTableCellElement, rpmBins: readonly number[], loadBins: readonly number[]): { row: number; col: number; rpm: number; load: number } | undefined {
  const table = cell.closest<HTMLTableElement>('table');
  const rowElement = cell.parentElement as HTMLTableRowElement | null;
  const header = table?.tHead?.rows[0];
  if (!table || !rowElement || !header) return undefined;
  const colDom = cell.cellIndex - 1;
  if (colDom < 0) return undefined;
  const rpm = finite(header.cells[cell.cellIndex]?.textContent?.trim());
  const load = finite(rowElement.cells[0]?.textContent?.trim());
  if (rpm === undefined || load === undefined) return undefined;

  const col = rpmBins.findIndex((value) => Math.abs(value - rpm) < 1e-9);
  const row = loadBins.findIndex((value) => Math.abs(value - load) < 1e-9);
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
  observability?: ObservabilityRecorder,
): VeAnalyzerViewController {
  const ownerEvidence = createOwnerEvidence(observability, 've-popup');
  const root = inner.element;
  let context: LoggerAnalysisContext = {
    traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [],
  };
  let active = true;
  let pendingContext: LoggerAnalysisContext | undefined;
  let pendingTune: readonly [import('../../../../core/tune/tune-model').TuneModel | undefined, string | undefined] | undefined;
  const details = new Map<number, { readonly heading: string; readonly content: readonly HTMLElement[]; readonly open: HTMLButtonElement; readonly hasVisit: boolean }>();
  const invalidate = (): void => {
    ownerEvidence.event('ve.popup.invalidate', { entries: details.size });
    details.clear();
    const page = root.closest<HTMLElement>('.analyzer-page') ?? root.parentElement ?? root;
    const panel = page.querySelector<HTMLElement>('.ve-cell-detail-popover');
    if (panel) {
      panel.hidden = true;
      const body = panel.querySelector(':scope > div');
      if (body?.firstChild) body.replaceChildren();
    }
  };

  inner.onPrimaryAnalysisChange(invalidate);

  const showDetail = (cell: HTMLTableCellElement): void => {
    const resolved = inner.getPrimaryAnalysis();
    const { panel, heading, body } = ensureDetailPanel(root);
    panel.hidden = false;
    if (!resolved) {
      heading.textContent = 'VE cell evidence';
      const unavailable = document.createElement('div');
      unavailable.className = 've-evidence-detail-loading';
      unavailable.textContent = 'Evidence is unavailable until a valid VE analysis has been run with an active working delay table.';
      body.replaceChildren(unavailable);
      return;
    }
    const coords = selectedCellCoordinates(cell, resolved.rpmBins, resolved.loadBins);
    if (!coords) { panel.hidden = true; return; }
    const title = `VE evidence · ${format(coords.rpm, 0)} RPM / ${format(coords.load, 0)} load`;

    const index = coords.row * resolved.veTable.cols + coords.col;
    const cached = details.get(index);
    ownerEvidence.event(cached ? 've.popup.cache-hit' : 've.popup.build', { entries: details.size, cell: index }, { visibility: active ? 'active' : 'hidden', stateRevision: inner.sessionRevision });
    if (cached) {
      cached.open.disabled = !cached.hasVisit || !context.openSamplesInLogger;
      if (heading.textContent !== cached.heading) heading.textContent = cached.heading;
      if (body.firstElementChild !== cached.content[0]) body.replaceChildren(...cached.content);
      return;
    }
    if (heading.textContent !== title) heading.textContent = title;
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
    const content = [grid, contextLine, actions];
    details.set(index, { heading: title, content, open, hasVisit: Boolean(visit) });
    body.replaceChildren(...content);
  };

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const cell = target.closest<HTMLTableCellElement>('[data-ve-analyzer="ve-table-view"] tbody td');
    if (!cell) return;
    // Capture the richer native VE evidence review instead of the legacy title-only popover.
    event.stopPropagation();
    showDetail(cell);
  }, { capture: true });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof HTMLTableCellElement) || !target.closest('[data-ve-analyzer="ve-table-view"]')) return;
    event.preventDefault();
    event.stopPropagation();
    showDetail(target);
  }, { capture: true });

  const controller: VeAnalyzerViewController = {
    element: root,
    setActive(next) {
      if (active === next) return;
      active = next;
      inner.setActive(next);
      if (!active) return;
      const tune = pendingTune; pendingTune = undefined;
      const nextContext = pendingContext; pendingContext = undefined;
      if (tune) controller.setTuneModel(tune[0], tune[1]);
      if (nextContext) controller.setContext(nextContext);
    },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(next) {
      if (!active) { pendingContext = next; return false; }
      context = next;
      const changed = inner.setContext(next);
      if (changed) invalidate();
      else {
        for (const cached of details.values()) cached.open.disabled = !cached.hasVisit || !context.openSamplesInLogger;
      }
      return changed;
    },
    setTuneModel(model, sourceName) {
      if (!active) { pendingTune = [model, sourceName]; return false; }
      const changed = inner.setTuneModel(model, sourceName);
      if (changed) invalidate();
      return changed;
    },
    refresh() {
      inner.refresh();
    },
  };
  return controller;
}
