import { describe, expect, it } from 'vitest';
import { veResultViewUsesNeutralFallback } from '../../apps/web/src/pages/ve-analyzer-result-heat';

describe('VE Analyzer Result View fallback heat', () => {
  const weak = 'Weak evidence only. Raw candidate 77 (+10.0%); no proposal is emitted. Robust median +10.0%; P10 +8.0%; P90 +12.0%; spread 4.0%; confidence limited; weight 3.500; samples 8.';
  const evidenceOnly = 'Robust median +4.0%; P10 +2.0%; P90 +6.0%; spread 4.0%; confidence moderate; weight 2.000; samples 5.';

  it('neutralizes alternate views only when that cell lacks the selected metric', () => {
    expect(veResultViewUsesNeutralFallback('', 90, 'samples')).toBe(true);
    expect(veResultViewUsesNeutralFallback(evidenceOnly, 80, 'change')).toBe(true);
    expect(veResultViewUsesNeutralFallback(weak, 70, 'samples')).toBe(false);
    expect(veResultViewUsesNeutralFallback(evidenceOnly, 80, 'confidence')).toBe(false);
  });

  it('leaves Proposed VE and Lambda Delay heat under the existing owners', () => {
    expect(veResultViewUsesNeutralFallback('', 90, 'proposal')).toBe(false);
    expect(veResultViewUsesNeutralFallback('', 90, 'delay')).toBe(false);
  });
});
