import type { VeResultDisplay, VeResultView } from './ve-analyzer-result-view';

/** Missing alternate metrics are neutral; proposal and delay retain base heat. */
export function veResultViewUsesNeutralFallback(
  view: VeResultView,
  display: VeResultDisplay,
): boolean {
  return view !== 'proposal' && view !== 'delay' && display.scaleMode === 'base';
}
