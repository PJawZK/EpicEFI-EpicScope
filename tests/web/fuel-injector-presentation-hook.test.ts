import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Fuel Pressure / Injector presentation hook', () => {
  it('runs from the analyzer hierarchy observer that owns summary disclosure', () => {
    const source = readFileSync('apps/web/src/app/analyzer-information-hierarchy.ts', 'utf8');
    expect(source).toContain("import { ensureFuelInjectorAnalyzerPresentation } from '../pages/fuel-injector-analyzer-presentation';");
    expect(source).toContain('ensureFuelInjectorAnalyzerPresentation(root);');
  });

  it('keeps the decision summary separate from the raw specialized summary', () => {
    const presentation = readFileSync('apps/web/src/pages/fuel-injector-analyzer-presentation.ts', 'utf8');
    const hierarchy = readFileSync('apps/web/src/app/analyzer-information-hierarchy.ts', 'utf8');
    expect(presentation).toContain('.specialized-analyzer-summary:not(.fuel-injector-decision-summary)');
    expect(hierarchy).toContain('.specialized-analyzer-summary:not(.fuel-injector-decision-summary)');
  });
});
