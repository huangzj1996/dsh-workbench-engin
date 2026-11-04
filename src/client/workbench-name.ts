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
