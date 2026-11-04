import { describe, expect, it } from 'vitest';

import {
  LAST_WORKBENCH_KEY,
  clearLastWorkbench,
  pickWorkbenchAfterDelete,
  readLastWorkbench,
  writeLastWorkbench,
  type KeyValueStore,
} from '../workbench-session';
import type { WorkbenchListEntry } from '../../shared/workbench/protocol';

/** In-memory stand-in for `localStorage`. */
function memoryStore(): KeyValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

/** One list row; only the fields navigation looks at matter. */
function entry(
  id: string,
  status: WorkbenchListEntry['status'] = 'ok',
  order = 1,
): WorkbenchListEntry {
  return { id, name: id, status, order };
}

describe('last used workbench', () => {
  it('remembers the id under the agreed localStorage key', () => {
    const store = memoryStore();

    writeLastWorkbench(store, 'alpha');

    expect(store.values.get(LAST_WORKBENCH_KEY)).toBe('alpha');
    expect(LAST_WORKBENCH_KEY).toBe('dsh-hello-word:last-workbench');
    expect(readLastWorkbench(store)).toBe('alpha');
  });

  it('reports nothing when the store is missing, empty or holds whitespace', () => {
    expect(readLastWorkbench(null)).toBeNull();

    const store = memoryStore();
    expect(readLastWorkbench(store)).toBeNull();
    store.setItem(LAST_WORKBENCH_KEY, '   ');
    expect(readLastWorkbench(store)).toBeNull();
  });

  it('never writes an empty id and can clear the pointer', () => {
    const store = memoryStore();

    writeLastWorkbench(store, '');
    expect(store.values.has(LAST_WORKBENCH_KEY)).toBe(false);

    writeLastWorkbench(store, 'alpha');
    clearLastWorkbench(store);
    expect(readLastWorkbench(store)).toBeNull();
  });

  it('survives a storage that throws (private mode / quota)', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };

    expect(readLastWorkbench(throwing)).toBeNull();
    expect(() => writeLastWorkbench(throwing, 'alpha')).not.toThrow();
    expect(() => clearLastWorkbench(throwing)).not.toThrow();
  });
});

describe('selecting a workbench after delete', () => {
  it('selects the next workbench in index order', () => {
    const before = [entry('alpha', 'ok', 1), entry('beta', 'ok', 2), entry('gamma', 'ok', 3)];
    const after = [entry('alpha', 'ok', 1), entry('gamma', 'ok', 3)];

    expect(pickWorkbenchAfterDelete(before, after, 'beta')).toBe('gamma');
  });

  it('selects the previous workbench when the last one is deleted', () => {
    const before = [entry('alpha', 'ok', 1), entry('beta', 'ok', 2)];
    const after = [entry('alpha', 'ok', 1)];

    expect(pickWorkbenchAfterDelete(before, after, 'beta')).toBe('alpha');
  });

  it('skips flagged entries when choosing the next openable workbench', () => {
    const before = [
      entry('alpha', 'ok', 1),
      entry('beta', 'ok', 2),
      entry('gamma', 'missing', 3),
      entry('delta', 'ok', 4),
    ];
    const after = [entry('alpha', 'ok', 1), entry('gamma', 'missing', 3), entry('delta', 'ok', 4)];

    expect(pickWorkbenchAfterDelete(before, after, 'beta')).toBe('delta');
  });

  it('returns nothing when no openable workbench is left', () => {
    expect(pickWorkbenchAfterDelete([entry('alpha')], [], 'alpha')).toBeNull();
    expect(
      pickWorkbenchAfterDelete(
        [entry('alpha'), entry('ghost', 'missing', 2)],
        [entry('ghost', 'missing', 2)],
        'alpha',
      ),
    ).toBeNull();
  });

  it('selects the first openable workbench when the deleted one is not in the old list', () => {
    const after = [entry('beta', 'ok', 1), entry('gamma', 'ok', 2)];

    expect(pickWorkbenchAfterDelete([], after, 'alpha')).toBe('beta');
  });
});
