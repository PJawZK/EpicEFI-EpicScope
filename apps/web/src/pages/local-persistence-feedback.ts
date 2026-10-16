import type { Origin } from '../observability/record';
import type { ObservabilityRecorder } from '../observability/recorder';
import '../styles/local-persistence-feedback.css';

/** Feedback belongs to this manager; retry persists its storage module's latest session cache. */
export function createLocalPersistenceFeedback(host: HTMLElement, key: string, retry: () => boolean, recorder?: ObservabilityRecorder) {
  const element = document.createElement('div');
  element.className = 'local-persistence-feedback';
  element.dataset.persistence = key;
  element.hidden = true;
  const message = document.createElement('span');
  message.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Retry saving';
  button.hidden = true;
  element.append(message, button);
  host.append(element);

  const show = (persisted: boolean, success: string, failure: string): void => {
    element.hidden = false;
    element.dataset.state = persisted ? 'saved' : 'error';
    message.textContent = persisted ? success : failure;
    button.hidden = persisted;
  };
  const record = (persisted: boolean, action: string, origin: Origin = 'system') => recorder?.record({ recordKind: 'event', subsystem: 'persistence', component: key, name: 'persistence.result', origin, severity: persisted ? 'info' : 'warning', metadata: { action, persisted } });
  let failureMessage = '';
  button.addEventListener('click', (event) => { const persisted = retry(); record(persisted, 'retry', event.isTrusted ? 'user' : 'programmatic'); show(persisted, 'Current session changes saved locally.', failureMessage); });

  return {
    report(persisted: boolean, action: 'save' | 'delete'): void {
      record(persisted, action);
      failureMessage = action === 'save'
        ? 'Could not save locally. Changes are available for this session only. Retry before reloading.'
        : 'Could not save the deletion locally. Removed for this session only; the item may return after reload.';
      show(persisted, action === 'save' ? 'Saved locally.' : 'Deletion saved locally.', failureMessage);
    },
  };
}
