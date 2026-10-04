import type {
  GraphPaneGeometry,
  GraphPaneSnapshot,
  GraphWorkspaceLayout,
} from './workspace-state';

export const GRAPH_PANE_IDS = ['pane-1', 'pane-2', 'pane-3', 'pane-4', 'pane-5', 'pane-6'] as const;

export interface GraphPaneState {
  id: string;
  channelIds: string[];
}

export type FreeformArrange = 'mosaic' | 'columns' | 'rows' | 'cascade' | 'custom';

export function paneCountForLayout(layout: GraphWorkspaceLayout): number {
  if (layout === 'grid4') return 4;
  if (layout === 'grid5' || layout === 'freeform') return 5;
  if (layout === 'grid6') return 6;
  return 1;
}

export function freeformArrangement(name: FreeformArrange): Record<string, GraphPaneGeometry> {
  const rect = (x: number, y: number, width: number, height: number): GraphPaneGeometry =>
    ({ x, y, width, height });

  if (name === 'columns') {
    return {
      'pane-1': rect(0, 0, .57, .32),
      'pane-2': rect(0, .34, .57, .32),
      'pane-3': rect(0, .68, .57, .32),
      'pane-4': rect(.59, 0, .41, .49),
      'pane-5': rect(.59, .51, .41, .49),
    };
  }
  if (name === 'rows') {
    return {
      'pane-1': rect(0, 0, 1, .19),
      'pane-2': rect(0, .2025, 1, .19),
      'pane-3': rect(0, .405, 1, .19),
      'pane-4': rect(0, .6075, 1, .19),
      'pane-5': rect(0, .81, 1, .19),
    };
  }
  if (name === 'cascade') {
    return {
      'pane-1': rect(0, 0, .68, .58),
      'pane-2': rect(.08, .08, .68, .58),
      'pane-3': rect(.16, .16, .68, .58),
      'pane-4': rect(.24, .24, .68, .58),
      'pane-5': rect(.32, .32, .68, .58),
    };
  }
  return {
    'pane-1': rect(0, 0, .58, .56),
    'pane-2': rect(.59, 0, .41, .275),
    'pane-3': rect(.59, .285, .41, .275),
    'pane-4': rect(0, .57, .49, .43),
    'pane-5': rect(.50, .57, .50, .43),
  };
}

export function createEmptyPaneStates(): GraphPaneState[] {
  return GRAPH_PANE_IDS.map((id) => ({ id, channelIds: [] }));
}

export function normalizePaneStates(
  panes: readonly GraphPaneSnapshot[] | undefined,
  legacyChannelIds: readonly string[],
): GraphPaneState[] {
  const normalized = createEmptyPaneStates();
  if (panes && panes.length > 0) {
    for (const pane of panes.slice(0, GRAPH_PANE_IDS.length)) {
      const target = normalized.find((candidate) => candidate.id === pane.id);
      if (target) target.channelIds = [...pane.channelIds];
    }
  } else {
    normalized[0]!.channelIds = [...legacyChannelIds];
  }
  return normalized;
}
