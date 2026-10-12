import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  resolveSemanticChannelRole,
  semanticChannelRole,
} from '../../apps/web/src/state/semantic-channel-roles';

function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition {
  return {
    id,
    sourceName,
    displayName,
    valueType: 'number',
    unit: undefined,
  };
}

describe('semantic channel roles', () => {
  it('keeps TPS as the EpicScope display name while accepting legacy TP', () => {
    expect(semanticChannelRole('engine.throttle.position').displayName).toBe('TPS');

    const result = resolveSemanticChannelRole('engine.throttle.position', [
      channel('TP'),
    ]);

    expect(result.channel?.id).toBe('TP');
    expect(result.source).toBe('exact-alias');
    expect(result.role.displayName).toBe('TPS');
  });

  it('prefers established EpicEFI runtime names over generic aliases', () => {
    const result = resolveSemanticChannelRole('engine.rpm', [
      channel('RPM'),
      channel('RPMValue'),
    ]);

    expect(result.channel?.id).toBe('RPMValue');
    expect(result.source).toBe('exact-alias');
  });

  it('resolves stable INI identities without changing their source identity', () => {
    const result = resolveSemanticChannelRole('engine.map', [
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
    ]);

    expect(result.channel?.id).toBe('ini:MAPValue');
    expect(result.role.displayName).toBe('MAP');
  });

  it('uses an explicit user/schema override before automatic aliases', () => {
    const result = resolveSemanticChannelRole(
      'engine.throttle.position',
      [channel('TPSValue'), channel('customThrottle')],
      { overrides: new Map([['engine.throttle.position', 'customThrottle']]) },
    );

    expect(result.channel?.id).toBe('customThrottle');
    expect(result.source).toBe('override');
  });

  it('falls back conservatively to familiar cross-ECU names', () => {
    const result = resolveSemanticChannelRole('temperature.coolant', [
      channel('sensor-17', 'ECT', 'Engine coolant'),
    ]);

    expect(result.channel?.id).toBe('sensor-17');
    expect(result.source).toBe('exact-alias');
  });

  it('does not mistake MAP targets for measured MAP', () => {
    const result = resolveSemanticChannelRole('engine.map', [
      channel('boostTarget', 'Boost target', 'Manifold pressure target'),
    ]);

    expect(result.channel).toBeUndefined();
    expect(result.source).toBe('unresolved');
  });
});
