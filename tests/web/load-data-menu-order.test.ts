import { describe, expect, it } from 'vitest';
import { LOAD_DATA_MENU_ORDER } from '../../apps/web/src/app/source-transition';

describe('Load Data menu ordering', () => {
  it('orders source actions by normal setup and use sequence', () => {
    expect(LOAD_DATA_MENU_ORDER).toEqual([
      '.load-ini',
      '.load-msq',
      '.open-log',
      '.unload-log',
      '.shim-source-button',
    ]);
  });

  it('keeps the recorded-log actions adjacent before the live shim action', () => {
    expect(LOAD_DATA_MENU_ORDER.indexOf('.open-log') + 1).toBe(LOAD_DATA_MENU_ORDER.indexOf('.unload-log'));
    expect(LOAD_DATA_MENU_ORDER.indexOf('.unload-log') + 1).toBe(LOAD_DATA_MENU_ORDER.indexOf('.shim-source-button'));
  });
});
