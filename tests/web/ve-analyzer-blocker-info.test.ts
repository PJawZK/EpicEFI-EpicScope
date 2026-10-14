import { describe, expect, it } from 'vitest';
import { describeVeRunBlocker } from '../../apps/web/src/pages/ve-analyzer-blocker-info';

describe('VE Analyzer Run blocker guidance', () => {
  it('explains lambda-delay activation distinctly from discovery', () => {
    const help = describeVeRunBlocker('Activate the lambda-delay recommendation with Use recommendation.');
    expect(help.why).toMatch(/align/i);
    expect(help.fix).toMatch(/Use recommendation/i);
  });

  it('explains proposal authority blockers with a corrective action', () => {
    const help = describeVeRunBlocker('Prior weight is blank');
    expect(help.why).toMatch(/existing VE table/i);
    expect(help.fix).toMatch(/Cell Change|Prior weight/i);
  });

  it('explains actual-mixture blockers without suggesting renamed channels', () => {
    const help = describeVeRunBlocker('Actual mixture — Missing');
    expect(help.why).toMatch(/measured AFR\/Lambda/i);
    expect(help.fix).toMatch(/Gas Scale AFR/i);
  });

  it('provides generic guidance for future unknown blocker types', () => {
    const help = describeVeRunBlocker('Future required condition');
    expect(help.why.length).toBeGreaterThan(20);
    expect(help.fix).toMatch(/Fix/i);
  });
});
