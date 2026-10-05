import type { HistogramPageContext } from './histogram-page';
import { createHeatmapView } from './heatmap-view';

export interface DualHeatmapViewController {
  readonly element: HTMLElement;
  setContext(context: HistogramPageContext): void;
  refresh(): void;
}

export function createDualHeatmapView(): DualHeatmapViewController {
  const left = createHeatmapView({ label: 'Left', compact: true });
  const right = createHeatmapView({ label: 'Right', compact: true });

  const root = document.createElement('section');
  root.className = 'dual-heatmap-view';
  root.hidden = true;
  left.element.hidden = false;
  right.element.hidden = false;
  root.append(left.element, right.element);

  return {
    element: root,
    setContext(context): void {
      left.setContext(context);
      right.setContext(context);
    },
    refresh(): void {
      left.refresh();
      right.refresh();
    },
  };
}
