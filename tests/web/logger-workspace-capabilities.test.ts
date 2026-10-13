import { describe, expect, it } from 'vitest';

import { loggerWorkspaceEditingAvailable } from '../../apps/web/src/state/logger-workspace-capabilities';

describe('Logger workspace editing capability', () => {
  it('allows workspace editing from an INI catalog before sample data is loaded', () => {
    expect(loggerWorkspaceEditingAvailable(2519)).toBe(true);
  });

  it('allows workspace editing from source channels when sample data is loaded', () => {
    expect(loggerWorkspaceEditingAvailable(1389)).toBe(true);
  });

  it('keeps workspace selection disabled when no channels are known', () => {
    expect(loggerWorkspaceEditingAvailable(0)).toBe(false);
  });
});
