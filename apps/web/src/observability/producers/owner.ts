import type { ObservabilityRecorder } from '../recorder';
import { createOperationFactory, type Operation } from '../operation';
import type { Metadata, RecordInput, Origin } from '../record';
let ownerSequence = 0;
/** Explicit passive producer calls at existing owners; no interception or domain lifecycle wrapper. */
export function createOwnerEvidence(recorder: ObservabilityRecorder | undefined, component: string) {
  const ownerId = `owner:${component}:${++ownerSequence}`;
  const operations = recorder ? createOperationFactory(recorder, ownerId) : undefined;
  return {
    event(name: string, metadata: Metadata = {}, context: Partial<Pick<RecordInput, 'visibility' | 'stateRevision' | 'sourceRevision' | 'origin' | 'semanticFingerprint'>> = {}) {
      recorder?.record({ recordKind: 'event', subsystem: 'owners', component, name, origin: 'system', priority: 'detail', ...context, metadata: { ...metadata, ownerId } });
    },
    begin(name: string, metadata: Metadata = {}, origin: Origin = 'async') {
      return operations?.begin({ subsystem: 'owners', component, name, origin, metadata: { ...metadata, ownerId } });
    },
  };
}
export function rejectOwnerCompletion(operation: Operation | undefined, reason: string): void {
  if (!operation) return;
  if (operation.outcome === undefined) operation.finish('superseded', reason);
  operation.staleCompletion(reason);
}
/** Preserve the original thrown object even when an exception exposes hostile getters. */
export function ownerFailureReason(error: unknown): string {
  try { const name = error instanceof Error ? error.name : undefined; return typeof name === 'string' ? name : 'owner-error'; }
  catch { return 'owner-error'; }
}
