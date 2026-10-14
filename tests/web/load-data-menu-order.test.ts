import { describe, expect, it } from 'vitest';
import { orderLoadDataMenuItems } from '../../apps/web/src/app/source-transition';

describe('Load Data menu ordering', () => {
  it('orders source actions by normal setup and use sequence', () => {
    const menu = document.createElement('div');
    menu.innerHTML = `
      <div class="load-data-menu-head">Header</div>
      <button class="open-log">LOG</button>
      <button class="unload-log">UNLOAD</button>
      <button class="load-ini">INI</button>
      <button class="shim-source-button">TS-SHIM</button>
      <button class="load-msq">MSQ</button>
    `;

    orderLoadDataMenuItems(menu);

    const labels = [...menu.querySelectorAll('button')].map((button) => button.textContent);
    expect(labels).toEqual(['INI', 'MSQ', 'LOG', 'UNLOAD', 'TS-SHIM']);
    expect(menu.firstElementChild?.classList.contains('load-data-menu-head')).toBe(true);
  });

  it('keeps working when optional dynamic items are absent', () => {
    const menu = document.createElement('div');
    menu.innerHTML = `
      <div class="load-data-menu-head">Header</div>
      <button class="open-log">LOG</button>
      <button class="load-ini">INI</button>
      <button class="load-msq">MSQ</button>
    `;

    orderLoadDataMenuItems(menu);

    const labels = [...menu.querySelectorAll('button')].map((button) => button.textContent);
    expect(labels).toEqual(['INI', 'MSQ', 'LOG']);
  });
});
