import { describe, expect, it } from 'vitest';
import {
  NUMERIC_SAMPLE_QUALITY,
  numericSampleQualityIsValid,
  numericSampleQualityToValidity,
} from '../../../core/log-model/log-types';
import {
  shimChannelDefinition,
  shimSchemaChannelDefinitions,
} from '../../../apps/web/src/adapters/shim/shim-schema-adapter';
import type { ShimSchema, ShimSchemaChannel } from '../../../apps/web/src/adapters/shim/shim-protocol';

function channel(overrides: Partial<ShimSchemaChannel> = {}): ShimSchemaChannel {
  return {
    id: 'RPMValue',
    name: 'RPMValue',
    unit: 'rpm',
    type: 'number',
    ...overrides,
  };
}

function schema(decodable = true): ShimSchema {
  return {
    id: 'native-v1:test',
    iniHash: 'abc123',
    decoderVersion: '1',
    complete: true,
    decodable,
    channels: [
      channel({
        displayHints: [{
          id: 'rpmGauge',
          name: 'Engine speed',
          unit: 'rpm',
          precision: 0,
          category: 'Engine',
        }],
      }),
      channel({ id: 'coolant', name: 'coolant', unit: '°C', category: 'Temperature' }),
    ],
  };
}

describe('ts_shim schema adapter', () => {
  it('maps exact shim identities plus display metadata into ChannelDefinition', () => {
    expect(shimChannelDefinition(schema().channels[0]!)).toEqual({
      id: 'RPMValue',
      sourceName: 'RPMValue',
      displayName: 'Engine speed',
      valueType: 'number',
      unit: 'rpm',
      category: 'Engine',
      precision: 0,
    });
  });

  it('falls back to exact output-channel names and direct channel category', () => {
    expect(shimChannelDefinition(schema().channels[1]!)).toEqual({
      id: 'coolant',
      sourceName: 'coolant',
      displayName: 'coolant',
      valueType: 'number',
      unit: '°C',
      category: 'Temperature',
    });
  });

  it('does not expose channels from an undecodable schema', () => {
    expect(shimSchemaChannelDefinitions(schema(false))).toEqual([]);
  });
});

describe('normalized numeric sample quality', () => {
  it('keeps shim-compatible quality meanings distinct', () => {
    expect(NUMERIC_SAMPLE_QUALITY).toEqual({
      valid: 0,
      invalid: 1,
      stale: 2,
      unavailable: 3,
      lost: 4,
    });
  });

  it('projects only valid quality to the legacy binary validity contract', () => {
    const quality = [0, 1, 2, 3, 4];
    expect(quality.map(numericSampleQualityIsValid)).toEqual([true, false, false, false, false]);
    expect(quality.map(numericSampleQualityToValidity)).toEqual([1, 0, 0, 0, 0]);
  });
});
