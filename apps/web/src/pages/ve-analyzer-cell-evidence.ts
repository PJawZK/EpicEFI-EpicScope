import type { ObservabilityRecorder } from '../observability/recorder';
import { createOwnerEvidence } from '../observability/producers/owner';
import type { NumericChannelRange } from '../../../../core/log-model/log-types';
import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import { veProposalEditOwner } from './ve-analyzer-proposal-edit-owner';
import { veWorkingCellMetrics } from './ve-analyzer-table-projection';
import '../styles/ve-analyzer-cell-evidence.css';

export interface VeEvidenceVisit {
  readonly sampleIndices: readonly number[];
  readonly timeMs: readonly number[];
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly durationMs: number | undefined;
}

function rangeTime(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const local = sampleIndex - range.startSampleIndex;
  if (local < 0 || local >= range.timeMs.length) return undefined;
  const value = range.timeMs[local];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

/** Pick the longest contiguous source visit; ties prefer the longer time span.
 * timeForSample is a pure retained-range lookup: only the winning visit is materialized.
 */
export function strongestVeEvidenceVisit(
  sampleIndices: ArrayLike<number>,
  timeForSample: (sampleIndex: number) => number | undefined,
  maxGapSamples = 1,
): VeEvidenceVisit | undefined {
  // Evidence-map traversal publishes nondecreasing indices. Keep a defensive
  // fallback for other callers, preserving duplicates and never mutating input.
  let ordered = true;
  let previous = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < sampleIndices.length; index += 1) {
    const sample = sampleIndices[index]!;
    if (!Number.isSafeInteger(sample) || sample < previous) { ordered = false; break; }
    previous = sample;
  }
  const indices = ordered ? sampleIndices : Array.from(sampleIndices).filter(Number.isSafeInteger).sort((a, b) => a - b);
  if (indices.length === 0) return undefined;

  const gap = Math.max(1, maxGapSamples);
  let bestStart = 0, bestEnd = 0;
  let bestDuration: number | undefined;
  let start = 0;
  let timedCount = 0;
  let minimum = Number.POSITIVE_INFINITY, maximum = Number.NEGATIVE_INFINITY;
  const finishRun = (end: number): void => {
    if (timedCount === 0) return;
    const duration = timedCount > 1 ? maximum - minimum : 0;
    const length = end - start, bestLength = bestEnd - bestStart;
    if (length > bestLength || (length === bestLength && duration > (bestDuration ?? -1))) {
      bestStart = start; bestEnd = end; bestDuration = duration;
    }
  };
  for (let index = 0; index < indices.length; index += 1) {
    const sample = indices[index]!;
    if (index > start && !(sample - indices[index - 1]! <= gap)) {
      finishRun(index);
      start = index; timedCount = 0;
      minimum = Number.POSITIVE_INFINITY; maximum = Number.NEGATIVE_INFINITY;
    }
    const time = timeForSample(sample);
    if (time !== undefined) {
      timedCount += 1;
      minimum = Math.min(minimum, time); maximum = Math.max(maximum, time);
    }
  }
  finishRun(indices.length);
  if (bestEnd === bestStart) return undefined;
  const samples: number[] = [], times: number[] = [];
  for (let index = bestStart; index < bestEnd; index += 1) {
    const sample = indices[index]!;
    samples.push(sample);
    const time = timeForSample(sample);
    if (time !== undefined) times.push(time);
  }
  return { sampleIndices: samples, timeMs: times,
    startSampleIndex: samples[0]!, endSampleIndex: samples[samples.length - 1]!, durationMs: bestDuration };
}

function isCurrentVeCell(root: HTMLElement, cell: HTMLTableCellElement): boolean {
  const table = root.querySelector<HTMLTableElement>('[data-ve-analyzer="ve-table-view"] table.ve-workbench-table');
  return cell.isConnected && Boolean(table?.contains(cell)) && cell.closest('table') === table;
}

function selectedCellCoordinates(cell: HTMLTableCellElement, rpmBins: readonly number[], loadBins: readonly number[]): { row: number; col: number; rpm: number; load: number } | undefined {
  const rowText = cell.dataset.veRow, colText = cell.dataset.veCol;
  if (!rowText?.trim() || !colText?.trim()) return undefined;
  const row = Number(rowText), col = Number(colText);
  if (!Number.isSafeInteger(row) || !Number.isSafeInteger(col) || row < 0 || col < 0
    || row >= loadBins.length || col >= rpmBins.length) return undefined;
  const rpm = rpmBins[col]!, load = loadBins[row]!;
  return Number.isFinite(rpm) && Number.isFinite(load) ? { row, col, rpm, load } : undefined;
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
  let disposed = false;
  const events = new AbortController();
  let context: LoggerAnalysisContext = {
    traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [],
  };
  let active = true;
  let pendingContext: LoggerAnalysisContext | undefined;
  let pendingTune: readonly [import('../../../../core/tune/tune-model').TuneModel | undefined, string | undefined] | undefined;
  const details = new Map<number, { readonly heading: string; readonly content: readonly HTMLElement[]; readonly open: HTMLButtonElement; readonly hasVisit: boolean; readonly updateWorking: () => void }>();
  let shownIndex: number | undefined;
  const invalidate = (): void => {
    ownerEvidence.event('ve.popup.invalidate', { entries: details.size });
    details.clear();
    shownIndex = undefined;
    const page = root.closest<HTMLElement>('.analyzer-page') ?? root.parentElement ?? root;
    const panel = page.querySelector<HTMLElement>('.ve-cell-detail-popover');
    if (panel) {
      panel.hidden = true;
      const body = panel.querySelector(':scope > div');
      if (body?.firstChild) body.replaceChildren();
    }
  };

  const unsubscribePrimary = inner.onPrimaryAnalysisChange(invalidate);

  const showDetail = (cell: HTMLTableCellElement): void => {
    if (!active || !isCurrentVeCell(root, cell)) return;
    const resolved = inner.getPrimaryAnalysis();
    const { panel, heading, body } = ensureDetailPanel(root);
    panel.hidden = false;
    if (!resolved) {
      shownIndex = undefined;
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
    shownIndex = index;
    const cached = details.get(index);
    ownerEvidence.event(cached ? 've.popup.cache-hit' : 've.popup.build', { entries: details.size, cell: index }, { visibility: active ? 'active' : 'hidden', stateRevision: inner.sessionRevision });
    if (cached) {
      cached.updateWorking();
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
      metric('Generated proposed VE', format(proposalCell.proposedValue, resolved.veTable.digits)),
      metric('Raw evidence candidate', format(proposalCell.evidenceCandidate, resolved.veTable.digits)),
      metric('Analysis VE change', signed(proposalCell.changeValue, 2)),
      metric('Analysis VE change %', signed(proposalCell.changePercent, 1, '%')),
      metric('Analysis change basis', proposalCell.state === 'measured' ? 'Accepted generated proposal versus original tune' : proposalCell.evidenceCandidate === undefined ? 'No evidence candidate available' : 'Unaccepted raw candidate versus original tune'),
      metric('Base-VE correction', signed(evidenceCell.correctionPercent, 1, '%')),
      metric('Correction basis', resolved.evidence.fuelCorrectionCompensated ? 'Actual / target with applied fuel trim compensation' : 'Actual / target without applied fuel trim compensation'),
      metric('Samples', evidenceCell.sampleCount.toLocaleString()),
      metric('Evidence weight', format(evidenceCell.totalWeight, 3)),
      metric('Confidence', evidenceCell.confidence),
      metric('P10 correction', percentFromRatio(evidenceCell.correctionP10Ratio)),
      metric('P90 correction', percentFromRatio(evidenceCell.correctionP90Ratio)),
      metric('Spread', evidenceCell.correctionSpreadPercent === undefined ? '—' : `${format(evidenceCell.correctionSpreadPercent, 1)}%`),
      metric('Proposal state', proposalCell.state),
    );

    const workingMetrics = [metric('Working VE', '—'), metric('Working change', '—'), metric('Working change %', '—')];
    grid.append(...workingMetrics);
    const updateWorking = (): void => {
      const snapshot = veProposalEditOwner(root)?.snapshot();
      const working = snapshot && snapshot.rows === resolved.veTable.rows && snapshot.cols === resolved.veTable.cols ? snapshot.values[index] : undefined;
      const values = veWorkingCellMetrics(current, working);
      const texts = [format(values.value, resolved.veTable.digits), signed(values.change, 2), signed(values.changePercent, 1, '%')];
      workingMetrics.forEach((node, i) => {
        const output = node.lastElementChild!;
        if (output.textContent !== texts[i]) output.textContent = texts[i]!;
      });
    };
    updateWorking();

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
    details.set(index, { heading: title, content, open, hasVisit: Boolean(visit), updateWorking });
    body.replaceChildren(...content);
  };

  // The existing owner publishes this local render event after working edits.
  // Patch only the shown review fields; retained evidence/visits stay cached.
  root.addEventListener('ve-proposal-table-rendered', () => {
    if (!active || shownIndex === undefined) return;
    const page = root.closest<HTMLElement>('.analyzer-page') ?? root.parentElement ?? root;
    if (page.querySelector<HTMLElement>('.ve-cell-detail-popover')?.hidden === false) details.get(shownIndex)?.updateWorking();
  }, { signal: events.signal });

  root.addEventListener('ve-cell-evidence-open', (event) => {
    const detail = (event as CustomEvent<{ readonly cell?: HTMLTableCellElement }>).detail;
    const cell = detail?.cell;
    if (!(cell instanceof HTMLTableCellElement)) return;
    showDetail(cell);
  }, { signal: events.signal });

  const controller: VeAnalyzerViewController = {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      active = false; pendingContext = undefined; pendingTune = undefined;
      unsubscribePrimary(); invalidate();
      context = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
      inner.dispose();
    },
    setActive(next) { if (disposed) return;
      if (active === next) return;
      active = next;
      inner.setActive(next);
      if (!active) {
        const page = root.closest<HTMLElement>('.analyzer-page') ?? root.parentElement ?? root;
        const panel = page.querySelector<HTMLElement>('.ve-cell-detail-popover');
        if (panel) panel.hidden = true;
        return;
      }
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
      if (disposed) return false;
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
      if (disposed) return false;
      if (!active) { pendingTune = [model, sourceName]; return false; }
      const changed = inner.setTuneModel(model, sourceName);
      if (changed) invalidate();
      return changed;
    },
    refresh() {
      if (disposed) return;
      inner.refresh();
    },
  };
  return controller;
}
