import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  isVeActualMixtureChannelEligible,
  preferredVeActualMixtureChannel,
} from '../../apps/web/src/pages/analyzer-channel-roles';

function channel(sourceName: string, unit = '', displayName = sourceName): ChannelDefinition {
  return {
    id: `ini:${sourceName}`,
    sourceName,
    displayName,
    valueType: 'number',
    ...(unit ? { unit } : {}),
  };
}

describe('VE actual-mixture channel selection', () => {
  it('accepts real AFR measurements and rejects AFR-derived error/context channels', () => {
    expect(isVeActualMixtureChannelEligible(channel('afrGasolineScale', 'AFR'), 'afr')).toBe(true);
    expect(isVeActualMixtureChannelEligible(channel('AFRValue', 'AFR'), 'afr')).toBe(true);
    expect(isVeActualMixtureChannelEligible(channel('afrError', '%'), 'afr')).toBe(false);
    expect(isVeActualMixtureChannelEligible(channel('targetAFR', 'AFR'), 'afr')).toBe(false);
    expect(isVeActualMixtureChannelEligible(channel('afrCorrection', '%'), 'afr')).toBe(false);
    expect(isVeActualMixtureChannelEligible(channel('afrTargetOffset', 'AFR'), 'afr')).toBe(false);
  });

  it('accepts real Lambda measurements and rejects Lambda target/error/context channels', () => {
    expect(isVeActualMixtureChannelEligible(channel('lambdaValue'), 'lambda')).toBe(true);
    expect(isVeActualMixtureChannelEligible(channel('RealLambdaValue1'), 'lambda')).toBe(true);
    expect(isVeActualMixtureChannelEligible(channel('targetLambda'), 'lambda')).toBe(false);
    expect(isVeActualMixtureChannelEligible(channel('lambdaError', '%'), 'lambda')).toBe(false);
    expect(isVeActualMixtureChannelEligible(channel('lambdaCorrection', '%'), 'lambda')).toBe(false);
  });

  it('keeps AFR and Lambda domains distinct', () => {
    expect(isVeActualMixtureChannelEligible(channel('lambdaValue'), 'afr')).toBe(false);
    expect(isVeActualMixtureChannelEligible(channel('afrGasolineScale', 'AFR'), 'lambda')).toBe(false);
  });

  it('prefers the firmware VE Analyze AFR source over misleading AFR-like channels', () => {
    const channels = [
      channel('afrError', '%'),
      channel('targetAFR', 'AFR'),
      channel('AFRValue', 'AFR'),
      channel('afrGasolineScale', 'AFR'),
      channel('lambdaValue'),
    ];
    expect(preferredVeActualMixtureChannel(channels, 'afr')?.sourceName).toBe('afrGasolineScale');
  });

  it('prefers primary lambdaValue in Lambda mode', () => {
    const channels = [
      channel('targetLambda'),
      channel('lambdaValue2'),
      channel('RealLambdaValue1'),
      channel('lambdaValue'),
    ];
    expect(preferredVeActualMixtureChannel(channels, 'lambda')?.sourceName).toBe('lambdaValue');
  });
});
