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

  sync();
  queueMicrotask(sync);
  root.addEventListener('ve-proposal-table-rendered', sync);
}
