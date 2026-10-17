import type { VeProposalEditOwner } from './ve-analyzer-proposal-edit-owner';

/** Target uses its own working table, not the VE proposal edit surface.
 * This registry only connects the semantic v2 owner to shared UI tools. */
const owners = new WeakMap<HTMLElement, VeProposalEditOwner>();

export function registerVeTargetEditOwner(root: HTMLElement, owner: VeProposalEditOwner): void {
  owners.set(root, owner);
}

export function veTargetEditOwner(root: HTMLElement): VeProposalEditOwner | undefined {
  return owners.get(root);
}
