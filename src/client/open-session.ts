/**
 * The one way the badge and the drawer ask the shell to open a bound session.
 *
 * A stored session id can always be opened even while the shell cannot describe
 * that session (degraded states), so the only failures are "no id", "no shell"
 * and "the shell refused or threw" — all flattened to a boolean the caller turns
 * into a readable hint.
 */
import type { SessionShell } from './session-shell';

/** Ask the shell to open `sessionId`; false when nothing could be opened. */
export function attemptOpenSession(
  shell: SessionShell | undefined,
  sessionId: string | null,
): boolean {
  if (shell === undefined || sessionId === null) return false;
  try {
    return shell.openSession(sessionId);
  } catch {
    return false;
  }
}
