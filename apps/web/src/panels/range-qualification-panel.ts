import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type {
  NumericEventOptions,
  NumericEventResult,
} from '../../../../core/analysis/events';
import type {
  NumericQualificationCondition,
  NumericQualificationOperator,
  NumericQualificationResult,
} from '../../../../core/analysis/sample-qualification';

export interface RangeQualificationPanelController {
  readonly element: HTMLDialogElement;
  setChannels(channels: readonly ChannelDefinition[]): void;
  setRange(startMs: number | undefined, endMs: number | undefined): void;
  setEvaluator(
    evaluator: (
      referenceChannelId: string,
      conditions: readonly NumericQualificationCondition[],
    ) => NumericQualificationResult | undefined,
  ): void;
  setEventEvaluator(
    evaluator: (
      referenceChannelId: string,
      conditions: readonly NumericQualificationCondition[],
      options: NumericEventOptions,
    ) => NumericEventResult | undefined,
  ): void;
  open(): void;
  close(): void;
}

interface ConditionDraft {
  id: number;
  channelId: string;
  operator: NumericQualificationOperator;
  value: string;
}

const MAX_RENDERED_EVENTS = 200;

function formatDurationMs(durationMs: number): string {
  const safe = Math.max(0, durationMs);
  if (safe < 1_000) return `${safe.toFixed(0)} ms`;
  if (safe < 60_000) return `${(safe / 1_000).toFixed(3)} s`;
  return `${(safe / 60_000).toFixed(2)} min`;
}

function formatTimeMs(timeMs: number): string {
  const safe = Math.max(0, timeMs);
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const milliseconds = Math.floor(safe % 1_000);
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

export function createRangeQualificationPanel(): RangeQualificationPanelController {
  let channels: readonly ChannelDefinition[] = [];
  let channelMap = new Map<string, ChannelDefinition>();
  let startMs: number | undefined;
  let endMs: number | undefined;
  let conditionCounter = 1;
  let conditions: ConditionDraft[] = [{ id: conditionCounter, channelId: '', operator: 'gte', value: '' }];
  let evaluator:
    | ((referenceChannelId: string, conditions: readonly NumericQualificationCondition[]) => NumericQualificationResult | undefined)
    | undefined;
  let eventEvaluator:
    | ((
        referenceChannelId: string,
        conditions: readonly NumericQualificationCondition[],
        options: NumericEventOptions,
      ) => NumericEventResult | undefined)
    | undefined;

  const dialog = document.createElement('dialog');
  dialog.className = 'range-qualification-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="range-qualification-panel">
      <header class="range-qualification-head">
        <div>
          <strong>Analyze selected range</strong>
          <small class="range-qualification-range">Set A and B to define a range.</small>
        </div>
        <button type="button" class="range-qualification-close" aria-label="Close range analysis">×</button>
      </header>
      <div class="range-qualification-grid">
        <label class="range-qualification-field">
          <span>Reference channel</span>
          <select class="range-qualification-reference"></select>
        </label>
        <div class="range-qualification-note">
          Conditions use active decoded graph traces only. All conditions are combined with AND.
        </div>
      </div>
      <div class="range-qualification-conditions"></div>
      <details class="range-events-options">
        <summary>Event options</summary>
        <div class="range-events-option-grid">
          <label class="range-qualification-field">
            <span>Minimum duration</span>
            <div class="range-events-input-unit"><input class="range-events-min-duration" type="number" min="0" step="any" value="0" inputmode="decimal" /><em>ms</em></div>
          </label>
          <label class="range-qualification-field">
            <span>Merge gap ≤</span>
            <div class="range-events-input-unit"><input class="range-events-merge-gap" type="number" min="0" step="any" value="0" inputmode="decimal" /><em>ms</em></div>
          </label>
          <div class="range-qualification-note">
            Events are contiguous qualifying sample runs. Merge gap bridges short non-qualifying gaps; minimum duration is applied afterwards.
          </div>
        </div>
      </details>
      <div class="range-qualification-actions">
        <button type="button" class="range-qualification-add">＋ Condition</button>
        <span class="grow"></span>
        <button type="button" class="range-events-run">Find events</button>
        <button type="button" class="range-qualification-run">Apply qualification</button>
      </div>
      <div class="range-qualification-status">Choose a reference channel and optional conditions.</div>
      <div class="range-qualification-result" hidden>
        <div><span>Input</span><strong data-result="input">0</strong></div>
        <div><span>Eligible</span><strong data-result="eligible">0</strong></div>
        <div><span>Value rejected</span><strong data-result="rejected">0</strong></div>
        <div><span>Invalid</span><strong data-result="invalid">0</strong></div>
        <div><span>Unavailable</span><strong data-result="unavailable">0</strong></div>
        <div><span>Coverage</span><strong data-result="coverage">—</strong></div>
      </div>
      <section class="range-events-result" hidden aria-label="Events result">
        <div class="range-events-summary">
          <div><span>Events</span><strong data-event-result="events">0</strong></div>
          <div><span>Raw runs</span><strong data-event-result="raw">0</strong></div>
          <div><span>After merge</span><strong data-event-result="merged">0</strong></div>
          <div><span>Eligible samples</span><strong data-event-result="eligible">0</strong></div>
          <div><span>Invalid</span><strong data-event-result="invalid">0</strong></div>
          <div><span>Unavailable</span><strong data-event-result="unavailable">0</strong></div>
          <div><span>Rejected</span><strong data-event-result="rejected">0</strong></div>
          <div><span>Coverage</span><strong data-event-result="coverage">—</strong></div>
        </div>
        <div class="range-events-table-wrap">
          <table class="range-events-table">
            <thead>
              <tr><th>#</th><th>Type</th><th>Start</th><th>End</th><th>Duration</th><th>Qualifying</th><th>Bridged</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <small class="range-events-render-status"></small>
      </section>
    </form>
  `;

  const closeButton = dialog.querySelector<HTMLButtonElement>('.range-qualification-close');
  const rangeText = dialog.querySelector<HTMLElement>('.range-qualification-range');
  const referenceSelect = dialog.querySelector<HTMLSelectElement>('.range-qualification-reference');
  const conditionsHost = dialog.querySelector<HTMLElement>('.range-qualification-conditions');
  const addButton = dialog.querySelector<HTMLButtonElement>('.range-qualification-add');
  const runButton = dialog.querySelector<HTMLButtonElement>('.range-qualification-run');
  const eventRunButton = dialog.querySelector<HTMLButtonElement>('.range-events-run');
  const minimumDurationInput = dialog.querySelector<HTMLInputElement>('.range-events-min-duration');
  const mergeGapInput = dialog.querySelector<HTMLInputElement>('.range-events-merge-gap');
  const status = dialog.querySelector<HTMLElement>('.range-qualification-status');
  const result = dialog.querySelector<HTMLElement>('.range-qualification-result');
  const eventResult = dialog.querySelector<HTMLElement>('.range-events-result');
  const eventTableBody = dialog.querySelector<HTMLTableSectionElement>('.range-events-table tbody');
  const eventRenderStatus = dialog.querySelector<HTMLElement>('.range-events-render-status');
  if (
    !closeButton || !rangeText || !referenceSelect || !conditionsHost || !addButton || !runButton
    || !eventRunButton || !minimumDurationInput || !mergeGapInput || !status || !result
    || !eventResult || !eventTableBody || !eventRenderStatus
  ) {
    throw new Error('Range qualification panel structure is incomplete.');
  }

  const resultField = (name: string): HTMLElement => {
    const element = result.querySelector<HTMLElement>(`[data-result="${name}"]`);
    if (!element) throw new Error(`Range qualification result field is missing: ${name}`);
    return element;
  };

  const eventField = (name: string): HTMLElement => {
    const element = eventResult.querySelector<HTMLElement>(`[data-event-result="${name}"]`);
    if (!element) throw new Error(`Range event result field is missing: ${name}`);
    return element;
  };

  const resetResults = (): void => {
    result.hidden = true;
    eventResult.hidden = true;
    eventTableBody.replaceChildren();
    eventRenderStatus.textContent = '';
    status.textContent = 'Choose a reference channel and optional conditions.';
  };

  const fillChannelSelect = (select: HTMLSelectElement, selectedId = ''): void => {
    select.replaceChildren();
    for (const channel of channels) {
      select.add(new Option(channel.displayName || channel.sourceName, channel.id));
    }
    if (selectedId && channels.some((channel) => channel.id === selectedId)) select.value = selectedId;
  };

  const renderConditions = (): void => {
    conditionsHost.replaceChildren();
    for (const draft of conditions) {
      const row = document.createElement('div');
      row.className = 'range-qualification-condition';
      row.dataset.conditionId = String(draft.id);
      row.innerHTML = `
        <select class="range-qualification-condition-channel" aria-label="Condition channel"></select>
        <select class="range-qualification-condition-operator" aria-label="Condition operator">
          <option value="gte">≥</option>
          <option value="gt">&gt;</option>
          <option value="lte">≤</option>
          <option value="lt">&lt;</option>
          <option value="eq">=</option>
        </select>
        <input class="range-qualification-condition-value" type="number" step="any" inputmode="decimal" aria-label="Condition value" />
        <button type="button" class="range-qualification-remove" title="Remove condition" aria-label="Remove condition">×</button>
      `;
      const channelSelect = row.querySelector<HTMLSelectElement>('.range-qualification-condition-channel');
      const operatorSelect = row.querySelector<HTMLSelectElement>('.range-qualification-condition-operator');
      const valueInput = row.querySelector<HTMLInputElement>('.range-qualification-condition-value');
      const removeButton = row.querySelector<HTMLButtonElement>('.range-qualification-remove');
      if (!channelSelect || !operatorSelect || !valueInput || !removeButton) continue;
      fillChannelSelect(channelSelect, draft.channelId);
      if (!draft.channelId && channels[0]) {
        draft.channelId = channels[0].id;
        channelSelect.value = draft.channelId;
      }
      operatorSelect.value = draft.operator;
      valueInput.value = draft.value;
      channelSelect.addEventListener('change', () => {
        draft.channelId = channelSelect.value;
        resetResults();
      });
      operatorSelect.addEventListener('change', () => {
        draft.operator = operatorSelect.value as NumericQualificationOperator;
        resetResults();
      });
      valueInput.addEventListener('input', () => {
        draft.value = valueInput.value;
        resetResults();
      });
      removeButton.addEventListener('click', () => {
        conditions = conditions.filter((condition) => condition.id !== draft.id);
        renderConditions();
        resetResults();
      });
      conditionsHost.append(row);
    }
  };

  const parseConditions = (): readonly NumericQualificationCondition[] | undefined => {
    const parsedConditions: NumericQualificationCondition[] = [];
    for (const draft of conditions) {
      const value = Number(draft.value);
      if (!draft.channelId || !Number.isFinite(value)) {
        status.textContent = 'Every condition needs an active channel and a finite value.';
        result.hidden = true;
        eventResult.hidden = true;
        return undefined;
      }
      parsedConditions.push({
        channelId: draft.channelId,
        operator: draft.operator,
        value,
      });
    }
    return parsedConditions;
  };

  const parseEventOptions = (): NumericEventOptions | undefined => {
    const minimumDurationMs = Number(minimumDurationInput.value);
    const maximumMergeGapMs = Number(mergeGapInput.value);
    if (!Number.isFinite(minimumDurationMs) || minimumDurationMs < 0) {
      status.textContent = 'Minimum event duration must be a finite non-negative number.';
      return undefined;
    }
    if (!Number.isFinite(maximumMergeGapMs) || maximumMergeGapMs < 0) {
      status.textContent = 'Event merge gap must be a finite non-negative number.';
      return undefined;
    }
    return { minimumDurationMs, maximumMergeGapMs };
  };

  const renderEvents = (eventsResult: NumericEventResult): void => {
    eventField('events').textContent = eventsResult.retainedEventCount.toLocaleString();
    eventField('raw').textContent = eventsResult.rawEventCount.toLocaleString();
    eventField('merged').textContent = eventsResult.mergedEventCount.toLocaleString();
    eventField('eligible').textContent = eventsResult.qualification.eligibleSampleCount.toLocaleString();
    eventField('invalid').textContent = eventsResult.qualification.invalidSampleCount.toLocaleString();
    eventField('unavailable').textContent = eventsResult.qualification.unavailableSampleCount.toLocaleString();
    eventField('rejected').textContent = eventsResult.qualification.valueRejectedSampleCount.toLocaleString();
    eventField('coverage').textContent = eventsResult.complete ? 'Complete' : 'Partial decoded';

    const rows = eventsResult.events.slice(0, MAX_RENDERED_EVENTS).map((event, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${event.kind === 'point' ? 'Point' : 'Interval'}</td>
        <td>${formatTimeMs(event.startTimeMs)}</td>
        <td>${formatTimeMs(event.endTimeMs)}</td>
        <td>${formatDurationMs(event.durationMs)}</td>
        <td>${event.qualifyingSampleCount.toLocaleString()}</td>
        <td>${event.bridgedGapSampleCount.toLocaleString()}</td>
      `;
      return row;
    });
    eventTableBody.replaceChildren(...rows);
    const rendered = rows.length;
    eventRenderStatus.textContent = rendered < eventsResult.retainedEventCount
      ? `Showing first ${rendered.toLocaleString()} of ${eventsResult.retainedEventCount.toLocaleString()} events. Analysis count is unchanged.`
      : `${rendered.toLocaleString()} event${rendered === 1 ? '' : 's'} shown.`;
    eventResult.hidden = false;
  };

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  referenceSelect.addEventListener('change', resetResults);
  minimumDurationInput.addEventListener('input', resetResults);
  mergeGapInput.addEventListener('input', resetResults);

  addButton.addEventListener('click', () => {
    if (conditions.length >= 6) {
      status.textContent = 'Up to 6 AND conditions are supported in this first pass.';
      return;
    }
    conditionCounter += 1;
    conditions.push({
      id: conditionCounter,
      channelId: channels[0]?.id ?? '',
      operator: 'gte',
      value: '',
    });
    renderConditions();
    resetResults();
  });

  runButton.addEventListener('click', () => {
    if (!evaluator || !referenceSelect.value) return;
    const parsedConditions = parseConditions();
    if (!parsedConditions) return;

    const qualification = evaluator(referenceSelect.value, parsedConditions);
    if (!qualification) {
      status.textContent = 'Qualification is unavailable for the current active traces.';
      result.hidden = true;
      return;
    }

    eventResult.hidden = true;
    resultField('input').textContent = qualification.inputSampleCount.toLocaleString();
    resultField('eligible').textContent = qualification.eligibleSampleCount.toLocaleString();
    resultField('rejected').textContent = qualification.valueRejectedSampleCount.toLocaleString();
    resultField('invalid').textContent = qualification.invalidSampleCount.toLocaleString();
    resultField('unavailable').textContent = qualification.unavailableSampleCount.toLocaleString();
    resultField('coverage').textContent = qualification.complete ? 'Complete' : 'Partial decoded';
    result.hidden = false;
    const percent = qualification.inputSampleCount > 0
      ? (qualification.eligibleSampleCount / qualification.inputSampleCount) * 100
      : 0;
    status.textContent = `${qualification.eligibleSampleCount.toLocaleString()} of ${qualification.inputSampleCount.toLocaleString()} samples eligible (${percent.toFixed(1)}%).`;
  });

  eventRunButton.addEventListener('click', () => {
    if (!eventEvaluator || !referenceSelect.value) return;
    const parsedConditions = parseConditions();
    if (!parsedConditions) return;
    const eventOptions = parseEventOptions();
    if (!eventOptions) return;

    const eventsResult = eventEvaluator(referenceSelect.value, parsedConditions, eventOptions);
    if (!eventsResult) {
      status.textContent = 'Events are unavailable for the current active traces.';
      eventResult.hidden = true;
      return;
    }

    result.hidden = true;
    renderEvents(eventsResult);
    const shown = Math.min(eventsResult.retainedEventCount, MAX_RENDERED_EVENTS);
    status.textContent = eventsResult.retainedEventCount === 0
      ? `No retained events. ${eventsResult.qualification.eligibleSampleCount.toLocaleString()} samples qualified before event timing rules.`
      : `${eventsResult.retainedEventCount.toLocaleString()} event${eventsResult.retainedEventCount === 1 ? '' : 's'} found${shown < eventsResult.retainedEventCount ? ` · showing first ${shown.toLocaleString()}` : ''}.`;
  });

  const setChannels = (nextChannels: readonly ChannelDefinition[]): void => {
    const previousReference = referenceSelect.value;
    channels = nextChannels;
    channelMap = new Map(channels.map((channel) => [channel.id, channel]));
    fillChannelSelect(referenceSelect, previousReference);
    conditions = conditions.map((draft) => ({
      ...draft,
      channelId: channelMap.has(draft.channelId) ? draft.channelId : channels[0]?.id ?? '',
    }));
    renderConditions();
    const disabled = channels.length === 0 || startMs === undefined || endMs === undefined || startMs === endMs;
    runButton.disabled = disabled;
    eventRunButton.disabled = disabled;
    resetResults();
  };

  const setRange = (nextStartMs: number | undefined, nextEndMs: number | undefined): void => {
    startMs = nextStartMs;
    endMs = nextEndMs;
    const valid = nextStartMs !== undefined && nextEndMs !== undefined && nextStartMs !== nextEndMs;
    rangeText.textContent = valid
      ? `A/B span ${formatDurationMs(Math.abs(nextEndMs - nextStartMs))}`
      : 'Set A and B to define a range.';
    runButton.disabled = !valid || channels.length === 0;
    eventRunButton.disabled = !valid || channels.length === 0;
    resetResults();
  };

  return {
    element: dialog,
    setChannels,
    setRange,
    setEvaluator: (nextEvaluator) => { evaluator = nextEvaluator; },
    setEventEvaluator: (nextEvaluator) => { eventEvaluator = nextEvaluator; },
    open: () => {
      if (!dialog.open) dialog.showModal();
    },
    close: () => dialog.close(),
  };
}
