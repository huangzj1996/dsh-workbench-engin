/**
 * Workbench-name rules, kept pure so they run in Node test environments.
 *
 * Workbench names live in `<id>.json`; the key (`id`) never changes, only the
 * display name may. A name is whatever the user typed, minus surrounding
 * whitespace — and a name that is blank after trimming is not a name.
 */
export function normalizeWorkbenchName(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Reconcile the drawer's local name draft with the committed workbench name.
 *
 * The draft is raw text (typing "My " must keep its trailing space), while the
 * committed name is trimmed, so the two are compared after trimming: as long as
 * the draft still represents the committed name it is left untouched, and only
 * a name that changed underneath (a disk refresh after an AI edit) wins.
 */
export function syncNameDraft(draft: string, committedName: string): string {
  return draft.trim() === committedName.trim() ? draft : committedName;
}
