// Layout selection stays in v7; the installed presentation owns node placement.
const placements = new WeakMap<HTMLElement, () => void>();

export function registerVeTableHeaderPlacement(root: HTMLElement, place: () => void): () => void {
  placements.set(root, place);
  return () => { if (placements.get(root) === place) placements.delete(root); };
}

export function placeAdaptedVeTableHeader(root: HTMLElement): boolean {
  const place = placements.get(root);
  if (!place) return false;
  place();
  return true;
}
