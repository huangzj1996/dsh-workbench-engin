/**
 * Presentation helpers for the three reconciliation flags.
 *
 * The list RPC reports one `status` per workbench; the panel turns it into a
 * badge label, a one-line explanation and the dropdown option text. Keeping the
 * mapping here means the badge and the dropdown can never disagree.
 */
import type { WorkbenchListEntry } from '../shared/workbench/protocol';
import type { Translate } from './translate';

/** The statuses that need a badge and an explanation (`ok` stays quiet). */
type FlaggedStatus = Exclude<WorkbenchListEntry['status'], 'ok'>;

/** Badge label key per flagged status. */
export const WORKBENCH_STATUS_LABEL_KEYS: Record<FlaggedStatus, string> = {
  adopted: 'list.status.adopted',
  missing: 'list.status.missing',
  corrupt: 'list.status.corrupt',
};

/** One-line explanation key per flagged status. */
export const WORKBENCH_STATUS_HINT_KEYS: Record<FlaggedStatus, string> = {
  adopted: 'list.status.adopted.hint',
  missing: 'list.status.missing.hint',
  corrupt: 'list.status.corrupt.hint',
};

/** True when the panel can actually open this list entry. */
export function isOpenable(entry: WorkbenchListEntry): boolean {
  return entry.status === 'ok' || entry.status === 'adopted';
}

/** Badge text for a flagged entry; empty for `ok`. */
export function workbenchStatusLabel(tr: Translate, status: WorkbenchListEntry['status']): string {
  if (status === 'ok') return '';
  return tr(WORKBENCH_STATUS_LABEL_KEYS[status], status);
}

/** Dropdown option text: the name plus the flag when there is one. */
export function workbenchOptionLabel(tr: Translate, entry: WorkbenchListEntry): string {
  const name = entry.name.trim() === '' ? entry.id : entry.name;
  const label = workbenchStatusLabel(tr, entry.status);
  return label === '' ? name : `${name} · ${label}`;
}
