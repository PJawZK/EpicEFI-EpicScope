import { createOperationFactory, type OperationInput } from './operation';
import { ObservabilityRecorder, type RecorderOptions } from './recorder';

/** Construct explicitly at an application owner; importing this module installs nothing. */
export function createObservabilitySession(options: Omit<RecorderOptions, 'sessionId'> & { readonly sessionId?: string } = {}) {
  const sessionId = (options.sessionId ?? crypto.randomUUID()).slice(0, 96);
  const recorder = new ObservabilityRecorder({ ...options, sessionId });
  const operations = createOperationFactory(recorder, sessionId);
  const context = { recordKind: 'event' as const, subsystem: 'application', component: 'session', origin: 'system' as const, priority: 'critical' as const };
  recorder.record({ ...context, name: 'session.started' });
  let ended = false;
  return Object.freeze({
    sessionId, recorder,
    beginOperation(input: OperationInput) { return ended ? undefined : operations.begin(input); },
    checkpoint(name: string) { return !ended && recorder.record({ ...context, name: 'session.checkpoint', metadata: { checkpoint: name } }) !== undefined; },
    end() {
      if (ended) return false;
      ended = true;
      recorder.record({ ...context, name: 'session.ended', outcome: 'success', reason: 'confirmed-normal-end' });
      return true;
    },
  });
}
