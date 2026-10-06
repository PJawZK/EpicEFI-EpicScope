import type { LoggerAnalysisContext } from './logger-page';

export interface AnalyzerScope {
  readonly kind: 'full' | 'range';
  readonly label: string;
  readonly startMs?: number;
  readonly endMs?: number;
}

export function populateAnalyzerScopeSelect(
  select: HTMLSelectElement,
  context: LoggerAnalysisContext,
  preferred: string,
): void {
  select.replaceChildren(new Option('Full Log', 'full'));
  if (context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs) {
    select.add(new Option('Current A/B', 'ab'));
  }
  context.savedRanges.forEach((range, index) => select.add(new Option(range.label, `saved:${index}`)));
  if ([...select.options].some((option) => option.value === preferred)) select.value = preferred;
}

export function selectedAnalyzerScope(
  select: HTMLSelectElement,
  context: LoggerAnalysisContext,
): AnalyzerScope | undefined {
  if (select.value === 'full') return { kind: 'full', label: 'Full Log' };
  if (select.value === 'ab') {
    if (context.aTimeMs === undefined || context.bTimeMs === undefined || context.aTimeMs === context.bTimeMs) return undefined;
    return { kind: 'range', label: 'Current A/B', startMs: context.aTimeMs, endMs: context.bTimeMs };
  }
  if (!select.value.startsWith('saved:')) return undefined;
  const index = Number(select.value.slice('saved:'.length));
  const saved = Number.isInteger(index) ? context.savedRanges[index] : undefined;
  return saved
    ? { kind: 'range', label: saved.label, startMs: saved.startMs, endMs: saved.endMs }
    : undefined;
}

export function analyzerScopeBounds(scope: AnalyzerScope): { startMs?: number; endMs?: number } {
  if (scope.kind === 'full' || scope.startMs === undefined || scope.endMs === undefined) return {};
  return {
    startMs: Math.min(scope.startMs, scope.endMs),
    endMs: Math.max(scope.startMs, scope.endMs),
  };
}
