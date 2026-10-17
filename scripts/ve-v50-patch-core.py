from pathlib import Path

p = Path('apps/web/src/pages/ve-table-interaction.ts')
s = p.read_text()

def r(old: str, new: str) -> None:
    global s
    if old not in s:
        raise SystemExit('missing pattern: ' + old[:100])
    s = s.replace(old, new, 1)

r(
'''        const anchors = piecewiseAnchors(indices, (index) => {
          const row = axis === 'horizontal' ? outer : index;
          const col = axis === 'horizontal' ? index : outer;
          return this.#pinned.has(key(row, col));
        });
        const support = [...anchors];
        const maxIndex = axis === 'horizontal' ? this.#surface.cols - 1 : this.#surface.rows - 1;
        if (method1d === 'shape') {
          if (anchors[0]! > 0) support.unshift(anchors[0]! - 1);
          if (anchors[anchors.length - 1]! < maxIndex) support.push(anchors[anchors.length - 1]! + 1);
        }
        const sample = (inner: number): number | undefined => axis === 'horizontal' ? read(outer, inner) : read(inner, outer);
''',
'''        const sample = (inner: number): number | undefined => axis === 'horizontal' ? read(outer, inner) : read(inner, outer);
        const anchors = piecewiseAnchors(indices, (index) => {
          const row = axis === 'horizontal' ? outer : index;
          const col = axis === 'horizontal' ? index : outer;
          return this.#pinned.has(key(row, col)) && sample(index) !== undefined;
        });
        const support = [...anchors];
        const maxIndex = axis === 'horizontal' ? this.#surface.cols - 1 : this.#surface.rows - 1;
        if (method1d === 'shape') {
          const before = anchors[0]! - 1;
          const after = anchors[anchors.length - 1]! + 1;
          if (before >= 0 && sample(before) !== undefined) support.unshift(before);
          if (after <= maxIndex && sample(after) !== undefined) support.push(after);
        }
''')

r(
'''      const original = read(row, col);
      if (original === undefined || !Number.isFinite(target) || !Number.isFinite(min) || !Number.isFinite(max)) return;
      let value = original + (target - original) * strength;
''',
'''      const original = read(row, col);
      if (!Number.isFinite(target) || !Number.isFinite(min) || !Number.isFinite(max)) return;
      // Undefined interior cells are valid interpolation targets. Existing
      // finite cells blend by strength; an empty cell receives the interpolated
      // value directly because there is no numeric source value to blend from.
      let value = original === undefined ? target : original + (target - original) * strength;
''')

r(
'''      const boundaryValues: number[] = [];
      for (let col = c0; col <= c1; col += 1) {
        const top = read(r0, col);
        const bottom = read(r1, col);
        if (top === undefined || bottom === undefined) {
          transaction.cancel();
          return false;
        }
        boundaryValues.push(top, bottom);
      }
      for (let row = r0 + 1; row < r1; row += 1) {
        const left = read(row, c0);
        const right = read(row, c1);
        if (left === undefined || right === undefined) {
          transaction.cancel();
          return false;
        }
        boundaryValues.push(left, right);
      }
''',
'''      // Bilinear needs only the four finite corners. Boundary Surface can
      // also operate with sparse edges: missing edge samples are synthesized
      // from the corresponding corner endpoints when evaluated below.
      const boundaryValues: number[] = [topLeft, topRight, bottomLeft, bottomRight];
      for (let col = c0; col <= c1; col += 1) {
        const top = read(r0, col);
        const bottom = read(r1, col);
        if (top !== undefined) boundaryValues.push(top);
        if (bottom !== undefined) boundaryValues.push(bottom);
      }
      for (let row = r0 + 1; row < r1; row += 1) {
        const left = read(row, c0);
        const right = read(row, c1);
        if (left !== undefined) boundaryValues.push(left);
        if (right !== undefined) boundaryValues.push(right);
      }
''')

r(
'''          const top = read(r0, position.col);
          const bottom = read(r1, position.col);
          const left = read(position.row, c0);
          const right = read(position.row, c1);
          if (top === undefined || bottom === undefined || left === undefined || right === undefined) continue;
          target = (1 - v) * top + v * bottom + (1 - u) * left + u * right - base;
''',
'''          const top = read(r0, position.col) ?? (topLeft + (topRight - topLeft) * u);
          const bottom = read(r1, position.col) ?? (bottomLeft + (bottomRight - bottomLeft) * u);
          const left = read(position.row, c0) ?? (topLeft + (bottomLeft - topLeft) * v);
          const right = read(position.row, c1) ?? (topRight + (bottomRight - topRight) * v);
          target = (1 - v) * top + v * bottom + (1 - u) * left + u * right - base;
''')

r(
'''  beginBrushStroke(options: TableBrushOptions): TableBrushStroke {
''',
'''  brushFootprint(center: TableCellPosition, options: TableBrushOptions): readonly TableCellPosition[] {
    if (!this.#inside(center)) return [];
    const radius = Math.max(0, Math.floor(options.radius));
    const falloff = options.falloff ?? 'linear';
    const positions: TableCellPosition[] = [];
    for (let row = Math.max(0, center.row - radius); row <= Math.min(this.#surface.rows - 1, center.row + radius); row += 1) {
      for (let col = Math.max(0, center.col - radius); col <= Math.min(this.#surface.cols - 1, center.col + radius); col += 1) {
        if (this.#pinned.has(key(row, col))) continue;
        if (brushWeight(Math.hypot(row - center.row, col - center.col), radius, falloff) <= 0) continue;
        positions.push({ row, col });
      }
    }
    return positions;
  }

  beginBrushStroke(options: TableBrushOptions): TableBrushStroke {
''')

p.write_text(s)

# Keep regression expectations aligned with sparse-cell interpolation.
p = Path('tests/ve-table-interaction.test.ts')
s = p.read_text()
old = '''  it('skips a 1D interpolation line whose required support contains a non-finite value', () => {
    const memory = memorySurface(1, 5, [0, Number.NaN, 20, 30, 40]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 0, col: 4 });
    expect(session.interpolate({ axis: 'horizontal', method1d: 'shape', strength: 1 })).toBe(false);
    expect(memory.values()[1]).toBeNaN();
    expect(memory.commits()).toBe(0);
  });
'''
new = '''  it('fills an empty interior cell during shape interpolation instead of treating it as required support', () => {
    const memory = memorySurface(1, 5, [0, Number.NaN, 20, 30, 40]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 0, col: 4 });
    expect(session.interpolate({ axis: 'horizontal', method1d: 'shape', strength: 1 })).toBe(true);
    expect(memory.values()[1]).toBeGreaterThanOrEqual(0);
    expect(memory.values()[1]).toBeLessThanOrEqual(40);
    expect(memory.commits()).toBe(1);
  });
'''
if old not in s:
    raise SystemExit('old shape regression not found')
s = s.replace(old, new, 1)
marker = "  it('keeps a continuous Brush stroke inside one transaction and accumulates pulses', () => {\n"
extra = '''  it('fills empty interior and edge cells from four finite 2D bilinear corners', () => {
    const memory = memorySurface(3, 3, [0, Number.NaN, 20, Number.NaN, Number.NaN, Number.NaN, 40, Number.NaN, 60]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
    expect(session.interpolate({ axis: 'both', method2d: 'bilinear', strength: 1 })).toBe(true);
    expect(memory.values()[1]).toBe(10);
    expect(memory.values()[3]).toBe(20);
    expect(memory.values()[4]).toBe(30);
    expect(memory.commits()).toBe(1);
  });

  it('synthesizes missing edge samples for Boundary Surface interpolation', () => {
    const memory = memorySurface(3, 3, [0, Number.NaN, 20, Number.NaN, Number.NaN, Number.NaN, 40, Number.NaN, 60]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
    expect(session.interpolate({ axis: 'both', method2d: 'boundary', strength: 1 })).toBe(true);
    expect(memory.values()[4]).toBe(30);
    expect(memory.commits()).toBe(1);
  });

  it('reports a Brush footprint without pinned cells', () => {
    const memory = memorySurface(3, 3, new Array(9).fill(0));
    const session = new TableInteractionSession(memory.surface);
    session.selectCell({ row: 1, col: 1 });
    session.togglePinsForSelection();
    const footprint = session.brushFootprint({ row: 1, col: 1 }, { delta: 1, radius: 1, strength: 1, falloff: 'flat' });
    expect(footprint).not.toContainEqual({ row: 1, col: 1 });
    expect(footprint.length).toBe(8);
  });

'''
if marker not in s:
    raise SystemExit('brush test marker not found')
s = s.replace(marker, extra + marker, 1)
p.write_text(s)
