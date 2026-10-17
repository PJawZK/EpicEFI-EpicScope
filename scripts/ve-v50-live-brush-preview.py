from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    if text.count(old) < count:
        raise SystemExit(f'{path}: missing pattern: {old[:140]!r}')
    p.write_text(text.replace(old, new, count))

# 1) Generic core reports the exact pending values produced by each Brush pulse.
replace('apps/web/src/pages/ve-table-interaction.ts',
'''export interface TableBrushStroke {
  pulse(center: TableCellPosition, direction?: 1 | -1): void;
  commit(): boolean;
  cancel(): void;
}
''',
'''export interface TablePreviewValue {
  readonly position: TableCellPosition;
  readonly value: number;
}

export interface TableBrushStroke {
  /** Apply one pending Brush pulse and report only cells whose pending value changed. */
  pulse(center: TableCellPosition, direction?: 1 | -1): readonly TablePreviewValue[];
  commit(): boolean;
  cancel(): void;
}
''')

replace('apps/web/src/pages/ve-table-interaction.ts',
'''      pulse: (center, direction = 1): void => {
        if (!active || !this.#inside(center) || !Number.isFinite(options.delta) || options.delta === 0 || strength <= 0) return;
        const r0 = Math.max(0, center.row - radius);
        const r1 = Math.min(this.#surface.rows - 1, center.row + radius);
        const c0 = Math.max(0, center.col - radius);
        const c1 = Math.min(this.#surface.cols - 1, center.col + radius);
        for (let row = r0; row <= r1; row += 1) {
          for (let col = c0; col <= c1; col += 1) {
            if (this.#pinned.has(key(row, col))) continue;
            const distance = Math.hypot(row - center.row, col - center.col);
            const weight = brushWeight(distance, radius, falloff);
            if (weight <= 0) continue;
            const current = finite(transaction.get(row, col));
            if (current === undefined) continue;
            transaction.set(row, col, current + options.delta * direction * strength * weight);
            touched = true;
          }
        }
      },
''',
'''      pulse: (center, direction = 1): readonly TablePreviewValue[] => {
        if (!active || !this.#inside(center) || !Number.isFinite(options.delta) || options.delta === 0 || strength <= 0) return [];
        const r0 = Math.max(0, center.row - radius);
        const r1 = Math.min(this.#surface.rows - 1, center.row + radius);
        const c0 = Math.max(0, center.col - radius);
        const c1 = Math.min(this.#surface.cols - 1, center.col + radius);
        const preview: TablePreviewValue[] = [];
        for (let row = r0; row <= r1; row += 1) {
          for (let col = c0; col <= c1; col += 1) {
            if (this.#pinned.has(key(row, col))) continue;
            const distance = Math.hypot(row - center.row, col - center.col);
            const weight = brushWeight(distance, radius, falloff);
            if (weight <= 0) continue;
            const current = finite(transaction.get(row, col));
            if (current === undefined) continue;
            transaction.set(row, col, current + options.delta * direction * strength * weight);
            const pending = finite(transaction.get(row, col));
            if (pending === undefined || pending === current) continue;
            preview.push({ position: { row, col }, value: pending });
            touched = true;
          }
        }
        return preview;
      },
''')

# 2) DOM shell renders pending values without committing semantic authority.
replace('apps/web/src/pages/ve-table-interaction-dom.ts',
'''  type TableBrushStroke,
  type TableCellPosition,
''',
'''  type TableBrushStroke,
  type TableCellPosition,
  type TablePreviewValue,
''')

replace('apps/web/src/pages/ve-table-interaction-dom.ts',
'''  readonly readValue?: (position: TableCellPosition) => number | undefined;
  readonly baselineValue?: (position: TableCellPosition) => number | undefined;
  readonly adjustBrushRadius?: (delta: 1 | -1) => void;
''',
'''  readonly readValue?: (position: TableCellPosition) => number | undefined;
  readonly baselineValue?: (position: TableCellPosition) => number | undefined;
  /** Presentation-only formatter for transient Brush values. */
  readonly formatPreviewValue?: (position: TableCellPosition, value: number) => string;
  readonly adjustBrushRadius?: (delta: 1 | -1) => void;
''')

replace('apps/web/src/pages/ve-table-interaction-dom.ts',
'''  let inlinePreviewOriginal = new Map<HTMLTableCellElement, string>();
  let gestureListenersInstalled = false;
''',
'''  let inlinePreviewOriginal = new Map<HTMLTableCellElement, string>();
  let brushValuePreviewOriginal = new Map<HTMLTableCellElement, string>();
  let pendingBrushValuePreview = new Map<string, TablePreviewValue>();
  let brushPreviewFrame: number | undefined;
  let gestureListenersInstalled = false;
''')

replace('apps/web/src/pages/ve-table-interaction-dom.ts',
'''  const stopBrushTimer = (): void => {
    if (brushTimer !== undefined) window.clearInterval(brushTimer);
    brushTimer = undefined;
  };

  function gestureKeyDown(event: KeyboardEvent): void {
''',
'''  const stopBrushTimer = (): void => {
    if (brushTimer !== undefined) window.clearInterval(brushTimer);
    brushTimer = undefined;
  };

  const valueNodeForCell = (cell: HTMLTableCellElement): HTMLElement =>
    cell.querySelector<HTMLElement>(':scope > span') ?? cell;

  const setPreviewValueState = (cell: HTMLTableCellElement, position: TableCellPosition, value: number): void => {
    const baseline = preferences.baselineValue?.(position);
    if (baseline === undefined || !Number.isFinite(baseline)) return;
    const epsilon = 1e-9 * Math.max(1, Math.abs(value), Math.abs(baseline));
    setDataset(cell, 'tableValueState', value < baseline - epsilon ? 'lower' : value > baseline + epsilon ? 'higher' : 'same');
  };

  const flushBrushValuePreview = (): void => {
    if (brushPreviewFrame !== undefined) {
      window.cancelAnimationFrame(brushPreviewFrame);
      brushPreviewFrame = undefined;
    }
    if (!table || pendingBrushValuePreview.size === 0) return;
    const pending = pendingBrushValuePreview;
    pendingBrushValuePreview = new Map();
    for (const entry of pending.values()) {
      const cell = cellFor(entry.position);
      if (!cell) continue;
      const valueNode = valueNodeForCell(cell);
      if (!brushValuePreviewOriginal.has(cell)) brushValuePreviewOriginal.set(cell, valueNode.textContent ?? '');
      valueNode.textContent = preferences.formatPreviewValue?.(entry.position, entry.value) ?? String(Math.round(entry.value * 1000) / 1000);
      setDataset(cell, 'tableLivePreview', 'true');
      if (cell.dataset.delayRow !== undefined) setDataset(cell, 'delayPreview', 'true');
      setPreviewValueState(cell, entry.position, entry.value);
    }
  };

  const queueBrushValuePreview = (updates: readonly TablePreviewValue[]): void => {
    if (updates.length === 0) return;
    for (const update of updates) pendingBrushValuePreview.set(positionKey(update.position), update);
    if (brushPreviewFrame !== undefined) return;
    brushPreviewFrame = window.requestAnimationFrame(() => {
      brushPreviewFrame = undefined;
      flushBrushValuePreview();
    });
  };

  const clearBrushValuePreview = (restoreText: boolean): void => {
    if (brushPreviewFrame !== undefined) window.cancelAnimationFrame(brushPreviewFrame);
    brushPreviewFrame = undefined;
    pendingBrushValuePreview.clear();
    for (const [cell, originalText] of brushValuePreviewOriginal) {
      if (restoreText && cell.isConnected) valueNodeForCell(cell).textContent = originalText;
      delete cell.dataset.tableLivePreview;
      delete cell.dataset.delayPreview;
    }
    brushValuePreviewOriginal.clear();
    if (restoreText) refreshValueStates();
  };

  function gestureKeyDown(event: KeyboardEvent): void {
''')

replace('apps/web/src/pages/ve-table-interaction-dom.ts',
'''  const finishBrush = (commit: boolean): void => {
    stopBrushTimer();
    const stroke = brushStroke;
    brushStroke = undefined;
    brushPointerId = undefined;
    brushLast = undefined;
    brushDirection = 1;
    if (stroke) {
      if (commit) {
        if (stroke.commit()) finishEdit();
        else refresh();
      } else {
        stroke.cancel();
        refresh();
      }
    }
    maybeRemoveGestureListeners();
  };

  const pulseBrush = (position: TableCellPosition, immediate = false): void => {
    if (!brushStroke) return;
    brushLast = position;
    if (immediate) brushStroke.pulse(position, brushDirection);
  };
''',
'''  const finishBrush = (commit: boolean): void => {
    stopBrushTimer();
    const stroke = brushStroke;
    brushStroke = undefined;
    brushPointerId = undefined;
    brushLast = undefined;
    brushDirection = 1;
    if (stroke) {
      if (commit) {
        // Flush the final pending pulse before commit so pointer-up never hides the
        // last visual state. Semantic authority still changes exactly once below.
        flushBrushValuePreview();
        if (stroke.commit()) {
          clearBrushValuePreview(false);
          finishEdit();
        } else {
          clearBrushValuePreview(true);
          refresh();
        }
      } else {
        stroke.cancel();
        clearBrushValuePreview(true);
        refresh();
      }
    } else clearBrushValuePreview(true);
    maybeRemoveGestureListeners();
  };

  const pulseBrush = (position: TableCellPosition, immediate = false): void => {
    if (!brushStroke) return;
    brushLast = position;
    if (immediate) queueBrushValuePreview(brushStroke.pulse(position, brushDirection));
  };
''')

replace('apps/web/src/pages/ve-table-interaction-dom.ts',
'''    brushTimer = window.setInterval(() => {
      if (!brushStroke || !brushLast) return;
      brushStroke.pulse(brushLast, brushDirection);
    }, 90);
''',
'''    brushTimer = window.setInterval(() => {
      if (!brushStroke || !brushLast) return;
      queueBrushValuePreview(brushStroke.pulse(brushLast, brushDirection));
    }, 90);
''')

# Make inline preview preserve the VE cell's span structure as well.
replace('apps/web/src/pages/ve-table-interaction-dom.ts',
'''  const restoreInlinePreview = (): void => {
    for (const [previewCell, text] of inlinePreviewOriginal) {
      previewCell.textContent = text;
      delete previewCell.dataset.tablePreview;
      delete previewCell.dataset.delayPreview;
    }
    inlinePreviewOriginal.clear();
  };

  const previewInlineValue = (activeCell: HTMLTableCellElement, text: string): void => {
    for (const position of selectedPositions()) {
      const previewCell = cellFor(position);
      if (!previewCell || previewCell === activeCell) continue;
      if (!inlinePreviewOriginal.has(previewCell)) inlinePreviewOriginal.set(previewCell, previewCell.textContent ?? '');
      previewCell.textContent = text || '—';
      previewCell.dataset.tablePreview = 'true';
      if (previewCell.dataset.delayRow !== undefined) previewCell.dataset.delayPreview = 'true';
    }
  };
''',
'''  const restoreInlinePreview = (): void => {
    for (const [previewCell, text] of inlinePreviewOriginal) {
      valueNodeForCell(previewCell).textContent = text;
      delete previewCell.dataset.tablePreview;
      delete previewCell.dataset.delayPreview;
    }
    inlinePreviewOriginal.clear();
  };

  const previewInlineValue = (activeCell: HTMLTableCellElement, text: string): void => {
    for (const position of selectedPositions()) {
      const previewCell = cellFor(position);
      if (!previewCell || previewCell === activeCell) continue;
      const valueNode = valueNodeForCell(previewCell);
      if (!inlinePreviewOriginal.has(previewCell)) inlinePreviewOriginal.set(previewCell, valueNode.textContent ?? '');
      valueNode.textContent = text || '—';
      previewCell.dataset.tablePreview = 'true';
      if (previewCell.dataset.delayRow !== undefined) previewCell.dataset.delayPreview = 'true';
    }
  };
''')

# 3) Domain adapters own formatting, keeping the generic controller presentation-only.
replace('apps/web/src/pages/ve-analyzer-delay-table-interaction.ts',
'''    readValue: (position) => surface.valueAt(position),
    baselineValue: (position) => surface.baselineValueAt(position),
    adjustBrushRadius: (delta) => saveToolPreferences({
''',
'''    readValue: (position) => surface.valueAt(position),
    baselineValue: (position) => surface.baselineValueAt(position),
    formatPreviewValue: (_position, value) => String(Math.round(value)),
    adjustBrushRadius: (delta) => saveToolPreferences({
''')

replace('apps/web/src/pages/ve-analyzer-proposal-table-interaction.ts',
'''  let step: number | undefined;
  let smoothStrength = 0.5;
''',
'''  let step: number | undefined;
  let previewDigits = owner.snapshot()?.digits;
  let smoothStrength = 0.5;
''')

replace('apps/web/src/pages/ve-analyzer-proposal-table-interaction.ts',
'''    readValue: (position) => surface.valueAt(position),
    baselineValue: (position) => surface.baselineValueAt(position),
    adjustBrushRadius: (delta) => { brush = { ...brush, radius: Math.max(1, Math.min(8, brush.radius + delta)) }; },
''',
'''    readValue: (position) => surface.valueAt(position),
    baselineValue: (position) => surface.baselineValueAt(position),
    formatPreviewValue: (_position, value) => previewDigits === undefined ? String(Math.round(value * 1000) / 1000) : value.toFixed(previewDigits),
    adjustBrushRadius: (delta) => { brush = { ...brush, radius: Math.max(1, Math.min(8, brush.radius + delta)) }; },
''')

replace('apps/web/src/pages/ve-analyzer-proposal-table-interaction.ts',
'''  const bind = (): void => {
    const renderedTable = veHost.querySelector<HTMLTableElement>('table.ve-workbench-table') ?? undefined;
''',
'''  const bind = (): void => {
    previewDigits = owner.snapshot()?.digits;
    const renderedTable = veHost.querySelector<HTMLTableElement>('table.ve-workbench-table') ?? undefined;
''')

# 4) Core unit regression: pulse exposes pending value without committing the surface.
replace('tests/ve-table-interaction.test.ts',
'''    brush.pulse({ row: 1, col: 1 });
    brush.pulse({ row: 1, col: 1 });
    brush.pulse({ row: 1, col: 1 });
    expect(brush.commit()).toBe(true);
''',
'''    expect(brush.pulse({ row: 1, col: 1 })).toEqual([{ position: { row: 1, col: 1 }, value: 2 }]);
    expect(brush.pulse({ row: 1, col: 1 })).toEqual([{ position: { row: 1, col: 1 }, value: 4 }]);
    expect(brush.pulse({ row: 1, col: 1 })).toEqual([{ position: { row: 1, col: 1 }, value: 6 }]);
    expect(memory.values()[4]).toBe(0);
    expect(memory.commits()).toBe(0);
    expect(brush.commit()).toBe(true);
''')

# 5) Real-browser acceptance: value text changes during a stroke while semantic owner remains unchanged.
replace('tests/web/ve-proposal-table-interaction.browser.mjs',
'''    const preview = [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td[data-table-brush-preview="true"]')];
    assert(preview.length > 0, 'VE Proposal Brush did not show a prospective affected-cell footprint');
    brushButton.click();
    checks.push('VE Proposal Brush clears stale selection and exposes its prospective footprint');
''',
'''    const preview = [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td[data-table-brush-preview="true"]')];
    assert(preview.length > 0, 'VE Proposal Brush did not show a prospective affected-cell footprint');
    const brushCenter = cell(root, 1, 1);
    const semanticBeforeBrush = valueAt(root, 1, 1);
    const textBeforeBrush = brushCenter.querySelector(':scope > span')?.textContent ?? brushCenter.textContent;
    brushCenter.setPointerCapture = () => {};
    pointer(brushCenter, 'pointerdown', { clientX: 10, clientY: 10 });
    await new Promise((resolve) => setTimeout(resolve, 125));
    const liveText = brushCenter.querySelector(':scope > span')?.textContent ?? brushCenter.textContent;
    assert(brushCenter.dataset.tableLivePreview === 'true' && liveText !== textBeforeBrush,
      'VE Proposal Brush did not render pending numeric values during the active stroke');
    assert(valueAt(root, 1, 1) === semanticBeforeBrush,
      'VE Proposal Brush live preview committed semantic authority before pointer-up');
    pointer(document, 'pointerup', { clientX: 10, clientY: 10 });
    await settle();
    assert(valueAt(root, 1, 1) !== semanticBeforeBrush,
      'VE Proposal Brush did not commit the previewed value on pointer-up');
    brushButton.click();
    checks.push('VE Proposal Brush shows live numeric change while keeping one semantic commit per stroke');
''')

replace('tests/web/ve-shared-table-interaction.browser.mjs',
'''    pointer(cells()[2], 'pointerdown');
    await new Promise((resolve) => setTimeout(resolve, 210));
    pointer(document, 'pointerup');
    await settle();
    assert(values()[2] > beforeBrush && view.sessionRevision === brushRevision + 1, 'Held Brush did not accumulate and commit once');
    checks.push('held Brush accumulates while one stroke publishes one semantic revision');
''',
'''    const brushCell = cells()[2];
    const brushTextBefore = brushCell.textContent;
    pointer(brushCell, 'pointerdown');
    await new Promise((resolve) => setTimeout(resolve, 125));
    assert(brushCell.dataset.tableLivePreview === 'true' && brushCell.textContent !== brushTextBefore,
      'Held Lambda Brush did not show its pending numeric value before pointer-up');
    assert(values()[2] === beforeBrush && view.sessionRevision === brushRevision,
      'Lambda Brush live preview committed semantic authority before pointer-up');
    await new Promise((resolve) => setTimeout(resolve, 100));
    pointer(document, 'pointerup');
    await settle();
    assert(values()[2] > beforeBrush && view.sessionRevision === brushRevision + 1, 'Held Brush did not accumulate and commit once');
    checks.push('held Brush previews live numeric values while one stroke publishes one semantic revision');
''')

# Record the acceptance refinement.
p = Path('docs/VE_ANALYZER_V50_MANUAL_ACCEPTANCE.md')
text = p.read_text()
needle = 'The next manual pass should judge click/drag/Brush responsiveness before any further visual redesign.\n'
addition = '''The next manual pass should judge click/drag/Brush responsiveness before any further visual redesign.\n\n## Live Brush value preview checkpoint\n\nThe performance pass must not make Brush opaque. During an active stroke, only the cells touched by pending Brush pulses are updated in the DOM, with their pending numeric values and lower/higher baseline-memory color visible before pointer-up. Those updates are presentation-only: semantic table authority and undo history still commit exactly once when the stroke ends. Pointer movement is batched through `requestAnimationFrame` and does not restore the old whole-table semantic refresh cost. Cancel restores the pre-stroke text/state.\n'''
if needle not in text:
    raise SystemExit('manual acceptance checkpoint marker missing')
p.write_text(text.replace(needle, addition, 1))
