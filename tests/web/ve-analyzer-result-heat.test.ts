import { describe, expect, it } from 'vitest';
import { parseVeRenderedCellMetrics, veResultDisplay, type VeResultView } from '../../apps/web/src/pages/ve-analyzer-result-view';
import { veResultViewUsesNeutralFallback } from '../../apps/web/src/pages/ve-analyzer-result-heat';

function neutral(title: string, current: number, view: VeResultView): boolean {
  return veResultViewUsesNeutralFallback(view, veResultDisplay(parseVeRenderedCellMetrics(title, String(current)), view));
}

describe('VE Analyzer Result View fallback heat', () => {
  const weak = 'Weak evidence only. Raw candidate 77 (+10.0%); no proposal is emitted. Robust median +10.0%; P10 +8.0%; P90 +12.0%; spread 4.0%; confidence limited; weight 3.500; samples 8.';
  const evidenceOnly = 'Robust median +4.0%; P10 +2.0%; P90 +6.0%; spread 4.0%; confidence moderate; weight 2.000; samples 5.';

  it('neutralizes alternate views only when that cell lacks the selected metric', () => {
    expect(neutral('', 90, 'samples')).toBe(true);
    expect(neutral(evidenceOnly, 80, 'change')).toBe(true);
    expect(neutral(weak, 70, 'samples')).toBe(false);
    expect(neutral(evidenceOnly, 80, 'confidence')).toBe(false);
  });

  it('leaves Proposed VE and Lambda Delay heat under the Result View owner', () => {
    expect(neutral('', 90, 'proposal')).toBe(false);
    expect(neutral('', 90, 'delay')).toBe(false);
  });
});
