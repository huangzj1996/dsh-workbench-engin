import { describe, expect, it } from 'vitest';

import { normalizeWorkbenchName } from '../workbench-name';

describe('normalizeWorkbenchName', () => {
  it('trims whitespace around the name', () => {
    expect(normalizeWorkbenchName('  我的工作台  ')).toBe('我的工作台');
  });

  it('rejects a name that is empty after trimming', () => {
    expect(normalizeWorkbenchName('   ')).toBeNull();
    expect(normalizeWorkbenchName('')).toBeNull();
  });
});
