import type { NumericChannelRange } from '../../../../core/log-model/log-types';
import { buildViewportEnvelope, buildRawViewportSeries } from '../../../../core/timeline/viewport-series';
import { buildStableValueScale } from '../../../../core/timeline/value-scale';
import { createFullViewport, panViewport, zoomViewport, type TimelineViewport } from '../../../../core/timeline/viewport-state';

const NS = 'http://www.w3.org/2000/svg';
const WIDTH = 1000;
const LEFT = 65;
const RIGHT = 980;
const PLOT_WIDTH = RIGHT - LEFT;
function svgNode(tag: string, attrs: Record<string, string>, text?: string): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Display projection of accepted numeric ranges; never reads a source or calculates analysis. */
export function createIdleStabilityPlot() {
  const element = document.createElementNS(NS, 'svg');
  element.classList.add('idle-stability-plot');
  element.setAttribute('viewBox', `0 0 ${WIDTH} 480`);
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', 'Recorded RPM and target above; actual minus target error below. Wheel zoom, drag pan, double-click fit.');
  element.setAttribute('tabindex', '0');
  const events = new AbortController();
  let active = false;
  let viewport: TimelineViewport | undefined;
  let ranges: readonly (NumericChannelRange | undefined)[] = [];
  let scales: readonly { min: number; max: number }[] = [];
  let drag: { x: number; start: TimelineViewport; pointer: number } | undefined;
  const readout = svgNode('text', { x: '75', y: '22', class: 'idle-plot-cursor' });
  const xFor = (time: number) => LEFT + (time - viewport!.visibleStartMs) / Math.max(1, viewport!.visibleEndMs - viewport!.visibleStartMs) * PLOT_WIDTH;
  const yFor = (value: number, pane: number) => 42 + pane * 232 + 172 - (value - scales[pane]!.min) / (scales[pane]!.max - scales[pane]!.min) * 172;
  const draw = () => {
    if (!active) return;
    element.replaceChildren();
    element.append(readout);
    if (!viewport) return;
    for (let pane = 0; pane < 2; pane += 1) {
      const top = 42 + pane * 232;
      element.append(svgNode('text', { x: String(LEFT), y: String(top - 8) }, pane ? 'RPM ERROR · actual − target (RPM)' : 'RPM RESPONSE · actual / target (RPM)'));
      for (let tick = 0; tick <= 4; tick += 1) {
        const y = top + tick / 4 * 172;
        element.append(svgNode('line', { x1: String(LEFT), x2: String(RIGHT), y1: String(y), y2: String(y), stroke: '#25404e' }));
        const value = scales[pane]!.max - tick / 4 * (scales[pane]!.max - scales[pane]!.min);
        element.append(svgNode('text', { x: '57', y: String(y + 4), 'text-anchor': 'end' }, value.toFixed(0)));
      }
      for (let tick = 0; tick <= 4; tick += 1) {
        const time = viewport.visibleStartMs + tick / 4 * (viewport.visibleEndMs - viewport.visibleStartMs);
        element.append(svgNode('text', { x: String(LEFT + tick / 4 * PLOT_WIDTH), y: String(top + 193), 'text-anchor': tick === 0 ? 'start' : tick === 4 ? 'end' : 'middle' }, `${(time / 1000).toFixed(2)} s`));
      }
    }
    ranges.forEach((range, index) => {
      if (!range) return;
      const pane = index === 2 ? 1 : 0;
      let d = '';
      if (range.values.length <= 2000) {
        const points = buildRawViewportSeries(range, viewport!.visibleStartMs, viewport!.visibleEndMs);
        for (const point of points) {
          d += `${point.breakBefore ? 'M' : 'L'}${xFor(point.timeMs).toFixed(2)},${yFor(point.value, pane).toFixed(2)} `;
          // A single recorded sample remains visible without inventing a connecting segment.
          if (point.breakBefore) d += `l.1,0 `;
        }
      } else {
        // Independent min/max columns preserve peaks and never connect across missing bins.
        const envelope = buildViewportEnvelope(range, viewport!.visibleStartMs, viewport!.visibleEndMs, PLOT_WIDTH);
        for (const column of envelope.columns) {
          const x = LEFT + column.x;
          d += `M${x},${yFor(column.min, pane).toFixed(2)}L${x + .2},${yFor(column.max, pane).toFixed(2)} `;
        }
      }
      element.append(svgNode('path', { d, fill: 'none', stroke: ['#61b8ed', '#7bd2b1', '#e8b46d'][index]!, 'stroke-width': '1.5', 'data-idle-trace': String(index) }));
    });
    if (!ranges[2]) element.append(svgNode('text', { x: '350', y: '360' }, 'Target unavailable — error evidence not calculated'));
  };
  const fit = () => { if (viewport) { viewport = createFullViewport(viewport.fullStartMs, viewport.fullEndMs); draw(); } };
  element.addEventListener('wheel', event => {
    if (!active || !viewport) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * WIDTH - LEFT) / PLOT_WIDTH));
    viewport = zoomViewport(viewport, event.deltaY < 0 ? .8 : 1.25, viewport.visibleStartMs + fraction * (viewport.visibleEndMs - viewport.visibleStartMs));
    draw();
  }, { passive: false, signal: events.signal });
  element.addEventListener('pointerdown', event => {
    if (!active || !viewport || event.button !== 0) return;
    element.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, start: viewport, pointer: event.pointerId };
  }, { signal: events.signal });
  element.addEventListener('pointermove', event => {
    if (!active || !viewport) return;
    const rect = element.getBoundingClientRect();
    if (drag) {
      viewport = panViewport(drag.start, -(event.clientX - drag.x) / rect.width * WIDTH / PLOT_WIDTH * (drag.start.visibleEndMs - drag.start.visibleStartMs));
      draw();
    } else {
      const fraction = Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * WIDTH - LEFT) / PLOT_WIDTH));
      readout.textContent = `Source time ${((viewport.visibleStartMs + fraction * (viewport.visibleEndMs - viewport.visibleStartMs)) / 1000).toFixed(3)} s`;
    }
  }, { signal: events.signal });
  const end = () => { if (drag && element.hasPointerCapture(drag.pointer)) element.releasePointerCapture(drag.pointer); drag = undefined; };
  element.addEventListener('pointerup', end, { signal: events.signal });
  element.addEventListener('pointercancel', end, { signal: events.signal });
  element.addEventListener('dblclick', fit, { signal: events.signal });
  element.addEventListener('keydown', event => {
    if (!active || !viewport) return;
    if (!['ArrowLeft', 'ArrowRight', '+', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { fit(); return; }
    viewport = event.key === '+' || event.key === '-'
      ? zoomViewport(viewport, event.key === '+' ? .8 : 1.25, (viewport.visibleStartMs + viewport.visibleEndMs) / 2)
      : panViewport(viewport, (event.key === 'ArrowLeft' ? -.1 : .1) * (viewport.visibleEndMs - viewport.visibleStartMs));
    draw();
  }, { signal: events.signal });
  return {
    element, fit,
    setActive(next: boolean) { active = next; if (!next) end(); else draw(); },
    clear() { ranges = []; viewport = undefined; readout.textContent = ''; element.replaceChildren(); },
    setData(rpm: NumericChannelRange, target: NumericChannelRange | undefined, error: NumericChannelRange | undefined, startMs: number, endMs: number) {
      ranges = [rpm, target, error];
      const rpmScale = buildStableValueScale(rpm);
      const targetScale = target ? buildStableValueScale(target) : rpmScale;
      scales = [{ min: Math.min(rpmScale.min, targetScale.min), max: Math.max(rpmScale.max, targetScale.max) }, error ? buildStableValueScale(error) : { min: -1, max: 1 }];
      viewport = createFullViewport(startMs, endMs);
      readout.textContent = '';
      draw();
    },
    dispose() { end(); events.abort(); ranges = []; viewport = undefined; element.replaceChildren(); },
  };
}
