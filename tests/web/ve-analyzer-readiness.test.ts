import { describe, expect, it } from 'vitest';
import { veProposalSettingIssues } from '../../apps/web/src/pages/ve-analyzer-readiness';

describe('VE Analyzer proposal readiness', () => {
  it('reports exact invalid proposal settings', () => {
    expect(veProposalSettingIssues({
      priorWeight: '',
      minimumEvidenceWeight: '5',
      maximumAbsoluteChange: '-1',
      maximumPercentChange: 'abc',
    })).toEqual([
      'Prior weight is blank',
      'Max VE change must be 0 or greater',
      'Max VE change % must be a number',
    ]);
  });

  it('accepts zero and positive numeric settings', () => {
    expect(veProposalSettingIssues({
      priorWeight: '0',
      minimumEvidenceWeight: '5',
      maximumAbsoluteChange: '50',
      maximumPercentChange: '50',
    })).toEqual([]);
  });
});
