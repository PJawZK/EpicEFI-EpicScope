import type { VeEvidenceMapResult } from './ve-evidence-map';

export type VeProposalState = 'no-evidence' | 'weak-evidence' | 'measured' | 'withheld-limit';

export interface VeProposalConfig {
  readonly priorWeight: number;
  readonly minimumEvidenceWeight: number;
  readonly maximumAbsoluteChange: number;
  readonly maximumPercentChange: number;
}

export interface VeProposalCell {
  readonly row: number;
  readonly col: number;
  readonly currentValue: number;
  readonly evidenceCandidate: number | undefined;
  readonly proposedValue: number | undefined;
  readonly changeValue: number | undefined;
  readonly changePercent: number | undefined;
  readonly state: VeProposalState;
  readonly totalWeight: number;
  readonly sampleCount: number;
}

export interface VeProposalResult {
  readonly cells: readonly VeProposalCell[];
  readonly measuredCellCount: number;
  readonly weakCellCount: number;
  readonly withheldCellCount: number;
  readonly noEvidenceCellCount: number;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and >= 0.`);
  return value;
}

export function buildVeProposal(
  currentValues: readonly number[],
  rows: number,
  cols: number,
  evidence: VeEvidenceMapResult,
  config: VeProposalConfig,
): VeProposalResult {
  if (rows * cols > currentValues.length || evidence.cells.length !== rows * cols) throw new RangeError('VE proposal geometry does not match the current VE table.');
  const priorWeight = finiteNonNegative(config.priorWeight, 'VE prior weight');
  const minimumEvidenceWeight = finiteNonNegative(config.minimumEvidenceWeight, 'VE minimum evidence weight');
  const maximumAbsoluteChange = finiteNonNegative(config.maximumAbsoluteChange, 'VE maximum absolute change');
  const maximumPercentChange = finiteNonNegative(config.maximumPercentChange, 'VE maximum percent change');

  const cells: VeProposalCell[] = [];
  let measuredCellCount = 0;
  let weakCellCount = 0;
  let withheldCellCount = 0;
  let noEvidenceCellCount = 0;

  for (let index = 0; index < rows * cols; index += 1) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const currentValue = currentValues[index]!;
    const source = evidence.cells[index]!;
    if (!(source.totalWeight > 0) || source.correctionRatio === undefined || !Number.isFinite(currentValue)) {
      noEvidenceCellCount += 1;
      cells.push({ row, col, currentValue, evidenceCandidate: undefined, proposedValue: undefined, changeValue: undefined, changePercent: undefined, state: 'no-evidence', totalWeight: source.totalWeight, sampleCount: source.sampleCount });
      continue;
    }

    const evidenceCandidate = currentValue * source.correctionRatio;
    const rawChange = evidenceCandidate - currentValue;
    const rawPercent = currentValue !== 0 ? rawChange / currentValue * 100 : Number.POSITIVE_INFINITY;
    if (Math.abs(rawChange) > maximumAbsoluteChange || Math.abs(rawPercent) > maximumPercentChange) {
      withheldCellCount += 1;
      cells.push({ row, col, currentValue, evidenceCandidate, proposedValue: undefined, changeValue: rawChange, changePercent: rawPercent, state: 'withheld-limit', totalWeight: source.totalWeight, sampleCount: source.sampleCount });
      continue;
    }

    if (source.totalWeight < minimumEvidenceWeight) {
      weakCellCount += 1;
      cells.push({ row, col, currentValue, evidenceCandidate, proposedValue: undefined, changeValue: rawChange, changePercent: rawPercent, state: 'weak-evidence', totalWeight: source.totalWeight, sampleCount: source.sampleCount });
      continue;
    }

    const denominator = priorWeight + source.totalWeight;
    const proposedValue = denominator > 0
      ? (currentValue * priorWeight + evidenceCandidate * source.totalWeight) / denominator
      : evidenceCandidate;
    const changeValue = proposedValue - currentValue;
    const changePercent = currentValue !== 0 ? changeValue / currentValue * 100 : undefined;
    measuredCellCount += 1;
    cells.push({ row, col, currentValue, evidenceCandidate, proposedValue, changeValue, changePercent, state: 'measured', totalWeight: source.totalWeight, sampleCount: source.sampleCount });
  }

  return { cells, measuredCellCount, weakCellCount, withheldCellCount, noEvidenceCellCount };
}
