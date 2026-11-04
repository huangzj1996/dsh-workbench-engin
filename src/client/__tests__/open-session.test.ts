import { describe, expect, it } from 'vitest';

import { attemptOpenSession } from '../open-session';
import type { SessionShell } from '../session-shell';

/** A shell whose only meaningful part is the open capability. */
function shellThat(openSession: (id: string) => boolean): SessionShell {
  return {
    getSnapshot: () => ({ available: true, sessions: [], currentId: null }),
    subscribe: () => () => undefined,
    openSession,
    refresh: () => undefined,
  };
}

describe('attemptOpenSession', () => {
  it('asks the shell to open the stored id and reports success', () => {
    const opened: string[] = [];
    const shell = shellThat((id) => {
      opened.push(id);
      return true;
    });

    expect(attemptOpenSession(shell, 's-7')).toBe(true);
    expect(opened).toEqual(['s-7']);
  });

  it('reports a failed open instead of throwing when the shell throws', () => {
    const shell = shellThat(() => {
      throw new Error('no such session');
    });

    expect(attemptOpenSession(shell, 's-7')).toBe(false);
  });

  it('reports failure when there is no session id or no shell at all', () => {
    expect(attemptOpenSession(shellThat(() => true), null)).toBe(false);
    expect(attemptOpenSession(undefined, 's-7')).toBe(false);
  });
});
