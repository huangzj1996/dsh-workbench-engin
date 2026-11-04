/**
 * What a session badge should show, decided from the panel binding plus the
 * shell's session snapshot.
 *
 * Resolution always goes through `sessionId`; the title is display data. A
 * session the shell has renamed keeps the same badge, and a different session
 * that happens to carry the old title never gets adopted. When the shell cannot
 * produce the session the view carries a readable degraded state instead of an
 * empty box: the renderer only has to pick the words.
 */
import type { HarnessBinding } from './harness-binding';
import type { HarnessSession, HarnessSessionSnapshot } from './session-shell';

/** Every state a session badge can be in. */
export type HarnessBadgeView =
  /** The shell reports the bound session; `title` may still be empty (blank). */
  | { kind: 'bound'; sessionId: string; title: string; running: boolean }
  /** The panel stores no session id yet. */
  | { kind: 'unbound'; title: string }
  /** The shell list is readable but the bound session is not in it. */
  | { kind: 'missing'; sessionId: string; title: string }
  /** The shell exposes no readable session list at all. */
  | { kind: 'unavailable'; sessionId: string; title: string };

/** Find the bound session in the shell snapshot, by id only. */
export function findSession(
  snapshot: HarnessSessionSnapshot,
  sessionId: string,
): HarnessSession | null {
  const id = sessionId.trim();
  if (id === '') return null;
  return snapshot.sessions.find((session) => session.id === id) ?? null;
}

/**
 * The session a badge can ask the shell to open.
 *
 * Resolution goes through the stored id, so a badge stays clickable even while
 * the shell list is missing it (a missing session can still be opened by id);
 * only a panel with no id at all has nothing to open.
 */
export function harnessOpenTarget(binding: HarnessBinding): string | null {
  const sessionId = binding.sessionId.trim();
  return sessionId === '' ? null : sessionId;
}

/** Decide the badge body for one panel binding and the current shell snapshot. */
export function harnessBadgeView(
  binding: HarnessBinding,
  snapshot: HarnessSessionSnapshot,
): HarnessBadgeView {
  const sessionId = binding.sessionId.trim();
  const storedTitle = binding.sessionTitle.trim();
  if (sessionId === '') return { kind: 'unbound', title: storedTitle };
  if (!snapshot.available) return { kind: 'unavailable', sessionId, title: storedTitle };
  const session = findSession(snapshot, sessionId);
  if (session === null) return { kind: 'missing', sessionId, title: storedTitle };
  return {
    kind: 'bound',
    sessionId: session.id,
    title: session.title.trim() !== '' ? session.title : storedTitle,
    running: session.running,
  };
}
