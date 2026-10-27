import { mergeIdleRegionBounds, type IdleRegionBounds } from '../../../../core/analysis/idle-regions';

export interface IdleManagedRegion extends IdleRegionBounds {
  readonly id: string;
  readonly label: string;
  readonly included: boolean;
  readonly origin: 'manual' | 'candidate';
  readonly edited: boolean;
  readonly boundsEdited: boolean;
}
/** Source-bound region definitions only. Does not own Logger ranges or recorded arrays. */
export function createIdleRegionSession() {
  let source: object | undefined, revision: number | undefined, extent: IdleRegionBounds | undefined;
  let regions: readonly IdleManagedRegion[] = [], nextId = 0;
  const valid = (bounds: IdleRegionBounds) => !!source && !!extent && Number.isFinite(bounds.startMs) && Number.isFinite(bounds.endMs)
    && bounds.startMs >= extent.startMs && bounds.endMs <= extent.endMs && bounds.endMs > bounds.startMs;
  return {
    get regions() { return regions; },
    bind(next: object | undefined, nextRevision: number | undefined, nextExtent: IdleRegionBounds | undefined) {
      const changed = source !== next || revision !== nextRevision;
      source = next; revision = nextRevision; extent = nextExtent;
      if (changed) { regions = []; nextId = 0; }
      return changed;
    },
    includedBounds() { return mergeIdleRegionBounds(regions.filter(region => region.included)); },
    add(bounds: IdleRegionBounds, label = 'Manual region') {
      if (!valid(bounds)) throw new Error('Enter start < end inside the current recording. Previous regions retained.');
      if (regions.length >= 200) throw new Error('Region limit reached (200). Remove a region before adding another.');
      const region: IdleManagedRegion = { ...bounds, id: `region:${++nextId}`, label: label.trim().slice(0, 100) || 'Manual region', included: true, origin: 'manual', edited: false, boundsEdited: false };
      regions = [...regions, region]; return region;
    },
    addCandidates(bounds: readonly IdleRegionBounds[]) {
      let added = 0;
      for (const candidate of bounds) {
        if (!valid(candidate) || regions.some(region => region.startMs === candidate.startMs && region.endMs === candidate.endMs) || regions.length >= 200) continue;
        regions = [...regions, { startMs: candidate.startMs, endMs: candidate.endMs, id: `region:${++nextId}`, label: `RPM candidate ${nextId}`, included: false, origin: 'candidate', edited: false, boundsEdited: false }]; added++;
      }
      return added;
    },
    edit(id: string, bounds: IdleRegionBounds, label: string) {
      if (!valid(bounds)) throw new Error('Enter start < end inside the current recording. Previous regions retained.');
      regions = regions.map(region => region.id === id ? { ...region, ...bounds, label: label.trim().slice(0, 100) || region.label, edited: true, boundsEdited: region.boundsEdited || region.startMs !== bounds.startMs || region.endMs !== bounds.endMs } : region);
    },
    include(id: string | undefined, included: boolean) { regions = regions.map(region => id === undefined || region.id === id ? { ...region, included } : region); },
    remove(id: string) { regions = regions.filter(region => region.id !== id); },
  };
}
