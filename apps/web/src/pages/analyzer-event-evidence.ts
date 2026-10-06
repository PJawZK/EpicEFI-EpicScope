import type { NumericChannelRange } from '../../../../core/log-model/log-types';

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

const PALETTE = ['#58a6ff', '#f2cc60', '#56d364', '#ff7b72', '#d2a8ff', '#79c0ff', '#ffa657', '#a5d6ff'];

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

export function renderAlignedAnalyzerEvidence(
  canvas: HTMLCanvasElement,
  series: readonly AnalyzerEvidenceSeries[],
  events: readonly AnalyzerEvidenceEvent[],
  beforeMs: number,
  afterMs: number,
): void {
  const width = Math.max(320, canvas.clientWidth || 900);
  const height = Math.max(180, canvas.clientHeight || 260);
  const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#071119';
  ctx.fillRect(0, 0, width, height);

  const left = 44;
  const right = 14;
  const top = 22;
  const bottom = 28;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const bins = 101;
  const total = Math.max(1, beforeMs + afterMs);
  const xFor = (relativeMs: number): number => left + ((relativeMs + beforeMs) / total) * plotW;

  ctx.strokeStyle = '#1e3544';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top + plotH);
  ctx.lineTo(left + plotW, top + plotH);
  ctx.stroke();
  const zeroX = xFor(0);
  ctx.strokeStyle = '#526b7b';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(zeroX, top);
  ctx.lineTo(zeroX, top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#78909e';
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText(`${(-beforeMs).toFixed(0)} ms`, left, height - 8);
  ctx.fillText('t=0', Math.max(left, zeroX - 10), height - 8);
  ctx.fillText(`+${afterMs.toFixed(0)} ms`, left + plotW - 44, height - 8);

  let legendX = left;
  series.forEach((entry, seriesIndex) => {
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
    const bounds = extent([...lows, ...highs, ...medians]);
    if (!bounds || medians.length < 2) return;
    const yFor = (value: number): number => top + plotH - ((value - bounds.min) / (bounds.max - bounds.min)) * plotH;
    const color = PALETTE[seriesIndex % PALETTE.length]!;

    if (lows.length > 1 && highs.length > 1) {
      ctx.globalAlpha = 0.12;
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

    ctx.fillStyle = color;
    ctx.fillRect(legendX, 7, 8, 2);
    ctx.fillStyle = '#a9bdc9';
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText(entry.label, legendX + 12, 11);
    legendX += Math.min(150, 18 + ctx.measureText(entry.label).width + 16);
  });
}
