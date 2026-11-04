import { describe, expect, it } from 'vitest';

import type { HarnessBinding } from '../harness-binding';
import { findSession, harnessBadgeView } from '../harness-view';
import type { HarnessSessionSnapshot } from '../session-shell';

/** A binding with the three fields; overrides merge in. */
function binding(fields: Partial<HarnessBinding> = {}): HarnessBinding {
  return { sessionId: 's-1', sessionTitle: '缓存标题', pinTarget: [], ...fields };
}

/** A session snapshot as the shell bridge reports it. */
function snapshot(
  sessions: HarnessSessionSnapshot['sessions'],
  overrides: Partial<HarnessSessionSnapshot> = {},
): HarnessSessionSnapshot {
  return { available: true, currentId: null, sessions, ...overrides };
}

/** One session row with defaults. */
function session(
  id: string,
  fields: Partial<HarnessSessionSnapshot['sessions'][number]> = {},
): HarnessSessionSnapshot['sessions'][number] {
  return { id, title: `会话 ${id}`, running: false, blank: false, ...fields };
}

describe('findSession', () => {
  it('resolves a session by id only', () => {
    const rows = [session('s-1', { title: '甲' }), session('s-2', { title: '乙' })];

    expect(findSession(snapshot(rows), 's-2')?.title).toBe('乙');
    expect(findSession(snapshot(rows), 'ghost')).toBeNull();
    expect(findSession(snapshot(rows), '  ')).toBeNull();
  });
});

describe('harnessBadgeView', () => {
  it('shows the shell title and running state of the bound session', () => {
    const rows = [session('s-1', { title: '正在跑', running: true })];

    expect(harnessBadgeView(binding(), snapshot(rows))).toEqual({
      kind: 'bound',
      sessionId: 's-1',
      title: '正在跑',
      running: true,
    });
  });

  it('follows a title renamed in the shell, keeping the same session by id', () => {
    const before = harnessBadgeView(binding(), snapshot([session('s-1', { title: '旧名' })]));
    const after = harnessBadgeView(
      binding(),
      snapshot([session('s-2', { title: '旧名' }), session('s-1', { title: '新名' })]),
    );

    expect(before).toMatchObject({ kind: 'bound', sessionId: 's-1', title: '旧名' });
    expect(after).toMatchObject({ kind: 'bound', sessionId: 's-1', title: '新名' });
  });

  it('falls back to the stored title for a session the shell reports without one', () => {
    const view = harnessBadgeView(
      binding({ sessionTitle: '保存的标题' }),
      snapshot([session('s-1', { title: '' })]),
    );

    expect(view).toMatchObject({ kind: 'bound', title: '保存的标题' });
  });

  it('shows a readable missing state when the bound session is gone', () => {
    expect(harnessBadgeView(binding({ sessionTitle: '旧会话' }), snapshot([]))).toEqual({
      kind: 'missing',
      sessionId: 's-1',
      title: '旧会话',
    });
  });

  it('shows a readable unavailable state when the shell list cannot be read', () => {
    expect(
      harnessBadgeView(binding(), { available: false, currentId: null, sessions: [] }),
    ).toEqual({ kind: 'unavailable', sessionId: 's-1', title: '缓存标题' });
  });

  it('shows an unbound state when the panel names no session', () => {
    expect(harnessBadgeView(binding({ sessionId: '', sessionTitle: '未绑定' }), snapshot([]))).toEqual(
      { kind: 'unbound', title: '未绑定' },
    );
  });

  it('carries no conversation content from the shell row', () => {
    const rows = [
      session('s-1', {
        title: '标题',
        messages: [{ role: 'user', text: '会话正文不应进工作台' }],
        transcript: '会话正文不应进工作台',
      } as never),
    ];

    expect(JSON.stringify(harnessBadgeView(binding(), snapshot(rows)))).not.toContain('会话正文');
  });
});
