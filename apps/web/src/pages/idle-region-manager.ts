import type { IdleManagedRegion } from './idle-region-session';
import type { IdleRegionBounds } from '../../../../core/analysis/idle-regions';

export type IdleRegionAction =
  | { type: 'include'; id: string | undefined; included: boolean }
  | { type: 'edit'; id: string; bounds: IdleRegionBounds; label: string }
  | { type: 'add'; bounds: IdleRegionBounds; label: string }
  | { type: 'remove' | 'focus'; id: string }
  | { type: 'analyze' };
/** Scoped native dialog. Draft inputs are not semantic region authority until Apply. */
export function createIdleRegionManager(signal: AbortSignal, action: (action: IdleRegionAction) => void) {
  const element = document.createElement('dialog'); element.className = 'idle-region-manager';
  element.setAttribute('aria-label', 'Manage Idle regions');
  element.innerHTML = `<header><h2>Manage regions</h2><button type="button" data-manager="close" aria-label="Close region manager">×</button></header>
    <p>Include regions for combined analysis. View changes only graph focus. RPM candidates require throttle, temperature and load review; new candidates start excluded.</p>
    <p data-manager="authority"></p><p>Candidate rows are retained snapshots. Find candidates refreshes current suggestions; existing regions and inclusion choices are preserved.</p>
    <p data-manager="summary"></p><p data-manager="message" role="status" aria-live="polite"></p>
    <div class="idle-region-table"><table><thead><tr><th>Use</th><th>Region</th><th>Start (s)</th><th>End (s)</th><th>Duration</th><th>Origin</th><th>Actions</th></tr></thead><tbody></tbody></table></div>
    <section class="idle-region-create"><strong>Add manual interval</strong><label>Name <input data-new="label" value="Manual region" maxlength="100"></label><label>Start (s)<input data-new="start" type="number" step="any"></label><label>End (s)<input data-new="end" type="number" step="any"></label><button type="button" data-manager="add">Add region</button></section>
    <footer><button type="button" data-manager="all">Include all</button><button type="button" data-manager="none">Exclude all</button><button type="button" data-manager="analyze">Analyze included regions</button><button type="button" data-manager="close">Done</button></footer>`;
  let previous: readonly IdleManagedRegion[] | undefined;
  const body = element.querySelector('tbody')!;
  const input = (root: ParentNode, name: string, prefix: string) => root.querySelector<HTMLInputElement>(`[data-${prefix}="${name}"]`)!;
  const bounds = (root: ParentNode, prefix: string): IdleRegionBounds => {
    const a = input(root, 'start', prefix).value, b = input(root, 'end', prefix).value;
    return { startMs: a.trim() ? Number(a) * 1000 : NaN, endMs: b.trim() ? Number(b) * 1000 : NaN };
  };
  element.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!button) return;
    const kind = button.dataset.manager;
    if (kind === 'close') { element.close(); return; }
    if (kind === 'add') { action({ type: 'add', bounds: bounds(element, 'new'), label: input(element, 'label', 'new').value }); return; }
    if (kind === 'analyze') { action({ type: 'analyze' }); return; }
    if (kind === 'all' || kind === 'none') { action({ type: 'include', id: undefined, included: kind === 'all' }); return; }
    const row = button.closest<HTMLTableRowElement>('tr[data-region-id]'); if (!row) return;
    if (kind === 'edit') action({ type: 'edit', id: row.dataset.regionId!, bounds: bounds(row, 'edit'), label: input(row, 'label', 'edit').value });
    if (kind === 'remove' || kind === 'focus') action({ type: kind, id: row.dataset.regionId! });
  }, { signal });
  element.addEventListener('change', event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.dataset.include !== undefined) action({ type: 'include', id: input.closest<HTMLTableRowElement>('tr')!.dataset.regionId!, included: input.checked });
  }, { signal });
  return {
    element,
    resetDrafts() { for (const name of ['start', 'end']) input(element, name, 'new').value = ''; input(element, 'label', 'new').value = 'Manual region'; },
    open() { if (!element.open) element.showModal(); },
    close() { if (element.open) element.close(); },
    message(text: string) { element.querySelector('[data-manager=message]')!.textContent = text; },
    update(regions: readonly IdleManagedRegion[], focusId: string, extent: IdleRegionBounds | undefined, scopeLabel: string, combined: boolean) {
      element.querySelector('[data-manager=authority]')!.textContent = `Current metrics: ${scopeLabel}. ${combined ? 'Checked regions are applied.' : 'Checked regions are not the analysis scope. Press Analyze included regions to apply them.'}`;
      element.querySelector('[data-manager=summary]')!.textContent = `${regions.filter(r => r.included).length}/${regions.length} included · overlaps counted once · up to 200 regions · session only`;
      if (previous !== regions) {
        previous = regions; body.replaceChildren();
        for (const region of regions) {
          const row = document.createElement('tr'); row.dataset.regionId = region.id;
          row.innerHTML = `<td><input type="checkbox" data-include></td><td><input data-edit="label" maxlength="100"></td><td><input type="number" data-edit="start" step="any"></td><td><input type="number" data-edit="end" step="any"></td><td data-duration></td><td data-origin></td><td><button type="button" data-manager="focus">View</button><button type="button" data-manager="edit">Apply</button><button type="button" data-manager="remove">Delete</button></td>`;
          const include = row.querySelector<HTMLInputElement>('[data-include]')!; include.checked = region.included; include.setAttribute('aria-label', `Include ${region.label}`);
          for (const [name, value] of [['label', region.label], ['start', String(region.startMs / 1000)], ['end', String(region.endMs / 1000)]]) {
            const node = input(row, name!, 'edit'); node.value = value!; node.setAttribute('aria-label', `${region.label} ${name}`);
          }
          row.querySelector('[data-duration]')!.textContent = `${((region.endMs - region.startMs) / 1000).toFixed(2)} s`;
          row.querySelector('[data-origin]')!.textContent = `${region.origin}${region.edited ? ' · edited' : ''}`;
          body.append(row);
        }
      }
      for (const row of body.querySelectorAll<HTMLTableRowElement>('tr')) row.classList.toggle('is-focused', row.dataset.regionId === focusId);
      if (extent) for (const name of ['start', 'end']) {
        const node = input(element, name, 'new'); node.min = String(extent.startMs / 1000); node.max = String(extent.endMs / 1000);
        if (!node.value) node.value = String((name === 'start' ? extent.startMs : extent.endMs) / 1000);
      }
    },
  };
}
