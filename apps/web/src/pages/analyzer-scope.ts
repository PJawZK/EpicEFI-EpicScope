import type { LoggerAnalysisContext } from './logger-page';

export interface AnalyzerScope {
  readonly kind: 'full' | 'range';
  readonly label: string;
  readonly startMs?: number;
  readonly endMs?: number;
}

export interface AnalyzerScopeOption extends AnalyzerScope { readonly value: string; }

function validRange(start: number | undefined, end: number | undefined): boolean {
  return start !== undefined && end !== undefined && Number.isFinite(start) && Number.isFinite(end) && start !== end;
}

/** Project real Logger ranges; option indices still refer to the original array. */
export function analyzerScopeOptions(context: LoggerAnalysisContext): AnalyzerScopeOption[] {
  const options: AnalyzerScopeOption[] = [{ value: 'full', kind: 'full', label: 'Full Log' }];
  if (validRange(context.aTimeMs, context.bTimeMs)) options.push({ value: 'ab', kind: 'range', label: 'Current A/B', startMs: context.aTimeMs!, endMs: context.bTimeMs! });
  context.savedRanges.forEach((range, index) => {
    if (validRange(range.startMs, range.endMs)) options.push({ value: `saved:${index}`, kind: 'range', label: range.label, startMs: range.startMs, endMs: range.endMs });
  });
  return options;
}

/** Saved ranges have no persisted IDs. Retain exact semantics, then an unambiguous
 * rename at identical bounds. Removed/edited/ambiguous ranges fall back to Full. */
export function retainedAnalyzerScopeValue(value: string, previous: LoggerAnalysisContext, next: LoggerAnalysisContext): string {
  if (!value.startsWith('saved:')) return value;
  const old = analyzerScopeOptions(previous).find(option => option.value === value);
  if (!old) return 'full';
  const bounds = analyzerScopeBounds(old);
  const matches = analyzerScopeOptions(next).filter(option => option.value.startsWith('saved:')
    && JSON.stringify(analyzerScopeBounds(option)) === JSON.stringify(bounds));
  return matches.find(option => option.label === old.label)?.value ?? (matches.length === 1 ? matches[0]!.value : 'full');
}

export function populateAnalyzerScopeSelect(select: HTMLSelectElement, context: LoggerAnalysisContext, preferred: string): void {
  select.replaceChildren(...analyzerScopeOptions(context).map(option => new Option(option.label, option.value)));
  if ([...select.options].some(option => option.value === preferred)) select.value = preferred;
}

export function selectedAnalyzerScope(
  select: HTMLSelectElement,
  context: LoggerAnalysisContext,
): AnalyzerScope | undefined {
  if (select.value === 'full') return { kind: 'full', label: 'Full Log' };
  if (select.value === 'ab') {
    if (!validRange(context.aTimeMs, context.bTimeMs)) return undefined;
    return { kind: 'range', label: 'Current A/B', startMs: context.aTimeMs!, endMs: context.bTimeMs! };
  }
  if (!select.value.startsWith('saved:')) return undefined;
  const index = Number(select.value.slice('saved:'.length));
  const saved = Number.isInteger(index) ? context.savedRanges[index] : undefined;
  return saved && validRange(saved.startMs, saved.endMs)
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
