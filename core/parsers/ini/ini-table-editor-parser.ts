export interface IniTableEditorDefinition {
  readonly tableId: string;
  readonly mapId: string | undefined;
  readonly title: string | undefined;
  readonly page: number | undefined;
  readonly xBins: string;
  readonly xChannel: string | undefined;
  readonly yBins: string;
  readonly yChannel: string | undefined;
  readonly zBins: string;
}

function stripInlineComment(line: string): string {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (char === ';' && !quoted) return line.slice(0, index);
  }
  return line;
}

function csvFields(value: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of value) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

interface MutableTable {
  tableId: string | undefined;
  mapId: string | undefined;
  title: string | undefined;
  page: number | undefined;
  xBins: string | undefined;
  xChannel: string | undefined;
  yBins: string | undefined;
  yChannel: string | undefined;
  zBins: string | undefined;
}

function emptyMutableTable(): MutableTable {
  return {
    tableId: undefined,
    mapId: undefined,
    title: undefined,
    page: undefined,
    xBins: undefined,
    xChannel: undefined,
    yBins: undefined,
    yChannel: undefined,
    zBins: undefined,
  };
}

export function parseIniTableEditorDefinitions(source: string): readonly IniTableEditorDefinition[] {
  const definitions: IniTableEditorDefinition[] = [];
  let inTableEditor = false;
  let current: MutableTable | undefined;

  const finish = (): void => {
    if (current?.tableId && current.xBins && current.yBins && current.zBins) {
      definitions.push({
        tableId: current.tableId,
        mapId: current.mapId,
        title: current.title,
        page: current.page,
        xBins: current.xBins,
        xChannel: current.xChannel,
        yBins: current.yBins,
        yChannel: current.yChannel,
        zBins: current.zBins,
      });
    }
    current = undefined;
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = stripInlineComment(rawLine).trim();
    if (!line) continue;
    const section = /^\[([^\]]+)\]$/.exec(line);
    if (section) {
      if (inTableEditor) finish();
      inTableEditor = section[1]?.trim().toLocaleLowerCase() === 'tableeditor';
      continue;
    }
    if (!inTableEditor) continue;

    const assignment = /^([^=]+?)\s*=\s*(.*)$/.exec(line);
    if (!assignment) continue;
    const key = assignment[1]!.trim().toLocaleLowerCase();
    const fields = csvFields(assignment[2]!);

    if (key === 'table') {
      finish();
      const page = Number(fields[3]);
      current = emptyMutableTable();
      current.tableId = fields[0] || undefined;
      current.mapId = fields[1] || undefined;
      current.title = fields[2] || undefined;
      current.page = Number.isFinite(page) ? page : undefined;
      continue;
    }
    if (!current) continue;
    if (key === 'xbins') {
      current.xBins = fields[0] || undefined;
      current.xChannel = fields[1] || undefined;
    } else if (key === 'ybins') {
      current.yBins = fields[0] || undefined;
      current.yChannel = fields[1] || undefined;
    } else if (key === 'zbins') {
      current.zBins = fields[0] || undefined;
    }
  }
  if (inTableEditor) finish();
  return definitions;
}
