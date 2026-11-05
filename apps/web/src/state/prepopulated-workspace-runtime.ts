import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { GraphPaneSnapshot, GraphWorkspaceSnapshot } from './workspace-state';
import {
  resolveStarterWorkspaceTemplate,
  type ResolvedStarterWorkspace,
  type StarterWorkspaceTemplate,
} from './built-in-workspace-templates';
import {GRAPH_PANE_IDS} from './logger-pane-layout';
import type { SemanticChannelRoleId, SemanticChannelResolveOptions } from './semantic-channel-roles';

/**
 * Historical prefix used by the first protected pre-populated-workspace implementation.
 * Persisted IDs carrying this prefix are compatibility data only and no longer imply protection.
 */
export const LEGACY_BUILT_IN_WORKSPACE_ID_PREFIX = 'built-in:';

export function legacyBuiltInWorkspaceRuntimeId(template: StarterWorkspaceTemplate): string {
  return `${LEGACY_BUILT_IN_WORKSPACE_ID_PREFIX}${template.id}`;
}

export interface MaterializedStarterWorkspace {
  readonly workspace: GraphWorkspaceSnapshot;
  readonly resolution: ResolvedStarterWorkspace;
}

export const LOGGER_STARTER_CHANNEL_LIMIT = 4;
/** Ordered candidates; absent roles are omitted, never replaced by arbitrary catalog entries. */
export const LOGGER_STARTER_GROUPS: readonly {name:string;roles:readonly SemanticChannelRoleId[]}[] = [
  {name:'Engine',roles:['engine.rpm','engine.map','engine.throttle.position','temperature.coolant','temperature.intakeAir']},
  {name:'Idle',roles:['engine.rpm','idle.target','idle.airCommand','ignition.advance']},
  {name:'Fueling',roles:['fuel.lambda','fuel.lambdaTarget','fuel.injectorPulseWidth','fuel.injectorDuty','fuel.pressure','fuel.totalCorrection']},
  {name:'Boost',roles:['engine.map','boost.target','boost.wastegateCommand','boost.error','engine.rpm']},
  {name:'Electrical',roles:['electrical.batteryVoltage','electrical.alternatorDuty','electrical.sensorSupplyVoltage','cooling.fanActive','ignition.dwell','engine.rpm']},
  {name:'Controller',roles:['etb.target','etb.error','etb.duty','etb.feedForward','trigger.syncState','trigger.errorCount','idle.airCommand']},
];

export function resolveLoggerStarterPaneGroups(channels:readonly ChannelDefinition[],options:SemanticChannelResolveOptions = {}) {
  const groupTemplate:StarterWorkspaceTemplate = {id:'logger-layout-groups',name:'Logger layout groups',layout:'grid6',panes:LOGGER_STARTER_GROUPS.map((group,index)=>({id:GRAPH_PANE_IDS[index]!,roles:group.roles.map(roleId=>({roleId,requirement:'optional'}))}))};
  const groups=resolveStarterWorkspaceTemplate(groupTemplate,channels,options);
  return groups.panes;
}

function materializedPaneSnapshots(resolution:ResolvedStarterWorkspace,groups:readonly GraphPaneSnapshot[]) {
  return GRAPH_PANE_IDS.map(id=>({
    id,
    // Existing named templates retain their domain ordering; unused pane slots get shared groups.
    channelIds:[...new Set((resolution.panes.find(p=>p.id===id)??groups.find(p=>p.id===id))?.channelIds??[])].slice(0,LOGGER_STARTER_CHANNEL_LIMIT),
  }));
}

/**
 * Resolves a starter template once and returns a normal editable workspace snapshot.
 *
 * The caller owns the workspace identity. No reserved prefix is added and this function does not
 * update, refresh or otherwise retain ownership of an existing workspace after materialization.
 */
export function materializeStarterWorkspace(
  template: StarterWorkspaceTemplate,
  channels: readonly ChannelDefinition[],
  workspaceId: string,
  options: SemanticChannelResolveOptions = {},
  seed?: Partial<GraphWorkspaceSnapshot>,
  layoutDefaults:readonly GraphPaneSnapshot[] = resolveLoggerStarterPaneGroups(channels,options),
): MaterializedStarterWorkspace {
  const resolution = resolveStarterWorkspaceTemplate(template, channels, options);
  const panes = materializedPaneSnapshots(resolution,layoutDefaults);
  const requestedActivePaneId = seed?.activePaneId;
  const activePaneId = requestedActivePaneId && panes.some((pane) => pane.id === requestedActivePaneId)
    ? requestedActivePaneId
    : (panes[0]?.id ?? 'pane-1');
  const activePane = panes.find((pane) => pane.id === activePaneId) ?? panes[0];

  return {
    resolution,
    workspace: {
      id: workspaceId,
      name: seed?.name ?? template.name,
      channelIds: [...(activePane?.channelIds ?? [])],
      layout: template.layout,
      activePaneId,
      panes,
      viewport: seed?.viewport,
      cursorTimeMs: seed?.cursorTimeMs ?? 0,
      viewHistory: seed?.viewHistory ?? [],
      viewHistoryIndex: seed?.viewHistoryIndex ?? -1,
      ...(seed?.paneGeometry ? { paneGeometry: seed.paneGeometry } : {}),
      ...(seed?.minimizedPaneIds ? { minimizedPaneIds: seed.minimizedPaneIds } : {}),
      ...(seed?.maximizedPaneId !== undefined ? { maximizedPaneId: seed.maximizedPaneId } : {}),
      ...(seed?.freeformArrange ? { freeformArrange: seed.freeformArrange } : {}),
    },
  };
}

/** Compatibility aliases for callers/tests during the lifecycle migration. */
export const BUILT_IN_WORKSPACE_ID_PREFIX = LEGACY_BUILT_IN_WORKSPACE_ID_PREFIX;
export const builtInWorkspaceRuntimeId = legacyBuiltInWorkspaceRuntimeId;
