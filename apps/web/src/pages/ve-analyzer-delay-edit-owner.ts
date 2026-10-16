import type { VeDelayCellPosition } from '../../../../core/analysis/ve-delay-table-editing';

export interface VeDelayEditSnapshot {
  /** Broad Analyzer revision retained for diagnostics/compatibility. */
  readonly revision: number;
  /** Changes only when the editable Lambda-delay surface authority/values change. */
  readonly authorityGeneration: number;
  readonly rows: number;
  readonly cols: number;
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  readonly values: readonly (number | undefined)[];
}

export interface VeDelayCellValueEdit extends VeDelayCellPosition {
  readonly workingMs: number | undefined;
}

export interface VeDelayEditOwner {
  snapshot(): VeDelayEditSnapshot | undefined;
  applyValues(edits: readonly VeDelayCellValueEdit[]): boolean;
  revert(positions: readonly VeDelayCellPosition[]): boolean;
}

const owners = new WeakMap<HTMLElement, VeDelayEditOwner>();

/**
 * Register the semantic Lambda Delay owner against the stable VE root element.
 *
 * The root is only a lifetime/capability key. No values are read from the DOM and
 * no presentation state is treated as authoritative. This keeps the existing
 * controller wrapper chain stable while the v50 port is reconciled with current
 * production ownership.
 */
export function registerVeDelayEditOwner(element: HTMLElement, owner: VeDelayEditOwner): void {
  owners.set(element, owner);
}

export function veDelayEditOwner(element: HTMLElement): VeDelayEditOwner | undefined {
  return owners.get(element);
}
