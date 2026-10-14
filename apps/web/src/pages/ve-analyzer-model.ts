import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';

export type VeAxisKind = 'rpm' | 'load';

export function veTableCandidates(model: TuneModel | undefined): readonly TuneEntry[] {
  return model?.entries.filter((entry) => entry.kind === 'table' && entry.numericValues !== undefined) ?? [];
}

export function targetMixtureTableCandidates(model: TuneModel | undefined): readonly TuneEntry[] {
  return veTableCandidates(model);
}

export function veNumericCandidates(model: TuneModel | undefined): readonly TuneEntry[] {
  return model?.entries.filter((entry) => entry.numericValues !== undefined) ?? [];
}

export function veAxisCandidates(
  model: TuneModel | undefined,
  tableName: string,
  axis: VeAxisKind,
): readonly TuneEntry[] {
  const table = model?.byName.get(tableName);
  if (!table || table.kind !== 'table') return [];
  const expectedLength = axis === 'rpm' ? table.cols : table.rows;
  return veNumericCandidates(model).filter((entry) => entry.numericValues?.length === expectedLength);
}

function scoreName(name: string, patterns: readonly RegExp[]): number {
  let score = 0;
  for (let index = 0; index < patterns.length; index += 1) {
    if (patterns[index]!.test(name)) score += (patterns.length - index) * 10;
  }
  return score;
}

function bestName(entries: readonly TuneEntry[], patterns: readonly RegExp[]): string | undefined {
  let best: TuneEntry | undefined;
  let bestScore = 0;
  for (const entry of entries) {
    const score = scoreName(entry.name, patterns);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best?.name ?? entries[0]?.name;
}

export function preferredVeTableName(model: TuneModel | undefined): string | undefined {
  return bestName(veTableCandidates(model), [/^ve(table)?\d*$/i, /(^|[_\s])ve([_\s]|$)/i, /fuel.*ve/i, /ve.*table/i]);
}

export function preferredTargetMixtureTableName(
  model: TuneModel | undefined,
  veTableName?: string,
): string | undefined {
  const candidates = targetMixtureTableCandidates(model).filter((entry) => entry.name !== veTableName);
  return bestName(candidates, [
    /target.*(afr|lambda)/i,
    /(afr|lambda).*target/i,
    /^afr(table)?\d*$/i,
    /^lambda(table)?\d*$/i,
    /(afr|lambda).*table/i,
  ]);
}

export function preferredVeAxisName(
  model: TuneModel | undefined,
  tableName: string,
  axis: VeAxisKind,
): string | undefined {
  const candidates = veAxisCandidates(model, tableName, axis);
  return axis === 'rpm'
    ? bestName(candidates, [/rpm/i, /engine.*speed/i])
    : bestName(candidates, [/load/i, /map/i, /pressure/i, /kpa/i, /tps/i]);
}
