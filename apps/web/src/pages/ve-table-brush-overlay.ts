const OVERLAY_STYLE_ID = 've-table-brush-overlay-style';
const TABLE_SELECTOR = '.ve-workbench-table, .ve-delay-table';
const CELL_SELECTOR = 'td[data-table-row][data-table-col]';
const PREVIEW_SELECTOR = `${CELL_SELECTOR}[data-table-brush-preview='true']`;

const installedRoots = new WeakSet<HTMLElement>();
const overlayByShell = new WeakMap<HTMLElement, HTMLCanvasElement>();

function ensureStyle(document: Document): void {
  if (document.getElementById(OVERLAY_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = OVERLAY_STYLE_ID;
  style.textContent = `
    .ve-workbench-table-wrap,
    .ve-delay-table-shell {
      position: relative;
    }

    /* Brush footprint presentation is owned by the overlay canvas. Keep the
       interaction engine's data attributes semantic/presentation-neutral so
       pointer motion does not repaint table cells. */
    .ve-workbench-table td[data-table-brush-preview='true'],
    .ve-delay-table td[data-table-brush-preview='true'] {
      outline: none !important;
      box-shadow: none !important;
    }

    .ve-table-brush-overlay {
      position: absolute;
      inset: 0 auto auto 0;
      z-index: 5;
      pointer-events: none;
      contain: strict;
    }
  `;
  document.head.append(style);
}

function shellFor(table: HTMLTableElement): HTMLElement | undefined {
  return table.closest<HTMLElement>('.ve-workbench-table-wrap, .ve-delay-table-shell') ?? undefined;
}

function overlayFor(shell: HTMLElement): HTMLCanvasElement {
  const existing = overlayByShell.get(shell);
  if (existing?.isConnected) return existing;
  const canvas = shell.ownerDocument.createElement('canvas');
  canvas.className = 've-table-brush-overlay';
  canvas.dataset.veTableBrushOverlay = 'true';
  canvas.setAttribute('aria-hidden', 'true');
  shell.append(canvas);
  overlayByShell.set(shell, canvas);
  return canvas;
}

function sizeCanvas(canvas: HTMLCanvasElement, shell: HTMLElement): { width: number; height: number; dpr: number } {
  const width = Math.max(shell.scrollWidth, shell.clientWidth, 1);
  const height = Math.max(shell.scrollHeight, shell.clientHeight, 1);
  const dpr = Math.max(1, Math.min(2, shell.ownerDocument.defaultView?.devicePixelRatio ?? 1));
  const pixelWidth = Math.max(1, Math.ceil(width * dpr));
  const pixelHeight = Math.max(1, Math.ceil(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  if (canvas.style.width !== `${width}px`) canvas.style.width = `${width}px`;
  if (canvas.style.height !== `${height}px`) canvas.style.height = `${height}px`;
  return { width, height, dpr };
}

function clear(canvas: HTMLCanvasElement, width: number, height: number, dpr: number): CanvasRenderingContext2D | undefined {
  const context = canvas.getContext('2d') ?? undefined;
  if (!context) return undefined;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

function renderTable(table: HTMLTableElement): void {
  const shell = shellFor(table);
  if (!shell) return;
  const canvas = overlayFor(shell);
  const { width, height, dpr } = sizeCanvas(canvas, shell);
  const context = clear(canvas, width, height, dpr);
  if (!context) return;

  const active = table.dataset.tableBrush === 'true';
  canvas.hidden = !active;
  if (!active) return;

  const cells = [...table.querySelectorAll<HTMLTableCellElement>(PREVIEW_SELECTOR)];
  if (cells.length === 0) return;

  const shellRect = shell.getBoundingClientRect();
  context.lineWidth = 2;
  context.strokeStyle = 'rgba(126, 214, 244, .96)';
  context.fillStyle = 'rgba(126, 214, 244, .13)';

  for (const cell of cells) {
    const rect = cell.getBoundingClientRect();
    const x = rect.left - shellRect.left + shell.scrollLeft;
    const y = rect.top - shellRect.top + shell.scrollTop;
    const w = rect.width;
    const h = rect.height;
    if (!(w > 0 && h > 0)) continue;
    context.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
    context.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
  }
}

function tableFor(target: Node): HTMLTableElement | undefined {
  if (target instanceof HTMLTableElement && target.matches(TABLE_SELECTOR)) return target;
  if (!(target instanceof Element)) return undefined;
  return target.closest<HTMLTableElement>(TABLE_SELECTOR) ?? undefined;
}

export function installVeTableBrushOverlay(root: HTMLElement): void {
  if (installedRoots.has(root)) return;
  installedRoots.add(root);
  ensureStyle(root.ownerDocument);

  const observer = new MutationObserver((records) => {
    const tables = new Set<HTMLTableElement>();
    for (const record of records) {
      const table = tableFor(record.target);
      if (table && root.contains(table)) tables.add(table);
    }
    for (const table of tables) renderTable(table);
  });
  observer.observe(root, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-table-brush-preview', 'data-table-brush'],
  });

  for (const table of root.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR)) renderTable(table);
}
