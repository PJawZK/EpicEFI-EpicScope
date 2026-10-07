import '../app/font-size-settings';
import type { NumericChannelRange } from '../../../../core/log-model/log-types';
import { ensureIdleAnalyzerHelp } from './idle-analyzer-help';

export interface AnalyzerEvidenceSeries {
  readonly label: string;
  readonly range: NumericChannelRange;
  readonly group?: string;
}

export interface AnalyzerEvidenceEvent {
  readonly startTimeMs: number;
  readonly endTimeMs: number;
}

interface SamplePoint { readonly x: number; readonly value: number; }
interface SeriesVisibility { visible: boolean; envelope: boolean; }
interface LegendHit {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly seriesIndex: number;
  readonly kind: 'trace' | 'envelope';
}
interface RenderState {
  visibility: Map<string, SeriesVisibility>;
  hits: LegendHit[];
  listenerAttached: boolean;
  typographyListenerAttached?: boolean;
  lastRender?: () => void;
}

const PALETTE = ['#58a6ff', '#f2cc60', '#56d364', '#ff7b72', '#d2a8ff', '#79c0ff', '#ffa657', '#a5d6ff'];
const STATE = new WeakMap<HTMLCanvasElement, RenderState>();

function graphScale(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--epicscope-font-graph-scale').trim();
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(1.8, Math.max(0.8, value)) : 1;
}

function percentile(values: number[], p: number): number | undefined {
  if (!values.length) return undefined;
  values.sort((a, b) => a - b);
  const position = (values.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const a = values[lower];
  const b = values[upper];
  if (a === undefined) return undefined;
  if (b === undefined || lower === upper) return a;
  return a + (b - a) * (position - lower);
}

function valueAt(range: NumericChannelRange, timeMs: number): number | undefined {
  const times = range.timeMs;
  if (!times.length) return undefined;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const value = times[mid];
    if (value === undefined || value < timeMs) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [lo, Math.max(0, lo - 1)];
  let best: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const index of candidates) {
    const t = times[index];
    const value = range.values[index];
    if (t === undefined || value === undefined || range.validity[index] !== 1 || !Number.isFinite(value)) continue;
    const distance = Math.abs(t - timeMs);
    if (distance < bestDistance) { best = value; bestDistance = distance; }
  }
  return best;
}

function extent(points: readonly SamplePoint[]): { min: number; max: number } | undefined {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    min = Math.min(min, point.value);
    max = Math.max(max, point.value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  if (min === max) return { min: min - 0.5, max: max + 0.5 };
  return { min, max };
}

function isIdleEvidence(series: readonly AnalyzerEvidenceSeries[]): boolean {
  const labels = series.map((entry) => entry.label.toLowerCase());
  return labels.some((label) => label === 'rpm')
    && labels.some((label) => label === 'target')
    && labels.some((label) => /idle|dc|iac|etb|ignition|position|control/.test(label));
}

function idlePaneFor(entry: AnalyzerEvidenceSeries): 'engine' | 'control' {
  if (entry.group) return /engine|rpm|response/i.test(entry.group) ? 'engine' : 'control';
  return /^(rpm|target)$/i.test(entry.label) ? 'engine' : 'control';
}

function ensureState(canvas: HTMLCanvasElement): RenderState {
  let state = STATE.get(canvas);
  if (!state) {
    state = { visibility: new Map(), hits: [], listenerAttached: false };
    STATE.set(canvas, state);
  }
  if (!state.listenerAttached) {
    canvas.addEventListener('click', (event) => {
      const current = STATE.get(canvas);
      if (!current) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = current.hits.find((candidate) => x >= candidate.x && x <= candidate.x + candidate.width && y >= candidate.y && y <= candidate.y + candidate.height);
      if (!hit) return;
      const key = String(hit.seriesIndex);
      const visibility = current.visibility.get(key);
      if (!visibility) return;
      if (hit.kind === 'trace') visibility.visible = !visibility.visible;
      else visibility.envelope = !visibility.envelope;
      current.lastRender?.();
    });
    state.listenerAttached = true;
  }
  if (!state.typographyListenerAttached) {
    window.addEventListener('epicscope:typography-change', () => STATE.get(canvas)?.lastRender?.());
    state.typographyListenerAttached = true;
  }
  return state;
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  entries: readonly { entry: AnalyzerEvidenceSeries; seriesIndex: number }[],
  state: RenderState,
  top: number,
  left: number,
  maxWidth: number,
  scale: number,
): number {
  let x = left;
  let y = top;
  const rowHeight = 17 * scale;
  const labelFont = 9 * scale;
  const envelopeFont = 8 * scale;
  const hitHeight = 14 * scale;
  ctx.font = `${labelFont}px system-ui, sans-serif`;
  for (const { entry, seriesIndex } of entries) {
    const key = String(seriesIndex);
    const visibility = state.visibility.get(key)!;
    const labelWidth = Math.min(145 * scale, ctx.measureText(entry.label).width + 18 * scale);
    const envelopeWidth = 15 * scale;
    const itemWidth = labelWidth + 24 * scale;
    if (x + itemWidth > left + maxWidth && x > left) {
      x = left;
      y += rowHeight;
    }
    const color = PALETTE[seriesIndex % PALETTE.length]!;
    ctx.globalAlpha = visibility.visible ? 1 : 0.35;
    ctx.fillStyle = color;
    ctx.fillRect(x, y + 5 * scale, 9 * scale, Math.max(2, 2 * scale));
    ctx.fillStyle = '#a9bdc9';
    ctx.fillText(entry.label, x + 13 * scale, y + 9 * scale);
    state.hits.push({ x, y, width: labelWidth, height: hitHeight, seriesIndex, kind: 'trace' });

    const envelopeX = x + labelWidth;
    ctx.globalAlpha = visibility.envelope ? 1 : 0.35;
    ctx.strokeStyle = color;
    ctx.strokeRect(envelopeX, y + 1 * scale, envelopeWidth, 11 * scale);
    if (visibility.envelope) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = color;
      ctx.fillRect(envelopeX + 2 * scale, y + 3 * scale, 11 * scale, 7 * scale);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#a9bdc9';
    ctx.font = `${envelopeFont}px system-ui, sans-serif`;
    ctx.fillText('E', envelopeX + 5 * scale, y + 9 * scale);
    ctx.font = `${labelFont}px system-ui, sans-serif`;
    state.hits.push({ x: envelopeX, y, width: envelopeWidth, height: hitHeight, seriesIndex, kind: 'envelope' });
    x += itemWidth;
  }
  ctx.globalAlpha = 1;
  return y + rowHeight;
}

function drawPane(
  ctx: CanvasRenderingContext2D,
  width: number,
  paneTop: number,
  paneHeight: number,
  title: string | undefined,
  entries: readonly { entry: AnalyzerEvidenceSeries; seriesIndex: number }[],
  events: readonly AnalyzerEvidenceEvent[],
  beforeMs: number,
  afterMs: number,
  state: RenderState,
  scale: number,
): void {
  const left = Math.max(44, 44 * scale);
  const right = 14;
  const titleHeight = title ? 16 * scale : 0;
  const legendTop = paneTop + titleHeight;
  if (title) {
    ctx.fillStyle = '#8ea7b5';
    ctx.font = `${10 * scale}px system-ui, sans-serif`;
    ctx.fillText(title, left, paneTop + 10 * scale);
  }
  const legendBottom = drawLegend(ctx, entries, state, legendTop, left, width - left - right, scale);
  const plotTop = legendBottom + 3 * scale;
  const bottom = 24 * scale;
  const plotW = width - left - right;
  const plotH = Math.max(70, paneTop + paneHeight - plotTop - bottom);
  const bins = 101;
  const total = Math.max(1, beforeMs + afterMs);
  const xFor = (relativeMs: number): number => left + ((relativeMs + beforeMs) / total) * plotW;

  ctx.strokeStyle = '#1e3544';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, plotTop + plotH);
  ctx.lineTo(left + plotW, plotTop + plotH);
  ctx.stroke();
  const zeroX = xFor(0);
  ctx.strokeStyle = '#526b7b';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(zeroX, plotTop);
  ctx.lineTo(zeroX, plotTop + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#78909e';
  ctx.font = `${9 * scale}px system-ui, sans-serif`;
  const labelY = paneTop + paneHeight - 6 * scale;
  ctx.fillText(`${(-beforeMs).toFixed(0)} ms`, left, labelY);
  ctx.fillText('t=0', Math.max(left, zeroX - 10 * scale), labelY);
  ctx.fillText(`+${afterMs.toFixed(0)} ms`, left + plotW - 44 * scale, labelY);

  for (const { entry, seriesIndex } of entries) {
    const visibility = state.visibility.get(String(seriesIndex))!;
    if (!visibility.visible) continue;
    const medians: SamplePoint[] = [];
    const lows: SamplePoint[] = [];
    const highs: SamplePoint[] = [];
    for (let bin = 0; bin < bins; bin += 1) {
      const relativeMs = -beforeMs + (bin / (bins - 1)) * total;
      const values: number[] = [];
      for (const event of events) {
        const value = valueAt(entry.range, event.startTimeMs + relativeMs);
        if (value !== undefined) values.push(value);
      }
      const median = percentile([...values], 0.5);
      const low = percentile([...values], 0.1);
      const high = percentile([...values], 0.9);
      if (median !== undefined) medians.push({ x: relativeMs, value: median });
      if (low !== undefined) lows.push({ x: relativeMs, value: low });
      if (high !== undefined) highs.push({ x: relativeMs, value: high });
    }
    const bounds = extent(visibility.envelope ? [...lows, ...highs, ...medians] : medians);
    if (!bounds || medians.length < 2) continue;
    const yFor = (value: number): number => plotTop + plotH - ((value - bounds.min) / (bounds.max - bounds.min)) * plotH;
    const color = PALETTE[seriesIndex % PALETTE.length]!;

    if (visibility.envelope && lows.length > 1 && highs.length > 1) {
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = color;
      ctx.beginPath();
      highs.forEach((point, index) => {
        const x = xFor(point.x); const y = yFor(point.value);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      [...lows].reverse().forEach((point) => ctx.lineTo(xFor(point.x), yFor(point.value)));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    medians.forEach((point, index) => {
      const x = xFor(point.x); const y = yFor(point.value);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

export function renderAlignedAnalyzerEvidence(
  canvas: HTMLCanvasElement,
  series: readonly AnalyzerEvidenceSeries[],
  events: readonly AnalyzerEvidenceEvent[],
  beforeMs: number,
  afterMs: number,
): void {
  const idleSplit = isIdleEvidence(series);
  if (idleSplit) ensureIdleAnalyzerHelp(canvas);
  const scale = graphScale();
  const baseHeight = idleSplit ? 460 : 260;
  const scaledHeight = Math.round(baseHeight * Math.max(1, scale));
  canvas.style.height = `${scaledHeight}px`;
  const width = Math.max(320, canvas.clientWidth || 900);
  const height = Math.max(idleSplit ? 460 : 180, canvas.clientHeight || scaledHeight);
  const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#071119';
  ctx.fillRect(0, 0, width, height);

  const state = ensureState(canvas);
  state.hits = [];
  series.forEach((entry, seriesIndex) => {
    const key = String(seriesIndex);
    if (!state.visibility.has(key)) {
      state.visibility.set(key, {
        visible: true,
        envelope: idleSplit ? /^rpm$/i.test(entry.label) : true,
      });
    }
  });
  for (const key of [...state.visibility.keys()]) {
    if (Number(key) >= series.length) state.visibility.delete(key);
  }

  state.lastRender = () => renderAlignedAnalyzerEvidence(canvas, series, events, beforeMs, afterMs);

  if (idleSplit) {
    const indexed = series.map((entry, seriesIndex) => ({ entry, seriesIndex }));
    const engine = indexed.filter(({ entry }) => idlePaneFor(entry) === 'engine');
    const control = indexed.filter(({ entry }) => idlePaneFor(entry) === 'control');
    const gap = 8;
    const paneHeight = (height - gap) / 2;
    drawPane(ctx, width, 0, paneHeight, 'Engine response', engine, events, beforeMs, afterMs, state, scale);
    drawPane(ctx, width, paneHeight + gap, paneHeight, 'Controller / actuator response', control, events, beforeMs, afterMs, state, scale);
    ctx.strokeStyle = '#193241';
    ctx.beginPath();
    ctx.moveTo(14, paneHeight + gap / 2);
    ctx.lineTo(width - 14, paneHeight + gap / 2);
    ctx.stroke();
  } else {
    const indexed = series.map((entry, seriesIndex) => ({ entry, seriesIndex }));
    drawPane(ctx, width, 0, height, undefined, indexed, events, beforeMs, afterMs, state, scale);
  }
}
