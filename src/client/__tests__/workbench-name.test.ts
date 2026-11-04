import { describe, expect, it } from 'vitest';

import { normalizeWorkbenchName, syncNameDraft } from '../workbench-name';

describe('normalizeWorkbenchName', () => {
  it('trims whitespace around the name', () => {
    expect(normalizeWorkbenchName('  我的工作台  ')).toBe('我的工作台');
  });

  it('rejects a name that is empty after trimming', () => {
    expect(normalizeWorkbenchName('   ')).toBeNull();
    expect(normalizeWorkbenchName('')).toBeNull();
  });
});

describe('syncNameDraft', () => {
  it('keeps the raw draft while it still represents the committed name', () => {
    // Typing "My " commits "My"; echo back the raw text, not the trimmed one.
    expect(syncNameDraft('My ', 'My')).toBe('My ');
    expect(syncNameDraft('  我的工作台  ', '我的工作台')).toBe('  我的工作台  ');
  });

  it('adopts a committed name that changed on disk', () => {
    expect(syncNameDraft('旧名字', 'AI 改过的名字')).toBe('AI 改过的名字');
  });

  it('adopts the disk name when the draft is blank or was cleared', () => {
    expect(syncNameDraft('', '磁盘上的名字')).toBe('磁盘上的名字');
    expect(syncNameDraft('   ', '磁盘上的名字')).toBe('磁盘上的名字');
  });
});
