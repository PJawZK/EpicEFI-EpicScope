import { compileCalculatedField, evaluateCalculatedFieldRange } from '../../../../core/analysis/calculated-field';
import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';
import type { HistogramPageContext } from './histogram-page';
import {
  createHistogramLocalId,
  loadHistogramCalculatedFields,
  saveHistogramCalculatedFields,
  type HistogramCalculatedFieldDefinition,
} from '../state/histogram-table-storage';

export interface HistogramMathChannelsController {
  readonly element: HTMLElement;
  setContext(context: HistogramPageContext): void;
  refresh(): void;
}

interface ChannelSearchText {
  readonly label: string;
  readonly sourceName: string;
  readonly id: string;
}

const channelSearchTextCache = new WeakMap<ChannelDefinition, ChannelSearchText>();
const sourceButtonCache = new WeakMap<ChannelDefinition, HTMLButtonElement>();

function channelLabel(channel: ChannelDefinition): string {
  return channel.displayName || channel.sourceName;
}

function searchableChannelText(channel: ChannelDefinition): ChannelSearchText {
  const cached = channelSearchTextCache.get(channel);
  if (cached) return cached;
  const text = {
    label: channelLabel(channel).toLocaleLowerCase(),
    sourceName: channel.sourceName.toLocaleLowerCase(),
    id: channel.id.toLocaleLowerCase(),
  };
  channelSearchTextCache.set(channel, text);
  return text;
}

function sourceButtonFor(channel: ChannelDefinition): HTMLButtonElement {
  const cached = sourceButtonCache.get(channel);
  if (cached) return cached;
  const label = channelLabel(channel);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'math-channel-source-chip';
  button.dataset.sourceLabel = label;
  const name = document.createElement('strong');
  name.textContent = label;
  const detail = document.createElement('small');
  detail.textContent = channel.unit ?? channel.sourceName;
  button.replaceChildren(name, detail);
  button.title = `Insert [${label}]`;
  sourceButtonCache.set(channel, button);
  return button;
}

function sameChannelCatalog(
  left: HistogramPageContext['channels'],
  right: HistogramPageContext['channels'],
): boolean {
  return left.length === right.length && left.every((channel, index) => channel === right[index]);
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(3).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function validValues(range: NumericChannelRange): number[] {
  const values: number[] = [];
  for (let index = 0; index < range.values.length; index += 1) {
    const value = range.values[index];
    if (range.validity[index] === 1 && value !== undefined && Number.isFinite(value)) values.push(value);
  }
  return values;
}

export function createHistogramMathChannelsView(): HistogramMathChannelsController {
  let context: HistogramPageContext = {
    traces: [],
    channels: [],
    loadTraces: async () => [],
    aTimeMs: undefined,
    bTimeMs: undefined,
  };
  let fields = loadHistogramCalculatedFields();
  let editingId = '';
  let previewGeneration = 0;

  const root = document.createElement('section');
  root.className = 'histogram-math-channels-view';
  root.hidden = true;
  root.innerHTML = `
    <aside class="math-channel-manager">
      <header><strong>Math Channels</strong><button type="button" class="math-channel-new">＋ New</button></header>
      <div class="math-channel-search-wrap"><input class="math-channel-search" type="search" placeholder="Search math channels…" /></div>
      <div class="math-channel-list"></div>
      <footer><span class="math-channel-count">0 math channels</span></footer>
    </aside>
    <main class="math-channel-editor">
      <header><div><strong class="math-channel-editor-title">New Math Channel</strong><small>Calculated channels can be selected in Table Generator axes, values and filters.</small></div></header>
      <div class="math-channel-editor-body">
        <section class="math-channel-form">
          <div class="math-channel-field-grid">
            <label><span>Name</span><input class="math-channel-name" type="text" placeholder="Rail Differential Pressure" /></label>
            <label><span>Unit</span><input class="math-channel-unit" type="text" placeholder="kPa" /></label>
          </div>
          <label class="math-channel-formula-field"><span>Formula</span><textarea class="math-channel-formula" spellcheck="false" placeholder="[Fuel Pressure] - [MAP]"></textarea></label>
          <div class="math-channel-helper-row" aria-label="Formula helpers">
            <button type="button" data-insert=" + ">＋</button><button type="button" data-insert=" - ">−</button><button type="button" data-insert=" * ">×</button><button type="button" data-insert=" / ">÷</button><button type="button" data-insert=" % ">%</button><button type="button" data-insert=" ^ ">xʸ</button>
            <button type="button" data-insert="abs()">abs()</button><button type="button" data-insert="min()">min()</button><button type="button" data-insert="max()">max()</button><button type="button" data-insert="clamp()">clamp()</button><button type="button" data-insert="sqrt()">sqrt()</button><button type="button" data-insert="pow()">pow()</button><button type="button" data-insert="round()">round()</button>
          </div>
          <p class="math-channel-help">Click a source channel below to insert a <strong>[Channel Name]</strong> reference. Examples: <code>[Fuel Pressure] - [MAP]</code> · <code>clamp([TPS], 0, 100)</code> · <code>[Lambda] * 14.1</code>.</p>
          <div class="math-channel-validation">Enter a name and formula to preview the result.</div>
          <div class="math-channel-actions"><button type="button" class="math-channel-save">Save channel</button><button type="button" class="math-channel-reset">Reset editor</button><span></span><button type="button" class="math-channel-delete" hidden>Delete channel</button></div>
        </section>
        <section class="math-channel-preview">
          <div class="math-channel-preview-stats">
            <div><span>Valid samples</span><strong data-math-stat="count">—</strong></div>
            <div><span>Minimum</span><strong data-math-stat="min">—</strong></div>
            <div><span>Maximum</span><strong data-math-stat="max">—</strong></div>
            <div><span>Average</span><strong data-math-stat="mean">—</strong></div>
          </div>
          <div class="math-channel-source-browser">
            <header><strong>Source channels</strong><input class="math-channel-source-search" type="search" placeholder="Search available log channels…" /></header>
            <div class="math-channel-source-list"></div>
          </div>
        </section>
      </div>
    </main>
  `;

  const list = root.querySelector<HTMLElement>('.math-channel-list');
  const search = root.querySelector<HTMLInputElement>('.math-channel-search');
  const count = root.querySelector<HTMLElement>('.math-channel-count');
  const title = root.querySelector<HTMLElement>('.math-channel-editor-title');
  const nameInput = root.querySelector<HTMLInputElement>('.math-channel-name');
  const unitInput = root.querySelector<HTMLInputElement>('.math-channel-unit');
  const formulaInput = root.querySelector<HTMLTextAreaElement>('.math-channel-formula');
  const validation = root.querySelector<HTMLElement>('.math-channel-validation');
  const newButton = root.querySelector<HTMLButtonElement>('.math-channel-new');
  const saveButton = root.querySelector<HTMLButtonElement>('.math-channel-save');
  const resetButton = root.querySelector<HTMLButtonElement>('.math-channel-reset');
  const deleteButton = root.querySelector<HTMLButtonElement>('.math-channel-delete');
  const sourceSearch = root.querySelector<HTMLInputElement>('.math-channel-source-search');
  const sourceList = root.querySelector<HTMLElement>('.math-channel-source-list');
  if (!list || !search || !count || !title || !nameInput || !unitInput || !formulaInput || !validation || !newButton || !saveButton || !resetButton || !deleteButton || !sourceSearch || !sourceList) {
    throw new Error('Math Channels page structure is incomplete.');
  }

  const stat = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-math-stat="${name}"]`);
    if (!node) throw new Error(`Math Channel preview stat is missing: ${name}`);
    return node;
  };

  const resolveReference = (reference: string): ChannelDefinition => {
    const normalized = reference.trim().toLocaleLowerCase();
    const matches = context.channels.filter((channel) =>
      channel.id === reference
      || channelLabel(channel).toLocaleLowerCase() === normalized
      || channel.sourceName.toLocaleLowerCase() === normalized,
    );
    if (matches.length === 0) throw new RangeError(`Channel not found: [${reference}]`);
    if (matches.length > 1) throw new RangeError(`Channel reference is ambiguous: [${reference}]`);
    return matches[0]!;
  };

  const notifyChanged = (): void => {
    window.dispatchEvent(new CustomEvent('epicscope-histogram-calculated-fields-changed'));
  };

  const resetPreviewStats = (): void => {
    for (const name of ['count', 'min', 'max', 'mean']) stat(name).textContent = '—';
  };

  const insertText = (text: string): void => {
    const start = formulaInput.selectionStart ?? formulaInput.value.length;
    const end = formulaInput.selectionEnd ?? start;
    formulaInput.setRangeText(text, start, end, 'end');
    formulaInput.focus();
    void preview();
  };

  const renderList = (): void => {
    const query = search.value.trim().toLocaleLowerCase();
    const visible = fields.filter((field) => !query || field.name.toLocaleLowerCase().includes(query) || field.expression.toLocaleLowerCase().includes(query));
    list.replaceChildren();
    if (visible.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'math-channel-empty';
      empty.textContent = fields.length === 0 ? 'No math channels yet. Create one to reuse a calculated value in Table Generator.' : 'No math channels match the search.';
      list.append(empty);
    } else {
      for (const field of visible) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `math-channel-row${field.id === editingId ? ' math-channel-row--active' : ''}`;
        const name = document.createElement('strong');
        name.textContent = field.name;
        const expression = document.createElement('small');
        expression.textContent = field.expression;
        button.replaceChildren(name, expression);
        button.addEventListener('click', () => edit(field.id));
        list.append(button);
      }
    }
    count.textContent = `${fields.length} math channel${fields.length === 1 ? '' : 's'}`;
  };

  const renderSources = (): void => {
    const query = sourceSearch.value.trim().toLocaleLowerCase();
    const fragment = document.createDocumentFragment();
    for (const channel of context.channels) {
      const searchable = searchableChannelText(channel);
      if (query && !searchable.label.includes(query) && !searchable.sourceName.includes(query) && !searchable.id.includes(query)) continue;
      fragment.append(sourceButtonFor(channel));
    }
    sourceList.replaceChildren(fragment);
  };

  const resetEditor = (): void => {
    editingId = '';
    title.textContent = 'New Math Channel';
    nameInput.value = '';
    unitInput.value = '';
    formulaInput.value = '';
    deleteButton.hidden = true;
    validation.className = 'math-channel-validation';
    validation.textContent = 'Enter a name and formula to preview the result.';
    resetPreviewStats();
    renderList();
  };

  const edit = (id: string): void => {
    const field = fields.find((candidate) => candidate.id === id);
    if (!field) return;
    editingId = field.id;
    title.textContent = 'Edit Math Channel';
    nameInput.value = field.name;
    unitInput.value = field.unit ?? '';
    formulaInput.value = field.expression;
    deleteButton.hidden = false;
    renderList();
    void preview();
  };

  const preview = async (): Promise<void> => {
    const generation = ++previewGeneration;
    const expression = formulaInput.value.trim();
    if (!expression) {
      validation.className = 'math-channel-validation';
      validation.textContent = 'Enter a formula to preview the result.';
      resetPreviewStats();
      return;
    }
    try {
      const program = compileCalculatedField(expression);
      const references = new Map<string, ChannelDefinition>();
      for (const reference of program.references) references.set(reference, resolveReference(reference));
      validation.className = 'math-channel-validation';
      validation.textContent = `Valid formula · ${program.references.length} source channel${program.references.length === 1 ? '' : 's'} · loading preview…`;
      const startMs = context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs ? Math.min(context.aTimeMs, context.bTimeMs) : undefined;
      const endMs = startMs !== undefined ? Math.max(context.aTimeMs!, context.bTimeMs!) : undefined;
      const traces = await context.loadTraces([...new Set([...references.values()].map((channel) => channel.id))], startMs, endMs);
      if (generation !== previewGeneration) return;
      const byId = new Map(traces.map((trace) => [trace.channel.id, trace]));
      const ranges = new Map<string, NumericChannelRange>();
      for (const [reference, channel] of references) {
        const trace = byId.get(channel.id);
        if (!trace) throw new RangeError(`Preview data unavailable for [${reference}]`);
        ranges.set(reference, trace.range);
      }
      const evaluated = evaluateCalculatedFieldRange(program, ranges);
      const values = validValues(evaluated);
      if (values.length === 0) {
        validation.className = 'math-channel-validation math-channel-validation--warning';
        validation.textContent = 'Formula is valid, but it produced no finite samples in the current preview scope.';
        resetPreviewStats();
        return;
      }
      let sum = 0;
      let minimum = Number.POSITIVE_INFINITY;
      let maximum = Number.NEGATIVE_INFINITY;
      for (const value of values) {
        sum += value;
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      }
      stat('count').textContent = values.length.toLocaleString();
      stat('min').textContent = formatNumber(minimum);
      stat('max').textContent = formatNumber(maximum);
      stat('mean').textContent = formatNumber(sum / values.length);
      validation.className = 'math-channel-validation math-channel-validation--good';
      validation.textContent = `Formula valid · preview uses ${startMs === undefined ? 'available log data' : 'the current A/B range'}.`;
    } catch (error) {
      if (generation !== previewGeneration) return;
      validation.className = 'math-channel-validation math-channel-validation--error';
      validation.textContent = error instanceof Error ? error.message : 'Formula is invalid.';
      resetPreviewStats();
    }
  };

  const save = (): void => {
    const name = nameInput.value.trim();
    const expression = formulaInput.value.trim();
    if (!name || !expression) {
      validation.className = 'math-channel-validation math-channel-validation--error';
      validation.textContent = 'Name and formula are required.';
      return;
    }
    try {
      const program = compileCalculatedField(expression);
      for (const reference of program.references) resolveReference(reference);
      const existing = fields.find((field) => field.id === editingId);
      const field: HistogramCalculatedFieldDefinition = {
        id: existing?.id ?? createHistogramLocalId('formula'),
        name,
        expression,
        ...(unitInput.value.trim() ? { unit: unitInput.value.trim() } : {}),
      };
      fields = existing ? fields.map((candidate) => candidate.id === existing.id ? field : candidate) : [...fields, field];
      const persisted = saveHistogramCalculatedFields(fields);
      editingId = field.id;
      deleteButton.hidden = false;
      title.textContent = 'Edit Math Channel';
      renderList();
      notifyChanged();
      if (!persisted) {
        validation.className = 'math-channel-validation math-channel-validation--warning';
        validation.textContent = 'Available this session; could not save locally.';
      } else {
        void preview();
      }
    } catch (error) {
      validation.className = 'math-channel-validation math-channel-validation--error';
      validation.textContent = error instanceof Error ? error.message : 'Formula is invalid.';
    }
  };

  const remove = (): void => {
    if (!editingId) return;
    fields = fields.filter((field) => field.id !== editingId);
    saveHistogramCalculatedFields(fields);
    notifyChanged();
    resetEditor();
  };

  root.querySelectorAll<HTMLButtonElement>('[data-insert]').forEach((button) => {
    button.addEventListener('click', () => insertText(button.dataset.insert ?? ''));
  });
  sourceList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[data-source-label]');
    const label = button?.dataset.sourceLabel;
    if (label) insertText(`[${label}]`);
  });
  newButton.addEventListener('click', resetEditor);
  resetButton.addEventListener('click', resetEditor);
  saveButton.addEventListener('click', save);
  deleteButton.addEventListener('click', remove);
  search.addEventListener('input', renderList);
  sourceSearch.addEventListener('input', renderSources);
  nameInput.addEventListener('input', () => { void preview(); });
  unitInput.addEventListener('input', () => { void preview(); });
  formulaInput.addEventListener('input', () => { void preview(); });
  window.addEventListener('epicscope-histogram-calculated-fields-changed', () => {
    fields = loadHistogramCalculatedFields();
    if (editingId && !fields.some((field) => field.id === editingId)) editingId = '';
    renderList();
  });

  const refresh = (): void => {
    fields = loadHistogramCalculatedFields();
    renderList();
    renderSources();
    if (!root.hidden && formulaInput.value.trim()) void preview();
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    const channelsChanged = !sameChannelCatalog(context.channels, nextContext.channels);
    context = nextContext;
    if (channelsChanged) renderSources();
    if (!root.hidden && formulaInput.value.trim()) void preview();
  };

  resetEditor();
  renderSources();
  return { element: root, setContext, refresh };
}
