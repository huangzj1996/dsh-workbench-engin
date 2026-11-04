/**
 * The Workbench main panel: the shell that resolves the workbench root, lists
 * the workbenches found there and renders the one the user opens.
 *
 * Tickets #3–#4 scope: first-run root setup, the empty state, the list with its
 * three reconciliation flags, readable errors, and the grid view of one
 * workbench (panel chrome + renderer table). The config drawer and creating
 * workbenches arrive in later tickets.
 */
import * as React from 'react';

import { HeroBackdrop, HERO_BASE } from './hero-backdrop';
import { WorkbenchRpcError, type WorkbenchClient } from './rpc';
import { WorkbenchGrid } from './workbench-grid';
import type { WorkbenchListEntry } from '../shared/workbench/protocol';
import { DEFAULT_COLS, type WorkbenchScene } from '../shared/workbench/schema';

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
.dshwb-content-scene{align-items:stretch;justify-content:stretch;padding:16px 18px;overflow:hidden}
.dshwb-scene{display:flex;flex-direction:column;gap:10px;width:100%;height:100%;min-height:0;text-align:left}
.dshwb-scene-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.dshwb-scene-heading{display:flex;flex:1;min-width:0;align-items:baseline;gap:8px}
.dshwb-scene-name{margin:0;overflow:hidden;color:#eef3fb;font-size:15px;font-weight:600;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}
.dshwb-scene-id{overflow:hidden;max-width:40%;color:rgba(226,234,248,.48);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
.dshwb-scene-meta{flex:0 0 auto;color:rgba(226,234,248,.55);font-size:11.5px;white-space:nowrap}
.dshwb-scene-desc{margin:0;color:rgba(226,234,248,.62);font-size:12px;line-height:1.6}
.dshwb-item-name{flex:1;min-width:0;overflow:hidden;color:#eef3fb;font-size:13.5px;font-weight:500;white-space:nowrap;text-overflow:ellipsis}
.dshwb-item-id{overflow:hidden;max-width:45%;color:rgba(226,234,248,.48);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
.dshwb-badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;line-height:1.6;white-space:nowrap}
.dshwb-badge-external{background:rgba(86,160,255,.18);color:#a9ceff}
.dshwb-badge-missing{background:rgba(255,196,84,.16);color:#ffd88e}
.dshwb-badge-corrupt{background:rgba(255,112,96,.18);color:#ffb4a8}
.dshwb-loading{margin:0;color:rgba(226,234,248,.62);font-size:12.5px}
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
  | { kind: 'scene'; scene: WorkbenchScene }
  | { kind: 'open-error'; id: string; message: string };

/** Props injected by the panel slot, plus the Host RPC the entry composes in. */
export interface HelloPanelProps {
  /** Locale translate function bound to this plugin's namespace. */
  t?: (key: string) => string;
  /** Host RPC client; absent only if the entry could not build one. */
  rpc?: WorkbenchClient;
}

/** Status-label key per reconciliation flag. */
const STATUS_KEYS: Record<Exclude<WorkbenchListEntry['status'], 'ok'>, string> = {
  external: 'list.status.external',
  missing: 'list.status.missing',
  corrupt: 'list.status.corrupt',
};

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
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<PanelView>({ kind: 'list' });

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
      setState({
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
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
      const { scene } = await rpc.read(id);
      setView({ kind: 'scene', scene });
    } catch (error) {
      setView({
        kind: 'open-error',
        id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const startEditing = (prefill: string): void => {
    setPathDraft(prefill);
    setSaveError(null);
    setEditingRoot(true);
  };

  const saveRoot = async (): Promise<void> => {
    if (rpc === undefined) return;
    const path = pathDraft.trim();
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
      setAttempt((value) => value + 1);
    } catch (error) {
      setSaveError(
        error instanceof WorkbenchRpcError ? error.message : error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSavingRoot(false);
    }
  };

  const renderRootForm = (): React.ReactElement => {
    return React.createElement(
      'div',
      { className: 'dshwb-card' },
      React.createElement('h2', { className: 'dshwb-card-title' }, tr('root.title', '设置工作台根目录')),
      React.createElement(
        'p',
        { className: 'dshwb-card-sub' },
        tr('root.sub', '工作台的索引与每个工作台的 JSON 都会写在这个文件夹里。'),
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
        disabled: savingRoot,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setPathDraft(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          void saveRoot();
        },
      }),
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
              disabled: savingRoot,
              onClick: () => {
                setEditingRoot(false);
                setSaveError(null);
              },
            },
            tr('root.cancel', '取消'),
          ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dshwb-primary',
            disabled: savingRoot,
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
                '这个根目录里暂时没有工作台。可以让 AI 在根目录放一个 <id>/<id>.json，或稍后用「新建工作台」创建。',
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
                  React.createElement('span', { className: 'dshwb-item-name' }, entry.name),
                  React.createElement('span', { className: 'dshwb-item-id' }, entry.id),
                  entry.status !== 'ok' &&
                    React.createElement(
                      'span',
                      { className: `dshwb-badge dshwb-badge-${entry.status}` },
                      tr(STATUS_KEYS[entry.status], entry.status),
                    ),
                  React.createElement('span', { className: 'dshwb-item-chevron', 'aria-hidden': true }, '›'),
                ),
              ),
            ),
          ),
    );

  const renderScene = (scene: WorkbenchScene): React.ReactElement => {
    const cols = scene.cols ?? DEFAULT_COLS;
    return React.createElement(
      'div',
      { className: 'dshwb-scene' },
      React.createElement(
        'div',
        { className: 'dshwb-scene-bar' },
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-link', onClick: () => setView({ kind: 'list' }) },
          `← ${tr('scene.back', '返回列表')}`,
        ),
        React.createElement(
          'div',
          { className: 'dshwb-scene-heading' },
          React.createElement('h2', { className: 'dshwb-scene-name', title: scene.name }, scene.name),
          React.createElement('span', { className: 'dshwb-scene-id', title: scene.id }, scene.id),
        ),
        React.createElement(
          'span',
          { className: 'dshwb-scene-meta' },
          `${cols} ${tr('scene.colsUnit', '列')} · ${scene.panels.length} ${tr('scene.panelsUnit', '个子面板')}`,
        ),
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-link', onClick: () => void openWorkbench(scene.id) },
          tr('scene.refresh', '刷新'),
        ),
      ),
      scene.description !== undefined &&
        scene.description.trim() !== '' &&
        React.createElement('p', { className: 'dshwb-scene-desc' }, scene.description),
      React.createElement(WorkbenchGrid, { scene, tr }),
    );
  };

  const renderOpenError = (id: string, message: string): React.ReactElement =>
    React.createElement(
      'div',
      { className: 'dshwb-card' },
      React.createElement('h2', { className: 'dshwb-card-title' }, tr('scene.error.title', '打开工作台失败')),
      React.createElement('p', { className: 'dshwb-card-sub' }, message),
      React.createElement(
        'div',
        { className: 'dshwb-actions' },
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-secondary', onClick: () => setView({ kind: 'list' }) },
          tr('scene.back', '返回列表'),
        ),
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-primary', onClick: () => void openWorkbench(id) },
          tr('list.retry', '重试'),
        ),
      ),
    );

  let body: React.ReactNode;
  let sceneView = false;
  if (state.phase === 'loading') {
    body = React.createElement('p', { className: 'dshwb-loading' }, tr('list.loading', '正在读取…'));
  } else if (state.phase === 'no-root') {
    body = renderRootForm();
  } else if (state.phase === 'ready') {
    if (editingRoot) {
      body = renderRootForm();
    } else if (view.kind === 'scene') {
      sceneView = true;
      body = renderScene(view.scene);
    } else if (view.kind === 'opening') {
      body = React.createElement('p', { className: 'dshwb-loading' }, tr('scene.opening', '正在打开…'));
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
      { className: sceneView ? 'dshwb-content dshwb-content-scene' : 'dshwb-content' },
      sceneView ? body : React.createElement('div', { className: 'dshwb-stack' }, body),
    ),
  );
}

