from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch marker: {label}')
    return text.replace(old, new, 1)

# app shell: retain explicit INI TableEditor relationships and expose them to Histogram.
path = Path('apps/web/src/app/app-shell.ts')
text = path.read_text()
text = replace_once(
    text,
    "import { normalizeMsqTune, type TuneModel } from '../../../../core/tune/tune-model';\n",
    "import { normalizeMsqTune, type TuneModel } from '../../../../core/tune/tune-model';\nimport type { IniTableEditorDefinition } from '../../../../core/parsers/ini/ini-table-editor-parser';\n",
    'app-shell import',
)
text = replace_once(
    text,
    "  let activeIniBinding: BoundChannelCatalog | undefined;\n  let activeTuneModel: TuneModel | undefined;\n",
    "  let activeIniBinding: BoundChannelCatalog | undefined;\n  let activeIniTableDefinitions: readonly IniTableEditorDefinition[] = [];\n  let activeTuneModel: TuneModel | undefined;\n",
    'app-shell state',
)
text = replace_once(
    text,
    "        ...(activeTuneSourceName ? { tuneSourceName: activeTuneSourceName } : {}),\n        openSamplesInLogger: (request) => {\n",
    "        ...(activeTuneSourceName ? { tuneSourceName: activeTuneSourceName } : {}),\n        ...(activeIniTableDefinitions.length ? { tuneTableDefinitions: activeIniTableDefinitions } : {}),\n        openSamplesInLogger: (request) => {\n",
    'histogram context',
)
text = replace_once(
    text,
    "    activeIniCatalog = undefined;\n    activeIniSourceName = undefined;\n    activeIniBinding = undefined;\n",
    "    activeIniCatalog = undefined;\n    activeIniSourceName = undefined;\n    activeIniBinding = undefined;\n    activeIniTableDefinitions = [];\n",
    'unload ini mappings',
)
text = replace_once(
    text,
    "      parserStatus.textContent = `TUNE-MSQ · ${tableCount.toLocaleString()} table(s) · session only`;\n      if (activeMode === 'analyzer') analyzerPage.refresh();\n",
    "      parserStatus.textContent = `TUNE-MSQ · ${tableCount.toLocaleString()} table(s) · session only`;\n      if (activeMode === 'analyzer') analyzerPage.refresh();\n      else if (activeMode === 'histogram') setEpicScopeMode('histogram');\n",
    'refresh histogram after msq',
)
text = replace_once(
    text,
    "        activeIniCatalog = imported.catalog;\n        activeIniSourceName = imported.fileName;\n        activeIniBinding = undefined;\n",
    "        activeIniCatalog = imported.catalog;\n        activeIniSourceName = imported.fileName;\n        activeIniBinding = undefined;\n        activeIniTableDefinitions = imported.tableDefinitions;\n",
    'capture ini mappings',
)
text = replace_once(
    text,
    "        parserStatus.textContent =\n          `INI · ${imported.catalog.entries.length.toLocaleString()} catalog channels · `\n          + `${imported.parsed.outputChannels.length.toLocaleString()} outputs · local only`;\n        scheduleWorkspaceSave();\n",
    "        parserStatus.textContent =\n          `INI · ${imported.catalog.entries.length.toLocaleString()} catalog channels · `\n          + `${imported.parsed.outputChannels.length.toLocaleString()} outputs · ${imported.tableDefinitions.length.toLocaleString()} table maps · local only`;\n        if (activeMode === 'histogram') setEpicScopeMode('histogram');\n        scheduleWorkspaceSave();\n",
    'refresh histogram after ini',
)
path.write_text(text)

# Table Generator: use explicit INI zBins -> xBins/yBins relationships first.
path = Path('apps/web/src/pages/histogram-table-generator-view.ts')
text = path.read_text()
start = text.index('  const populateMsqAxisSelectors = (preferSuggested = false): void => {')
end = text.index('  const updateAxisControls = (): void => {', start)
replacement = r'''  const tableDefinitionFor = (tableName: string) => {
    const lowered = tableName.toLocaleLowerCase();
    return context.tuneTableDefinitions?.find((definition) => definition.zBins === tableName)
      ?? context.tuneTableDefinitions?.find((definition) => definition.zBins.toLocaleLowerCase() === lowered);
  };

  const selectRuntimeAxisChannels = (tableName: string): void => {
    const definition = tableDefinitionFor(tableName);
    if (!definition) return;
    const selectByIniName = (select: HTMLSelectElement, iniName: string | undefined): void => {
      if (!iniName) return;
      const lowered = iniName.toLocaleLowerCase();
      const channel = context.channels.find((candidate) => candidate.sourceName.toLocaleLowerCase() === lowered)
        ?? context.channels.find((candidate) => candidate.displayName.toLocaleLowerCase() === lowered);
      if (channel && logicalChannelExists(channel.id)) select.value = channel.id;
    };
    selectByIniName(xSelect, definition.xChannel);
    selectByIniName(ySelect, definition.yChannel);
  };

  const populateMsqAxisSelectors = (preferSuggested = false): void => {
    const previousTable = msqTableSelect.value;
    const previousX = msqXAxisSelect.value;
    const previousY = msqYAxisSelect.value;
    msqTableSelect.replaceChildren();
    msqXAxisSelect.replaceChildren();
    msqYAxisSelect.replaceChildren();
    const model = context.tuneModel;
    if (!model) {
      msqTableSelect.add(new Option('No MSQ loaded', ''));
      msqXAxisSelect.add(new Option('—', ''));
      msqYAxisSelect.add(new Option('—', ''));
      return;
    }
    const tables = model.entries.filter((entry) => entry.kind === 'table' && entry.numericValues);
    for (const tableEntry of tables) msqTableSelect.add(new Option(tableEntry.name, tableEntry.name));
    if (previousTable && tables.some((tableEntry) => tableEntry.name === previousTable)) msqTableSelect.value = previousTable;
    const selectedTable = model.byName.get(msqTableSelect.value) ?? tables[0];
    if (!selectedTable) return;
    if (!msqTableSelect.value) msqTableSelect.value = selectedTable.name;

    const definition = tableDefinitionFor(selectedTable.name);
    const numeric = model.entries.filter((entry) => entry.numericValues);
    const xCandidates = numeric.filter((entry) => entry.numericValues?.length === selectedTable.cols && entry.name !== selectedTable.name);
    const yCandidates = numeric.filter((entry) => entry.numericValues?.length === selectedTable.rows && entry.name !== selectedTable.name);
    const tableIndex = model.entries.indexOf(selectedTable);
    const score = (entry: (typeof model.entries)[number], axis: 'x' | 'y'): number => {
      const entryIndex = model.entries.indexOf(entry);
      const name = entry.name.toLocaleLowerCase();
      let value = entry.kind === 'vector' ? 1000 : 0;
      if (entry.pageNumber !== undefined && entry.pageNumber === selectedTable.pageNumber) value += 500;
      value += Math.max(0, 240 - Math.abs(entryIndex - tableIndex) * 12);
      if (entryIndex < tableIndex) value += 50;
      if (axis === 'x' && /(rpm|speed|x.?axis|x.?bin|column)/i.test(name)) value += 140;
      if (axis === 'y' && /(map|load|tps|pressure|y.?axis|y.?bin|row)/i.test(name)) value += 140;
      return value;
    };
    const rank = (candidates: typeof xCandidates, axis: 'x' | 'y', explicitName: string | undefined) => {
      const ranked = [...candidates].sort((left, right) => score(right, axis) - score(left, axis));
      if (!explicitName) return ranked;
      const explicit = candidates.find((entry) => entry.name === explicitName)
        ?? candidates.find((entry) => entry.name.toLocaleLowerCase() === explicitName.toLocaleLowerCase());
      return explicit ? [explicit, ...ranked.filter((entry) => entry !== explicit)] : ranked;
    };
    const rankedX = rank(xCandidates, 'x', definition?.xBins);
    const rankedY = rank(yCandidates, 'y', definition?.yBins);
    for (const entry of rankedX) msqXAxisSelect.add(new Option(entry.name, entry.name));
    for (const entry of rankedY) msqYAxisSelect.add(new Option(entry.name, entry.name));

    const tableChanged = previousTable !== selectedTable.name;
    const explicitX = definition
      ? rankedX.find((entry) => entry.name === definition.xBins || entry.name.toLocaleLowerCase() === definition.xBins.toLocaleLowerCase())
      : undefined;
    const explicitY = definition
      ? rankedY.find((entry) => entry.name === definition.yBins || entry.name.toLocaleLowerCase() === definition.yBins.toLocaleLowerCase())
      : undefined;
    const keepX = !preferSuggested && !tableChanged && previousX && xCandidates.some((entry) => entry.name === previousX);
    const suggestedX = keepX ? previousX : explicitX?.name ?? rankedX[0]?.name ?? '';
    if (suggestedX) msqXAxisSelect.value = suggestedX;
    const keepY = !preferSuggested && !tableChanged && previousY && yCandidates.some((entry) => entry.name === previousY);
    const suggestedY = keepY
      ? previousY
      : explicitY?.name ?? rankedY.find((entry) => entry.name !== suggestedX)?.name ?? rankedY[0]?.name ?? '';
    if (suggestedY) msqYAxisSelect.value = suggestedY;

    if ((preferSuggested || !previousTable || tableChanged) && definition) {
      selectRuntimeAxisChannels(selectedTable.name);
    }
  };

'''
text = text[:start] + replacement + text[end:]
path.write_text(text)
