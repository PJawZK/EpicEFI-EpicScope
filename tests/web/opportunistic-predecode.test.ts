import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import { buildOpportunisticPredecodeSelection } from '../../apps/web/src/performance/opportunistic-predecode';

function channel(id: string, displayName: string): ChannelDefinition {
  return {
    id,
    sourceName: displayName,
    displayName,
    valueType: 'number',
  };
}

describe('buildOpportunisticPredecodeSelection', () => {
  it('derives extra channels from the runtime catalog without fixed names', () => {
    const definitions = new Map<string, ChannelDefinition>([
      ['runtime:renamed-a', channel('runtime:renamed-a', 'Renamed A')],
      ['runtime:removed-old', channel('runtime:removed-old', 'Removed old')],
      ['runtime:new-b', channel('runtime:new-b', 'New B')],
      ['runtime:new-c', channel('runtime:new-c', 'New C')],
    ]);

    const result = buildOpportunisticPredecodeSelection(
      ['runtime:renamed-a'],
      definitions,
      new Set(['runtime:removed-old']),
      3,
    );

    expect(result.batchIds).toEqual(['runtime:renamed-a', 'runtime:new-b', 'runtime:new-c']);
    expect(result.opportunisticIds).toEqual(['runtime:new-b', 'runtime:new-c']);
    expect(result.opportunisticLabels).toEqual([
      'New B [runtime:new-b]',
      'New C [runtime:new-c]',
    ]);
  });

  it('preserves runtime catalog order and skips duplicate workspace assignments', () => {
    const definitions = new Map<string, ChannelDefinition>([
      ['runtime:a', channel('runtime:a', 'A')],
      ['runtime:b', channel('runtime:b', 'B')],
      ['runtime:c', channel('runtime:c', 'C')],
    ]);

    const result = buildOpportunisticPredecodeSelection(
      ['runtime:b', 'runtime:b'],
      definitions,
      new Set(),
      3,
    );

    expect(result.batchIds).toEqual(['runtime:b', 'runtime:a', 'runtime:c']);
    expect(result.opportunisticIds).toEqual(['runtime:a', 'runtime:c']);
  });
});
