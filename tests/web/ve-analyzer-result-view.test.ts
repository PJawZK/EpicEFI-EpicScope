import { describe, expect, it } from 'vitest';
import {
  parseVeRenderedCellMetrics,
  veResultDisplay,
} from '../../apps/web/src/pages/ve-analyzer-result-view';

describe('VE Analyzer result views', () => {
  it('extracts measured proposal and evidence metrics from the canonical cell detail', () => {
    const metrics = parseVeRenderedCellMetrics(
      'Measured proposal. Current 60, proposed 63, change +5.0%. Robust median +10.0%; P10 +6.0%; P90 +14.0%; spread 8.0%; confidence strong; weight 20.500; samples 42.',
      '63',
    );

    expect(metrics.state).toBe('measured');
    expect(metrics.current).toBe(60);
    expect(metrics.proposed).toBe(63);
    expect(metrics.changeValue).toBe(3);
    expect(metrics.changePercent).toBe(5);
    expect(metrics.correctionPercent).toBe(10);
    expect(metrics.spreadPercent).toBe(8);
    expect(metrics.confidence).toBe('strong');
    expect(metrics.weight).toBe(20.5);
    expect(metrics.samples).toBe(42);
  });

  it('keeps weak evidence distinct from an emitted proposal while exposing raw change views', () => {
    const metrics = parseVeRenderedCellMetrics(
      'Weak evidence only. Raw candidate 66 (+10.0%); no proposal is emitted. Robust median +10.0%; P10 +8.0%; P90 +12.0%; spread 4.0%; confidence limited; weight 2.500; samples 5.',
      '60',
    );

    expect(metrics.state).toBe('weak-evidence');
    expect(veResultDisplay(metrics, 'proposal').text).toBe('60');
    expect(veResultDisplay(metrics, 'change').text).toBe('+6');
    expect(veResultDisplay(metrics, 'change-percent').text).toBe('+10%');
  });

  it('exposes evidence and delay views without inventing unavailable values', () => {
    const metrics = parseVeRenderedCellMetrics(
      'Robust median -3.5%; P10 -5.0%; P90 -1.0%; spread 4.0%; confidence moderate; weight 9.250; samples 18.',
      '72',
    );

    expect(veResultDisplay(metrics, 'mixture-error').text).toBe('-3.5%');
    expect(veResultDisplay(metrics, 'samples').text).toBe('18');
    expect(veResultDisplay(metrics, 'weight').text).toBe('9.25');
    expect(veResultDisplay(metrics, 'confidence').text).toBe('Moderate');
    expect(veResultDisplay(metrics, 'spread').text).toBe('4%');
    expect(veResultDisplay(metrics, 'delay').text).toBe('—');
    expect(veResultDisplay(metrics, 'delay', 187.6).text).toBe('188');
  });
});
