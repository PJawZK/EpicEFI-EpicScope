import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import { assessVeFuelCorrection, isKnownPercentFuelCorrection } from '../../apps/web/src/pages/ve-fuel-correction';

function channel(sourceName: string, unit?: string): ChannelDefinition {
  return {
    id: sourceName,
    sourceName,
    ...(unit ? { unit } : {}),
  } as ChannelDefinition;
}

describe('VE fuel correction semantics', () => {
  it('recognizes EpicEFI STFT/LTFT percent correction identities without renaming them', () => {
    expect(isKnownPercentFuelCorrection(channel('stftCorrection1', '%'))).toBe(true);
    expect(isKnownPercentFuelCorrection(channel('ltftCorrection2', '%'))).toBe(true);
    expect(isKnownPercentFuelCorrection(channel('stftCorrection1', 'V'))).toBe(false);
    expect(isKnownPercentFuelCorrection(channel('egoCorrection', '%'))).toBe(false);
  });

  it('keeps unknown correction sources context-only in auto mode', () => {
    const assessment = assessVeFuelCorrection(channel('egoCorrection', '%'), 'auto');
    expect(assessment.applicable).toBe(false);
    expect(assessment.interpretation).toBe('context-only');
  });

  it('allows an explicit user declaration of percent fuel applied', () => {
    const assessment = assessVeFuelCorrection(channel('customFuelCorrection', '%'), 'percent');
    expect(assessment.applicable).toBe(true);
    expect(assessment.interpretation).toBe('percent-fuel-applied');
  });
});
