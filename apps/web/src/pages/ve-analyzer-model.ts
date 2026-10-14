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
  readonly unitScale: VeMixtureScale;
  readonly nameScale: VeMixtureScale;
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
    patterns[index]!.lastIndex = 0;
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

function exactName(entries: readonly TuneEntry[], names: readonly string[]): string | undefined {
  for (const name of names) {
    const match = entries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (match) return match.name;
  }
  return undefined;
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

function scaleFromText(value: string | undefined): VeMixtureScale {
  const text = value?.trim().toLowerCase() ?? '';
  if (!text) return 'unknown';
  if (/\bafr\b|air.?fuel/.test(text)) return 'afr';
  if (/lambda|\blam\b/.test(text)) return 'lambda';
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
  const unitScale = scaleFromText(entry?.units);
  const nameScale = scaleFromText(entry?.name);
  const valueScale = valueMixtureScale(entry);
  const identityScale = unitScale !== 'unknown' ? unitScale : nameScale;
  const conflict = unitScale !== 'unknown' && valueScale !== 'unknown' && unitScale !== valueScale;
  const resolvedScale = conflict
    ? 'unknown'
    : unitScale !== 'unknown'
      ? unitScale
      : valueScale !== 'unknown'
        ? valueScale
        : nameScale;
  return { identityScale, unitScale, nameScale, valueScale, resolvedScale, conflict };
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
      `Table unit indicates ${evidence.unitScale === 'afr' ? 'AFR' : 'Lambda'}, but the stored values look like ${evidence.valueScale === 'afr' ? 'AFR' : 'Lambda'}. Verify the table before analysis.`,
    );
  } else if (evidence.resolvedScale !== 'unknown' && evidence.resolvedScale !== selectedScale) {
    messages.push(`Scale mismatch: the selected table is ${evidence.resolvedScale === 'afr' ? 'AFR' : 'Lambda'}, but VE Analyzer is set to ${selectedScale === 'afr' ? 'AFR' : 'Lambda'}.`);
  }

  if (evidence.unitScale === 'unknown'
    && evidence.nameScale !== 'unknown'
    && evidence.valueScale !== 'unknown'
    && evidence.nameScale !== evidence.valueScale) {
    messages.push(
      `Table identifier suggests ${evidence.nameScale === 'afr' ? 'AFR' : 'Lambda'}, while the stored values look like ${evidence.valueScale === 'afr' ? 'AFR' : 'Lambda'}. No explicit unit is available; verify the scale.`,
    );
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

  if (evidence.resolvedScale === 'unknown' && !evidence.conflict && evidence.nameScale === 'unknown') {
    messages.push('This table is not identifiable as an AFR/Lambda target from its unit, values, or identifier. Verify the selection before analysis.');
  }

  const invalid = messages.some((message) => /same table|no finite|Scale mismatch|do not look like|Table unit indicates/.test(message));
  return {
    scale: evidence.resolvedScale,
    status: invalid ? 'invalid' : messages.length > 0 ? 'warning' : 'ok',
    messages,
  };
}

function sameGeometry(left: TuneEntry | undefined, right: TuneEntry): boolean {
  return Boolean(left && left.kind === 'table' && left.rows === right.rows && left.cols === right.cols);
}

function tableFamilyStem(tableName: string): string {
  return tableName.replace(/(?:_?table\d*)$/i, '');
}

export function preferredVeTableName(model: TuneModel | undefined): string | undefined {
  const candidates = veTableCandidates(model);
  const canonical = exactName(candidates, ['veTable']);
  if (canonical) return canonical;
  const mainVe = candidates.find((entry) => /^veTable\d*$/i.test(entry.name));
  if (mainVe) return mainVe.name;
  const nonAuxiliary = candidates.filter((entry) => !/(idle|crank|warm|trim|blend|correction|secondary)/i.test(entry.name));
  return bestName(nonAuxiliary.length ? nonAuxiliary : candidates, [/(^|[_\s])ve([_\s]|$)/i, /fuel.*ve/i, /ve.*table/i], false);
}

export function preferredTargetMixtureTableName(
  model: TuneModel | undefined,
  veTableName?: string,
): string | undefined {
  const ve = veTableName ? model?.byName.get(veTableName) : undefined;
  const candidates = targetMixtureTableCandidates(model).filter((entry) => entry.name !== veTableName);
  const geometryMatches = ve ? candidates.filter((entry) => sameGeometry(ve, entry)) : candidates;
  const preferredPool = geometryMatches.length ? geometryMatches : candidates;

  const canonical = exactName(preferredPool, ['lambdaTable', 'afrTable', 'targetAfrTable', 'targetLambdaTable']);
  if (canonical) return canonical;

  const nonAuxiliary = preferredPool.filter((entry) => !/(blend|trim|correction|max.*deviation|deviation|max|min)/i.test(entry.name));
  const pool = nonAuxiliary.length ? nonAuxiliary : preferredPool;
  const unitBacked = pool.filter((entry) => scaleFromText(entry.units) !== 'unknown');
  if (unitBacked.length === 1) return unitBacked[0]!.name;

  const named = bestName(pool, [
    /^afr(table)?\d*$/i,
    /^lambda(table)?\d*$/i,
    /target.*(afr|lambda)/i,
    /(afr|lambda).*target/i,
    /(afr|lambda).*table/i,
  ], false);
  if (named) return named;

  const valueIdentified = pool.filter((entry) => inferTuneMixtureScale(entry) !== 'unknown');
  return valueIdentified.length === 1 ? valueIdentified[0]!.name : undefined;
}

export function preferredVeAxisName(
  model: TuneModel | undefined,
  tableName: string,
  axis: VeAxisKind,
): string | undefined {
  const candidates = veAxisCandidates(model, tableName, axis);
  const stem = tableFamilyStem(tableName);
  const canonicalNames = axis === 'rpm'
    ? [`${stem}RpmBins`, `${stem}RPMBins`]
    : [`${stem}LoadBins`];
  const canonical = exactName(candidates, canonicalNames);
  if (canonical) return canonical;

  const stemPattern = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return axis === 'rpm'
    ? bestName(candidates, [new RegExp(`^${stemPattern}.*rpm.*bins$`, 'i'), /rpm.*bins/i, /engine.*speed/i], false)
    : bestName(candidates, [new RegExp(`^${stemPattern}.*load.*bins$`, 'i'), /load.*bins/i, /map.*bins/i, /pressure.*bins/i, /tps.*bins/i], false);
}
