import type { ObservabilityRecorder } from './recorder';
import type { Outcome, RecordInput } from './record';

export type OperationInput = Omit<RecordInput, 'recordKind' | 'priority' | 'operationId' | 'parentOperationId' | 'outcome' | 'durationMs'>;
export interface Operation {
  readonly id: string;
  readonly outcome: Outcome | undefined;
  child(input: OperationInput): Operation | undefined;
  finish(outcome: Outcome, reason?: string): boolean;
  staleCompletion(reason?: string): boolean;
}

/** Correlation is explicit; no implicit current-operation slot crosses async work. */
export function createOperationFactory(recorder: ObservabilityRecorder, sessionId: string) {
  let counter = 0;
  const begin = (input: OperationInput, parentOperationId?: string): Operation => {
    const id = `${sessionId}:op:${++counter}`;
    const name = input.name.slice(0, 80);
    const start = recorder.record({ ...input, operationId: id,
      ...(parentOperationId === undefined ? {} : { parentOperationId }),
      priority: 'critical', recordKind: 'event', name: `${name}.started`,
    });
    // Handles borrow only the recorder's bounded copy, never the producer payload.
    const ownerInput = { ...(start ?? { subsystem: 'observability', component: 'operation', origin: 'system' as const }), name };
    const terminalContext = { ...ownerInput, operationId: id,
      ...(parentOperationId === undefined ? {} : { parentOperationId }),
      priority: 'critical' as const, recordKind: 'event' as const,
    };
    let terminal: Outcome | undefined;
    return Object.freeze({
      id,
      get outcome() { return terminal; },
      child(child: OperationInput) { return terminal === undefined ? begin({ ...ownerInput, ...child }, id) : undefined; },
      finish(outcome: Outcome, reason?: string) {
        if (terminal !== undefined || !['success', 'failure', 'cancelled', 'superseded', 'stale'].includes(outcome)) return false;
        terminal = outcome;
        const now = recorder.time();
        recorder.record({ ...terminalContext, name: `${name}.completed`, outcome,
          ...(start === undefined || now === undefined ? {} : { durationMs: Math.max(0, now - start.monotonicTime) }),
          ...(reason === undefined ? {} : { reason }),
        });
        return true;
      },
      staleCompletion(reason?: string) {
        if (terminal === undefined) return false;
        recorder.record({ ...terminalContext, name: 'async.completion.stale', origin: 'async', outcome: 'stale', ...(reason === undefined ? {} : { reason }) });
        return true;
      },
    });
  };
  return { begin };
}
