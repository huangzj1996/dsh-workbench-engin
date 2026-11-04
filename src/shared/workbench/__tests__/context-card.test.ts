import { describe, expect, it } from 'vitest';

import { contextCardMarkdown } from '../context-card';

describe('contextCardMarkdown', () => {
  it('names the workbench, carries its id and the description as the purpose', () => {
    const markdown = contextCardMarkdown({
      id: 'demo',
      name: 'Demo',
      description: '给 AI 的工作台说明',
    });

    expect(markdown).toContain('# Demo');
    expect(markdown).toContain('`demo`');
    expect(markdown).toContain('给 AI 的工作台说明');
  });

  it('falls back to a placeholder purpose when the workbench has no description', () => {
    const markdown = contextCardMarkdown({ id: 'demo', name: 'Demo' });

    expect(markdown).toContain('（待补充）');
  });

  it('ships the five sections the card is meant to answer', () => {
    const markdown = contextCardMarkdown({ id: 'demo', name: 'Demo' });

    for (const heading of ['用途', '边界', '可以放什么', '不要放什么']) {
      expect(markdown).toContain(`## ${heading}`);
    }
  });
});
