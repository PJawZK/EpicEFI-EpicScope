import './ve-analyzer-v50-evidence-inspector.css';

const installedRoots = new WeakSet<HTMLElement>();

function detailPanel(root: HTMLElement): HTMLElement | null {
  const page = root.closest<HTMLElement>('.analyzer-page') ?? root.parentElement ?? root;
  return page.querySelector<HTMLElement>('.ve-cell-detail-popover');
}

function selectedVeCell(target: EventTarget | null, root: HTMLElement): HTMLTableCellElement | null {
  if (!(target instanceof Element)) return null;
  const cell = target.closest<HTMLTableCellElement>('[data-ve-analyzer="ve-table-view"] td[data-ve-row][data-ve-col]');
  return cell && root.contains(cell) ? cell : null;
}

function followSelection(root: HTMLElement, cell: HTMLTableCellElement): void {
  queueMicrotask(() => {
    const panel = detailPanel(root);
    if (!panel || panel.hidden || cell.dataset.tableSelected !== 'true' || !cell.isConnected) return;
    root.dispatchEvent(new CustomEvent('ve-cell-evidence-open', {
      bubbles: false,
      detail: { cell },
    }));
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * v50 presentation behavior for the existing semantic Cell Evidence owner.
 *
 * The evidence module continues to own analysis lookup, caching and Logger actions.
 * This adapter only makes its existing panel act like the frozen v50 inspector:
 * while open it follows the current VE selection, and its header can be dragged
 * without creating another evidence/state owner.
 */
export function installVeAnalyzerV50EvidenceInspector(root: HTMLElement): void {
  if (installedRoots.has(root)) return;
  installedRoots.add(root);

  root.addEventListener('pointerdown', (event) => {
    const cell = selectedVeCell(event.target, root);
    if (cell) followSelection(root, cell);
  }, { capture: true });

  root.addEventListener('focusin', (event) => {
    const cell = selectedVeCell(event.target, root);
    if (cell) followSelection(root, cell);
  });

  const page = root.closest<HTMLElement>('.analyzer-page') ?? root.parentElement ?? root;
  let dragPointerId: number | undefined;
  let panel: HTMLElement | undefined;
  let offsetX = 0;
  let offsetY = 0;

  const finishDrag = (): void => {
    dragPointerId = undefined;
    if (panel) panel.dataset.dragging = 'false';
    panel = undefined;
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', up, true);
  };

  function move(event: PointerEvent): void {
    if (dragPointerId !== event.pointerId || !panel) return;
    const rect = panel.getBoundingClientRect();
    const pad = 8;
    const maxLeft = Math.max(pad, window.innerWidth - rect.width - pad);
    const maxTop = Math.max(pad, window.innerHeight - rect.height - pad);
    panel.style.left = `${clamp(event.clientX - offsetX, pad, maxLeft)}px`;
    panel.style.top = `${clamp(event.clientY - offsetY, pad, maxTop)}px`;
  }

  function up(event: PointerEvent): void {
    if (dragPointerId !== event.pointerId) return;
    finishDrag();
  }

  page.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element)) return;
    const header = event.target.closest<HTMLElement>('.ve-cell-detail-popover > header');
    if (!header || !page.contains(header) || event.target.closest('button')) return;
    const currentPanel = header.parentElement as HTMLElement | null;
    if (!currentPanel || currentPanel.hidden) return;

    const rect = currentPanel.getBoundingClientRect();
    dragPointerId = event.pointerId;
    panel = currentPanel;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    currentPanel.dataset.dragging = 'true';
    currentPanel.style.left = `${rect.left}px`;
    currentPanel.style.top = `${rect.top}px`;
    currentPanel.style.right = 'auto';
    currentPanel.style.bottom = 'auto';
    currentPanel.style.transform = 'none';
    header.setPointerCapture?.(event.pointerId);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    event.preventDefault();
  }, { capture: true });
}
