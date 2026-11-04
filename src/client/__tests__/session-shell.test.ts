import { describe, expect, it } from 'vitest';

import { createSessionShell } from '../session-shell';

/** A mutable stand-in for the Client context: services can appear after the fact. */
function fakeContext(services: Record<string, unknown> = {}) {
  return {
    services,
    get(name: string): unknown {
      return services[name];
    },
  };
}

/** A shell session list row as the app publishes it. */
function row(id: string, fields: Record<string, unknown> = {}) {
  return { id, title: `会话 ${id}`, running: false, blank: false, ...fields };
}

/** Build the `sessions` service over a mutable snapshot + subscriber set. */
function fakeSessions(initial: unknown) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    service: {
      list: {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    },
    set(next: unknown): void {
      snapshot = next;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}

describe('createSessionShell', () => {
  it('normalises the shell session snapshot into rows the badge can use', () => {
    const sessions = fakeSessions({
      ids: ['s-1', 's-2'],
      byId: {
        's-1': row('s-1', { title: ' 改好名的会话 ', running: true }),
        's-2': { id: 's-2', displayTitle: '显示标题', blank: true },
      },
      current: 's-1',
    });
    const shell = createSessionShell(fakeContext({ sessions: sessions.service }));

    expect(shell.getSnapshot()).toEqual({
      available: true,
      currentId: 's-1',
      sessions: [
        { id: 's-1', title: '改好名的会话', running: true, blank: false },
        { id: 's-2', title: '显示标题', running: false, blank: true },
      ],
    });
  });

  it('reports unavailable when the shell exposes no session service', () => {
    const shell = createSessionShell(fakeContext());

    expect(shell.getSnapshot()).toEqual({ available: false, currentId: null, sessions: [] });
    expect(shell.openSession('s-1')).toBe(false);
  });

  it('follows the shell list and stops following after unsubscribe', () => {
    const sessions = fakeSessions({ ids: [], byId: {} });
    const shell = createSessionShell(fakeContext({ sessions: sessions.service }));
    let notified = 0;
    const unsubscribe = shell.subscribe(() => {
      notified += 1;
    });

    sessions.set({ ids: ['s-1'], byId: { 's-1': row('s-1', { running: true }) } });

    expect(notified).toBe(1);
    expect(shell.getSnapshot().sessions).toEqual([
      { id: 's-1', title: '会话 s-1', running: true, blank: false },
    ]);

    unsubscribe();
    sessions.set({ ids: [], byId: {} });
    expect(notified).toBe(1);
  });

  it('recovers a session service that appears after the panel mounted', () => {
    const context = fakeContext();
    const shell = createSessionShell(context);
    expect(shell.getSnapshot().available).toBe(false);

    const sessions = fakeSessions({ ids: ['s-1'], byId: { 's-1': row('s-1') } });
    context.services['sessions'] = sessions.service;
    shell.refresh();

    expect(shell.getSnapshot().available).toBe(true);
    expect(shell.getSnapshot().sessions.map((session) => session.id)).toEqual(['s-1']);
  });

  it('opens a session through the shell uiWorkspace service', () => {
    const opened: string[] = [];
    const shell = createSessionShell(
      fakeContext({
        sessions: fakeSessions({ ids: [], byId: {} }).service,
        uiWorkspace: { openSession: (id: string) => void opened.push(id) },
      }),
    );

    expect(shell.openSession('s-7')).toBe(true);
    expect(opened).toEqual(['s-7']);
  });

  it('reports a failed open instead of throwing when the shell lacks the capability', () => {
    const throwing = createSessionShell(
      fakeContext({
        sessions: fakeSessions({ ids: [], byId: {} }).service,
        uiWorkspace: {
          openSession: () => {
            throw new Error('no such session');
          },
        },
      }),
    );

    expect(throwing.openSession('s-7')).toBe(false);
  });
});
