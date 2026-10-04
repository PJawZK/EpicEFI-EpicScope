import type { ChannelDefinition } from '../../../../core/log-model/log-types';
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
  open(): void;
  close(): void;
}

interface ConditionDraft {
  id: number;
  channelId: string;
  operator: NumericQualificationOperator;
  value: string;
}

function formatDurationMs(durationMs: number): string {
  const safe = Math.max(0, durationMs);
  if (safe < 1_000) return `${safe.toFixed(0)} ms`;
  if (safe < 60_000) return `${(safe / 1_000).toFixed(3)} s`;
  return `${(safe / 60_000).toFixed(2)} min`;
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
      <div class="range-qualification-actions">
        <button type="button" class="range-qualification-add">＋ Condition</button>
        <span class="grow"></span>
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
    </form>
  `;

  const closeButton = dialog.querySelector<HTMLButtonElement>('.range-qualification-close');
  const rangeText = dialog.querySelector<HTMLElement>('.range-qualification-range');
  const referenceSelect = dialog.querySelector<HTMLSelectElement>('.range-qualification-reference');
  const conditionsHost = dialog.querySelector<HTMLElement>('.range-qualification-conditions');
  const addButton = dialog.querySelector<HTMLButtonElement>('.range-qualification-add');
  const runButton = dialog.querySelector<HTMLButtonElement>('.range-qualification-run');
  const status = dialog.querySelector<HTMLElement>('.range-qualification-status');
  const result = dialog.querySelector<HTMLElement>('.range-qualification-result');
  if (!closeButton || !rangeText || !referenceSelect || !conditionsHost || !addButton || !runButton || !status || !result) {
    throw new Error('Range qualification panel structure is incomplete.');
  }

  const resultField = (name: string): HTMLElement => {
    const element = result.querySelector<HTMLElement>(`[data-result="${name}"]`);
    if (!element) throw new Error(`Range qualification result field is missing: ${name}`);
    return element;
  };

  const resetResult = (): void => {
    result.hidden = true;
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
        resetResult();
      });
      operatorSelect.addEventListener('change', () => {
        draft.operator = operatorSelect.value as NumericQualificationOperator;
        resetResult();
      });
      valueInput.addEventListener('input', () => {
        draft.value = valueInput.value;
        resetResult();
      });
      removeButton.addEventListener('click', () => {
        conditions = conditions.filter((condition) => condition.id !== draft.id);
        renderConditions();
        resetResult();
      });
      conditionsHost.append(row);
    }
  };

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  referenceSelect.addEventListener('change', resetResult);

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
    resetResult();
  });

  runButton.addEventListener('click', () => {
    if (!evaluator || !referenceSelect.value) return;
    const parsedConditions: NumericQualificationCondition[] = [];
    for (const draft of conditions) {
      const value = Number(draft.value);
      if (!draft.channelId || !Number.isFinite(value)) {
        status.textContent = 'Every condition needs an active channel and a finite value.';
        result.hidden = true;
        return;
      }
      parsedConditions.push({
        channelId: draft.channelId,
        operator: draft.operator,
        value,
      });
    }

    const qualification = evaluator(referenceSelect.value, parsedConditions);
    if (!qualification) {
      status.textContent = 'Qualification is unavailable for the current active traces.';
      result.hidden = true;
      return;
    }

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
    runButton.disabled = channels.length === 0 || startMs === undefined || endMs === undefined || startMs === endMs;
    resetResult();
  };

  const setRange = (nextStartMs: number | undefined, nextEndMs: number | undefined): void => {
    startMs = nextStartMs;
    endMs = nextEndMs;
    const valid = startMs !== undefined && endMs !== undefined && startMs !== endMs;
    rangeText.textContent = valid
      ? `A/B span ${formatDurationMs(Math.abs(endMs - startMs))}`
      : 'Set A and B to define a range.';
    runButton.disabled = !valid || channels.length === 0;
    resetResult();
  };

  return {
    element: dialog,
    setChannels,
    setRange,
    setEvaluator: (nextEvaluator) => { evaluator = nextEvaluator; },
    open: () => {
      if (!dialog.open) dialog.showModal();
    },
    close: () => dialog.close(),
  };
}
