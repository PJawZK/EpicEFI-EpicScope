import type { ChannelDefinition, NumericChannelDataSource } from '../../../../core/log-model/log-types';
import {
  findSteppedSearchResultIndex,
  searchChannelValues,
  type ChannelConstraintOperator,
  type ChannelValueSearchMode,
  type ChannelValueSearchResult,
} from '../../../../core/analysis/channel-value-search';

export interface ChannelValueSearchPanelController {
  readonly element: HTMLElement;
  setLog(source: NumericChannelDataSource): void;
  setActiveChannels(channels: readonly ChannelDefinition[]): void;
  clear(): void;
  onJump(listener: (timeMs: number) => void): void;
}

function formatValue(channel: ChannelDefinition | undefined, value: number): string {
  const precision = Math.min(6, Math.max(0, channel?.precision ?? 2));
  return `${value.toFixed(precision)}${channel?.unit ? ` ${channel.unit}` : ''}`;
}

function formatTime(timeMs: number): string {
  const safe = Math.max(0, timeMs);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const milliseconds = Math.floor(safe % 1_000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

export function createChannelValueSearchPanel(): ChannelValueSearchPanelController {
  let channels: readonly ChannelDefinition[] = [];
  let channelMap = new Map<string, ChannelDefinition>();
  let source: NumericChannelDataSource | undefined;
  let results: readonly ChannelValueSearchResult[] = [];
  let resultIndex = -1;
  let jumpListener: ((timeMs: number) => void) | undefined;

  const root = document.createElement('div');
  root.className = 'value-search-wrap';
  root.innerHTML = `
    <button type="button" class="value-search-trigger" disabled aria-haspopup="dialog" aria-expanded="false" title="Search for channel values">⌕ Value search</button>
    <div class="value-search-popover" role="dialog" aria-label="Channel value search" hidden>
      <div class="value-search-head">
        <strong>Channel value search</strong>
        <button type="button" class="value-search-close" aria-label="Close value search">×</button>
      </div>
      <div class="value-search-grid">
        <label class="value-search-field value-search-field--wide">
          <span>Channel</span>
          <select class="value-search-channel"></select>
        </label>
        <label class="value-search-field">
          <span>Find</span>
          <select class="value-search-mode">
            <option value="max">Maximum</option>
            <option value="min">Minimum</option>
            <option value="closest">Closest to value</option>
          </select>
        </label>
        <label class="value-search-field value-search-target-field" hidden>
          <span>Target</span>
          <input class="value-search-target" type="number" step="any" inputmode="decimal" />
        </label>
      </div>
      <label class="value-search-constraint-toggle">
        <input type="checkbox" class="value-search-constraint-enabled" />
        <span>Limit by another channel</span>
      </label>
      <div class="value-search-constraint" hidden>
        <select class="value-search-constraint-channel" aria-label="Constraint channel"></select>
        <select class="value-search-constraint-operator" aria-label="Constraint operator">
          <option value="gte">≥</option>
          <option value="gt">&gt;</option>
          <option value="lte">≤</option>
          <option value="lt">&lt;</option>
          <option value="eq">=</option>
        </select>
        <input class="value-search-constraint-value" type="number" step="any" inputmode="decimal" aria-label="Constraint value" />
      </div>
      <div class="value-search-actions">
        <button type="button" class="value-search-run">Search</button>
        <span class="value-search-status">Choose a channel and search mode.</span>
      </div>
      <label class="value-search-step">
        <span>Next target step</span>
        <input class="value-search-step-input" type="number" min="0" step="any" inputmode="decimal" value="0.00" />
      </label>
      <div class="value-search-result" hidden>
        <div class="value-search-result-main"></div>
        <div class="value-search-result-sub"></div>
        <div class="value-search-result-nav">
          <button type="button" class="value-search-prev">◀ Previous</button>
          <span class="value-search-position">0 / 0</span>
          <button type="button" class="value-search-next">Next ▶</button>
        </div>
      </div>
    </div>
  `;

  const trigger = root.querySelector<HTMLButtonElement>('.value-search-trigger');
  const popover = root.querySelector<HTMLElement>('.value-search-popover');
  const closeButton = root.querySelector<HTMLButtonElement>('.value-search-close');
  const channelSelect = root.querySelector<HTMLSelectElement>('.value-search-channel');
  const modeSelect = root.querySelector<HTMLSelectElement>('.value-search-mode');
  const targetField = root.querySelector<HTMLElement>('.value-search-target-field');
  const targetInput = root.querySelector<HTMLInputElement>('.value-search-target');
  const constraintEnabled = root.querySelector<HTMLInputElement>('.value-search-constraint-enabled');
  const constraintRow = root.querySelector<HTMLElement>('.value-search-constraint');
  const constraintChannel = root.querySelector<HTMLSelectElement>('.value-search-constraint-channel');
  const constraintOperator = root.querySelector<HTMLSelectElement>('.value-search-constraint-operator');
  const constraintValue = root.querySelector<HTMLInputElement>('.value-search-constraint-value');
  const runButton = root.querySelector<HTMLButtonElement>('.value-search-run');
  const status = root.querySelector<HTMLElement>('.value-search-status');
  const stepInput = root.querySelector<HTMLInputElement>('.value-search-step-input');
  const result = root.querySelector<HTMLElement>('.value-search-result');
  const resultMain = root.querySelector<HTMLElement>('.value-search-result-main');
  const resultSub = root.querySelector<HTMLElement>('.value-search-result-sub');
  const position = root.querySelector<HTMLElement>('.value-search-position');
  const previousButton = root.querySelector<HTMLButtonElement>('.value-search-prev');
  const nextButton = root.querySelector<HTMLButtonElement>('.value-search-next');

  if (!trigger || !popover || !closeButton || !channelSelect || !modeSelect || !targetField || !targetInput
    || !constraintEnabled || !constraintRow || !constraintChannel || !constraintOperator || !constraintValue
    || !runButton || !status || !stepInput || !result || !resultMain || !resultSub || !position || !previousButton || !nextButton) {
    throw new Error('Channel value search panel structure is incomplete.');
  }

  const close = (): void => {
    popover.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  const minimumStep = (): number => {
    const parsed = Number(stepInput.value);
    return Number.isFinite(parsed) ? Math.max(0, Math.abs(parsed)) : 0;
  };

  const renderResult = (jump = true): void => {
    if (resultIndex < 0 || resultIndex >= results.length) {
      result.hidden = true;
      return;
    }

    const item = results[resultIndex];
    if (!item) return;
    const channel = channelMap.get(channelSelect.value);
    result.hidden = false;
    resultMain.textContent = `#${item.rank} · ${channel?.sourceName ?? channelSelect.value} = ${formatValue(channel, item.value)}`;
    const constraintText = item.constraintValue === undefined || !constraintEnabled.checked
      ? ''
      : ` · limit channel = ${formatValue(channelMap.get(constraintChannel.value), item.constraintValue)}`;
    resultSub.textContent = `Time ${formatTime(item.timeMs)} · sample ${item.sampleIndex.toLocaleString()}${constraintText}`;
    position.textContent = `${resultIndex + 1} / ${results.length}`;
    previousButton.disabled = findSteppedSearchResultIndex(results, resultIndex, -1, minimumStep()) === undefined;
    nextButton.disabled = findSteppedSearchResultIndex(results, resultIndex, 1, minimumStep()) === undefined;
    if (jump) jumpListener?.(item.timeMs);
  };

  const resetResults = (): void => {
    results = [];
    resultIndex = -1;
    result.hidden = true;
    position.textContent = '0 / 0';
  };

  const fillSelect = (select: HTMLSelectElement, nextChannels: readonly ChannelDefinition[]): void => {
    const previousValue = select.value;
    select.replaceChildren();
    for (const channel of nextChannels) select.add(new Option(channel.sourceName, channel.id));
    if (nextChannels.some((channel) => channel.id === previousValue)) select.value = previousValue;
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const nextOpen = popover.hidden;
    popover.hidden = !nextOpen;
    trigger.setAttribute('aria-expanded', String(nextOpen));
  });
  popover.addEventListener('click', (event) => event.stopPropagation());
  closeButton.addEventListener('click', close);
  document.addEventListener('click', close);

  modeSelect.addEventListener('change', () => {
    targetField.hidden = modeSelect.value !== 'closest';
    resetResults();
  });
  constraintEnabled.addEventListener('change', () => {
    constraintRow.hidden = !constraintEnabled.checked;
    resetResults();
  });
  channelSelect.addEventListener('change', resetResults);
  constraintChannel.addEventListener('change', resetResults);
  constraintOperator.addEventListener('change', resetResults);
  targetInput.addEventListener('input', resetResults);
  constraintValue.addEventListener('input', resetResults);
  stepInput.addEventListener('input', () => {
    if (resultIndex >= 0) renderResult(false);
  });

  runButton.addEventListener('click', () => {
    if (!source || !channelSelect.value) return;

    const mode = modeSelect.value as ChannelValueSearchMode;
    const target = mode === 'closest' ? Number(targetInput.value) : undefined;
    if (mode === 'closest' && !Number.isFinite(target)) {
      status.textContent = 'Enter a finite target value.';
      return;
    }

    let constraint;
    if (constraintEnabled.checked) {
      const value = Number(constraintValue.value);
      if (!constraintChannel.value || !Number.isFinite(value)) {
        status.textContent = 'Choose a limit channel and enter a finite limit value.';
        return;
      }
      constraint = {
        channelId: constraintChannel.value,
        operator: constraintOperator.value as ChannelConstraintOperator,
        value,
      };
    }

    runButton.disabled = true;
    status.textContent = 'Searching local log…';
    resetResults();

    void searchChannelValues(source, {
      channelId: channelSelect.value,
      mode,
      ...(target === undefined ? {} : { targetValue: target }),
      ...(constraint === undefined ? {} : { constraint }),
      resultLimit: 100,
    }).then((nextResults) => {
      results = nextResults;
      if (results.length === 0) {
        status.textContent = 'No valid samples matched this search.';
        return;
      }
      resultIndex = 0;
      status.textContent = `${results.length} ranked result${results.length === 1 ? '' : 's'} available.`;
      renderResult();
    }).catch((error: unknown) => {
      status.textContent = error instanceof Error ? error.message : 'Value search failed.';
    }).finally(() => {
      runButton.disabled = false;
    });
  });

  previousButton.addEventListener('click', () => {
    const nextIndex = findSteppedSearchResultIndex(results, resultIndex, -1, minimumStep());
    if (nextIndex !== undefined) {
      resultIndex = nextIndex;
      renderResult();
    }
  });
  nextButton.addEventListener('click', () => {
    const nextIndex = findSteppedSearchResultIndex(results, resultIndex, 1, minimumStep());
    if (nextIndex !== undefined) {
      resultIndex = nextIndex;
      renderResult();
    }
  });

  const setLog = (nextSource: NumericChannelDataSource): void => {
    source = nextSource;
    channels = [];
    channelMap.clear();
    fillSelect(channelSelect, channels);
    fillSelect(constraintChannel, channels);
    trigger.disabled = true;
    status.textContent = 'Add a graph trace to search its values.';
    targetInput.value = '';
    constraintValue.value = '';
    stepInput.value = '0.00';
    constraintEnabled.checked = false;
    constraintRow.hidden = true;
    modeSelect.value = 'max';
    targetField.hidden = true;
    resetResults();
  };

  const setActiveChannels = (nextChannels: readonly ChannelDefinition[]): void => {
    channels = nextChannels;
    channelMap = new Map(channels.map((channel) => [channel.id, channel]));
    fillSelect(channelSelect, channels);
    fillSelect(constraintChannel, channels);
    trigger.disabled = channels.length === 0;
    status.textContent = channels.length === 0
      ? 'Add a graph trace to search its values.'
      : 'Choose an active channel and search mode.';
    resetResults();
    if (channels.length === 0) close();
  };

  const clear = (): void => {
    channels = [];
    channelMap.clear();
    source = undefined;
    fillSelect(channelSelect, channels);
    fillSelect(constraintChannel, channels);
    trigger.disabled = true;
    close();
    resetResults();
  };

  clear();

  return {
    element: root,
    setLog,
    setActiveChannels,
    clear,
    onJump: (listener) => { jumpListener = listener; },
  };
}
