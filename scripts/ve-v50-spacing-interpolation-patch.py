from pathlib import Path

path = Path('apps/web/src/pages/ve-table-interaction.ts')
text = path.read_text()
old = '''export interface TableEditSurface {
  readonly rows: number;
  readonly cols: number;
  get(row: number, col: number): number;
  beginTransaction(label: string): TableEditTransaction;
}
'''
new = '''export interface TableEditSurface {
  readonly rows: number;
  readonly cols: number;
  get(row: number, col: number): number;
  /** Optional physical axis coordinates. Index coordinates remain the generic fallback. */
  rowCoordinate?(row: number): number;
  colCoordinate?(col: number): number;
  beginTransaction(label: string): TableEditTransaction;
}
'''
if old not in text:
    raise SystemExit('surface interface anchor missing')
text = text.replace(old, new, 1)
start = text.index('function monotoneSlopes(')
end = text.index('\nfunction piecewiseAnchors', start)
replacement = '''function pchipSlopes(xs: readonly number[], ys: readonly number[]): number[] | undefined {
  const count = xs.length;
  if (count !== ys.length || count === 0) return undefined;
  if (count === 1) return [0];
  const h: number[] = [];
  const delta: number[] = [];
  for (let index = 0; index < count - 1; index += 1) {
    const span = xs[index + 1]! - xs[index]!;
    if (!Number.isFinite(span) || span <= 0) return undefined;
    const slope = (ys[index + 1]! - ys[index]!) / span;
    if (!Number.isFinite(slope)) return undefined;
    h.push(span);
    delta.push(slope);
  }
  if (count === 2) return [delta[0]!, delta[0]!];

  const slopes = new Array<number>(count).fill(0);
  for (let index = 1; index < count - 1; index += 1) {
    const left = delta[index - 1]!;
    const right = delta[index]!;
    if (left === 0 || right === 0 || Math.sign(left) !== Math.sign(right)) {
      slopes[index] = 0;
      continue;
    }
    const leftSpan = h[index - 1]!;
    const rightSpan = h[index]!;
    const w1 = 2 * rightSpan + leftSpan;
    const w2 = rightSpan + 2 * leftSpan;
    slopes[index] = (w1 + w2) / (w1 / left + w2 / right);
  }

  const endpoint = (h0: number, h1: number, d0: number, d1: number): number => {
    let value = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(value) !== Math.sign(d0)) value = 0;
    else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(value) > Math.abs(3 * d0)) value = 3 * d0;
    return value;
  };
  slopes[0] = endpoint(h[0]!, h[1]!, delta[0]!, delta[1]!);
  slopes[count - 1] = endpoint(h[count - 2]!, h[count - 3]!, delta[count - 2]!, delta[count - 3]!);
  return slopes;
}

function monotoneValue(xs: readonly number[], ys: readonly number[], x: number): number | undefined {
  if (xs.length === 0 || xs.length !== ys.length || !Number.isFinite(x)) return undefined;
  if (xs.length === 1 || x <= xs[0]!) return ys[0]!;
  if (x >= xs[xs.length - 1]!) return ys[ys.length - 1]!;
  const slopes = pchipSlopes(xs, ys);
  if (!slopes) return undefined;
  let index = 0;
  while (index < xs.length - 2 && x > xs[index + 1]!) index += 1;
  const x0 = xs[index]!;
  const x1 = xs[index + 1]!;
  const span = x1 - x0;
  if (!(span > 0)) return undefined;
  const t = (x - x0) / span;
  const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
  const h10 = t ** 3 - 2 * t ** 2 + t;
  const h01 = -2 * t ** 3 + 3 * t ** 2;
  const h11 = t ** 3 - t ** 2;
  return h00 * ys[index]! + h10 * span * slopes[index]! + h01 * ys[index + 1]! + h11 * span * slopes[index + 1]!;
}

function increasingCoordinates(indices: readonly number[], coordinate: (index: number) => number): number[] | undefined {
  const values = indices.map(coordinate);
  if (values.some((value) => !Number.isFinite(value))) return undefined;
  if (values.length <= 1) return values;
  const direction = Math.sign(values[1]! - values[0]!);
  if (direction === 0) return undefined;
  for (let index = 1; index < values.length; index += 1) {
    if (Math.sign(values[index]! - values[index - 1]!) !== direction) return undefined;
  }
  return direction > 0 ? values : values.map((value) => -value);
}

function interpolated1d(
  index: number,
  anchors: readonly number[],
  support: readonly number[],
  read: (index: number) => number | undefined,
  coordinate: (index: number) => number,
  method: TableInterpolation1dMethod,
): { value: number; min: number; max: number } | undefined {
  const anchorValues = anchors.map(read);
  if (anchorValues.some((value) => value === undefined)) return undefined;
  const finiteAnchors = anchorValues as number[];
  const min = Math.min(...finiteAnchors);
  const max = Math.max(...finiteAnchors);
  const anchorXs = increasingCoordinates(anchors, coordinate);
  if (!anchorXs) return undefined;
  const direction = Math.sign(coordinate(anchors[anchors.length - 1]!) - coordinate(anchors[0]!));
  const x = coordinate(index) * (direction < 0 ? -1 : 1);
  if (!Number.isFinite(x)) return undefined;
  if (method === 'shape') {
    const supportValues = support.map(read);
    if (supportValues.some((value) => value === undefined)) return undefined;
    const supportXs = increasingCoordinates(support, coordinate);
    if (!supportXs) return undefined;
    const value = monotoneValue(supportXs, supportValues as number[], x);
    return value === undefined ? undefined : { value, min, max };
  }
  let segment = 0;
  while (segment < anchors.length - 2 && x > anchorXs[segment + 1]!) segment += 1;
  const x0 = anchorXs[segment]!;
  const x1 = anchorXs[segment + 1]!;
  const y0 = finiteAnchors[segment]!;
  const y1 = finiteAnchors[segment + 1]!;
  if (!(x1 > x0)) return undefined;
  const t = (x - x0) / (x1 - x0);
  return { value: y0 + (y1 - y0) * t, min, max };
}
'''
text = text[:start] + replacement + text[end:]
old = """        const sample = (inner: number): number | undefined => axis === 'horizontal' ? read(outer, inner) : read(inner, outer);
        for (const index of indices) {
"""
new = """        const sample = (inner: number): number | undefined => axis === 'horizontal' ? read(outer, inner) : read(inner, outer);
        const coordinate = (inner: number): number => axis === 'horizontal'
          ? (this.#surface.colCoordinate?.(inner) ?? inner)
          : (this.#surface.rowCoordinate?.(inner) ?? inner);
        for (const index of indices) {
"""
if old not in text:
    raise SystemExit('1D sample anchor missing')
text = text.replace(old, new, 1)
old = "          const entry = interpolated1d(index, anchors, support, sample, method1d);\n"
new = "          const entry = interpolated1d(index, anchors, support, sample, coordinate, method1d);\n"
if old not in text:
    raise SystemExit('interpolated1d call missing')
text = text.replace(old, new, 1)
edge_start = text.index("      const edgeSample = (fixed: number, start: number, end: number, t: number, horizontal: boolean): number | undefined => {")
loop_start = text.index('      for (const position of positions) {', edge_start)
loop_end = text.index('\n      }\n    }\n\n    if (!changed)', loop_start) + len('\n      }')
new_2d = '''      const rowCoordinate = (row: number): number => this.#surface.rowCoordinate?.(row) ?? row;
      const colCoordinate = (col: number): number => this.#surface.colCoordinate?.(col) ?? col;
      const rowStart = rowCoordinate(r0);
      const rowEnd = rowCoordinate(r1);
      const colStart = colCoordinate(c0);
      const colEnd = colCoordinate(c1);
      if (![rowStart, rowEnd, colStart, colEnd].every(Number.isFinite) || rowStart === rowEnd || colStart === colEnd) {
        transaction.cancel();
        return false;
      }
      for (const position of positions) {
        const u = (colCoordinate(position.col) - colStart) / (colEnd - colStart);
        const v = (rowCoordinate(position.row) - rowStart) / (rowEnd - rowStart);
        if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
        const base = bilinear(u, v);
        let target = base;
        if (method2d === 'boundary') {
          const top = read(r0, position.col);
          const bottom = read(r1, position.col);
          const left = read(position.row, c0);
          const right = read(position.row, c1);
          if (top === undefined || bottom === undefined || left === undefined || right === undefined) continue;
          target = (1 - v) * top + v * bottom + (1 - u) * left + u * right - base;
        }
        setBlended(position.row, position.col, target, boundaryMin, boundaryMax);
      }'''
text = text[:edge_start] + new_2d + text[loop_end:]
path.write_text(text)

path = Path('apps/web/src/pages/ve-analyzer-delay-table-interaction.ts')
text = path.read_text()
old = '''  get rows(): number { return this.#owner.snapshot()?.rows ?? 0; }
  get cols(): number { return this.#owner.snapshot()?.cols ?? 0; }

  get(row: number, col: number): number {
'''
new = '''  get rows(): number { return this.#owner.snapshot()?.rows ?? 0; }
  get cols(): number { return this.#owner.snapshot()?.cols ?? 0; }
  rowCoordinate(row: number): number { return this.#owner.snapshot()?.loadBins[row] ?? row; }
  colCoordinate(col: number): number { return this.#owner.snapshot()?.rpmBins[col] ?? col; }

  get(row: number, col: number): number {
'''
if old not in text:
    raise SystemExit('delay surface coordinate anchor missing')
path.write_text(text.replace(old, new, 1))

path = Path('tests/ve-table-interaction.test.ts')
text = path.read_text()
text = text.replace(
    'function memorySurface(rows: number, cols: number, initial: readonly number[]) {',
    'function memorySurface(rows: number, cols: number, initial: readonly number[], rowCoordinates?: readonly number[], colCoordinates?: readonly number[]) {',
    1,
)
old = '''    get(row, col) {
      return values[row * cols + col]!;
    },
    beginTransaction(label): TableEditTransaction {
'''
new = '''    get(row, col) {
      return values[row * cols + col]!;
    },
    ...(rowCoordinates ? { rowCoordinate: (row: number) => rowCoordinates[row] ?? row } : {}),
    ...(colCoordinates ? { colCoordinate: (col: number) => colCoordinates[col] ?? col } : {}),
    beginTransaction(label): TableEditTransaction {
'''
if old not in text:
    raise SystemExit('memory surface anchor missing')
text = text.replace(old, new, 1)
anchor = "  it('applies a 2D bilinear surface as one transaction', () => {\n"
tests = '''  it('uses physical axis spacing for linear interpolation', () => {
    const memory = memorySurface(1, 3, [0, 99, 40], undefined, [1000, 1500, 3000]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 0, col: 2 });
    expect(session.interpolate({ axis: 'horizontal', method1d: 'linear', strength: 1 })).toBe(true);
    expect(memory.values()[1]).toBeCloseTo(10, 8);
  });

  it('keeps shape interpolation monotone on highly uneven physical bins', () => {
    const memory = memorySurface(1, 5, [0, 10, 999, 30, 40], undefined, [0, 1, 8, 9, 30]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 1 }, { row: 0, col: 3 });
    expect(session.interpolate({ axis: 'horizontal', method1d: 'shape', strength: 1, clamp: true })).toBe(true);
    expect(memory.values()[2]).toBeGreaterThanOrEqual(10);
    expect(memory.values()[2]).toBeLessThanOrEqual(30);
    expect(memory.commits()).toBe(1);
  });

  it('uses physical row/column fractions for 2D interpolation', () => {
    const memory = memorySurface(
      3, 3,
      [0, 90, 20, 90, 90, 90, 40, 90, 60],
      [0, 1, 4],
      [0, 1, 4],
    );
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
    expect(session.interpolate({ axis: 'both', method2d: 'bilinear', strength: 1 })).toBe(true);
    expect(memory.values()[4]).toBeCloseTo(15, 8);
  });

'''
if anchor not in text:
    raise SystemExit('test insertion anchor missing')
path.write_text(text.replace(anchor, tests + anchor, 1))
