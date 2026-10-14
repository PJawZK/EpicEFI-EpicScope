import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';

export type VeAxisKind = 'rpm' | 'load';
export type VeMixtureScale = 'afr' | 'lambda' | 'unknown';

export interface TargetMixtureTableAssessment {
  readonly scale: VeMixtureScale;
  readonly status: 'ok' | 'warning' | 'invalid';
  readonly messages: readonly string[];
}

export interface TuneMixtureScaleEvidence {
  readonly identityScale: VeMixtureScale;
  readonly valueScale: VeMixtureScale;
  readonly resolvedScale: VeMixtureScale;
  readonly conflict: boolean;
}

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

function bestName(entries: readonly TuneEntry[], patterns: readonly RegExp[], allowFallback = true): string | undefined {
  let best: TuneEntry | undefined;
  let bestScore = 0;
  for (const entry of entries) {
    const score = scoreName(`${entry.name} ${entry.units ?? ''}`, patterns);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  if (best) return best.name;
  return allowFallback ? entries[0]?.name : undefined;
}

function finiteValues(entry: TuneEntry | undefined): readonly number[] {
  return entry?.numericValues?.filter(Number.isFinite) ?? [];
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle];
}

function identityMixtureScale(entry: TuneEntry | undefined): VeMixtureScale {
  if (!entry) return 'unknown';
  const identity = `${entry.name} ${entry.units ?? ''}`.toLowerCase();
  if (/lambda|\blam\b/.test(identity)) return 'lambda';
  if (/\bafr\b|air.?fuel/.test(identity)) return 'afr';
  return 'unknown';
}

function valueMixtureScale(entry: TuneEntry | undefined): VeMixtureScale {
  const values = finiteValues(entry);
  const middle = median(values);
  if (middle === undefined) return 'unknown';
  const lambdaLike = values.filter((value) => value >= 0.35 && value <= 2.5).length / values.length;
  const afrLike = values.filter((value) => value >= 4 && value <= 30).length / values.length;
  if (lambdaLike >= 0.9 && middle >= 0.5 && middle <= 1.5) return 'lambda';
  if (afrLike >= 0.9 && middle >= 7 && middle <= 20) return 'afr';
  return 'unknown';
}

export function tuneMixtureScaleEvidence(entry: TuneEntry | undefined): TuneMixtureScaleEvidence {
  const identityScale = identityMixtureScale(entry);
  const valueScale = valueMixtureScale(entry);
  const conflict = identityScale !== 'unknown' && valueScale !== 'unknown' && identityScale !== valueScale;
  const resolvedScale = conflict
    ? 'unknown'
    : valueScale !== 'unknown'
      ? valueScale
      : identityScale;
  return { identityScale, valueScale, resolvedScale, conflict };
}

export function inferTuneMixtureScale(entry: TuneEntry | undefined): VeMixtureScale {
  return tuneMixtureScaleEvidence(entry).resolvedScale;
}

export function assessTargetMixtureTable(
  entry: TuneEntry | undefined,
  selectedScale: Exclude<VeMixtureScale, 'unknown'>,
  veTableName?: string,
): TargetMixtureTableAssessment {
  if (!entry) return { scale: 'unknown', status: 'invalid', messages: ['No target mixture table is selected.'] };
  const messages: string[] = [];
  const evidence = tuneMixtureScaleEvidence(entry);
  const values = finiteValues(entry);

  if (entry.name === veTableName) messages.push('The selected target table is the same table as the VE table.');
  if (values.length === 0) messages.push('The selected target table has no finite numeric values.');

  if (evidence.conflict) {
    messages.push(
      `Source identity suggests ${evidence.identityScale === 'afr' ? 'AFR' : 'Lambda'}, but the stored values look like ${evidence.valueScale === 'afr' ? 'AFR' : 'Lambda'}. Verify the table and mixture scale before analysis.`,
    );
  } else if (evidence.resolvedScale !== 'unknown' && evidence.resolvedScale !== selectedScale) {
    messages.push(`Scale mismatch: the selected table looks like ${evidence.resolvedScale === 'afr' ? 'AFR' : 'Lambda'}, but VE Analyzer is set to ${selectedScale === 'afr' ? 'AFR' : 'Lambda'}.`);
  }

  if (values.length > 0) {
    const middle = median(values)!;
    if (selectedScale === 'lambda' && (middle < 0.35 || middle > 2.5)) {
      messages.push(`Selected table values do not look like Lambda (median ${middle.toFixed(2)}).`);
    }
    if (selectedScale === 'afr' && (middle < 4 || middle > 30)) {
      messages.push(`Selected table values do not look like AFR (median ${middle.toFixed(2)}).`);
    }
  }

  const identity = `${entry.name} ${entry.units ?? ''}`;
  if (evidence.resolvedScale === 'unknown' && !evidence.conflict && !/(target|afr|lambda|air.?fuel)/i.test(identity)) {
    messages.push('This table is not identifiable as an AFR/Lambda target from its name, units, or values. Verify the selection before analysis.');
  }

  const invalid = messages.some((message) => /same table|no finite|Scale mismatch|do not look like|Source identity suggests/.test(message));
  return {
    scale: evidence.resolvedScale,
    status: invalid ? 'invalid' : messages.length > 0 ? 'warning' : 'ok',
    messages,
  };
}

export function preferredVeTableName(model: TuneModel | undefined): string | undefined {
  return bestName(veTableCandidates(model), [/^ve(table)?\d*$/i, /(^|[_\s])ve([_\s]|$)/i, /fuel.*ve/i, /ve.*table/i]);
}

export function preferredTargetMixtureTableName(
  model: TuneModel | undefined,
  veTableName?: string,
): string | undefined {
  const candidates = targetMixtureTableCandidates(model).filter((entry) => entry.name !== veTableName);
  const named = bestName(candidates, [
    /target.*(afr|lambda)/i,
    /(afr|lambda).*target/i,
    /^afr(table)?\d*$/i,
    /^lambda(table)?\d*$/i,
    /(afr|lambda).*table/i,
  ], false);
  if (named) return named;
  const valueIdentified = candidates.filter((entry) => inferTuneMixtureScale(entry) !== 'unknown');
  return valueIdentified.length === 1 ? valueIdentified[0]!.name : undefined;
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
