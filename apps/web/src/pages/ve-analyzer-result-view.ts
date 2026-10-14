export type VeResultView =
  | 'proposal'
  | 'change'
  | 'change-percent'
  | 'mixture-error'
  | 'samples'
  | 'weight'
  | 'confidence'
  | 'spread'
  | 'delay';

export type VeRenderedProposalState = 'no-evidence' | 'measured' | 'weak-evidence' | 'withheld-limit';
export type VeRenderedConfidence = 'none' | 'limited' | 'moderate' | 'strong';

export interface VeRenderedCellMetrics {
  readonly state: VeRenderedProposalState;
  readonly current: number | undefined;
  readonly proposed: number | undefined;
  readonly evidenceCandidate: number | undefined;
  readonly changeValue: number | undefined;
  readonly changePercent: number | undefined;
  readonly correctionPercent: number | undefined;
  readonly spreadPercent: number | undefined;
  readonly confidence: VeRenderedConfidence | undefined;
  readonly weight: number | undefined;
  readonly samples: number | undefined;
}

export interface VeResultDisplay {
  readonly text: string;
  readonly numericValue: number | undefined;
  readonly scaleMode: 'base' | 'magnitude' | 'quality' | 'range';
}

export const VE_RESULT_VIEW_OPTIONS: readonly { value: VeResultView; label: string }[] = [
  { value: 'proposal', label: 'Proposed VE' },
  { value: 'change', label: 'VE change' },
  { value: 'change-percent', label: 'VE change %' },
  { value: 'mixture-error', label: 'Mixture error %' },
  { value: 'samples', label: 'Samples' },
  { value: 'weight', label: 'Evidence weight' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'spread', label: 'Spread %' },
  { value: 'delay', label: 'Lambda delay ms' },
] as const;

function parsedNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function matchNumber(text: string, expression: RegExp): number | undefined {
  return parsedNumber(expression.exec(text)?.[1]);
}

function firstRenderedNumber(text: string): number | undefined {
  return matchNumber(text.trim(), /^([+-]?\d+(?:\.\d+)?)/);
}

function confidenceFromTitle(title: string): VeRenderedConfidence | undefined {
  const match = /confidence (none|limited|moderate|strong)/i.exec(title)?.[1]?.toLowerCase();
  return match === 'none' || match === 'limited' || match === 'moderate' || match === 'strong' ? match : undefined;
}

export function parseVeRenderedCellMetrics(title: string, renderedText: string): VeRenderedCellMetrics {
  const state: VeRenderedProposalState = title.startsWith('Measured proposal')
    ? 'measured'
    : title.startsWith('Weak evidence')
      ? 'weak-evidence'
      : title.startsWith('Recommendation withheld')
        ? 'withheld-limit'
        : 'no-evidence';

  const currentFromTitle = matchNumber(title, /\bCurrent ([+-]?\d+(?:\.\d+)?)/i);
  const current = currentFromTitle ?? firstRenderedNumber(renderedText);
  const proposed = matchNumber(title, /\bproposed ([+-]?\d+(?:\.\d+)?)/i);
  const evidenceCandidate = matchNumber(title, /\bRaw candidate ([+-]?\d+(?:\.\d+)?)/i);
  const rawPercent = state === 'measured'
    ? matchNumber(title, /\bchange ([+-]?\d+(?:\.\d+)?)%/i)
    : matchNumber(title, /\(([+-]?\d+(?:\.\d+)?)%\)/);
  const resultValue = state === 'measured' ? proposed : evidenceCandidate;
  const changeValue = current !== undefined && resultValue !== undefined ? resultValue - current : undefined;

  return {
    state,
    current,
    proposed,
    evidenceCandidate,
    changeValue,
    changePercent: rawPercent,
    correctionPercent: matchNumber(title, /\bRobust median ([+-]?\d+(?:\.\d+)?)%/i),
    spreadPercent: matchNumber(title, /\bspread ([+-]?\d+(?:\.\d+)?)%/i),
    confidence: confidenceFromTitle(title),
    weight: matchNumber(title, /\bweight ([+-]?\d+(?:\.\d+)?)/i),
    samples: matchNumber(title, /\bsamples (\d+)/i),
  };
}

function clean(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function signed(value: number, digits: number, suffix = ''): string {
  return `${value > 0 ? '+' : ''}${clean(value, digits)}${suffix}`;
}

export function confidenceRank(confidence: VeRenderedConfidence | undefined): number | undefined {
  switch (confidence) {
    case 'limited': return 1;
    case 'moderate': return 2;
    case 'strong': return 3;
    case 'none': return 0;
    default: return undefined;
  }
}

export function veResultDisplay(
  metrics: VeRenderedCellMetrics,
  view: VeResultView,
  delayMs?: number,
): VeResultDisplay {
  switch (view) {
    case 'proposal': {
      const value = metrics.state === 'measured' ? metrics.proposed : metrics.current;
      return { text: value === undefined ? '—' : clean(value, 2), numericValue: value, scaleMode: 'base' };
    }
    case 'change':
      return { text: metrics.changeValue === undefined ? '—' : signed(metrics.changeValue, 2), numericValue: metrics.changeValue, scaleMode: 'magnitude' };
    case 'change-percent':
      return { text: metrics.changePercent === undefined ? '—' : signed(metrics.changePercent, 1, '%'), numericValue: metrics.changePercent, scaleMode: 'magnitude' };
    case 'mixture-error':
      return { text: metrics.correctionPercent === undefined ? '—' : signed(metrics.correctionPercent, 1, '%'), numericValue: metrics.correctionPercent, scaleMode: 'magnitude' };
    case 'samples':
      return { text: metrics.samples === undefined ? '—' : String(Math.round(metrics.samples)), numericValue: metrics.samples, scaleMode: 'quality' };
    case 'weight':
      return { text: metrics.weight === undefined ? '—' : clean(metrics.weight, 2), numericValue: metrics.weight, scaleMode: 'quality' };
    case 'confidence': {
      const rank = confidenceRank(metrics.confidence);
      const text = metrics.confidence && metrics.confidence !== 'none'
        ? `${metrics.confidence[0]!.toUpperCase()}${metrics.confidence.slice(1)}`
        : '—';
      return { text, numericValue: rank, scaleMode: 'quality' };
    }
    case 'spread':
      return { text: metrics.spreadPercent === undefined ? '—' : `${clean(metrics.spreadPercent, 1)}%`, numericValue: metrics.spreadPercent, scaleMode: 'magnitude' };
    case 'delay':
      return { text: delayMs === undefined ? '—' : `${Math.round(delayMs)}`, numericValue: delayMs, scaleMode: 'range' };
  }
}
