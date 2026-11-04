/**
 * The `harness` renderer: a session badge, not an embedded conversation.
 *
 * It shows the bound session's live title and running state, and opening it
 * hands the main area back to the shell (`uiWorkspace.openSession`). The body
 * never fetches conversation content; the shell snapshot only carries the
 * title/status rows this badge draws.
 *
 * Degraded states are deliberately readable: an unreadable session service, a
 * session id that is no longer in the shell, and an unbound panel each get one
 * line of explanation instead of an empty box or a crash.
 */
import * as React from 'react';

import { harnessBinding } from '../harness-binding';
import { harnessBadgeView, harnessOpenTarget } from '../harness-view';
import { useSessionSnapshot } from '../use-session-snapshot';
import type { PanelRendererProps } from './types';

/** Styles for the badge body; injected with the component. */
export const HARNESS_CSS = `
.dshwb-harness{display:flex;flex-direction:column;gap:8px;min-height:0}
.dshwb-harness-card{display:flex;flex-direction:column;gap:5px;box-sizing:border-box;width:100%;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:transparent;color:inherit;font-family:inherit;text-align:left;cursor:pointer;transition:background-color var(--ds-transition-duration) var(--ds-ease-in-out),border-color var(--ds-transition-duration) var(--ds-ease-in-out)}
.dshwb-harness-card:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l4)}
.dshwb-harness-card:active{background:var(--dsw-alias-interactive-bg-active)}
.dshwb-harness-card:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.dshwb-harness-head{display:flex;align-items:center;gap:8px;min-width:0}
.dshwb-harness-title{flex:1;min-width:0;overflow:hidden;color:#eef3fb;font-size:13px;font-weight:600;line-height:1.5;white-space:nowrap;text-overflow:ellipsis}
.dshwb-harness-status{flex:0 0 auto;padding:1px 8px;border-radius:999px;font-size:10.5px;line-height:1.7;white-space:nowrap}
.dshwb-harness-running{background:rgba(86,160,255,.2);color:#a9ceff}
.dshwb-harness-idle{background:rgba(255,255,255,.08);color:rgba(226,234,248,.62)}
.dshwb-harness-unknown{background:rgba(255,196,84,.16);color:#ffd88e}
.dshwb-harness-id{margin:0;overflow:hidden;color:rgba(226,234,248,.45);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10.5px;line-height:1.5;white-space:nowrap;text-overflow:ellipsis}
.dshwb-harness-hint{margin:0;color:rgba(226,234,248,.55);font-size:11.5px;line-height:1.6}
.dshwb-harness-reason{margin:0;color:rgba(226,234,248,.72);font-size:12px;line-height:1.6}
.dshwb-harness-error{margin:0;color:#ffb4a8;font-size:11.5px;line-height:1.6}
.dshwb-harness-degraded{padding:10px 12px;border:1px dashed rgba(255,196,84,.35);border-radius:10px;background:rgba(255,196,84,.06)}
.dshwb-harness-open{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;height:28px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:var(--dsw-font-xs-13-font-size);font-weight:500;line-height:var(--dsw-font-xs-13-line-height);white-space:nowrap;cursor:pointer;transition:background-color var(--ds-transition-duration) var(--ds-ease-in-out),border-color var(--ds-transition-duration) var(--ds-ease-in-out),color var(--ds-transition-duration) var(--ds-ease-in-out),opacity var(--ds-transition-duration) var(--ds-ease-in-out)}
.dshwb-harness-open:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshwb-harness-open:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}
.dshwb-harness-open:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.dshwb-harness-open:disabled{opacity:.4;cursor:not-allowed}
`;

/** One line naming the bound session when the shell cannot report its title. */
function displayTitle(tr: PanelRendererProps['tr'], title: string, sessionId: string): string {
  if (title !== '') return title;
  return sessionId !== '' ? sessionId : tr('panel.harness.untitled', '未命名会话');
}

/** The session badge body. */
export function HarnessPanel(props: PanelRendererProps): React.ReactElement {
  const { panel, tr, shell } = props;
  const binding = harnessBinding(panel);
  const snapshot = useSessionSnapshot(shell);
  const view = harnessBadgeView(binding, snapshot);
  const [openFailed, setOpenFailed] = React.useState(false);
  // Any stored id can be opened, even when the shell list cannot describe it.
  const openTarget = harnessOpenTarget(binding);

  // A different binding is a fresh attempt; forget the previous failure.
  React.useEffect(() => {
    setOpenFailed(false);
  }, [openTarget]);

  const open = (): void => {
    if (openTarget === null) return;
    setOpenFailed(false);
    if (shell === undefined || !shell.openSession(openTarget)) setOpenFailed(true);
  };

  /** Fallback action for a badge whose session the shell cannot describe. */
  const openButton = (): React.ReactElement =>
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'dshwb-harness-open',
        title: tr('panel.harness.openByIdHint', '按保存的会话 id 直接打开'),
        onClick: open,
      },
      tr('panel.harness.open', '打开会话'),
    );

  let body: React.ReactNode;
  if (view.kind === 'bound') {
    body = React.createElement(
      'button',
      {
        type: 'button',
        className: 'dshwb-harness-card',
        title: tr('panel.harness.openHint', '点击打开这条会话'),
        onClick: open,
      },
      React.createElement(
        'span',
        { className: 'dshwb-harness-head' },
        React.createElement(
          'span',
          { className: 'dshwb-harness-title' },
          displayTitle(tr, view.title, view.sessionId),
        ),
        React.createElement(
          'span',
          {
            className: view.running
              ? 'dshwb-harness-status dshwb-harness-running'
              : 'dshwb-harness-status dshwb-harness-idle',
          },
          view.running
            ? tr('panel.harness.running', '运行中')
            : tr('panel.harness.idle', '空闲'),
        ),
      ),
      React.createElement('span', { className: 'dshwb-harness-id' }, view.sessionId),
      React.createElement(
        'span',
        { className: 'dshwb-harness-hint' },
        tr('panel.harness.openHint', '点击打开这条会话'),
      ),
    );
  } else if (view.kind === 'unbound') {
    body = React.createElement(
      'p',
      { className: 'dshwb-harness-hint' },
      tr('panel.harness.unbound', '还没有绑定会话：在配置里选一条会话。'),
    );
  } else if (view.kind === 'missing') {
    body = React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'p',
        { className: 'dshwb-harness-title' },
        displayTitle(tr, view.title, view.sessionId),
      ),
      React.createElement(
        'p',
        { className: 'dshwb-harness-reason' },
        tr('panel.harness.missing', '绑定的会话不存在或不可读；仍可按 id 尝试打开，或在配置里重新选一条。'),
      ),
      React.createElement('p', { className: 'dshwb-harness-id' }, view.sessionId),
      openTarget !== null && openButton(),
    );
  } else {
    body = React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'p',
        { className: 'dshwb-harness-title' },
        displayTitle(tr, view.title, view.sessionId),
      ),
      React.createElement(
        'p',
        { className: 'dshwb-harness-reason' },
        tr('panel.harness.unavailable', '读不到外壳的会话列表，暂时无法显示会话状态；仍可按 id 尝试打开。'),
      ),
      React.createElement('p', { className: 'dshwb-harness-id' }, view.sessionId),
      openTarget !== null && openButton(),
    );
  }

  return React.createElement(
    'div',
    { className: 'dshwb-harness' },
    React.createElement('style', { dangerouslySetInnerHTML: { __html: HARNESS_CSS } }),
    view.kind === 'bound' || view.kind === 'unbound'
      ? body
      : React.createElement('div', { className: 'dshwb-harness-degraded' }, body),
    openFailed &&
      React.createElement(
        'p',
        { className: 'dshwb-harness-error', role: 'alert' },
        tr('panel.harness.openFailed', '打不开这条会话：外壳没有提供打开能力。'),
      ),
  );
}
