/** Declared test intent, never measured operating-state or qualification authority. */
export const IDLE_REGION_PURPOSES = {
  idle: 'Steady idle', recovery: 'Idle recovery', raised: 'Raised-RPM hold', entry: 'Transition to idle', custom: 'Custom investigation',
} as const;
export type IdleRegionPurpose = keyof typeof IDLE_REGION_PURPOSES;
export type IdleScopePurpose = IdleRegionPurpose | 'mixed';
export const isIdleRegionPurpose = (value: string): value is IdleRegionPurpose => Object.hasOwn(IDLE_REGION_PURPOSES, value);
export function summarizeIdlePurposes(purposes: readonly IdleRegionPurpose[]): IdleScopePurpose {
  const first = purposes[0] ?? 'custom';
  return purposes.some(purpose => purpose !== first) ? 'mixed' : first;
}
export const idlePurposeNeedsReview = (purpose: IdleScopePurpose) => purpose !== 'idle' && purpose !== 'custom';
export const idleScopePurposeLabel = (purpose: IdleScopePurpose) => purpose === 'mixed' ? 'Mixed test purposes' : IDLE_REGION_PURPOSES[purpose];
