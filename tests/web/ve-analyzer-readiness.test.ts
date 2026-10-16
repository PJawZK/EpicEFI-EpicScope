import { describe, expect, it } from 'vitest';
import { veProposalSettingIssues, createVeReadiness, type VeReadinessRow } from '../../apps/web/src/pages/ve-analyzer-readiness';

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


const validRow: VeReadinessRow = { id: 'rpm', name: 'RPM', purpose: 'Primary', required: true, source: 'Engine speed', status: 'Resolved', valid: true, targetSelector: '[data-role="rpm"]' };
const state = { active: true, pending: false, proposed: false, delayState: 'working' as const };
describe('structured VE readiness', () => {
  it('uses explicit validity rather than source/status wording', () => {
    const result = createVeReadiness([{ ...validRow, source: '—', status: 'Missing Mismatch Invalid', valid: true }], state);
    expect(result.canRun).toBe(true);
    expect(result.blockers).toEqual([]);
    const blocked = createVeReadiness([{ ...validRow, status: 'Resolved', valid: false }], state);
    expect(blocked.canRun).toBe(false);
    expect(blocked.blockers[0]).toMatchObject({ code: 'rpm', targetSelector: '[data-role="rpm"]' });
  });
  it('keeps optional missing roles out of blockers', () => {
    const result = createVeReadiness([validRow, { ...validRow, id: 'optional', required: false, valid: false }], state);
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
  it('separates ready inputs from pending and inactive execution', () => {
    expect(createVeReadiness([validRow], { ...state, pending: true })).toMatchObject({ ready: true, canRun: false, text: 'Calculating VE evidence…' });
    expect(createVeReadiness([validRow], { ...state, active: false })).toMatchObject({ ready: true, canRun: false, text: 'VE inactive' });
    expect(createVeReadiness([], state).canRun).toBe(false);
  });
  it('retains actionable delay state and explicit messages without parsing labels', () => {
    const row = { ...validRow, id: 'delay-activate', valid: false, blockerMessage: 'Activate working authority', targetSelector: '[data-ve-analyzer="use-delay"]' };
    expect(createVeReadiness([row], { ...state, delayState: 'recommendation' })).toMatchObject({ delayState: 'recommendation', blockers: [{ code: 'delay-activate', message: 'Activate working authority', targetSelector: row.targetSelector }] });
  });
  it('clears obsolete titles when ready and reflects completed proposal state', () => {
    expect(createVeReadiness([{ ...validRow, valid: false }], state).title).not.toBe('');
    expect(createVeReadiness([validRow], { ...state, proposed: true })).toMatchObject({ title: '', text: 'VE proposal calculated', canRun: true });
  });
});
