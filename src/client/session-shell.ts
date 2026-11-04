/**
 * The bridge to the shell's session list.
 *
 * The DSH shell publishes every session it retains as one external-store
 * snapshot (`ctx.get('sessions').list.getSnapshot()` → `{ ids, byId, current }`,
 * the shape the installed session-manager and skills-deck bundles read) and
 * opens one through `ctx.get('uiWorkspace').openSession(id)`. This module turns
 * those two optional services into one small, testable face for the badge and
 * the config drawer, and degrades to "unavailable" instead of throwing when the
 * shell does not offer them.
 *
 * Identity is the session id, never the title: a snapshot row's title may change
 * at any time and rows with equal titles are different sessions.
 */
import type { HarnessSessionRef } from './harness-binding';

/** One session the shell retains, as the badge needs it. */
export interface HarnessSession extends HarnessSessionRef {
  /** The shell's current title for this session; empty when it has none. */
  title: string;
  /** True while the session's agent is running. */
  running: boolean;
  /** True for a brand-new, never-persisted session placeholder. */
  blank: boolean;
}

/** Everything the badge/drawer needs from the shell at one moment. */
export interface HarnessSessionSnapshot {
  /** False when the shell exposes no readable session list at all. */
  available: boolean;
  /** Sessions in the shell's own order. */
  sessions: HarnessSession[];
  /** The session currently shown in the shell's main area, if one is. */
  currentId: string | null;
}

/** The face the renderer and the drawer talk to; stable across re-renders. */
export interface SessionShell {
  /** Current snapshot; the same object until something changes. */
  getSnapshot(): HarnessSessionSnapshot;
  /** Follow shell changes; the callback fires on the next different snapshot. */
  subscribe(listener: () => void): () => void;
  /** Ask the shell to open a session; false when the shell cannot. */
  openSession(sessionId: string): boolean;
  /** Re-read the shell list now (recovers a service that appeared late). */
  refresh(): void;
}

/** The Client context slice needed to reach the optional shell services. */
export interface SessionShellContext {
  get(service: string): unknown;
}

/** One external-store model behind `sessions.list`. */
interface SessionListModel {
  getSnapshot?: () => unknown;
  subscribe?: (listener: () => void) => () => void;
}

/** The part of `ctx.get('sessions')` this module uses. */
interface SessionsService {
  list?: SessionListModel | (() => unknown);
  refresh?: () => unknown;
}

/** The part of `ctx.get('uiWorkspace')` this module uses. */
interface UiWorkspaceService {
  openSession?: (target: string) => unknown;
}

/** True for a plain JSON object (not null, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read an optional service without letting a missing/odd one throw. */
function serviceOf<T>(ctx: SessionShellContext, name: string): T | undefined {
  try {
    const value = ctx.get(name);
    return isRecord(value) ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

/** The shell's current title for a row, preferring `title` over `displayTitle`. */
function titleOf(row: Record<string, unknown>): string {
  for (const key of ['title', 'displayTitle']) {
    const value = row[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
}

/** Turn one snapshot row into the badge's session shape. */
function sessionOf(id: string, row: Record<string, unknown>): HarnessSession {
  return {
    id,
    title: titleOf(row),
    running: row['running'] === true,
    blank: row['blank'] === true,
  };
}

/** Read the raw value the shell publishes for its session list. */
function rawSessions(sessions: SessionsService | undefined): unknown {
  const list = sessions?.list;
  if (typeof list === 'function') {
    try {
      return list();
    } catch {
      return undefined;
    }
  }
  if (list !== undefined && typeof list.getSnapshot === 'function') {
    try {
      return list.getSnapshot();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Normalise every published list shape this module knows into one row array. */
function normalizeSessions(raw: unknown): HarnessSession[] {
  const out: HarnessSession[] = [];
  const seen = new Set<string>();
  const push = (id: string, row: Record<string, unknown>): void => {
    const trimmed = id.trim();
    if (trimmed === '' || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(sessionOf(trimmed, row));
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        push(item, {});
      } else if (isRecord(item) && typeof item['id'] === 'string') {
        push(item['id'], item);
      }
    }
    return out;
  }
  if (!isRecord(raw)) return [];

  const byId = raw['byId'];
  if (isRecord(byId)) {
    const ids = Array.isArray(raw['ids']) ? raw['ids'] : Object.keys(byId);
    for (const id of ids) {
      if (typeof id !== 'string') continue;
      const row = byId[id];
      if (isRecord(row)) push(id, row);
    }
    // A row outside `ids` is still a retained session; keep it rather than
    // pretending it does not exist (the badge would show a false "missing").
    for (const id of Object.keys(byId)) {
      const row = byId[id];
      if (isRecord(row)) push(id, row);
    }
    return out;
  }
  const items = raw['items'];
  return Array.isArray(items) ? normalizeSessions(items) : [];
}

/** The id of the session in the shell's main view, when the shell reports one. */
function currentIdOf(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const current = raw['current'];
  return typeof current === 'string' && current.trim() !== '' ? current.trim() : null;
}

/** Read the whole snapshot off the shell's optional services. */
function readSnapshot(ctx: SessionShellContext): HarnessSessionSnapshot {
  const sessions = serviceOf<SessionsService>(ctx, 'sessions');
  const raw = rawSessions(sessions);
  return {
    available: raw !== undefined,
    sessions: normalizeSessions(raw),
    currentId: currentIdOf(raw),
  };
}

/** The external-store model behind `sessions.list`, when there is one. */
function listModelOf(ctx: SessionShellContext): SessionListModel | null {
  const sessions = serviceOf<SessionsService>(ctx, 'sessions');
  const list = sessions?.list;
  return list !== undefined &&
    typeof list !== 'function' &&
    typeof list.getSnapshot === 'function'
    ? list
    : null;
}

/** Cheap structural equality, so a re-read only notifies on real changes. */
function sameSnapshot(a: HarnessSessionSnapshot, b: HarnessSessionSnapshot): boolean {
  if (a.available !== b.available || a.currentId !== b.currentId) return false;
  if (a.sessions.length !== b.sessions.length) return false;
  return a.sessions.every((session, index) => {
    const other = b.sessions[index];
    return (
      other !== undefined &&
      session.id === other.id &&
      session.title === other.title &&
      session.running === other.running &&
      session.blank === other.blank
    );
  });
}

/**
 * Build the session-shell bridge over one Client context.
 *
 * Services are looked up lazily on every read: `sessions`/`uiWorkspace` are
 * optional and may be missing or appear after this bundle activated.
 */
export function createSessionShell(ctx: SessionShellContext): SessionShell {
  let cached = readSnapshot(ctx);
  const listeners = new Set<() => void>();
  let followedModel: SessionListModel | null = null;
  let stopFollowing: (() => void) | null = null;

  const notifyIfChanged = (): void => {
    const next = readSnapshot(ctx);
    if (sameSnapshot(next, cached)) return;
    cached = next;
    for (const listener of [...listeners]) listener();
  };

  const follow = (): void => {
    const model = listModelOf(ctx);
    if (model === followedModel) return;
    if (stopFollowing !== null) {
      try {
        stopFollowing();
      } catch {
        // A broken unsubscribe must not break the panel.
      }
      stopFollowing = null;
    }
    followedModel = model;
    if (model !== null && typeof model.subscribe === 'function') {
      try {
        stopFollowing = model.subscribe(notifyIfChanged);
      } catch {
        stopFollowing = null;
      }
    }
  };

  return {
    getSnapshot: () => cached,
    subscribe(listener) {
      listeners.add(listener);
      follow();
      return () => {
        listeners.delete(listener);
      };
    },
    openSession(sessionId) {
      const target = sessionId.trim();
      if (target === '') return false;
      const ui = serviceOf<UiWorkspaceService>(ctx, 'uiWorkspace');
      if (ui === undefined || typeof ui.openSession !== 'function') return false;
      try {
        const result = ui.openSession(target);
        if (isRecord(result) && typeof (result as { then?: unknown }).then === 'function') {
          (result as unknown as PromiseLike<unknown>).then(undefined, () => undefined);
        }
        return true;
      } catch {
        return false;
      }
    },
    refresh() {
      const sessions = serviceOf<SessionsService>(ctx, 'sessions');
      if (sessions !== undefined && typeof sessions.refresh === 'function') {
        try {
          void sessions.refresh();
        } catch {
          // Best effort: the shell list may be read-only.
        }
      }
      follow();
      notifyIfChanged();
    },
  };
}
