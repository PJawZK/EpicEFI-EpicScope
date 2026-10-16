import type { NumericChannelRange } from '../../../../core/log-model/log-types';

interface BridgeEndpoint { readonly timeMs: number; readonly value: number }
export interface IntegrityBridge { readonly before: BridgeEndpoint; readonly after: BridgeEndpoint }

function lowerBound(values: Float64Array, target: number): number {
  let low = 0, high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if ((values[middle] ?? Number.POSITIVE_INFINITY) < target) low = middle + 1;
    else high = middle;
  }
  return low;
}
function endpoint(range: NumericChannelRange, index: number): BridgeEndpoint | undefined {
  const timeMs = range.timeMs[index], value = range.values[index];
  if (timeMs === undefined || value === undefined || range.validity[index] !== 1
    || !Number.isFinite(timeMs) || !Number.isFinite(value)) return undefined;
  return { timeMs, value };
}

/** Draw-local traversal for nondecreasing marker times. No state survives a draw:
 * mutable CRC validity, range replacement and new projections are read afresh.
 * Binary jumps skip distant valid spans; disjoint backward windows and a forward
 * cursor prevent markers in one invalid run from repeatedly scanning that run. */
export function createOrderedBridgeLookup(range: NumericChannelRange): (timeMs: number) => IntegrityBridge | undefined {
  let beforeLimit = 0, afterIndex = 0;
  let before: BridgeEndpoint | undefined;
  return markerTimeMs => {
    const pivot = lowerBound(range.timeMs, markerTimeMs);
    for (let index = pivot - 1; index >= beforeLimit; index -= 1) {
      const candidate = endpoint(range, index);
      if (candidate && candidate.timeMs < markerTimeMs) { before = candidate; break; }
    }
    beforeLimit = pivot;
    afterIndex = Math.max(afterIndex, pivot);
    let after: BridgeEndpoint | undefined;
    while (afterIndex < range.timeMs.length) {
      const candidate = endpoint(range, afterIndex);
      if (candidate && candidate.timeMs > markerTimeMs) { after = candidate; break; }
      afterIndex += 1;
    }
    return before && after && after.timeMs > before.timeMs ? { before, after } : undefined;
  };
}
