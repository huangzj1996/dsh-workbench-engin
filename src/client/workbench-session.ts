/**
 * Panel session memory and navigation helpers.
 *
 * Two concerns, both pure enough to test without a browser: the "last used
 * workbench" pointer (browser `localStorage`, injected as a small interface so
 * tests can use a map) and which workbench to select after deleting the one
 * currently open. The panel shell owns the RPC calls; this module owns the
 * decisions.
 */
import type { WorkbenchListEntry } from '../shared/workbench/protocol';
import { isOpenable } from './workbench-status';

/** The localStorage key that remembers the last opened workbench. */
export const LAST_WORKBENCH_KEY = 'dsh-hello-word:last-workbench';

/** The slice of `Storage` this module needs. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The page's `localStorage`, or null when it is unavailable (SSR, denial). */
export function browserStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Read the remembered workbench id; a missing/blank/unreadable value is null. */
export function readLastWorkbench(store: KeyValueStore | null): string | null {
  if (store === null) return null;
  try {
    const raw = store.getItem(LAST_WORKBENCH_KEY);
    if (typeof raw !== 'string') return null;
    const id = raw.trim();
    return id === '' ? null : id;
  } catch {
    return null;
  }
}

/** Remember the workbench the user opened; an empty id is a no-op. */
export function writeLastWorkbench(store: KeyValueStore | null, id: string): void {
  if (store === null || id === '') return;
  try {
    store.setItem(LAST_WORKBENCH_KEY, id);
  } catch {
    // Storage can be denied or full; the pointer is a convenience, not state.
  }
}

/** Forget the remembered workbench (used when it is deleted). */
export function clearLastWorkbench(store: KeyValueStore | null): void {
  if (store === null) return;
  try {
    store.removeItem(LAST_WORKBENCH_KEY);
  } catch {
    // Same as above: never let storage trouble break the panel.
  }
}

/**
 * Which workbench to open after deleting `deletedId`.
 *
 * The list is ordered by the index, so "the next one" means the nearest
 * openable entry after the deleted position; when the deleted one was last
 * (or no later entry is openable) the nearest openable entry before it wins.
 * Flagged entries ({@link isOpenable} false) are skipped: they cannot be
 * opened and would only bounce the user into an error card.
 *
 * @param before - the list as it was before the delete (for the position).
 * @param after - the refreshed list without the deleted workbench.
 * @returns the id to open, or null when nothing openable is left.
 */
export function pickWorkbenchAfterDelete(
  before: readonly WorkbenchListEntry[],
  after: readonly WorkbenchListEntry[],
  deletedId: string,
): string | null {
  const openable = after.filter(isOpenable);
  if (openable.length === 0) return null;
  const deletedIndex = before.findIndex((entry) => entry.id === deletedId);
  if (deletedIndex === -1) return openable[0].id;
  const preceding = before.slice(0, deletedIndex).filter(isOpenable).length;
  return (openable[preceding] ?? openable[openable.length - 1]).id;
}
