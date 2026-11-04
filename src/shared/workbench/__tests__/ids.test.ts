import { describe, expect, it } from 'vitest';

import { generateWorkbenchId, slugifyWorkbenchName } from '../ids';
import { WORKBENCH_ID_PATTERN } from '../schema';

describe('slugifyWorkbenchName', () => {
  it('turns an ASCII name into a lowercase dash slug', () => {
    expect(slugifyWorkbenchName('My First Workbench!')).toBe('my-first-workbench');
  });

  it('is empty when the name has no ASCII letters or digits', () => {
    expect(slugifyWorkbenchName('我的工作台')).toBe('');
    expect(slugifyWorkbenchName('  ')).toBe('');
  });
});

describe('generateWorkbenchId', () => {
  it('uses the slug when it is free', () => {
    expect(generateWorkbenchId('Demo', [])).toBe('demo');
  });

  it('falls back to a random wb- id when the slug is empty', () => {
    // random() = 0 picks the first character of the alphabet every time.
    expect(generateWorkbenchId('我的工作台', [], () => 0)).toBe('wb-aaaaaa');
  });

  it('appends -2, -3 ... until the id is free', () => {
    expect(generateWorkbenchId('Demo', ['demo'])).toBe('demo-2');
    expect(generateWorkbenchId('Demo', ['demo', 'demo-2'])).toBe('demo-3');
  });

  it('keeps a collision suffix inside the 64-character id limit', () => {
    const long = 'a'.repeat(64);
    const id = generateWorkbenchId(long, [long]);
    expect(id).toHaveLength(64);
    expect(id.endsWith('-2')).toBe(true);
    expect(WORKBENCH_ID_PATTERN.test(id)).toBe(true);
  });

  it('keeps legal ids when the collision suffix reaches two digits', () => {
    const long = 'b'.repeat(64);
    const taken: string[] = [long];
    for (let round = 0; round < 10; round += 1) taken.push(generateWorkbenchId(long, taken));
    const id = generateWorkbenchId(long, taken);
    expect(id).toHaveLength(64);
    expect(WORKBENCH_ID_PATTERN.test(id)).toBe(true);
    expect(taken).not.toContain(id);
  });
});
