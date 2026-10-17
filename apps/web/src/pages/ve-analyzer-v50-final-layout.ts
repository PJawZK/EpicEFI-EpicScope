import './ve-analyzer-v50-final-layout.css';

const installedRoots = new WeakSet<HTMLElement>();

/**
 * Final presentation-order reconciliation against the frozen v50 workbench.
 *
 * Existing production nodes keep their listeners/state owners. This layer only
 * restores the visual workflow order: compact setup -> readiness/status -> Run,
 * with blocker feedback immediately adjacent to the status row.
 */
export function installVeAnalyzerV50FinalLayout(root: HTMLElement): void {
  if (installedRoots.has(root)) return;
  installedRoots.add(root);

  const sync = (): void => {
    const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar');
    if (!actionbar) return;

    const run = actionbar.querySelector<HTMLButtonElement>('.ve-workbench-run');
    if (run && actionbar.lastElementChild !== run) actionbar.append(run);

    const blocker = root.querySelector<HTMLElement>('.ve-run-blocker-panel');
    if (blocker && actionbar.nextElementSibling !== blocker) {
      actionbar.insertAdjacentElement('afterend', blocker);
    }
  };

  // Size each rendered table row from the table viewport instead of using
  // table{height:100%}, which can distribute anonymous extra row space and
  // leave dark unpainted bands. This is presentation only.
  const fitRows = (): void => {
    for (const wrapper of root.querySelectorAll<HTMLElement>('.ve-workbench-table-wrap')) {
      if (wrapper.clientHeight < 1 || wrapper.clientWidth < 1) continue;
      const table = wrapper.querySelector<HTMLTableElement>('table.ve-workbench-table');
      const rows = table?.tBodies[0]?.rows.length ?? 0;
      if (!table || !rows) continue;
      const headerHeight = table.tHead?.getBoundingClientRect().height ?? 20;
      const available = Math.max(0, wrapper.clientHeight - headerHeight - 2);
      const rowHeight = Math.max(16, Math.min(70, available / rows));
      const next = `${rowHeight.toFixed(2)}px`;
      if (table.style.getPropertyValue('--ve-v50-row-height') !== next) {
        table.style.setProperty('--ve-v50-row-height', next);
      }
    }
  };
  const scheduleFit = (): void => { requestAnimationFrame(fitRows); };
  const resizeObserver = new ResizeObserver(scheduleFit);
  for (const wrapper of root.querySelectorAll<HTMLElement>('.ve-workbench-table-wrap')) {
    resizeObserver.observe(wrapper);
  }

  sync();
  queueMicrotask(sync);
  scheduleFit();
  root.addEventListener('ve-proposal-table-rendered', () => { sync(); scheduleFit(); });

}
