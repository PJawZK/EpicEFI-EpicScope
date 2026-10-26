import { describe, expect, it } from 'vitest';
import { veResultDisplay, type VeCellMetrics, type VeResultView } from '../../apps/web/src/pages/ve-analyzer-result-view';
import { projectVeTable } from '../../apps/web/src/pages/ve-analyzer-table-projection';
import { veResultViewUsesNeutralFallback } from '../../apps/web/src/pages/ve-analyzer-result-heat';

const base = projectVeTable([90], 1, 1).cells[0]!;
const evidence: VeCellMetrics = { ...base, current: 80, correctionPercent: 4, confidence: 'moderate', weight: 2, samples: 5 };
const weak: VeCellMetrics = { ...evidence, state: 'weak-evidence', current: 70, evidenceCandidate: 77, changeValue: 7, changePercent: 10 };
const neutral = (metrics: VeCellMetrics, view: VeResultView) => veResultViewUsesNeutralFallback(view, veResultDisplay(metrics, view));

describe('VE Analyzer Result View fallback heat', () => {
  it('neutralizes alternate views only when that cell lacks the selected metric', () => {
    expect(neutral(base, 'samples')).toBe(true);
    expect(neutral(evidence, 'change')).toBe(true);
    expect(neutral(weak, 'samples')).toBe(false);
    expect(neutral(evidence, 'confidence')).toBe(false);
  });
  it('leaves Proposed VE and Lambda Delay heat under the Result View owner', () => {
    expect(neutral(base, 'proposal')).toBe(false);
    expect(neutral(base, 'delay')).toBe(false);
  });
});
