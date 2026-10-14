import { describe, expect, it } from 'vitest';
import {
  isGasScaleAfrLabel,
  isGenericAfrLabel,
  shouldPreferGasScaleAfr,
} from '../../apps/web/src/app/ve-analyzer-ui-refinements';

describe('VE Analyzer UI refinements', () => {
  it('recognizes literal Gas Scale AFR labels without renaming them', () => {
    const label = 'Air/Fuel Ratio_Gas Scale [AFR]';
    expect(isGasScaleAfrLabel(label)).toBe(true);
    expect(label).toBe('Air/Fuel Ratio_Gas Scale [AFR]');
  });

  it('recognizes the generic AFR source that should yield to Gas Scale AFR initially', () => {
    expect(isGenericAfrLabel('AFRValue [AFR]')).toBe(true);
    expect(shouldPreferGasScaleAfr('AFRValue [AFR]', 'Air/Fuel Ratio_Gas Scale [AFR]', 'afr')).toBe(true);
  });

  it('does not override an explicit non-generic AFR selection', () => {
    expect(isGenericAfrLabel('RealAFRValue [AFR]')).toBe(false);
    expect(shouldPreferGasScaleAfr('RealAFRValue [AFR]', 'Air/Fuel Ratio_Gas Scale [AFR]', 'afr')).toBe(false);
  });

  it('does not apply AFR Gas Scale preference in Lambda mode', () => {
    expect(shouldPreferGasScaleAfr('lambdaValue', 'Air/Fuel Ratio_Gas Scale [AFR]', 'lambda')).toBe(false);
  });
});
