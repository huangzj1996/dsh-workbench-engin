/**
 * The Workbench main panel: the shell that resolves the workbench root, lists
 * the workbenches found there, creates new ones and opens the one the user
 * picks.
 *
 * Tickets #3–#5 scope: first-run root setup, the empty state, the list with its
 * reconciliation flags, readable errors, the grid view of one workbench, the
 * create flow (auto id + context card saved by the Host) and the config
 * drawer/autosave owned by `workbench-editor`.
 *
 * Ticket #6 adds the multi-workbench shell: restoring the last used workbench
 * on mount, switching between them, deleting the open one with a confirmation,
 * and the refresh action that re-reads the root, the list and the open workbench so
 * AI edits made on disk become visible.
 */
import * as React from 'react';

import { CreateWorkbenchDialog } from './create-workbench-dialog';
import { HeroBackdrop, HERO_BASE } from './hero-backdrop';
import { requestRootPick, type RootPickFallbackReason } from './root-picker';
import { WorkbenchRpcError, type WorkbenchClient } from './rpc';
import { WorkbenchEditor } from './workbench-editor';
import type { SessionShell } from './session-shell';
import { createWorkbench } from './workbench-draft';
import {
  browserStorage,
  clearLastWorkbench,
  pickWorkbenchAfterDelete,
  readLastWorkbench,
  writeLastWorkbench,
} from './workbench-session';
import {
  WORKBENCH_STATUS_HINT_KEYS,
  WORKBENCH_STATUS_LABEL_KEYS,
  isOpenable,
} from './workbench-status';
import type { WorkbenchListEntry } from '../shared/workbench/protocol';
import type { Workbench } from '../shared/workbench/schema';

/** The main-panel key this bundle owns. */
export const PANEL_ID = 'hello-word';

/**
 * Component-local styles: hover/focus states need real class selectors.
 * Injected once by the shell.
 */
const PANEL_CSS = `
.dshwb-content{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto}
.dshwb-stack{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:520px;text-align:center}
.dshwb-hint{margin:0;color:#eef3fb;font-size:17px;font-weight:500;letter-spacing:.02em}
.dshwb-sub{margin:0;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.7}
.dshwb-card{box-sizing:border-box;width:100%;padding:18px 18px 16px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(9,15,26,.62);backdrop-filter:blur(14px);color:#eef3fb;text-align:left;box-shadow:0 18px 48px rgba(0,0,0,.35)}
.dshwb-card-title{margin:0 0 6px;font-size:15px;font-weight:600;line-height:1.4}
.dshwb-card-sub{margin:0 0 14px;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.6}
.dshwb-label{display:block;margin:0 0 6px;color:rgba(226,234,248,.68);font-size:12px}
.dshwb-pickrow{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 14px}
.dshwb-picksep{color:rgba(226,234,248,.45);font-size:11.5px;line-height:1.5}
.dshwb-notice{margin:8px 0 0;color:#ffd88e;font-size:12px;line-height:1.6}
.dshwb-input{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(255,255,255,.06);color:#eef3fb;font-family:inherit;font-size:13px;line-height:1.4;outline:none;transition:border-color .15s ease}
.dshwb-input:focus{border-color:var(--dsw-alias-brand-primary)}
.dshwb-input::placeholder{color:rgba(226,234,248,.4)}
.dshwb-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.dshwb-primary{display:inline-flex;align-items:center;justify-content:center;padding:8px 18px;border:1px solid transparent;border-radius:9px;background:var(--dsw-alias-brand-primary);color:#fff;font-family:inherit;font-size:13px;font-weight:500;line-height:1.4;cursor:pointer;transition:filter .15s ease}
.dshwb-primary:hover{filter:brightness(1.08)}
.dshwb-primary:active{transform:translateY(1px)}
.dshwb-primary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-primary:disabled{opacity:.45;cursor:not-allowed;filter:none;transform:none}
.dshwb-secondary{display:inline-flex;align-items:center;justify-content:center;padding:7px 14px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:transparent;color:#eef3fb;font-family:inherit;font-size:12.5px;font-weight:500;line-height:1.4;cursor:pointer;transition:background .15s ease}
.dshwb-secondary:hover{background:rgba(255,255,255,.08)}
.dshwb-secondary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-link{padding:0;border:0;background:none;color:rgba(226,234,248,.68);font-family:inherit;font-size:12px;line-height:1.4;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.dshwb-link:hover{color:#eef3fb}
.dshwb-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:4px}
.dshwb-error{margin:10px 0 0;color:#ffb4a8;font-size:12.5px;line-height:1.6;word-break:break-word}
.dshwb-root-bar{display:flex;align-items:center;gap:10px;width:100%;margin-bottom:10px;text-align:left}
.dshwb-root-path{flex:1;min-width:0;overflow:hidden;color:rgba(226,234,248,.6);font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
.dshwb-list{display:flex;flex-direction:column;gap:8px;width:100%;margin:0;padding:0;list-style:none;text-align:left}
.dshwb-item{display:flex;align-items:center;gap:10px;box-sizing:border-box;width:100%;padding:11px 13px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(255,255,255,.05);color:inherit;font-family:inherit;text-align:left;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.dshwb-item:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.2)}
.dshwb-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-item-chevron{flex:0 0 auto;color:rgba(226,234,248,.45);font-size:15px;line-height:1}
.dshwb-content-workbench{align-items:stretch;justify-content:stretch;padding:16px 18px;overflow:hidden}
.dshwb-workbench{display:flex;flex-direction:column;gap:10px;width:100%;height:100%;min-height:0;text-align:left}
.dshwb-workbench-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.dshwb-workbench-heading{display:flex;flex:1;min-width:0;align-items:baseline;gap:8px}
.dshwb-workbench-name{margin:0;overflow:hidden;color:#eef3fb;font-size:15px;font-weight:600;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}
.dshwb-workbench-id{overflow:hidden;max-width:40%;color:rgba(226,234,248,.48);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
.dshwb-workbench-meta{flex:0 0 auto;color:rgba(226,234,248,.55);font-size:11.5px;white-space:nowrap}
.dshwb-workbench-desc{margin:0;color:rgba(226,234,248,.62);font-size:12px;line-height:1.6}
.dshwb-item-name{flex:1;min-width:0;overflow:hidden;color:#eef3fb;font-size:13.5px;font-weight:500;white-space:nowrap;text-overflow:ellipsis}
.dshwb-item-id{overflow:hidden;max-width:45%;color:rgba(226,234,248,.48);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
.dshwb-item-main{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}
.dshwb-item-headline{display:flex;align-items:center;gap:8px;min-width:0}
.dshwb-item-hint{color:rgba(226,234,248,.55);font-size:11.5px;line-height:1.5;text-align:left}
.dshwb-badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;line-height:1.6;white-space:nowrap}
.dshwb-badge-adopted{background:rgba(86,160,255,.18);color:#a9ceff}
.dshwb-badge-missing{background:rgba(255,196,84,.16);color:#ffd88e}
.dshwb-badge-corrupt{background:rgba(255,112,96,.18);color:#ffb4a8}
.dshwb-link-danger{color:#ffb4a8}
.dshwb-link-danger:hover{color:#ffd2c9}
.dshwb-loading{margin:0;color:rgba(226,234,248,.62);font-size:12.5px}
.dshwb-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(4,9,18,.6);backdrop-filter:blur(3px)}
.dshwb-dialog{box-sizing:border-box;width:100%;max-width:420px;padding:18px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(9,15,26,.94);box-shadow:0 24px 60px rgba(0,0,0,.45);color:#eef3fb}
.dshwb-dialog-title{margin:0 0 6px;font-size:16px;font-weight:600;line-height:1.4}
.dshwb-dialog-sub{margin:0 0 14px;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.6}
.dshwb-dialog-hint{margin:6px 0 0;color:rgba(226,234,248,.5);font-size:11.5px;line-height:1.6}
.dshwb-label-spaced{margin-top:12px}
.dshwb-idrow{display:flex;align-items:center;gap:8px}
.dshwb-idvalue{flex:1;min-width:0;overflow:hidden;padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.04);color:rgba(226,234,248,.8);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}
`;

/** Panel status while the root + list are being resolved. */
type PanelState =
  | { phase: 'loading' }
  | { phase: 'no-root' }
  | { phase: 'ready'; root: string; entries: WorkbenchListEntry[] }
  | { phase: 'error'; message: string };

/** What the panel shows inside the `ready` phase: the list or one workbench. */
type PanelView =
  | { kind: 'list' }
  | { kind: 'opening'; id: string }
  | { kind: 'workbench'; workbench: Workbench; configure?: boolean }
  | { kind: 'open-error'; id: string; message: string };

/** Props injected by the panel slot, plus the Host RPC the entry composes in. */
export interface HelloPanelProps {
  /** Locale translate function bound to this plugin's namespace. */
  t?: (key: string) => string;
  /** Host RPC client; absent only if the entry could not build one. */
  rpc?: WorkbenchClient;
  /** The shell session list, for session-badge panels. */
  shell?: SessionShell;
}

/** Readable message for any RPC/other failure. */
function readableError(error: unknown): string {
  if (error instanceof WorkbenchRpcError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

/** The central panel: hero backdrop + first-run root setup + the workbench list. */
export function HelloPanel(props: HelloPanelProps): React.ReactElement {
  const translate = props.t;
  const tr = React.useCallback(
    (key: string, fallback: string): string => {
      if (typeof translate !== 'function') return fallback;
      const value = translate(key);
      return value === key ? fallback : value;
    },
    [translate],
  );
  const rpc = props.rpc;

  const [state, setState] = React.useState<PanelState>({ phase: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const [editingRoot, setEditingRoot] = React.useState(false);
  const [pathDraft, setPathDraft] = React.useState('');
  const [savingRoot, setSavingRoot] = React.useState(false);
  /** True while the shell's folder chooser is being opened (host-side dialog). */
  const [picking, setPicking] = React.useState(false);
  /** Why the chooser could not be offered; keeps the manual form, no blocking error. */
  const [pickFallback, setPickFallback] = React.useState<RootPickFallbackReason | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<PanelView>({ kind: 'list' });
  const [creating, setCreating] = React.useState(false);
  /** Drawer preference, carried across workbench switches (create opens it). */
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  /** The panel's session memory (last used workbench); null when unavailable. */
  const storage = React.useMemo(() => browserStorage(), []);
  const viewRef = React.useRef(view);
  viewRef.current = view;
  /** The "restore last used workbench" attempt runs once per panel mount. */
  const restoredRef = React.useRef(false);

  /** Ids already in the root, so a new workbench picks a colliding-free id. */
  const takenIds = React.useMemo(
    () => (state.phase === 'ready' ? state.entries.map((entry) => entry.id) : []),
    [state],
  );

  const openCreate = (): void => setCreating(true);

  /** Persist a brand-new workbench, then refresh the list and open it. */
  const createAndOpenWorkbench = async (name: string, id: string): Promise<void> => {
    if (rpc === undefined) {
      throw new WorkbenchRpcError('internal', tr('error.connection', '连接服务不可用，请稍后重试'));
    }
    const workbench = createWorkbench(id, name, tr('panel.new.reserved', '占位面板'));
    const saved = (await rpc.save(workbench)).workbench;
    const list = await rpc.list();
    setState({ phase: 'ready', root: list.root, entries: list.entries });
    setCreating(false);
    writeLastWorkbench(storage, saved.id);
    setDrawerOpen(true);
    setView({ kind: 'workbench', workbench: saved, configure: true });
  };

  const load = React.useCallback(async (): Promise<void> => {
    if (rpc === undefined) {
      setState({ phase: 'error', message: tr('error.connection', '连接服务不可用，请稍后重试') });
      return;
    }
    setView({ kind: 'list' });
    setState({ phase: 'loading' });
    try {
      const config = await rpc.getRootConfig();
      if (config.root === null) {
        setState({ phase: 'no-root' });
        return;
      }
      const list = await rpc.list();
      setState({ phase: 'ready', root: list.root, entries: list.entries });
    } catch (error) {
      setState({ phase: 'error', message: readableError(error) });
    }
  }, [rpc, tr]);

  React.useEffect(() => {
    void load();
  }, [load, attempt]);

  /** Read one workbench and render it; failures stay inside the panel. */
  const openWorkbench = async (id: string): Promise<void> => {
    if (rpc === undefined) return;
    setView({ kind: 'opening', id });
    try {
      const { workbench } = await rpc.read(id);
      setView({ kind: 'workbench', workbench });
      writeLastWorkbench(storage, id);
      // The Host clears the "adopted" marker on a successful read; mirror that
      // in the switcher without paying for another list round-trip.
      setState((current) =>
        current.phase === 'ready'
          ? {
              phase: 'ready',
              root: current.root,
              entries: current.entries.map((entry) =>
                entry.id === id && entry.status === 'adopted'
                  ? { ...entry, status: 'ok' as const }
                  : entry,
              ),
            }
          : current,
      );
    } catch (error) {
      setView({ kind: 'open-error', id, message: readableError(error) });
    }
  };

  /**
   * Refresh action: re-read the root pointer, the list and — when one is open —
   * the workbench itself, so edits an AI made on disk become visible.
   */
  const refresh = async (): Promise<void> => {
    if (rpc === undefined) return;
    try {
      const config = await rpc.getRootConfig();
      if (config.root === null) {
        setView({ kind: 'list' });
        setState({ phase: 'no-root' });
        return;
      }
      const list = await rpc.list();
      setState({ phase: 'ready', root: list.root, entries: list.entries });
      const current = viewRef.current;
      if (current.kind !== 'workbench') return;
      try {
        const { workbench } = await rpc.read(current.workbench.id);
        setView({ kind: 'workbench', workbench });
      } catch (error) {
        setView({ kind: 'open-error', id: current.workbench.id, message: readableError(error) });
      }
    } catch (error) {
      setState({ phase: 'error', message: readableError(error) });
    }
  };

  // Opening the panel (e.g. from the sidebar entry) restores the last workbench.
  React.useEffect(() => {
    if (restoredRef.current || state.phase !== 'ready') return;
    restoredRef.current = true;
    const last = readLastWorkbench(storage);
    if (last === null) return;
    const entry = state.entries.find((candidate) => candidate.id === last);
    if (entry === undefined || !isOpenable(entry)) return;
    void openWorkbench(last);
  }, [state, storage, openWorkbench]);

  /** The editor deleted the open workbench: open the next one or show the list. */
  const handleDeleted = async (id: string): Promise<void> => {
    if (rpc === undefined) return;
    const before = state.phase === 'ready' ? state.entries : [];
    if (readLastWorkbench(storage) === id) clearLastWorkbench(storage);
    try {
      const list = await rpc.list();
      setState({ phase: 'ready', root: list.root, entries: list.entries });
      const next = pickWorkbenchAfterDelete(before, list.entries, id);
      if (next === null) {
        setView({ kind: 'list' });
        return;
      }
      await openWorkbench(next);
    } catch (error) {
      setState({ phase: 'error', message: readableError(error) });
    }
  };

  const startEditing = (prefill: string): void => {
    setPathDraft(prefill);
    setSaveError(null);
    setPickFallback(null);
    setEditingRoot(true);
  };

  /**
   * Persist one root path. Both entry paths — the shell's folder chooser and
   * the manual input — land here, so they share the same validation, pointer
   * write and reload of the list.
   */
  const saveRoot = async (pathInput?: string): Promise<void> => {
    if (rpc === undefined) return;
    const path = (pathInput ?? pathDraft).trim();
    if (path === '') {
      setSaveError(tr('root.needPath', '请先填写文件夹路径'));
      return;
    }
    setSavingRoot(true);
    setSaveError(null);
    try {
      await rpc.setRoot(path);
      setEditingRoot(false);
      setPathDraft('');
      setPickFallback(null);
      setAttempt((value) => value + 1);
    } catch (error) {
      setSaveError(readableError(error));
    } finally {
      setSavingRoot(false);
    }
  };

  /**
   * Prefer the shell's native folder chooser; on cancel do nothing, and when
   * the shell cannot offer one fall back to the manual input with a note.
   */
  const chooseRoot = async (): Promise<void> => {
    if (rpc === undefined) return;
    setPicking(true);
    setPickFallback(null);
    setSaveError(null);
    try {
      const outcome = await requestRootPick(rpc);
      if (outcome.kind === 'picked') {
        setPathDraft(outcome.path);
        await saveRoot(outcome.path);
      } else if (outcome.kind === 'fallback') {
        setPickFallback(outcome.reason);
      }
    } finally {
      setPicking(false);
    }
  };

  const renderRootForm = (): React.ReactElement => {
    const busy = savingRoot || picking;
    /** Emphasize whichever path the user is already taking. */
    const typedPath = pathDraft.trim() !== '';
    return React.createElement(
      'div',
      { className: 'dshwb-card' },
      React.createElement('h2', { className: 'dshwb-card-title' }, tr('root.title', '设置工作台根目录')),
      React.createElement(
        'p',
        { className: 'dshwb-card-sub' },
        tr('root.sub', '工作台的索引与每个工作台的 JSON 都会写在这个文件夹里。'),
      ),
      // Prefer the shell's OS folder chooser; the manual input below is the
      // fallback (always present, so a failed chooser never blocks the setup).
      React.createElement(
        'div',
        { className: 'dshwb-pickrow' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: typedPath ? 'dshwb-secondary' : 'dshwb-primary',
            disabled: busy,
            onClick: () => void chooseRoot(),
          },
          picking ? tr('root.picking', '正在打开选择框…') : tr('root.pick', '选择文件夹…'),
        ),
        React.createElement(
          'span',
          { className: 'dshwb-picksep' },
          tr('root.pick.or', '或手动填写路径'),
        ),
      ),
      React.createElement(
        'label',
        { className: 'dshwb-label', htmlFor: 'dshwb-root-input' },
        tr('root.label', '根目录路径'),
      ),
      React.createElement('input', {
        id: 'dshwb-root-input',
        className: 'dshwb-input',
        type: 'text',
        value: pathDraft,
        placeholder: tr('root.placeholder', '例如：D:\\work\\my-workbenches'),
        autoComplete: 'off',
        spellCheck: false,
        disabled: busy,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setPathDraft(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          void saveRoot();
        },
      }),
      pickFallback !== null &&
        React.createElement(
          'p',
          { className: 'dshwb-notice', role: 'status' },
          pickFallback === 'picker-unavailable'
            ? tr('root.pick.unavailable', '系统文件夹选择框不可用，请直接填写下面的路径。')
            : tr('root.pick.failed', '系统文件夹选择框打不开，请直接填写下面的路径。'),
        ),
      saveError !== null && React.createElement('p', { className: 'dshwb-error', role: 'alert' }, saveError),
      React.createElement(
        'div',
        { className: 'dshwb-actions' },
        editingRoot &&
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshwb-secondary',
              disabled: busy,
              onClick: () => {
                setEditingRoot(false);
                setSaveError(null);
                setPickFallback(null);
              },
            },
            tr('root.cancel', '取消'),
          ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: typedPath ? 'dshwb-primary' : 'dshwb-secondary',
            disabled: busy,
            onClick: () => void saveRoot(),
          },
          savingRoot ? tr('root.saving', '校验中…') : tr('root.save', '保存并继续'),
        ),
      ),
    );
  };

  const renderList = (root: string, entries: WorkbenchListEntry[]): React.ReactElement =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'div',
        { className: 'dshwb-root-bar' },
        React.createElement('span', { className: 'dshwb-root-path', title: root }, root),
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-primary', onClick: openCreate },
          tr('bar.new', '新建工作台'),
        ),
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-link', onClick: () => setAttempt((value) => value + 1) },
          tr('list.refresh', '刷新'),
        ),
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-link', onClick: () => startEditing(root) },
          tr('root.change', '更换根目录'),
        ),
      ),
      entries.length === 0
        ? React.createElement(
            'div',
            { className: 'dshwb-card' },
            React.createElement('h2', { className: 'dshwb-card-title' }, tr('list.empty.title', '还没有工作台')),
            React.createElement(
              'p',
              { className: 'dshwb-card-sub' },
              tr(
                'list.empty.sub',
                '这个根目录里暂时没有工作台。可以让 AI 在根目录放一个 <id>/<id>.json，或点「新建工作台」创建。',
              ),
            ),
            React.createElement(
              'div',
              { className: 'dshwb-actions' },
              React.createElement(
                'button',
                { type: 'button', className: 'dshwb-primary', onClick: openCreate },
                tr('list.empty.action', '新建工作台'),
              ),
            ),
          )
        : React.createElement(
            'ul',
            { className: 'dshwb-list' },
            entries.map((entry) =>
              React.createElement(
                'li',
                { key: entry.id },
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'dshwb-item',
                    title: entry.name,
                    onClick: () => void openWorkbench(entry.id),
                  },
                  React.createElement(
                    'span',
                    { className: 'dshwb-item-main' },
                    React.createElement(
                      'span',
                      { className: 'dshwb-item-headline' },
                      React.createElement('span', { className: 'dshwb-item-name' }, entry.name),
                      entry.status !== 'ok' &&
                        React.createElement(
                          'span',
                          { className: `dshwb-badge dshwb-badge-${entry.status}` },
                          tr(WORKBENCH_STATUS_LABEL_KEYS[entry.status], entry.status),
                        ),
                    ),
                    entry.status !== 'ok' &&
                      React.createElement(
                        'span',
                        { className: 'dshwb-item-hint' },
                        tr(WORKBENCH_STATUS_HINT_KEYS[entry.status], entry.status),
                      ),
                  ),
                  // Missing/corrupt entries have no readable name, so the Host
                  // reports the id as the name: never show the id twice.
                  entry.name !== entry.id &&
                    React.createElement('span', { className: 'dshwb-item-id' }, entry.id),
                  React.createElement('span', { className: 'dshwb-item-chevron', 'aria-hidden': true }, '›'),
                ),
              ),
            ),
          ),
    );

  /** The workbench view: the editor owns live state, autosave and the drawer. */
  const renderWorkbenchEditor = (workbench: Workbench): React.ReactElement => {
    const client = rpc;
    if (client === undefined) {
      return React.createElement(
        'div',
        { className: 'dshwb-card' },
        React.createElement('p', { className: 'dshwb-card-sub' }, tr('error.connection', '连接服务不可用，请稍后重试')),
        React.createElement(
          'div',
          { className: 'dshwb-actions' },
          React.createElement(
            'button',
            { type: 'button', className: 'dshwb-secondary', onClick: () => void load() },
            tr('list.retry', '重试'),
          ),
        ),
      );
    }
    return React.createElement(WorkbenchEditor, {
      key: workbench.id,
      workbench,
      tr,
      client,
      shell: props.shell,
      entries: state.phase === 'ready' ? state.entries : [],
      defaultDrawerOpen:
        view.kind === 'workbench' && view.configure === true ? true : drawerOpen,
      onBack: () => void load(),
      onReload: () => void refresh(),
      onSwitch: (id: string) => void openWorkbench(id),
      onDeleted: handleDeleted,
      onDrawerChange: setDrawerOpen,
      onCreateWorkbench: openCreate,
    });
  };

  const renderOpenError = (id: string, message: string): React.ReactElement =>
    React.createElement(
      'div',
      { className: 'dshwb-card' },
      React.createElement('h2', { className: 'dshwb-card-title' }, tr('workbench.error.title', '打开工作台失败')),
      React.createElement('p', { className: 'dshwb-card-sub' }, message),
      React.createElement(
        'div',
        { className: 'dshwb-actions' },
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-secondary', onClick: () => setView({ kind: 'list' }) },
          tr('workbench.back', '返回列表'),
        ),
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-primary', onClick: () => void openWorkbench(id) },
          tr('list.retry', '重试'),
        ),
      ),
    );

  let body: React.ReactNode;
  let workbenchView = false;
  if (state.phase === 'loading') {
    body = React.createElement('p', { className: 'dshwb-loading' }, tr('list.loading', '正在读取…'));
  } else if (state.phase === 'no-root') {
    body = renderRootForm();
  } else if (state.phase === 'ready') {
    if (editingRoot) {
      body = renderRootForm();
    } else if (view.kind === 'workbench') {
      workbenchView = true;
      body = renderWorkbenchEditor(view.workbench);
    } else if (view.kind === 'opening') {
      body = React.createElement('p', { className: 'dshwb-loading' }, tr('workbench.opening', '正在打开…'));
    } else if (view.kind === 'open-error') {
      body = renderOpenError(view.id, view.message);
    } else {
      body = renderList(state.root, state.entries);
    }
  } else {
    body = React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'div',
        { className: 'dshwb-card' },
        React.createElement('h2', { className: 'dshwb-card-title' }, tr('error.title', '读取失败')),
        React.createElement('p', { className: 'dshwb-card-sub' }, state.message),
        React.createElement(
          'div',
          { className: 'dshwb-actions' },
          React.createElement(
            'button',
            { type: 'button', className: 'dshwb-secondary', onClick: () => setAttempt((value) => value + 1) },
            tr('list.retry', '重试'),
          ),
          React.createElement(
            'button',
            { type: 'button', className: 'dshwb-secondary', onClick: () => startEditing('') },
            tr('root.change', '更换根目录'),
          ),
        ),
      ),
      editingRoot && renderRootForm(),
    );
  }

  return React.createElement(
    'div',
    {
      style: {
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: HERO_BASE,
      },
    },
    React.createElement('style', { dangerouslySetInnerHTML: { __html: PANEL_CSS } }),
    React.createElement(HeroBackdrop),
    React.createElement(
      'div',
      { className: workbenchView ? 'dshwb-content dshwb-content-workbench' : 'dshwb-content' },
      workbenchView ? body : React.createElement('div', { className: 'dshwb-stack' }, body),
    ),
    creating &&
      React.createElement(CreateWorkbenchDialog, {
        translate: tr,
        takenIds,
        onClose: () => setCreating(false),
        onCreate: createAndOpenWorkbench,
      }),
  );
}

