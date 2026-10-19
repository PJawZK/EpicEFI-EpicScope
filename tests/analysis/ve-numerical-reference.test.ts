import { describe, expect, it } from 'vitest';
import { VE_NUMERICAL_REFERENCES } from '../fixtures/ve-numerical-references';

function matches(actual: unknown, expected: unknown): void {
  if (typeof expected === 'number' && Number.isFinite(expected)) {
    expect(typeof actual).toBe('number'); expect(actual).toBeCloseTo(expected, 10);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true); expect((actual as unknown[]).length).toBe(expected.length);
    expected.forEach((value, index) => matches((actual as unknown[])[index], value));
  } else if (expected && typeof expected === 'object') {
    expect(actual).toBeTruthy(); expect(Object.keys(actual as object)).toEqual(Object.keys(expected));
    for (const [key, value] of Object.entries(expected)) matches((actual as Record<string, unknown>)[key], value);
  } else expect(actual).toEqual(expected);
}

describe('VE v50 independent numerical reference ledger', () => {
  for (const reference of VE_NUMERICAL_REFERENCES) {
    // Explicit expected failures keep known mathematical discrepancies visible.
    // Group 4 must remove .fails only after correcting the owner and validating.
    const test = reference.knownIssue ? it.fails : it;
    test(`${reference.id}: ${reference.title}${reference.knownIssue ? ' [KNOWN ISSUE: ' + reference.knownIssue + ']' : ''}`, async () => {
      matches(await reference.run(), reference.expected);
    });
  }
});
