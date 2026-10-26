const installedRoots = new WeakSet<HTMLElement>();

/**
 * Presentation-only compound-control policy for the frozen v50 setup row.
 * Native <details> remains the disclosure owner; this only prevents overlapping
 * setup popovers by keeping at most one compact setup group open at a time.
 */
export function installVeAnalyzerV50SetupDisclosurePolicy(root: HTMLElement): () => void {
  if (installedRoots.has(root)) return () => {};
  installedRoots.add(root);

  const events = new AbortController();
  const groups = [...root.querySelectorAll<HTMLDetailsElement>('.ve-v50-setup-group')];
  for (const group of groups) {
    group.addEventListener('toggle', () => {
      if (!group.open) return;
      for (const sibling of groups) {
        if (sibling !== group && sibling.open) sibling.open = false;
      }
    }, { signal: events.signal });
  }
  return () => { events.abort(); closeVeAnalyzerSetupDisclosures(root); installedRoots.delete(root); };
}

/** Tool owners share the compact disclosure closing policy. */
export function closeVeAnalyzerSetupDisclosures(root: HTMLElement): void {
  for (const group of root.querySelectorAll<HTMLDetailsElement>('.ve-v50-setup-group')) group.open = false;
}
