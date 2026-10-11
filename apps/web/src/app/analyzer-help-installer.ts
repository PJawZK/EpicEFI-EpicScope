import { ensureAdditionalAnalyzerHelp } from '../pages/analyzer-additional-help';
import { ensureAnalyzerSectionHelp } from '../pages/analyzer-section-help';

const INSTALLED = new WeakSet<HTMLElement>();

export function installAnalyzerHelp(root: HTMLElement): void {
  if (INSTALLED.has(root)) return;
  INSTALLED.add(root);

  const apply = (): void => {
    ensureAdditionalAnalyzerHelp(root);
    ensureAnalyzerSectionHelp(root);
  };
  apply();

  const observer = new MutationObserver(() => {
    observer.disconnect();
    try {
      apply();
    } finally {
      observer.observe(root, { childList: true, subtree: true });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}
