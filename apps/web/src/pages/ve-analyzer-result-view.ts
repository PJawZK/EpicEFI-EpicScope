import { formatVeMetric as clean, formatSignedVeMetric as signed } from './ve-metric-format';
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

export type VeRenderedProposalState = import('../../../../core/analysis/ve-proposal').VeProposalState;
export type VeRenderedConfidence = 'none' | 'limited' | 'moderate' | 'strong';

export interface VeCellMetrics {
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
  { value: 'proposal', label: 'Working VE' },
  { value: 'change', label: 'Analysis VE change' },
  { value: 'change-percent', label: 'Analysis VE change %' },
  { value: 'mixture-error', label: 'Base-VE correction %' },
  { value: 'samples', label: 'Samples' },
  { value: 'weight', label: 'Evidence weight' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'spread', label: 'Spread %' },
  { value: 'delay', label: 'Lambda delay ms' },
] as const;

function baseDisplay(metrics: VeCellMetrics, digits: number): VeResultDisplay {
  return {
    text: metrics.current === undefined ? '—' : clean(metrics.current, digits),
    numericValue: metrics.current,
    scaleMode: 'base',
  };
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
  metrics: VeCellMetrics,
  view: VeResultView,
  delayMs?: number,
  digits = 2,
): VeResultDisplay {
  switch (view) {
    case 'proposal': {
      const value = metrics.state === 'measured' ? metrics.proposed : metrics.current;
      return { text: value === undefined ? '—' : clean(value, digits), numericValue: value, scaleMode: 'base' };
    }
    case 'change':
      return metrics.changeValue === undefined
        ? baseDisplay(metrics, digits)
        : { text: signed(metrics.changeValue, 2), numericValue: metrics.changeValue, scaleMode: 'magnitude' };
    case 'change-percent':
      return metrics.changePercent === undefined
        ? baseDisplay(metrics, digits)
        : { text: signed(metrics.changePercent, 1, '%'), numericValue: metrics.changePercent, scaleMode: 'magnitude' };
    case 'mixture-error':
      return metrics.correctionPercent === undefined
        ? baseDisplay(metrics, digits)
        : { text: signed(metrics.correctionPercent, 1, '%'), numericValue: metrics.correctionPercent, scaleMode: 'magnitude' };
    case 'samples':
      return metrics.samples === undefined
        ? baseDisplay(metrics, digits)
        : { text: String(Math.round(metrics.samples)), numericValue: metrics.samples, scaleMode: 'quality' };
    case 'weight':
      return metrics.weight === undefined
        ? baseDisplay(metrics, digits)
        : { text: clean(metrics.weight, 3), numericValue: metrics.weight, scaleMode: 'quality' };
    case 'confidence': {
      const rank = confidenceRank(metrics.confidence);
      if (rank === undefined || !metrics.confidence || metrics.confidence === 'none') return baseDisplay(metrics, digits);
      const text = `${metrics.confidence[0]!.toUpperCase()}${metrics.confidence.slice(1)}`;
      return { text, numericValue: rank, scaleMode: 'quality' };
    }
    case 'spread':
      return metrics.spreadPercent === undefined
        ? baseDisplay(metrics, digits)
        : { text: `${clean(metrics.spreadPercent, 1)}%`, numericValue: metrics.spreadPercent, scaleMode: 'magnitude' };
    case 'delay':
      return delayMs === undefined
        ? baseDisplay(metrics, digits)
        : { text: `${Math.round(delayMs)}`, numericValue: delayMs, scaleMode: 'range' };
  }
}
