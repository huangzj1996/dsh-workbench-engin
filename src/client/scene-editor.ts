/**
 * The scene view: one workbench being edited.
 *
 * It owns the live scene (local first, grid reflows on every keystroke), the
 * autosave (300ms debounce over the Host `save` RPC) and the drawer/grid split.
 * A failed save keeps its readable error in the top bar, rolls the visible scene
 * back to the last version known to be on disk, and offers a retry that
 * re-applies the failed draft.
 *
 * Ticket #6 adds the top-bar workbench switcher, the refresh action (flush,
 * then let the shell re-read the root/list/scene), and the confirmed delete
 * that removes the folder and its index entry before handing the panel back.
 */
import * as React from 'react';

import { ConfigDrawer, type WorkbenchFieldsPatch } from './config-drawer';
import { WorkbenchGrid } from './workbench-grid';
import {
  addPanel,
  changePanelType,
  movePanel,
  removePanel,
  updatePanel,
  updateWorkbench,
  type PanelType,
} from './workbench-draft';
import { WorkbenchRpcError, type WorkbenchClient } from './rpc';
import { workbenchOptionLabel } from './workbench-status';
import { DEFAULT_COLS, type WorkbenchPanel, type WorkbenchScene } from '../shared/workbench/schema';
import type { WorkbenchListEntry } from '../shared/workbench/protocol';
import type { Translate } from './translate';

/** Debounce window for autosave, as the spec asks (~300ms). */
export const AUTOSAVE_DELAY_MS = 300;

/** Styles for the scene body and its save indicator. */
export const SCENE_CSS = `
.dshwb-scene{display:flex;flex-direction:column;gap:10px;width:100%;height:100%;min-height:0;text-align:left}
.dshwb-scene-body{display:flex;flex:1;min-height:0;gap:12px;position:relative}
.dshwb-scene-body>.dshwb-grid-wrap{flex:1;min-width:0}
.dshwb-save-status{flex:0 0 auto;color:rgba(226,234,248,.6);font-size:11.5px;white-space:nowrap}
.dshwb-save-error{flex:0 1 auto;max-width:300px;min-width:0;overflow:hidden;color:#ffb4a8;font-size:11.5px;line-height:1.5;white-space:nowrap;text-overflow:ellipsis}
.dshwb-switch{flex:0 0 auto;width:auto;max-width:240px;padding:6px 8px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(255,255,255,.06);color:#eef3fb;font-family:inherit;font-size:12.5px;line-height:1.4;color-scheme:dark;cursor:pointer}
.dshwb-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-confirm-text{flex:0 1 auto;max-width:260px;color:#ffb4a8;font-size:11.5px;line-height:1.5}
`;
// The narrow-window overlay rule lives in DRAWER_CSS (config-drawer) so it is
// declared after the drawer's base width rules and actually wins.

/** Props injected by the panel shell. */
export interface SceneEditorProps {
  /** Initial scene read from disk; the editor takes it over from here. */
  scene: WorkbenchScene;
  tr: Translate;
  client: WorkbenchClient;
  /** Every registered workbench in index order, for the top-bar switcher. */
  entries: readonly WorkbenchListEntry[];
  /** Whether the drawer starts open (true right after creating a workbench). */
  defaultDrawerOpen?: boolean;
  onBack: () => void;
  /** Flush, then re-read root, list and this workbench (AI edits on disk). */
  onReload: () => void;
  /** Flush, then hand the panel over to another workbench. */
  onSwitch: (id: string) => void;
  /** Called after this workbench was deleted: open the next one or the empty state. */
  onDeleted: (id: string) => Promise<void>;
  /** Report drawer open/closed so switching keeps the user's preference. */
  onDrawerChange?: (open: boolean) => void;
  onCreateWorkbench: () => void;
}

/** Readable message for any RPC/other failure. */
function readableError(error: unknown): string {
  if (error instanceof WorkbenchRpcError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

/** The editor for one workbench. */
export function SceneEditor(props: SceneEditorProps): React.ReactElement {
  const { tr, client } = props;
  const [scene, setScene] = React.useState<WorkbenchScene>(props.scene);
  const [lastSaved, setLastSaved] = React.useState<WorkbenchScene>(props.scene);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(props.defaultDrawerOpen === true);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = React.useState<string | null>(
    props.scene.panels[0]?.id ?? null,
  );

  const sceneRef = React.useRef(scene);
  sceneRef.current = scene;
  const lastSavedRef = React.useRef(lastSaved);
  lastSavedRef.current = lastSaved;
  /** The draft whose save failed, kept so "retry" can re-apply it. */
  const retrySceneRef = React.useRef<WorkbenchScene | null>(null);
  const timerRef = React.useRef<number | null>(null);
  /** Monotonic save counter so an out-of-order reply never overwrites newer state. */
  const seqRef = React.useRef(0);
  /** Set before a delete so the unmount safety net cannot re-create the folder. */
  const deletingRef = React.useRef(false);

  const clearTimer = React.useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Save the live scene now (cancelling the debounce). Returns false when the
   * save failed, so navigation can stay on the panel and show the error.
   */
  const flush = React.useCallback(async (): Promise<boolean> => {
    clearTimer();
    const target = sceneRef.current;
    if (target === lastSavedRef.current) return true;
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setSaving(true);
    try {
      const saved = (await client.save(target)).scene;
      if (seq !== seqRef.current) return true;
      lastSavedRef.current = saved;
      setLastSaved(saved);
      retrySceneRef.current = null;
      setSaveError(null);
      if (sceneRef.current === target) {
        // Treat the saved copy as current immediately, so the unmount safety
        // net below does not write the same scene a second time.
        sceneRef.current = saved;
        setScene(saved);
      }
      return true;
    } catch (error) {
      if (seq !== seqRef.current) return false;
      setSaveError(readableError(error));
      retrySceneRef.current = target;
      // Fall back to the last version we know is on disk, and make the ref agree
      // so an unmount right now cannot resurrect the failed draft.
      sceneRef.current = lastSavedRef.current;
      setScene(lastSavedRef.current);
      return false;
    } finally {
      if (seq === seqRef.current) setSaving(false);
    }
  }, [clearTimer, client]);

  // Debounce: every change schedules one save 300ms after the last edit.
  React.useEffect(() => {
    if (scene === lastSaved) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, AUTOSAVE_DELAY_MS);
    return clearTimer;
  }, [scene, lastSaved, clearTimer, flush]);

  // Safety net: an edit made right before the editor unmounts still reaches disk.
  React.useEffect(
    () => () => {
      clearTimer();
      // A delete in flight wins: saving now would resurrect the removed folder.
      if (deletingRef.current) return;
      const pending = sceneRef.current;
      if (pending !== lastSavedRef.current) {
        void client.save(pending).catch(() => undefined);
      }
    },
    [clearTimer, client],
  );

  /**
   * Adopt a disk re-read of the same workbench (the refresh action).
   *
   * The shell keys this component by workbench id, so a refresh of the open
   * workbench keeps the component mounted and hands down a fresh `scene` prop.
   * Without this sync the editor would keep showing its own copy and AI edits
   * made on disk would never appear.
   */
  const propSceneRef = React.useRef(props.scene);
  React.useEffect(() => {
    const next = props.scene;
    if (next === propSceneRef.current) return;
    propSceneRef.current = next;
    sceneRef.current = next;
    lastSavedRef.current = next;
    retrySceneRef.current = null;
    setScene(next);
    setLastSaved(next);
    setSaveError(null);
  }, [props.scene]);

  // Keep the selection valid when the selected panel is removed.
  React.useEffect(() => {
    if (selectedPanelId !== null && scene.panels.some((panel) => panel.id === selectedPanelId)) {
      return;
    }
    setSelectedPanelId(scene.panels[0]?.id ?? null);
  }, [scene.panels, selectedPanelId]);

  const handleBack = (): void => {
    void flush().then((saved) => {
      if (saved) props.onBack();
    });
  };

  const handleReload = (): void => {
    void flush().then((saved) => {
      if (saved) props.onReload();
    });
  };

  /** Switch workbenches only after the pending autosave lands. */
  const switchTo = (id: string): void => {
    if (id === sceneRef.current.id) return;
    setActionError(null);
    void flush().then((saved) => {
      if (saved) props.onSwitch(id);
    });
  };

  const setDrawer = (open: boolean): void => {
    setDrawerOpen(open);
    props.onDrawerChange?.(open);
  };

  /** Delete the open workbench, then let the shell pick the next one. */
  const deleteWorkbench = async (): Promise<void> => {
    if (deletingRef.current) return;
    const id = sceneRef.current.id;
    setDeleting(true);
    setActionError(null);
    setSaveError(null);
    retrySceneRef.current = null;
    deletingRef.current = true;
    clearTimer();
    try {
      await client.delete(id);
      // The unmount right after this must not write the removed scene back.
      sceneRef.current = lastSavedRef.current;
      setConfirmingDelete(false);
      await props.onDeleted(id);
    } catch (error) {
      deletingRef.current = false;
      setActionError(readableError(error));
    } finally {
      setDeleting(false);
    }
  };

  const retrySave = (): void => {
    const target = retrySceneRef.current;
    if (target === null) return;
    setSaveError(null);
    // The debounce effect picks this change up and saves it again.
    setScene(target);
  };

  const onWorkbenchChange = (patch: WorkbenchFieldsPatch): void => {
    setScene((current) => updateWorkbench(current, patch));
  };

  const onAddPanel = (type: PanelType): void => {
    const title =
      type === 'harness'
        ? tr('panel.new.harness', '会话门牌')
        : tr('panel.new.reserved', '占位面板');
    const next = addPanel(sceneRef.current, type, title);
    const added = next.panels[next.panels.length - 1];
    if (added !== undefined) setSelectedPanelId(added.id);
    setScene(next);
  };

  const onDeletePanel = (id: string): void => {
    setScene((current) => removePanel(current, id));
  };

  const onMovePanel = (id: string, delta: number): void => {
    setScene((current) => movePanel(current, id, delta));
  };

  const onPanelChange = (id: string, patch: Partial<WorkbenchPanel>): void => {
    setScene((current) => updatePanel(current, id, patch));
  };

  const onPanelTypeChange = (id: string, type: PanelType): void => {
    setScene((current) => changePanelType(current, id, type));
  };

  const cols = scene.cols ?? DEFAULT_COLS;
  const status =
    scene === lastSaved
      ? tr('save.saved', '已保存')
      : saving
        ? tr('save.saving', '保存中…')
        : tr('save.pending', '待保存');

  return React.createElement(
    'div',
    { className: 'dshwb-scene' },
    React.createElement('style', { dangerouslySetInnerHTML: { __html: SCENE_CSS } }),
    React.createElement(
      'div',
      { className: 'dshwb-scene-bar' },
      React.createElement(
        'button',
        { type: 'button', className: 'dshwb-link', onClick: handleBack },
        `← ${tr('scene.back', '返回列表')}`,
      ),
      React.createElement(
        'select',
        {
          className: 'dshwb-switch',
          'aria-label': tr('bar.switch', '切换工作台'),
          title: tr('bar.switch', '切换工作台'),
          value: scene.id,
          disabled: deleting,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => switchTo(event.target.value),
        },
        props.entries.map((entry) =>
          React.createElement(
            'option',
            { key: entry.id, value: entry.id },
            workbenchOptionLabel(tr, entry),
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'dshwb-scene-heading' },
        React.createElement(
          'h2',
          { className: 'dshwb-scene-name', title: scene.name },
          scene.name.trim() === '' ? scene.id : scene.name,
        ),
        React.createElement('span', { className: 'dshwb-scene-id', title: scene.id }, scene.id),
      ),
      React.createElement(
        'span',
        { className: 'dshwb-scene-meta' },
        `${cols} ${tr('scene.colsUnit', '列')} · ${scene.panels.length} ${tr('scene.panelsUnit', '个子面板')}`,
      ),
      saveError !== null &&
        React.createElement(
          'span',
          { className: 'dshwb-save-error', role: 'alert', title: saveError },
          `${tr('save.errorPrefix', '保存失败：')}${saveError}`,
        ),
      saveError !== null &&
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-link', onClick: retrySave },
          tr('save.retry', '重试'),
        ),
      saveError === null &&
        React.createElement('span', { className: 'dshwb-save-status' }, status),
      actionError !== null &&
        React.createElement(
          'span',
          { className: 'dshwb-save-error', role: 'alert', title: actionError },
          actionError,
        ),
      React.createElement(
        'button',
        { type: 'button', className: 'dshwb-link', onClick: handleReload },
        tr('scene.refresh', '刷新'),
      ),
      confirmingDelete
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'span',
              { className: 'dshwb-confirm-text' },
              tr('bar.deleteConfirm', '删除这个工作台？目录与索引登记都会移除，无法撤销。'),
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dshwb-link dshwb-link-danger',
                disabled: deleting,
                onClick: () => void deleteWorkbench(),
              },
              deleting
                ? tr('bar.deleting', '删除中…')
                : tr('bar.confirmDelete', '确认删除'),
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dshwb-link',
                disabled: deleting,
                onClick: () => setConfirmingDelete(false),
              },
              tr('bar.cancelDelete', '取消'),
            ),
          )
        : React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshwb-link dshwb-link-danger',
              onClick: () => {
                setActionError(null);
                setConfirmingDelete(true);
              },
            },
            tr('bar.delete', '删除工作台'),
          ),
      React.createElement(
        'button',
        { type: 'button', className: 'dshwb-primary', onClick: props.onCreateWorkbench },
        tr('bar.new', '新建工作台'),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'dshwb-secondary',
          onClick: () => setDrawer(!drawerOpen),
        },
        drawerOpen ? tr('drawer.hide', '收起配置') : tr('drawer.show', '配置'),
      ),
    ),
    scene.description !== undefined &&
      scene.description.trim() !== '' &&
      React.createElement('p', { className: 'dshwb-scene-desc' }, scene.description),
    React.createElement(
      'div',
      { className: 'dshwb-scene-body' },
      React.createElement(WorkbenchGrid, { scene, tr }),
      drawerOpen &&
        React.createElement(ConfigDrawer, {
          scene,
          selectedPanelId,
          tr,
          onClose: () => setDrawer(false),
          onWorkbenchChange,
          onSelectPanel: setSelectedPanelId,
          onAddPanel,
          onDeletePanel,
          onMovePanel,
          onPanelChange,
          onPanelTypeChange,
        }),
    ),
  );
}
