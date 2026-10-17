export interface TableCellPosition {
  readonly row: number;
  readonly col: number;
}

export interface TableEditTransaction {
  get(row: number, col: number): number;
  set(row: number, col: number, value: number): void;
  commit(): boolean;
  cancel(): void;
}

export interface TableEditSurface {
  readonly rows: number;
  readonly cols: number;
  get(row: number, col: number): number;
  /** Optional physical axis coordinates. Index coordinates remain the generic fallback. */
  rowCoordinate?(row: number): number;
  colCoordinate?(col: number): number;
  beginTransaction(label: string): TableEditTransaction;
}

export type TableInterpolationAxis = 'horizontal' | 'vertical' | 'both';
export type TableInterpolation1dMethod = 'linear' | 'shape';
export type TableInterpolation2dMethod = 'bilinear' | 'boundary';
export type TableBrushFalloff = 'flat' | 'linear' | 'soft';

export interface TableInterpolationOptions {
  readonly axis: TableInterpolationAxis;
  readonly method1d?: TableInterpolation1dMethod;
  readonly method2d?: TableInterpolation2dMethod;
  readonly strength?: number;
  readonly clamp?: boolean;
}

export interface TableBrushOptions {
  readonly delta: number;
  readonly radius: number;
  readonly strength?: number;
  readonly falloff?: TableBrushFalloff;
}

export interface TablePreviewValue {
  readonly position: TableCellPosition;
  readonly value: number;
}

export interface TableBrushStroke {
  /** Apply one pending Brush pulse and report only cells whose pending value changed. */
  pulse(center: TableCellPosition, direction?: 1 | -1): readonly TablePreviewValue[];
  commit(): boolean;
  cancel(): void;
}

function key(row: number, col: number): string {
  return `${row}:${col}`;
}

function parseKey(value: string): TableCellPosition {
  const [row, col] = value.split(':').map(Number);
  return { row: row ?? 0, col: col ?? 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function finite(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

function boundedStrength(value: number | undefined): number {
  return clamp(value ?? 1, 0, 1);
}

function rectangle(a: TableCellPosition, b: TableCellPosition): TableCellPosition[] {
  const r0 = Math.min(a.row, b.row);
  const r1 = Math.max(a.row, b.row);
  const c0 = Math.min(a.col, b.col);
  const c1 = Math.max(a.col, b.col);
  const positions: TableCellPosition[] = [];
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) positions.push({ row, col });
  }
  return positions;
}

function pchipSlopes(xs: readonly number[], ys: readonly number[]): number[] | undefined {
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

function piecewiseAnchors(indices: readonly number[], isPinned: (index: number) => boolean): number[] {
  if (indices.length <= 2) return [...indices];
  const anchors = [indices[0]!, ...indices.slice(1, -1).filter(isPinned), indices[indices.length - 1]!];
  return [...new Set(anchors)].sort((a, b) => a - b);
}

function brushWeight(distance: number, radius: number, falloff: TableBrushFalloff): number {
  if (radius <= 0) return distance === 0 ? 1 : 0;
  if (distance > radius) return 0;
  if (falloff === 'flat') return 1;
  const t = clamp(distance / radius, 0, 1);
  if (falloff === 'soft') return 0.5 + 0.5 * Math.cos(Math.PI * t);
  return 1 - t;
}

export class TableInteractionSession {
  readonly #surface: TableEditSurface;
  readonly #selected = new Set<string>();
  readonly #pinned = new Set<string>();
  #anchor: TableCellPosition | undefined;

  constructor(surface: TableEditSurface) {
    this.#surface = surface;
  }

  selectedPositions(): readonly TableCellPosition[] {
    return [...this.#selected].map(parseKey);
  }

  pinnedPositions(): readonly TableCellPosition[] {
    return [...this.#pinned].map(parseKey);
  }

  isSelected(position: TableCellPosition): boolean {
    return this.#selected.has(key(position.row, position.col));
  }

  isPinned(position: TableCellPosition): boolean {
    return this.#pinned.has(key(position.row, position.col));
  }

  clearSelection(): void {
    this.#selected.clear();
    this.#anchor = undefined;
  }

  setSelection(positions: readonly TableCellPosition[]): void {
    this.#selected.clear();
    for (const position of positions) {
      if (this.#inside(position)) this.#selected.add(key(position.row, position.col));
    }
    this.#anchor = positions.find((position) => this.#inside(position));
  }

  selectCell(position: TableCellPosition, mode: 'replace' | 'toggle' | 'extend' = 'replace'): void {
    if (!this.#inside(position)) return;
    if (mode === 'extend' && this.#anchor) {
      this.setRectangle(this.#anchor, position, false, this.#anchor);
      return;
    }
    const cellKey = key(position.row, position.col);
    if (mode === 'toggle') {
      if (this.#selected.has(cellKey)) this.#selected.delete(cellKey);
      else this.#selected.add(cellKey);
      this.#anchor = position;
      return;
    }
    this.#selected.clear();
    this.#selected.add(cellKey);
    this.#anchor = position;
  }

  setRectangle(a: TableCellPosition, b: TableCellPosition, additive = false, anchor: TableCellPosition = a): void {
    if (!additive) this.#selected.clear();
    for (const position of rectangle(a, b)) {
      if (this.#inside(position)) this.#selected.add(key(position.row, position.col));
    }
    if (this.#inside(anchor)) this.#anchor = anchor;
  }

  togglePinsForSelection(): void {
    if (this.#selected.size === 0) return;
    const shouldPin = [...this.#selected].some((cellKey) => !this.#pinned.has(cellKey));
    for (const cellKey of this.#selected) {
      if (shouldPin) this.#pinned.add(cellKey);
      else this.#pinned.delete(cellKey);
    }
  }

  clearPins(): void {
    this.#pinned.clear();
  }

  replaceSelection(value: number): boolean {
    if (!Number.isFinite(value) || this.#selected.size === 0) return false;
    const transaction = this.#surface.beginTransaction('direct-edit');
    for (const cellKey of this.#selected) {
      const { row, col } = parseKey(cellKey);
      transaction.set(row, col, value);
    }
    return transaction.commit();
  }

  adjust(delta: number): boolean {
    if (!Number.isFinite(delta) || delta === 0 || this.#selected.size === 0) return false;
    const transaction = this.#surface.beginTransaction('adjust');
    let changed = false;
    for (const cellKey of this.#selected) {
      if (this.#pinned.has(cellKey)) continue;
      const { row, col } = parseKey(cellKey);
      const current = finite(transaction.get(row, col));
      if (current === undefined) continue;
      transaction.set(row, col, current + delta);
      changed = true;
    }
    if (!changed) {
      transaction.cancel();
      return false;
    }
    return transaction.commit();
  }

  smooth(strength = 1): boolean {
    const amount = boundedStrength(strength);
    if (amount <= 0 || this.#selected.size === 0) return false;
    const snapshot = new Map<string, number>();
    const read = (row: number, col: number): number | undefined => {
      const cellKey = key(row, col);
      if (!snapshot.has(cellKey)) {
        const value = finite(this.#surface.get(row, col));
        if (value === undefined) return undefined;
        snapshot.set(cellKey, value);
      }
      return snapshot.get(cellKey);
    };
    for (const cellKey of this.#selected) {
      const { row, col } = parseKey(cellKey);
      for (let r = Math.max(0, row - 1); r <= Math.min(this.#surface.rows - 1, row + 1); r += 1) {
        for (let c = Math.max(0, col - 1); c <= Math.min(this.#surface.cols - 1, col + 1); c += 1) read(r, c);
      }
    }

    const transaction = this.#surface.beginTransaction('smooth');
    let changed = false;
    for (const cellKey of this.#selected) {
      if (this.#pinned.has(cellKey)) continue;
      const { row, col } = parseKey(cellKey);
      const original = read(row, col);
      if (original === undefined) continue;
      const neighbors: number[] = [];
      for (let r = Math.max(0, row - 1); r <= Math.min(this.#surface.rows - 1, row + 1); r += 1) {
        for (let c = Math.max(0, col - 1); c <= Math.min(this.#surface.cols - 1, col + 1); c += 1) {
          const value = read(r, c);
          if (value !== undefined) neighbors.push(value);
        }
      }
      if (neighbors.length === 0) continue;
      const average = neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length;
      transaction.set(row, col, original + (average - original) * amount);
      changed = true;
    }
    if (!changed) {
      transaction.cancel();
      return false;
    }
    return transaction.commit();
  }

  interpolate(options: TableInterpolationOptions): boolean {
    if (this.#selected.size < 2) return false;
    const positions = this.selectedPositions();
    const rows = positions.map((position) => position.row);
    const cols = positions.map((position) => position.col);
    const r0 = Math.min(...rows);
    const r1 = Math.max(...rows);
    const c0 = Math.min(...cols);
    const c1 = Math.max(...cols);
    const axis = options.axis;
    if (axis === 'both' && r0 === r1) return this.interpolate({ ...options, axis: 'horizontal' });
    if (axis === 'both' && c0 === c1) return this.interpolate({ ...options, axis: 'vertical' });

    if (axis === 'both') {
      const expected = (r1 - r0 + 1) * (c1 - c0 + 1);
      if (positions.length !== expected) return false;
      for (let row = r0; row <= r1; row += 1) {
        for (let col = c0; col <= c1; col += 1) {
          if (!this.#selected.has(key(row, col))) return false;
        }
      }
    }

    const strength = boundedStrength(options.strength);
    if (strength <= 0) return false;
    const shouldClamp = options.clamp ?? true;
    const method1d = options.method1d ?? 'linear';
    const method2d = options.method2d ?? 'bilinear';
    const selected = this.#selected;
    const snapshot = new Map<string, number | undefined>();
    const read = (row: number, col: number): number | undefined => {
      const cellKey = key(row, col);
      if (snapshot.has(cellKey)) return snapshot.get(cellKey);
      const value = finite(this.#surface.get(row, col));
      snapshot.set(cellKey, value);
      return value;
    };

    const transaction = this.#surface.beginTransaction(`interpolate-${axis}`);
    let changed = false;
    const setBlended = (row: number, col: number, target: number, min: number, max: number): void => {
      const cellKey = key(row, col);
      if (!selected.has(cellKey) || this.#pinned.has(cellKey)) return;
      const original = read(row, col);
      if (!Number.isFinite(target) || !Number.isFinite(min) || !Number.isFinite(max)) return;
      // Undefined interior cells are valid interpolation targets. Existing
      // finite cells blend by strength; an empty cell receives the interpolated
      // value directly because there is no numeric source value to blend from.
      let value = original === undefined ? target : original + (target - original) * strength;
      if (shouldClamp) value = clamp(value, min, max);
      if (!Number.isFinite(value)) return;
      transaction.set(row, col, value);
      changed = true;
    };

    if (axis === 'horizontal' || axis === 'vertical') {
      const outerStart = axis === 'horizontal' ? r0 : c0;
      const outerEnd = axis === 'horizontal' ? r1 : c1;
      for (let outer = outerStart; outer <= outerEnd; outer += 1) {
        const indices: number[] = [];
        const innerStart = axis === 'horizontal' ? c0 : r0;
        const innerEnd = axis === 'horizontal' ? c1 : r1;
        for (let inner = innerStart; inner <= innerEnd; inner += 1) {
          const row = axis === 'horizontal' ? outer : inner;
          const col = axis === 'horizontal' ? inner : outer;
          if (selected.has(key(row, col))) indices.push(inner);
        }
        if (indices.length < 2) continue;
        const sample = (inner: number): number | undefined => axis === 'horizontal' ? read(outer, inner) : read(inner, outer);
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
        const coordinate = (inner: number): number => axis === 'horizontal'
          ? (this.#surface.colCoordinate?.(inner) ?? inner)
          : (this.#surface.rowCoordinate?.(inner) ?? inner);
        for (const index of indices) {
          const row = axis === 'horizontal' ? outer : index;
          const col = axis === 'horizontal' ? index : outer;
          const entry = interpolated1d(index, anchors, support, sample, coordinate, method1d);
          if (entry) setBlended(row, col, entry.value, entry.min, entry.max);
        }
      }
    } else {
      const topLeft = read(r0, c0);
      const topRight = read(r0, c1);
      const bottomLeft = read(r1, c0);
      const bottomRight = read(r1, c1);
      if (topLeft === undefined || topRight === undefined || bottomLeft === undefined || bottomRight === undefined) {
        transaction.cancel();
        return false;
      }
      // Bilinear needs only the four finite corners. Boundary Surface can
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
      const boundaryMin = Math.min(...boundaryValues);
      const boundaryMax = Math.max(...boundaryValues);
      const bilinear = (u: number, v: number): number => (
        topLeft * (1 - u) * (1 - v)
        + topRight * u * (1 - v)
        + bottomLeft * (1 - u) * v
        + bottomRight * u * v
      );
      const rowCoordinate = (row: number): number => this.#surface.rowCoordinate?.(row) ?? row;
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
          const top = read(r0, position.col) ?? (topLeft + (topRight - topLeft) * u);
          const bottom = read(r1, position.col) ?? (bottomLeft + (bottomRight - bottomLeft) * u);
          const left = read(position.row, c0) ?? (topLeft + (bottomLeft - topLeft) * v);
          const right = read(position.row, c1) ?? (topRight + (bottomRight - topRight) * v);
          target = (1 - v) * top + v * bottom + (1 - u) * left + u * right - base;
        }
        setBlended(position.row, position.col, target, boundaryMin, boundaryMax);
      }
    }

    if (!changed) {
      transaction.cancel();
      return false;
    }
    return transaction.commit();
  }

  brushFootprint(center: TableCellPosition, options: TableBrushOptions): readonly TableCellPosition[] {
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
    const transaction = this.#surface.beginTransaction('brush');
    const radius = Math.max(0, Math.floor(options.radius));
    const strength = boundedStrength(options.strength);
    const falloff = options.falloff ?? 'linear';
    let active = true;
    let touched = false;

    return {
      pulse: (center, direction = 1): readonly TablePreviewValue[] => {
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
      commit: (): boolean => {
        if (!active) return false;
        active = false;
        if (!touched) {
          transaction.cancel();
          return false;
        }
        return transaction.commit();
      },
      cancel: (): void => {
        if (!active) return;
        active = false;
        transaction.cancel();
      },
    };
  }

  #inside(position: TableCellPosition): boolean {
    return position.row >= 0 && position.row < this.#surface.rows && position.col >= 0 && position.col < this.#surface.cols;
  }
}
