/** The table owner renders; the installed tool owner reports visibility. */
export interface VeDelayPresentationOwner {
  readonly visible: boolean;
  setVisible(visible: boolean): void;
}
const owners = new WeakMap<HTMLElement, VeDelayPresentationOwner>();
export function registerVeDelayPresentationOwner(root: HTMLElement, owner: VeDelayPresentationOwner): void {
  owners.set(root, owner);
}
export function veDelayPresentationOwner(root: HTMLElement): VeDelayPresentationOwner | undefined {
  return owners.get(root);
}
