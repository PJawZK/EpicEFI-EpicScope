import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';
import { createTuneTable2D, type TuneTable2D } from '../../../../core/tune/table-correlation';
import { addInlineHelpButton, showInlineHelpPopover } from '../components/inline-help';

export interface IgnitionTuneSetupController {
  readonly element: HTMLElement;
  setTuneModel(model: TuneModel | undefined, sourceName?: string): void;
  selectedTable(): TuneTable2D | undefined;
  description(): string;
}

function numericEntries(model: TuneModel | undefined): readonly TuneEntry[] {
  return model?.entries.filter((entry) => entry.numericValues !== undefined) ?? [];
}

function tableEntries(model: TuneModel | undefined): readonly TuneEntry[] {
  return model?.entries.filter((entry) => entry.kind === 'table' && entry.numericValues !== undefined) ?? [];
}

function normalized(name: string): string {
  return name.replace(/[_:./\\-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function ignitionTableScore(entry: TuneEntry): number {
  const name = normalized(entry.name);
  let score = 0;
  if (/ignition|spark/.test(name)) score += 12;
  if (/advance|timing/.test(name)) score += 7;
  if (/table|map/.test(name)) score += 2;
  if (/idle|crank|start|dwell|trim|correction|retard|knock|launch|limit/.test(name)) score -= 12;
  return score;
}

function axisScore(entry: TuneEntry, kind: 'rpm' | 'load'): number {
  const name = normalized(entry.name);
  if (kind === 'rpm') {
    let score = /rpm/.test(name) ? 20 : 0;
    if (/load|map|pressure|kpa/.test(name)) score -= 10;
    return score;
  }
  let score = 0;
  if (/load/.test(name)) score += 20;
  if (/map|pressure|kpa/.test(name)) score += 14;
  if (/ignition|spark/.test(name)) score += 3;
  if (/rpm/.test(name)) score -= 20;
  return score;
}

function bestByScore(entries: readonly TuneEntry[], score: (entry: TuneEntry) => number): TuneEntry | undefined {
  let best: TuneEntry | undefined;
  let bestScore = 0;
  for (const entry of entries) {
    const current = score(entry);
    if (current > bestScore) {
      best = entry;
      bestScore = current;
    }
  }
  return best;
}

export function createIgnitionTuneSetup(onChange: () => void): IgnitionTuneSetupController {
  let model: TuneModel | undefined;
  let sourceName: string | undefined;
  let rememberedTable = '';
  let rememberedRpmAxis = '';
  let rememberedLoadAxis = '';

  const element = document.createElement('div');
  element.className = 'ignition-tune-setup';
  element.innerHTML = `
    <div class="ignition-tune-setup-head"><strong>Base ignition table comparison</strong><span data-ignition-tune="status">No MSQ loaded</span></div>
    <div class="specialized-analyzer-options-grid ignition-tune-setup-grid">
      <label><span data-ignition-tune="table-label">Base ignition table</span><select data-ignition-tune="table"></select></label>
      <label><span data-ignition-tune="rpm-label">Base table RPM axis</span><select data-ignition-tune="rpm-axis"></select></label>
      <label><span data-ignition-tune="load-label">Base table load axis</span><select data-ignition-tune="load-axis"></select></label>
    </div>
  `;

  const tableSelect = element.querySelector<HTMLSelectElement>('[data-ignition-tune="table"]');
  const rpmSelect = element.querySelector<HTMLSelectElement>('[data-ignition-tune="rpm-axis"]');
  const loadSelect = element.querySelector<HTMLSelectElement>('[data-ignition-tune="load-axis"]');
  const status = element.querySelector<HTMLElement>('[data-ignition-tune="status"]');
  const tableLabel = element.querySelector<HTMLElement>('[data-ignition-tune="table-label"]');
  const rpmLabel = element.querySelector<HTMLElement>('[data-ignition-tune="rpm-label"]');
  const loadLabel = element.querySelector<HTMLElement>('[data-ignition-tune="load-label"]');
  if (!tableSelect || !rpmSelect || !loadSelect || !status || !tableLabel || !rpmLabel || !loadLabel) {
    throw new Error('Ignition tune setup structure is incomplete.');
  }

  addInlineHelpButton(tableLabel, {
    title: 'Base ignition table',
    text: 'Optional MSQ table used only to explain observed ignition behavior. EpicScope compares logged final advance with this table; it does not assume the table value is correct or safe.',
  }, showInlineHelpPopover);
  addInlineHelpButton(rpmLabel, {
    title: 'Base table RPM axis',
    text: 'MSQ numeric entry used as the selected base ignition table RPM breakpoints. The selected runtime RPM channel is mapped against this axis.',
  }, showInlineHelpPopover);
  addInlineHelpButton(loadLabel, {
    title: 'Base table load axis',
    text: 'MSQ numeric entry used as the selected base ignition table load breakpoints. The selected runtime Load / MAP channel must use the corresponding quantity and units.',
  }, showInlineHelpPopover);

  const syncAxes = (auto = false): void => {
    const table = model?.byName.get(tableSelect.value);
    const previousRpm = rpmSelect.value || rememberedRpmAxis;
    const previousLoad = loadSelect.value || rememberedLoadAxis;
    rpmSelect.replaceChildren(new Option('(select axis)', ''));
    loadSelect.replaceChildren(new Option('(select axis)', ''));
    if (!table || table.kind !== 'table') return;
    const numeric = numericEntries(model);
    const rpmCandidates = numeric.filter((entry) => entry.numericValues?.length === table.cols);
    const loadCandidates = numeric.filter((entry) => entry.numericValues?.length === table.rows);
    for (const entry of rpmCandidates) rpmSelect.add(new Option(entry.name, entry.name));
    for (const entry of loadCandidates) loadSelect.add(new Option(entry.name, entry.name));

    if (rpmCandidates.some((entry) => entry.name === previousRpm)) rpmSelect.value = previousRpm;
    else if (auto) rpmSelect.value = bestByScore(rpmCandidates, (entry) => axisScore(entry, 'rpm'))?.name ?? '';
    if (loadCandidates.some((entry) => entry.name === previousLoad)) loadSelect.value = previousLoad;
    else if (auto) loadSelect.value = bestByScore(loadCandidates, (entry) => axisScore(entry, 'load'))?.name ?? '';
    rememberedRpmAxis = rpmSelect.value;
    rememberedLoadAxis = loadSelect.value;
  };

  const rebuild = (): void => {
    tableSelect.replaceChildren(new Option(model ? '(select table)' : '(load MSQ)', ''));
    rpmSelect.replaceChildren(new Option('(select axis)', ''));
    loadSelect.replaceChildren(new Option('(select axis)', ''));
    tableSelect.disabled = !model;
    rpmSelect.disabled = !model;
    loadSelect.disabled = !model;
    if (!model) {
      status.textContent = 'No MSQ loaded · review remains log-only';
      return;
    }

    const tables = tableEntries(model);
    for (const entry of tables) tableSelect.add(new Option(entry.name, entry.name));
    if (tables.some((entry) => entry.name === rememberedTable)) tableSelect.value = rememberedTable;
    else tableSelect.value = bestByScore(tables, ignitionTableScore)?.name ?? '';
    rememberedTable = tableSelect.value;
    syncAxes(true);
    status.textContent = tableSelect.value && rpmSelect.value && loadSelect.value
      ? `${sourceName ?? 'MSQ'} · mapped for comparison`
      : `${sourceName ?? 'MSQ'} · choose table/axes to enable comparison`;
  };

  const changed = (): void => {
    rememberedTable = tableSelect.value;
    rememberedRpmAxis = rpmSelect.value;
    rememberedLoadAxis = loadSelect.value;
    status.textContent = tableSelect.value && rpmSelect.value && loadSelect.value
      ? `${sourceName ?? 'MSQ'} · mapped for comparison`
      : `${sourceName ?? 'MSQ'} · choose table/axes to enable comparison`;
    onChange();
  };

  tableSelect.addEventListener('change', () => {
    rememberedTable = tableSelect.value;
    rememberedRpmAxis = '';
    rememberedLoadAxis = '';
    syncAxes(true);
    changed();
  });
  rpmSelect.addEventListener('change', changed);
  loadSelect.addEventListener('change', changed);

  return {
    element,
    setTuneModel(nextModel, nextSourceName) {
      model = nextModel;
      sourceName = nextSourceName;
      rebuild();
    },
    selectedTable() {
      if (!model || !tableSelect.value || !rpmSelect.value || !loadSelect.value) return undefined;
      try {
        return createTuneTable2D(model, {
          tableName: tableSelect.value,
          xAxisName: rpmSelect.value,
          yAxisName: loadSelect.value,
        });
      } catch {
        return undefined;
      }
    },
    description() {
      if (!model) return 'No MSQ loaded';
      if (!tableSelect.value || !rpmSelect.value || !loadSelect.value) return 'MSQ loaded · base table mapping incomplete';
      return `${tableSelect.value} · RPM ${rpmSelect.value} · load ${loadSelect.value}`;
    },
  };
}
