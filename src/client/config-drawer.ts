/**
 * The config drawer: the whole configuration surface for one workbench.
 *
 * It is a sibling of the grid inside the workbench view (380px, scrollable, shrinks
 * to an overlay on narrow windows) and edits the live workbench through callbacks —
 * the workbench editor owns the state and the autosave, so every keystroke lands in
 * the grid immediately. Layout: three sections, workbench fields, the panel
 * list (add / delete / reorder / select), and the selected panel's properties.
 */
import * as React from 'react';

import { useCopyToClipboard } from './clipboard';
import { bindingPatch, harnessBinding, parsePinTargetText } from './harness-binding';
import { findSession, harnessOpenTarget } from './harness-view';
import { PANEL_TYPES, panelTypeDefinition, panelTypeLabel, type PanelType } from './panel-types';
import { useSessionSnapshot } from './use-session-snapshot';
import type { WorkbenchPanel, Workbench } from '../shared/workbench/schema';
import { DEFAULT_COLS } from '../shared/workbench/schema';
import type { HarnessSession, SessionShell } from './session-shell';
import type { Translate } from './translate';
import { normalizeWorkbenchName, syncNameDraft } from './workbench-name';

/** The workbench-level fields this drawer edits. */
export interface WorkbenchFieldsPatch {
  name?: string;
  description?: string;
  cols?: number;
}

/** Everything the drawer needs from the workbench editor. */
export interface ConfigDrawerProps {
  workbench: Workbench;
  /** Id of the panel whose properties are shown, null when none is selected. */
  selectedPanelId: string | null;
  tr: Translate;
  /** The shell session list, for picking what a session badge binds to. */
  shell?: SessionShell;
  onClose: () => void;
  onWorkbenchChange: (patch: WorkbenchFieldsPatch) => void;
  onSelectPanel: (id: string) => void;
  onAddPanel: (type: PanelType) => void;
  onDeletePanel: (id: string) => void;
  onMovePanel: (id: string, delta: number) => void;
  onPanelChange: (id: string, patch: Partial<WorkbenchPanel>) => void;
  onPanelTypeChange: (id: string, type: PanelType) => void;
}

/** Styles for the drawer; injected with the component (panel styles are global). */
export const DRAWER_CSS = `
.dshwb-drawer{box-sizing:border-box;display:flex;flex:0 0 380px;flex-direction:column;max-width:380px;min-height:0;overflow:auto;padding:12px 14px 20px;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:rgba(9,15,26,.82);backdrop-filter:blur(14px);box-shadow:0 14px 36px rgba(0,0,0,.28);color:#eef3fb}
.dshwb-drawer-head{display:flex;align-items:center;gap:8px;margin:0 0 4px}
.dshwb-drawer-title{margin:0;flex:1;font-size:14px;font-weight:600;line-height:1.4}
.dshwb-drawer-section{margin:12px 0 0;padding:12px 0 0;border-top:1px solid rgba(255,255,255,.1)}
.dshwb-drawer-section-title{margin:0 0 10px;color:rgba(226,234,248,.7);font-size:11.5px;font-weight:600;letter-spacing:.06em}
.dshwb-field{margin:0 0 10px}
.dshwb-field-label{display:block;margin:0 0 5px;color:rgba(226,234,248,.68);font-size:12px}
.dshwb-textarea{min-height:62px;resize:vertical;line-height:1.5;font-family:inherit}
.dshwb-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dshwb-idrow{display:flex;align-items:center;gap:8px}
.dshwb-idvalue{flex:1;min-width:0;overflow:hidden;padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.04);color:rgba(226,234,248,.8);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}
.dshwb-panel-list{display:flex;flex-direction:column;gap:6px;margin:0 0 10px;padding:0;list-style:none}
.dshwb-panel-row{display:flex;align-items:center;gap:4px;padding:4px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.04)}
.dshwb-panel-row-active{border-color:var(--dsw-alias-brand-primary);background:rgba(86,160,255,.12)}
.dshwb-panel-pick{display:flex;flex:1;min-width:0;align-items:center;gap:7px;padding:4px 5px;border:0;border-radius:6px;background:none;color:inherit;font-family:inherit;font-size:12px;text-align:left;cursor:pointer}
.dshwb-panel-pick:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dshwb-panel-ordinal{flex:0 0 auto;color:rgba(169,206,255,.85);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10.5px}
.dshwb-panel-name{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12.5px}
.dshwb-panel-kind{flex:0 0 auto;color:rgba(226,234,248,.45);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px}
.dshwb-icon-btn{box-sizing:border-box;display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:12px;line-height:1;cursor:pointer;transition:background-color var(--ds-transition-duration) var(--ds-ease-in-out),border-color var(--ds-transition-duration) var(--ds-ease-in-out),color var(--ds-transition-duration) var(--ds-ease-in-out),opacity var(--ds-transition-duration) var(--ds-ease-in-out)}
.dshwb-icon-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dshwb-icon-btn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}
.dshwb-icon-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.dshwb-icon-btn:disabled{opacity:.4;cursor:not-allowed}
.dshwb-icon-btn-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}
.dshwb-confirm{display:flex;flex:0 0 auto;align-items:center;gap:4px}
.dshwb-confirm-text{color:#ffb4a8;font-size:11px;white-space:nowrap}
.dshwb-add-row{display:flex;flex-wrap:wrap;gap:8px}
.dshwb-add-row .dshwb-input{flex:1;min-width:0;color-scheme:dark}
.dshwb-drawer select.dshwb-input{color-scheme:dark}
.dshwb-drawer-hint{margin:0;color:rgba(226,234,248,.55);font-size:11.5px;line-height:1.6}
.dshwb-session-status{display:flex;align-items:center;gap:6px;margin:-2px 0 10px;color:rgba(226,234,248,.62);font-size:11.5px;line-height:1.5}
.dshwb-drawer-openrow{display:flex;align-items:center;gap:8px;margin:-2px 0 10px}
.dshwb-session-dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.28)}
.dshwb-session-dot-running{background:#56a0ff}
.dshwb-session-dot-warn{background:#ffc454}
@media (max-width: 900px){.dshwb-drawer{position:absolute;top:0;right:0;bottom:0;z-index:5;flex:none;width:min(380px,88%);max-width:none;box-shadow:-18px 0 48px rgba(0,0,0,.45)}}
`;

/** Read one string field off a panel without trusting the JSON shape. */
function stringField(panel: WorkbenchPanel, key: string): string {
  const value = panel[key];
  return typeof value === 'string' ? value : '';
}

/** Read one string-array field off a panel (`pinTarget`), defaulting to empty. */
function stringArrayField(panel: WorkbenchPanel, key: string): string[] {
  const value = panel[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Raw string read for controlled inputs: never trims while the user types. */
function rawStringField(panel: WorkbenchPanel, key: string): string {
  const value = panel[key];
  return typeof value === 'string' ? value : '';
}

/** Dropdown label for one shell session. */
function sessionOptionLabel(tr: Translate, session: HarnessSession): string {
  const title =
    session.title !== '' ? session.title : tr('panel.harness.untitled', '未命名会话');
  return session.running ? `${title} · ${tr('panel.harness.running', '运行中')}` : title;
}

/**
 * The session-badge fields: a picker over the shell's session list.
 *
 * Picking writes the three binding fields (`sessionId` is identity, so a stale
 * option can never overwrite it). The cached title is editable as a fallback for
 * when the shell cannot report one, and `pinTarget` keeps its array form. When
 * the shell exposes no session list at all the picker degrades to manual id and
 * title inputs rather than disappearing.
 */
function HarnessFields(props: {
  panel: WorkbenchPanel;
  tr: Translate;
  shell?: SessionShell;
  onValue: (patch: Partial<WorkbenchPanel>) => void;
}): React.ReactElement {
  const { panel, tr, shell, onValue } = props;
  const binding = harnessBinding(panel);
  const snapshot = useSessionSnapshot(shell);
  const bound = findSession(snapshot, binding.sessionId);
  const missing = snapshot.available && binding.sessionId !== '' && bound === null;

  /**
   * The stored id can always be opened, even while the shell list cannot
   * describe the session (manual-id path and the "missing" case included).
   */
  const openTarget = harnessOpenTarget(binding);
  const [openFailed, setOpenFailed] = React.useState(false);
  React.useEffect(() => {
    setOpenFailed(false);
  }, [openTarget]);
  const open = (): void => {
    if (openTarget === null) return;
    setOpenFailed(false);
    if (shell === undefined || !shell.openSession(openTarget)) setOpenFailed(true);
  };
  const openRow: React.ReactNode =
    openTarget === null
      ? null
      : React.createElement(
          'div',
          { className: 'dshwb-drawer-openrow' },
          React.createElement(
            'button',
            { type: 'button', className: 'dshwb-secondary', onClick: open },
            tr('panel.harness.open', '打开会话'),
          ),
          React.createElement(
            'span',
            { className: 'dshwb-drawer-hint' },
            tr('panel.harness.openByIdHint', '按保存的会话 id 直接打开'),
          ),
        );
  const openError = openFailed
    ? React.createElement(
        'p',
        { className: 'dshwb-error', role: 'alert' },
        tr('panel.harness.openFailed', '打不开这条会话：外壳没有提供打开能力。'),
      )
    : null;

  /** Dropdown choice: empty unbinds, a known session writes all three fields. */
  const pick = (id: string): void => {
    if (id === '') {
      onValue({ sessionId: '', sessionTitle: '' });
      return;
    }
    const session = findSession(snapshot, id);
    if (session === null) return;
    const patch = bindingPatch(panel, session);
    if (patch !== null) onValue(patch);
  };

  const pinTargetField = React.createElement(TextField, {
    id: 'dshwb-panel-pin-target',
    label: tr('panel.pinTarget', '定位目标'),
    value: stringArrayField(panel, 'pinTarget').join(', '),
    placeholder: tr('panel.pinTargetPlaceholder', '多个用逗号分隔'),
    onValue: (value: string) => onValue({ pinTarget: parsePinTargetText(value) }),
  });

  if (!snapshot.available) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'p',
        { className: 'dshwb-drawer-hint' },
        tr(
          'panel.sessions.unavailable',
          '读不到外壳的会话列表；可以手填会话 id，点击门牌时仍会按 id 打开。',
        ),
      ),
      React.createElement(TextField, {
        id: 'dshwb-panel-session-id',
        label: tr('panel.sessionId', '会话 id'),
        value: rawStringField(panel, 'sessionId'),
        placeholder: tr('panel.sessionIdPlaceholder', '要打开的会话'),
        onValue: (value: string) => onValue({ sessionId: value }),
      }),
      openRow,
      openError,
      React.createElement(TextField, {
        id: 'dshwb-panel-session-title',
        label: tr('panel.sessionTitle', '会话标题'),
        value: rawStringField(panel, 'sessionTitle'),
        placeholder: tr('panel.sessionTitlePlaceholder', '显示在门牌上的标题'),
        onValue: (value: string) => onValue({ sessionTitle: value }),
      }),
      pinTargetField,
    );
  }

  const options: React.ReactNode[] = [
    React.createElement(
      'option',
      { key: '', value: '' },
      tr('panel.sessions.none', '未绑定（选一条会话）'),
    ),
  ];
  for (const session of snapshot.sessions) {
    options.push(
      React.createElement(
        'option',
        { key: session.id, value: session.id },
        sessionOptionLabel(tr, session),
      ),
    );
  }
  if (missing) {
    const label = binding.sessionTitle !== '' ? binding.sessionTitle : binding.sessionId;
    options.push(
      React.createElement(
        'option',
        { key: binding.sessionId, value: binding.sessionId },
        `${label} · ${tr('panel.sessions.missing', '不可用')}`,
      ),
    );
  }

  const status =
    bound !== null
      ? React.createElement(
          'p',
          { className: 'dshwb-session-status' },
          React.createElement('span', {
            className: bound.running
              ? 'dshwb-session-dot dshwb-session-dot-running'
              : 'dshwb-session-dot',
          }),
          bound.running
            ? tr('panel.harness.running', '运行中')
            : tr('panel.harness.idle', '空闲'),
        )
      : missing
        ? React.createElement(
            'p',
            { className: 'dshwb-session-status' },
            React.createElement('span', { className: 'dshwb-session-dot dshwb-session-dot-warn' }),
            tr('panel.sessions.missing', '绑定的会话已不在外壳列表里'),
          )
        : null;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      Field,
      { label: tr('panel.sessions.label', '会话'), htmlFor: 'dshwb-panel-session-pick' },
      React.createElement(
        'select',
        {
          id: 'dshwb-panel-session-pick',
          className: 'dshwb-input',
          value: binding.sessionId,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => pick(event.target.value),
        },
        options,
      ),
    ),
    status,
    missing && openRow,
    openError,
    snapshot.sessions.length === 0 &&
      React.createElement(
        'p',
        { className: 'dshwb-drawer-hint' },
        tr('panel.sessions.empty', '外壳里还没有会话，先去侧栏建一条。'),
      ),
    React.createElement(TextField, {
      id: 'dshwb-panel-session-title',
      label: tr('panel.sessionTitle', '会话标题'),
      value: rawStringField(panel, 'sessionTitle'),
      placeholder: tr('panel.sessionTitlePlaceholder', '显示在门牌上的标题'),
      hint: tr('panel.sessionTitleHint', '门牌优先显示外壳里的当前标题；读不到时用这个缓存标题。'),
      onValue: (value: string) => onValue({ sessionTitle: value }),
    }),
    pinTargetField,
  );
}

/** Label + control wrapper used by every field. */
function Field(props: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return React.createElement(
    'div',
    { className: 'dshwb-field' },
    React.createElement('label', { className: 'dshwb-field-label', htmlFor: props.htmlFor }, props.label),
    props.children,
    props.hint !== undefined && React.createElement('p', { className: 'dshwb-drawer-hint' }, props.hint),
  );
}

/** A text input bound to a workbench/panel field. */
function TextField(props: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  onValue: (value: string) => void;
  onBlur?: () => void;
}): React.ReactElement {
  return React.createElement(
    Field,
    { label: props.label, htmlFor: props.id, hint: props.hint },
    React.createElement('input', {
      id: props.id,
      className: 'dshwb-input',
      type: 'text',
      value: props.value,
      placeholder: props.placeholder,
      autoComplete: 'off',
      spellCheck: false,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onValue(event.target.value),
      onBlur: props.onBlur,
    }),
  );
}

/** A textarea bound to a workbench/panel field. */
function TextAreaField(props: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onValue: (value: string) => void;
}): React.ReactElement {
  return React.createElement(
    Field,
    { label: props.label, htmlFor: props.id },
    React.createElement('textarea', {
      id: props.id,
      className: 'dshwb-input dshwb-textarea',
      value: props.value,
      placeholder: props.placeholder,
      spellCheck: false,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => props.onValue(event.target.value),
    }),
  );
}

/** A positive-integer field; an empty value means "not set" (auto flow). */
function NumberField(props: {
  id: string;
  label: string;
  value: number | undefined;
  min: number;
  max?: number;
  onValue: (value: number | undefined) => void;
}): React.ReactElement {
  return React.createElement(
    Field,
    { label: props.label, htmlFor: props.id },
    React.createElement('input', {
      id: props.id,
      className: 'dshwb-input',
      type: 'number',
      inputMode: 'numeric',
      min: props.min,
      max: props.max,
      value: props.value === undefined ? '' : String(props.value),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value.trim();
        if (raw === '') {
          props.onValue(undefined);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < props.min) return;
        if (props.max !== undefined && parsed > props.max) return;
        props.onValue(parsed);
      },
    }),
  );
}

/**
 * The type-specific fields of one panel.
 *
 * Dispatch goes through the panel-type registry: a type that binds a session
 * gets the session picker, any other registered type gets its own text field,
 * and an unregistered (AI-written) type keeps its unknown fields untouched.
 */
function TypeFields(props: {
  panel: WorkbenchPanel;
  tr: Translate;
  shell?: SessionShell;
  onValue: (patch: Partial<WorkbenchPanel>) => void;
}): React.ReactElement {
  const { panel, tr, onValue } = props;
  const definition = panelTypeDefinition(panel.type);
  if (definition === undefined) {
    return React.createElement(
      'p',
      { className: 'dshwb-drawer-hint' },
      tr('panel.unknownFields', '这个类型没有内置编辑器；它的未知字段会原样保存。'),
    );
  }
  if (definition.bindsSession) {
    return React.createElement(HarnessFields, {
      panel,
      tr,
      shell: props.shell,
      onValue,
    });
  }
  return React.createElement(TextAreaField, {
    id: `dshwb-panel-text`,
    label: tr('panel.text', '占位文本'),
    value: stringField(panel, 'text'),
    placeholder: tr('panel.textPlaceholder', '占位面板里显示的文字'),
    onValue: (value: string) => onValue({ text: value }),
  });
}

/** The config drawer for one workbench. */
export function ConfigDrawer(props: ConfigDrawerProps): React.ReactElement {
  const { workbench, tr } = props;
  const { copied, copy } = useCopyToClipboard();
  const [nameDraft, setNameDraft] = React.useState(workbench.name);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [addType, setAddType] = React.useState<PanelType>('reserved');

  // Follow a disk reload by content version: the draft is re-synced only when
  // the committed name no longer matches what it represents, so typing (which
  // trims the committed name) never fights the input, but an external rename
  // picked up by Refresh immediately shows up.
  React.useEffect(() => {
    setNameDraft((draft) => syncNameDraft(draft, workbench.name));
  }, [workbench.id, workbench.name]);

  const commitName = (raw: string): void => {
    setNameDraft(raw);
    if (normalizeWorkbenchName(raw) !== null) props.onWorkbenchChange({ name: raw.trim() });
  };

  const commitNameOnBlur = (): void => {
    if (normalizeWorkbenchName(nameDraft) === null) setNameDraft(workbench.name);
  };

  const cols = workbench.cols ?? DEFAULT_COLS;
  const selected = workbench.panels.find((panel) => panel.id === props.selectedPanelId);

  const workbenchSection = React.createElement(
    'section',
    { className: 'dshwb-drawer-section' },
    React.createElement('h3', { className: 'dshwb-drawer-section-title' }, tr('drawer.workbench', '工作台')),
    React.createElement(TextField, {
      id: 'dshwb-workbench-name',
      label: tr('drawer.name', '名称'),
      value: nameDraft,
      placeholder: tr('drawer.namePlaceholder', '例如：我的工作台'),
      onValue: commitName,
      onBlur: commitNameOnBlur,
    }),
    React.createElement(TextAreaField, {
      id: 'dshwb-workbench-description',
      label: tr('drawer.description', '描述'),
      value: workbench.description ?? '',
      placeholder: tr('drawer.descriptionPlaceholder', '这个工作台是做什么的'),
      onValue: (value: string) => props.onWorkbenchChange({ description: value }),
    }),
    React.createElement(NumberField, {
      id: 'dshwb-workbench-cols',
      label: tr('drawer.cols', '列数'),
      value: cols,
      min: 1,
      max: 12,
      onValue: (value: number | undefined) => {
        if (value !== undefined) props.onWorkbenchChange({ cols: value });
      },
    }),
    React.createElement(
      'div',
      { className: 'dshwb-field' },
      React.createElement(
        'label',
        { className: 'dshwb-field-label', htmlFor: 'dshwb-workbench-id' },
        tr('drawer.id', 'id（创建后只读）'),
      ),
      React.createElement(
        'div',
        { className: 'dshwb-idrow' },
        React.createElement(
          'input',
          {
            id: 'dshwb-workbench-id',
            className: 'dshwb-idvalue',
            type: 'text',
            value: workbench.id,
            readOnly: true,
            onFocus: (event: React.FocusEvent<HTMLInputElement>) => event.currentTarget.select(),
          },
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dshwb-secondary',
            onClick: () => copy(workbench.id),
          },
          copied ? tr('drawer.copied', '已复制') : tr('drawer.copy', '复制'),
        ),
      ),
    ),
  );

  const panelSection = React.createElement(
    'section',
    { className: 'dshwb-drawer-section' },
    React.createElement('h3', { className: 'dshwb-drawer-section-title' }, tr('drawer.panels', '子面板')),
    workbench.panels.length === 0
      ? React.createElement('p', { className: 'dshwb-drawer-hint' }, tr('drawer.noPanels', '还没有子面板。'))
      : React.createElement(
          'ul',
          { className: 'dshwb-panel-list' },
          workbench.panels.map((panel, index) =>
            React.createElement(
              'li',
              {
                key: panel.id,
                className:
                  panel.id === props.selectedPanelId
                    ? 'dshwb-panel-row dshwb-panel-row-active'
                    : 'dshwb-panel-row',
              },
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'dshwb-panel-pick',
                  title: panel.title,
                  onClick: () => props.onSelectPanel(panel.id),
                },
                React.createElement(
                  'span',
                  { className: 'dshwb-panel-ordinal' },
                  String(index + 1).padStart(2, '0'),
                ),
                React.createElement(
                  'span',
                  { className: 'dshwb-panel-name' },
                  panel.title.trim() === '' ? tr('panel.untitled', '未命名') : panel.title,
                ),
                React.createElement('span', { className: 'dshwb-panel-kind' }, panel.type),
              ),
              confirmDeleteId === panel.id
                ? React.createElement(
                    'span',
                    { className: 'dshwb-confirm' },
                    React.createElement(
                      'span',
                      { className: 'dshwb-confirm-text' },
                      tr('drawer.deleteConfirm', '确认删除？'),
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dshwb-icon-btn',
                        title: tr('drawer.confirm', '确认'),
                        onClick: () => {
                          setConfirmDeleteId(null);
                          props.onDeletePanel(panel.id);
                        },
                      },
                      '✓',
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dshwb-icon-btn',
                        title: tr('drawer.cancel', '取消'),
                        onClick: () => setConfirmDeleteId(null),
                      },
                      '✕',
                    ),
                  )
                : React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dshwb-icon-btn',
                        title: tr('drawer.moveUp', '上移'),
                        disabled: index === 0,
                        onClick: () => props.onMovePanel(panel.id, -1),
                      },
                      '↑',
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dshwb-icon-btn',
                        title: tr('drawer.moveDown', '下移'),
                        disabled: index === workbench.panels.length - 1,
                        onClick: () => props.onMovePanel(panel.id, 1),
                      },
                      '↓',
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dshwb-icon-btn dshwb-icon-btn-danger',
                        title: tr('drawer.delete', '删除'),
                        onClick: () => setConfirmDeleteId(panel.id),
                      },
                      '✕',
                    ),
                  ),
            ),
          ),
        ),
    React.createElement(
      'div',
      { className: 'dshwb-add-row' },
      React.createElement(
        'select',
        {
          className: 'dshwb-input',
          'aria-label': tr('panel.type', '类型'),
          value: addType,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
            setAddType(event.target.value as PanelType),
        },
        PANEL_TYPES.map((type) =>
          React.createElement('option', { key: type, value: type }, panelTypeLabel(tr, type)),
        ),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'dshwb-secondary',
          onClick: () => props.onAddPanel(addType),
        },
        tr('drawer.add', '添加子面板'),
      ),
    ),
  );

  const typeOptions = React.useMemo(() => {
    const known = new Set<string>(PANEL_TYPES);
    const options = [...PANEL_TYPES] as string[];
    if (selected !== undefined && !known.has(selected.type)) options.push(selected.type);
    return options;
  }, [selected]);

  const selectedSection = React.createElement(
    'section',
    { className: 'dshwb-drawer-section' },
    React.createElement(
      'h3',
      { className: 'dshwb-drawer-section-title' },
      tr('drawer.panelProps', '子面板属性'),
    ),
    selected === undefined
      ? React.createElement(
          'p',
          { className: 'dshwb-drawer-hint' },
          tr('drawer.selectPanelHint', '在下面的列表里选择一个子面板来编辑它的属性。'),
        )
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(TextField, {
            id: 'dshwb-panel-title',
            label: tr('panel.title', '标题'),
            value: selected.title,
            placeholder: tr('panel.titlePlaceholder', '显示在子面板顶部的标题'),
            onValue: (value: string) => props.onPanelChange(selected.id, { title: value }),
          }),
          React.createElement(TextField, {
            id: 'dshwb-panel-sub',
            label: tr('panel.sub', '副标题'),
            value: selected.sub ?? '',
            placeholder: tr('panel.subPlaceholder', '可选的一行补充说明'),
            onValue: (value: string) => props.onPanelChange(selected.id, { sub: value }),
          }),
          React.createElement(
            Field,
            { label: tr('panel.type', '类型'), htmlFor: 'dshwb-panel-type' },
            React.createElement(
              'select',
              {
                id: 'dshwb-panel-type',
                className: 'dshwb-input',
                value: selected.type,
                onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
                  props.onPanelTypeChange(selected.id, event.target.value as PanelType),
              },
              typeOptions.map((type) =>
                React.createElement(
                  'option',
                  { key: type, value: type },
                  panelTypeLabel(tr, type),
                ),
              ),
            ),
          ),
          React.createElement(
            Field,
            { label: tr('panel.layout', '位置与跨度'), hint: tr('panel.layoutHint', '留空表示自动排列；坐标从 1 开始。') },
            React.createElement(
              'div',
              { className: 'dshwb-grid2' },
              React.createElement(NumberField, {
                id: 'dshwb-panel-col',
                label: tr('panel.col', '起始列'),
                value: selected.col,
                min: 1,
                onValue: (value: number | undefined) =>
                  props.onPanelChange(selected.id, { col: value }),
              }),
              React.createElement(NumberField, {
                id: 'dshwb-panel-row',
                label: tr('panel.row', '起始行'),
                value: selected.row,
                min: 1,
                onValue: (value: number | undefined) =>
                  props.onPanelChange(selected.id, { row: value }),
              }),
              React.createElement(NumberField, {
                id: 'dshwb-panel-w',
                label: tr('panel.w', '跨列'),
                value: selected.w,
                min: 1,
                max: 12,
                onValue: (value: number | undefined) =>
                  props.onPanelChange(selected.id, { w: value }),
              }),
              React.createElement(NumberField, {
                id: 'dshwb-panel-h',
                label: tr('panel.h', '跨行'),
                value: selected.h,
                min: 1,
                onValue: (value: number | undefined) =>
                  props.onPanelChange(selected.id, { h: value }),
              }),
            ),
          ),
          React.createElement(TypeFields, {
            panel: selected,
            tr,
            shell: props.shell,
            onValue: (patch: Partial<WorkbenchPanel>) => props.onPanelChange(selected.id, patch),
          }),
        ),
  );

  return React.createElement(
    'aside',
    { className: 'dshwb-drawer', 'aria-label': tr('drawer.title', '配置') },
    React.createElement('style', { dangerouslySetInnerHTML: { __html: DRAWER_CSS } }),
    React.createElement(
      'header',
      { className: 'dshwb-drawer-head' },
      React.createElement('h2', { className: 'dshwb-drawer-title' }, tr('drawer.title', '配置')),
      React.createElement(
        'button',
        { type: 'button', className: 'dshwb-link', onClick: props.onClose },
        tr('drawer.close', '收起'),
      ),
    ),
    workbenchSection,
    panelSection,
    selectedSection,
  );
}
