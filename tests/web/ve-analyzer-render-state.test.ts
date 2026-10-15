import { describe, expect, it } from 'vitest';
import { parseVeCanonicalRenderText } from '../../apps/web/src/pages/ve-analyzer-render-state';

describe('VE Analyzer authoritative render snapshot', () => {
  it('preserves exact current VE text', () => {
    expect(parseVeCanonicalRenderText('70.125')).toEqual({ currentText: '70.125' });
  });

  it('preserves exact current and proposed VE text', () => {
    expect(parseVeCanonicalRenderText('70.125 → 70.375')).toEqual({
      currentText: '70.125',
      proposalText: '70.375',
    });
  });

  it('rejects result-view text that is not canonical VE input', () => {
    expect(parseVeCanonicalRenderText('Moderate')).toBeUndefined();
    expect(parseVeCanonicalRenderText('—')).toBeUndefined();
  });
});
