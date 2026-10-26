import type { VeMsqWriteSnapshot } from '../../../../core/tune/ve-msq-write';
export interface VeProposalCellPosition {
  readonly row: number;
  readonly col: number;
}

export interface VeProposalCellValueEdit extends VeProposalCellPosition {
  readonly value: number | undefined;
}

export interface VeProposalEditSnapshot {
  readonly revision: number;
  readonly authorityGeneration: number;
  readonly pinnedPositions?: readonly VeProposalCellPosition[];
  readonly rows: number;
  readonly cols: number;
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  /** Baseline displayed values when this review authority was established. */
  readonly baselineValues: readonly (number | undefined)[];
  /** Current review/working values. Source MSQ remains immutable. */
  readonly values: readonly (number | undefined)[];
  readonly digits: number | undefined;
}

export interface VeProposalEditOwner {
  snapshot(): VeProposalEditSnapshot | undefined;
  /** Capture committed Working VE, independently of visible Result View. No I/O. */
  captureMsqWrite(): VeMsqWriteSnapshot | undefined;
  isMsqWriteCurrent(snapshot: VeMsqWriteSnapshot): boolean;
  applyValues(edits: readonly VeProposalCellValueEdit[]): boolean;
  revert(positions: readonly VeProposalCellPosition[]): boolean;
  setPinned(positions: readonly VeProposalCellPosition[]): boolean;
}

const OWNERS = new WeakMap<HTMLElement, VeProposalEditOwner>();

export function registerVeProposalEditOwner(root: HTMLElement, owner: VeProposalEditOwner): void {
  OWNERS.set(root, owner);
}

export function veProposalEditOwner(root: HTMLElement): VeProposalEditOwner | undefined {
  return OWNERS.get(root);
}
