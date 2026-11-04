/**
 * Session-badge binding fields: the three fields a `harness` panel stores and
 * the one clean patch the config drawer writes when a session is picked.
 *
 * The binding is the panel's identity for a session, so it is keyed by
 * `sessionId` only — titles are display data and may change in the shell.
 * Everything else on the panel is somebody else's field and must survive a
 * rebind untouched, including fields this bundle has never heard of.
 */
import type { WorkbenchPanel } from '../shared/workbench/schema';

/** The persisted fields that bind a session badge to one shell session. */
export interface HarnessBinding {
  /** Title cached on the panel; used when the shell cannot report the title. */
  sessionTitle: string;
  /** The session identity. Resolving sessions always goes through this id. */
  sessionId: string;
  /** Pin targets from the workbench config, normalised to a string array. */
  pinTarget: string[];
}

/** One session as the shell (or a caller) names it. */
export interface HarnessSessionRef {
  id: string;
  title?: string;
}

/** Split a raw list value on both the ASCII and the Chinese comma. */
const LIST_SEPARATOR = /[,，]/;

/**
 * Coerce a raw `pinTarget` JSON value into the string array the config expects.
 *
 * Public workbench configs arrive as arrays, but an AI may have written a single
 * string; anything else (number, object, null) has no list meaning and becomes
 * an empty array rather than being carried along in a broken shape.
 */
export function normalizePinTarget(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item !== '');
  }
  if (typeof value === 'string') {
    return value
      .split(LIST_SEPARATOR)
      .map((item) => item.trim())
      .filter((item) => item !== '');
  }
  return [];
}

/** Read one string field off a panel without trusting the JSON shape. */
function stringField(panel: WorkbenchPanel, key: string): string {
  const value = panel[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Read the three binding fields off a panel, cleaned for use and display. */
export function harnessBinding(panel: WorkbenchPanel): HarnessBinding {
  return {
    sessionTitle: stringField(panel, 'sessionTitle'),
    sessionId: stringField(panel, 'sessionId'),
    pinTarget: normalizePinTarget(panel['pinTarget']),
  };
}

/**
 * The panel patch that binds a picked session.
 *
 * `sessionId` is the panel's identity for the session, so a blank id would bind
 * nothing and silently point at whatever the title happens to match: it is
 * rejected here (null) instead of written. The existing `pinTarget` array is
 * carried through normalised; unbinding is not this function's job.
 */
export function bindingPatch(
  panel: WorkbenchPanel,
  session: HarnessSessionRef,
): Partial<WorkbenchPanel> | null {
  const sessionId = session.id.trim();
  if (sessionId === '') return null;
  const sessionTitle = typeof session.title === 'string' ? session.title.trim() : '';
  return {
    sessionId,
    sessionTitle,
    pinTarget: normalizePinTarget(panel['pinTarget']),
  };
}
