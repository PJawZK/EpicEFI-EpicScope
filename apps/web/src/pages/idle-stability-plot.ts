import { buildViewportTraceSeries, nearestNumericSample } from '../../../../core/timeline/viewport-series';
import { buildStableValueScale } from '../../../../core/timeline/value-scale';
import { createFullViewport, panViewport, zoomViewport, type TimelineViewport } from '../../../../core/timeline/viewport-state';
import type { AnalyzerEvidenceSeries } from './analyzer-event-evidence';

export interface IdlePlotSeries extends AnalyzerEvidenceSeries { readonly unit: string; readonly color: string; readonly pane: 0 | 1; readonly axis?: 'right'; }
const NS = 'http://www.w3.org/2000/svg', WIDTH = 1000, LEFT = 0, RIGHT = 985, PLOT_WIDTH = RIGHT - LEFT;
function svgNode(tag: string, attrs: Record<string, string>, text?: string): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Recorded presentation only. Shares Logger viewport, sample lookup and envelope primitives. */
export function createIdleStabilityPlot() {
  const element = document.createElement('div'); element.className = 'idle-plot-surface';
  const frame = document.createElement('div'); frame.className = 'idle-plot-frame';
  const axis = document.createElement('div'); axis.className = 'idle-plot-y-axis';
  const rightAxis = document.createElement('div'); rightAxis.className = 'idle-plot-y-axis idle-plot-y-axis-right';
  const svg = document.createElementNS(NS, 'svg'); svg.classList.add('idle-stability-plot');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} 480`); svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Recorded RPM and target; base, correction and final position. Wheel zoom, drag pan, Shift-drag zoom, Home to fit.'); svg.setAttribute('tabindex', '0');
  const tooltip = document.createElement('div'); tooltip.className = 'idle-plot-tooltip'; tooltip.hidden = true; tooltip.setAttribute('role', 'status');
  const legend = document.createElement('div'); legend.className = 'idle-plot-legend'; legend.setAttribute('aria-label', 'Recorded trace visibility');
  frame.append(axis, svg, rightAxis); element.append(frame, tooltip, legend);
  const events = new AbortController();
  legend.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-trace-label]') : null;
    if (!active || !button) return; const label = button.dataset.traceLabel!;
    if (hidden.has(label)) hidden.delete(label); else hidden.add(label);
    button.setAttribute('aria-pressed', String(!hidden.has(label))); draw();
  }, { signal: events.signal });
  const defaultTitles = ['RPM CONTROL · actual / target', 'AIRFLOW REQUESTS · position (%) / correction (pp)'] as const;
  let titles: readonly [string,string] = defaultTitles;
  let active = false, series: readonly IdlePlotSeries[] = [], hidden = new Set<string>();
  let viewport: TimelineViewport | undefined;
  let scales: readonly { min: number; max: number }[] = [];
  let drag: { x: number; start: TimelineViewport; pointer: number; zoom: boolean } | undefined;
  const crosshair = svgNode('line', { stroke: '#94aebd', 'stroke-dasharray': '3 3', y1: '28', y2: '440', 'pointer-events': 'none' });
  const fractionAt = (x: number) => Math.max(0, Math.min(1, ((x - svg.getBoundingClientRect().left) / svg.getBoundingClientRect().width * WIDTH - LEFT) / PLOT_WIDTH));
  const timeAt = (x: number) => viewport!.visibleStartMs + fractionAt(x) * (viewport!.visibleEndMs - viewport!.visibleStartMs);
  const xFor = (time: number) => LEFT + (time - viewport!.visibleStartMs) / Math.max(1, viewport!.visibleEndMs - viewport!.visibleStartMs) * PLOT_WIDTH;
  const yFor = (value: number, pane: number, right: boolean) => { const scale=scales[pane+(right?2:0)]!; return 30 + pane * 232 + 178 - (value - scale.min) / (scale.max - scale.min) * 178; };
  const traceCache = new Map<IdlePlotSeries, { key: string; trace: ReturnType<typeof buildViewportTraceSeries> }>();
  const draw = () => {
    if (!active) return;
    svg.replaceChildren(); axis.replaceChildren(); rightAxis.replaceChildren(); tooltip.hidden = true;
    if (!viewport) return;
    for (let pane = 0; pane < 2; pane += 1) {
      const top = 30 + pane * 232;
      svg.append(svgNode('text', { x: String(LEFT), y: String(top - 9) }, titles[pane]));
      for (let tick = 0; tick <= 4; tick += 1) {
        const y = top + tick / 4 * 178;
        svg.append(svgNode('line', { x1: String(LEFT), x2: String(RIGHT), y1: String(y), y2: String(y), stroke: 'var(--line-soft, #253846)' }));
        const label = document.createElement('span'); label.style.top = `${y / 480 * 100}%`;
        const scale=scales[pane]!, decimals=frame.classList.contains('has-right-axis') ? scale.max-scale.min<4?2:scale.max-scale.min<40?1:0 : 0;
        label.textContent = (scale.max - tick / 4 * (scale.max - scale.min)).toFixed(decimals); axis.append(label);
        if (series.some(entry=>entry.pane===pane&&entry.axis==='right')) {
          const scale=scales[pane+2]!, right=document.createElement('span'); right.style.top=label.style.top; right.textContent=(scale.max-tick/4*(scale.max-scale.min)).toFixed(scale.max-scale.min<4?2:1); rightAxis.append(right);
        }
      }
      for (let tick = 0; tick <= 4; tick += 1) {
        const time = viewport.visibleStartMs + tick / 4 * (viewport.visibleEndMs - viewport.visibleStartMs);
        svg.append(svgNode('text', { x: String(LEFT + tick / 4 * PLOT_WIDTH), y: String(top + 198), 'text-anchor': tick === 0 ? 'start' : tick === 4 ? 'end' : 'middle' }, `${(time / 1000).toFixed(2)} s`));
      }
    }
    series.forEach((entry, index) => {
      if (hidden.has(entry.label)) return;
      const pixelWidth = Math.max(1, Math.round(svg.getBoundingClientRect().width * PLOT_WIDTH / WIDTH));
      const key = `${viewport!.visibleStartMs}:${viewport!.visibleEndMs}:${pixelWidth}`;
      let cached = traceCache.get(entry);
      if (cached?.key !== key) {
        cached = { key, trace: buildViewportTraceSeries(entry.range, viewport!.visibleStartMs, viewport!.visibleEndMs, pixelWidth) };
        traceCache.set(entry, cached);
      }
      let d = '';
      for (const point of cached.trace.points) {
        d += `${point.breakBefore ? 'M' : 'L'}${xFor(point.timeMs).toFixed(2)},${yFor(point.value, entry.pane, entry.axis === 'right').toFixed(2)} `;
        if (point.breakBefore) d += 'l.1,0 ';
      }
      const path = svgNode('path', { d, fill: 'none', stroke: entry.color, 'stroke-width': '1.3', 'vector-effect': 'non-scaling-stroke', 'data-trace-mode': cached.trace.mode, 'data-idle-trace': String(index), 'data-trace-label': entry.label, 'data-value-axis': entry.axis ?? 'left' });
      svg.append(path);
    });
    if (!series.some(entry => entry.pane === 1)) svg.append(svgNode('text', { x: '300', y: '350' }, 'Controller context unavailable · map recorded position channels'));
  };
  const fit = () => { if (viewport) { viewport = createFullViewport(viewport.fullStartMs, viewport.fullEndMs); draw(); } };
  const zoom = (factor: number) => { if (active && viewport) { viewport = zoomViewport(viewport, factor, (viewport.visibleStartMs + viewport.visibleEndMs) / 2); draw(); } };
  svg.addEventListener('wheel', event => { if (!active || !viewport) return; event.preventDefault(); viewport = zoomViewport(viewport, event.deltaY < 0 ? .8 : 1.25, timeAt(event.clientX)); draw(); }, { passive: false, signal: events.signal });
  svg.addEventListener('pointerdown', event => {
    if (!active || !viewport || event.button !== 0) return;
    event.preventDefault(); svg.setPointerCapture(event.pointerId); drag = { x: event.clientX, start: viewport, pointer: event.pointerId, zoom: event.shiftKey };
  }, { signal: events.signal });
  svg.addEventListener('pointermove', event => {
    if (!active || !viewport) return;
    if (drag) {
      tooltip.hidden = true;
      if (!drag.zoom) { viewport = panViewport(drag.start, -(event.clientX - drag.x) / svg.getBoundingClientRect().width * WIDTH / PLOT_WIDTH * (drag.start.visibleEndMs - drag.start.visibleStartMs)); draw(); }
      return;
    }
    const reference = series[0]; const sample = reference ? nearestNumericSample(reference.range, timeAt(event.clientX)) : undefined;
    if (!sample) { tooltip.hidden = true; crosshair.remove(); return; }
    crosshair.setAttribute('x1', String(xFor(sample.timeMs))); crosshair.setAttribute('x2', String(xFor(sample.timeMs))); svg.append(crosshair);
    const title = document.createElement('strong'); title.textContent = `${(sample.timeMs / 1000).toFixed(3)} s · sample ${sample.sampleIndex}`; tooltip.replaceChildren(title);
    for (const entry of series) {
      if (hidden.has(entry.label)) continue;
      const index = sample.sampleIndex - entry.range.startSampleIndex, value = entry.range.values[index];
      const valid = entry.range.validity[index] === 1 && entry.range.timeMs[index] === sample.timeMs && value !== undefined && Number.isFinite(value);
      const row = document.createElement('div'); row.style.color = entry.color; row.textContent = `${entry.label}: ${valid ? value.toFixed(2) + ' ' + entry.unit : 'Unavailable'}`; tooltip.append(row);
    }
    const rect = element.getBoundingClientRect(); tooltip.style.left = `${Math.max(0, Math.min(rect.width - 230, event.clientX - rect.left + 12))}px`;
    tooltip.style.top = `${Math.max(0, Math.min(rect.height - 135, event.clientY - rect.top + 10))}px`; tooltip.hidden = false;
  }, { signal: events.signal });
  const end = (event?: PointerEvent) => {
    const old = drag; drag = undefined;
    if (old && event && old.zoom && viewport && Math.abs(event.clientX - old.x) > 3) {
      const a = timeAt(old.x), b = timeAt(event.clientX); viewport = { ...old.start, visibleStartMs: Math.min(a, b), visibleEndMs: Math.max(a, b) }; draw();
    }
    if (old && svg.hasPointerCapture(old.pointer)) svg.releasePointerCapture(old.pointer);
  };
  svg.addEventListener('pointerup', end, { signal: events.signal });
  svg.addEventListener('pointercancel', () => end(), { signal: events.signal });
  svg.addEventListener('pointerleave', () => { tooltip.hidden = true; crosshair.remove(); }, { signal: events.signal });
  svg.addEventListener('dblclick', fit, { signal: events.signal });
  svg.addEventListener('keydown', event => {
    if (!active || !viewport || !['ArrowLeft', 'ArrowRight', '+', '-', 'Home'].includes(event.key)) return;
    event.preventDefault(); if (event.key === 'Home') fit(); else if (event.key === '+' || event.key === '-') zoom(event.key === '+' ? .8 : 1.25);
    else { viewport = panViewport(viewport, (event.key === 'ArrowLeft' ? -.1 : .1) * (viewport.visibleEndMs - viewport.visibleStartMs)); draw(); }
  }, { signal: events.signal });
  return {
    element, fit, zoom,
    setActive(next: boolean) { active = next; if (!next) { end(); tooltip.hidden = true; } else draw(); },
    clear() { traceCache.clear(); series = []; viewport = undefined; svg.replaceChildren(); axis.replaceChildren(); rightAxis.replaceChildren(); frame.classList.remove('has-right-axis'); legend.replaceChildren(); tooltip.hidden = true; },
    setData(entries: readonly IdlePlotSeries[], startMs: number, endMs: number, options?: { titles?: readonly [string,string]; ariaLabel?: string; preserveViewport?: boolean }) {
      titles = options?.titles ?? defaultTitles;
      svg.setAttribute('aria-label', options?.ariaLabel ?? 'Recorded RPM and target; base, correction and final position. Wheel zoom, drag pan, Shift-drag zoom, Home to fit.');
      traceCache.clear(); series = entries; frame.classList.toggle('has-right-axis',entries.some(entry=>entry.axis==='right')); const perPane = [0, 1, 2, 3].map(group => {
        const bounds = entries.filter(entry => entry.pane === group%2 && (entry.axis === 'right') === (group>=2)).map(entry => buildStableValueScale(entry.range));
        return bounds.reduce((a, b) => ({ min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) }), bounds[0] ?? { min: -1, max: 1 });
      }); scales = perPane; if (!options?.preserveViewport || !viewport || viewport.fullStartMs !== startMs || viewport.fullEndMs !== endMs) viewport = createFullViewport(startMs, endMs);
      legend.replaceChildren();
      for (const entry of entries) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = entry.label; button.style.color = entry.color; button.setAttribute('aria-pressed', String(!hidden.has(entry.label)));
        button.dataset.traceLabel = entry.label; legend.append(button);
      }
      draw();
    },
    dispose() { end(); events.abort(); traceCache.clear(); series = []; viewport = undefined; element.replaceChildren(); },
  };
}
