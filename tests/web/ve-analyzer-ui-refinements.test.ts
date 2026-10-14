import { describe, expect, it } from 'vitest';
import { isGasScaleAfrOption, preferGasScaleAfrOption } from '../../apps/web/src/app/ve-analyzer-ui-refinements';

describe('VE Analyzer UI refinements', () => {
  it('recognizes literal Gas Scale AFR labels without renaming them', () => {
    const option = new Option('Air/Fuel Ratio_Gas Scale [AFR]', 'gas');
    expect(isGasScaleAfrOption(option)).toBe(true);
    expect(option.textContent).toBe('Air/Fuel Ratio_Gas Scale [AFR]');
  });

  it('upgrades the initial generic AFR selection to Gas Scale AFR', () => {
    const control = document.createElement('select');
    control.append(new Option('AFRValue [AFR]', 'afr'), new Option('Air/Fuel Ratio_Gas Scale [AFR]', 'gas'));
    control.value = 'afr';
    expect(preferGasScaleAfrOption(control, 'afr')).toBe(true);
    expect(control.value).toBe('gas');
  });

  it('does not override an explicit non-generic AFR selection', () => {
    const control = document.createElement('select');
    control.append(new Option('RealAFRValue [AFR]', 'real'), new Option('Air/Fuel Ratio_Gas Scale [AFR]', 'gas'));
    control.value = 'real';
    expect(preferGasScaleAfrOption(control, 'afr')).toBe(false);
    expect(control.value).toBe('real');
  });

  it('does not apply AFR Gas Scale preference in Lambda mode', () => {
    const control = document.createElement('select');
    control.append(new Option('lambdaValue', 'lambda'), new Option('Air/Fuel Ratio_Gas Scale [AFR]', 'gas'));
    control.value = 'lambda';
    expect(preferGasScaleAfrOption(control, 'lambda')).toBe(false);
    expect(control.value).toBe('lambda');
  });
});
