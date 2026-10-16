import type { HealthContext, HealthSnapshot } from '../health-rules';
import type { ObservabilityRecorder } from '../recorder';
/** Called at explicit report creation using its already acquired health snapshot. */
export function recordHealthSnapshot(recorder: ObservabilityRecorder, snapshot: HealthSnapshot, context: HealthContext): void {
  recorder.record({ recordKind: 'snapshot', subsystem: 'health', component: 'runtime-health', name: 'health.snapshot', origin: 'system', metadata: {
    hasChannelDataSource: snapshot.hasChannelDataSource, channelDefinitionCount: snapshot.channelDefinitionCount,
    catalogChannelCount: snapshot.catalogChannelCount, renderableAssignedChannelCount: snapshot.renderableAssignedChannelCount,
    unavailableAssignedChannelCount: snapshot.unavailableAssignedChannelCount, activeTraceCount: snapshot.activeTraceCount,
    logLoaded: context.logLoaded, iniLoaded: context.iniLoaded, bindingActive: context.bindingActive, runtimeErrorCount: context.runtimeErrorCount,
  } });
}
