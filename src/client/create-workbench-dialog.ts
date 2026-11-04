/**
 * The "create workbench" modal: name input, the auto-generated read-only id
 * that the panel shell will save under, and the cancel/create actions.
 *
 * The dialog owns only the draft name and the create request's busy/error
 * state; the shell owns the actual `save` call (so the list and the panel view
 * refresh in one place). Enter confirms, Esc closes.
 */
import * as React from 'react';

import { useCopyToClipboard } from './clipboard';
import { describeError } from '../shared/workbench/errors';
import { generateWorkbenchId } from '../shared/workbench/ids';
import type { Translate } from './translate';
import { normalizeWorkbenchName } from './workbench-name';

/** Props injected by the panel shell. */
export interface CreateWorkbenchDialogProps {
  /** Locale translate function bound to this plugin's namespace. */
  translate: Translate;
  /** Ids already taken in the workbench root; the new id must not collide. */
  takenIds: readonly string[];
  /** Dismiss without creating; the shell restores trigger focus. */
  onClose: () => void;
  /** Create and persist the workbench; the shell closes the dialog on success. */
  onCreate: (name: string, id: string) => Promise<void>;
}

/** The creation dialog: mounted only while it is open. */
export function CreateWorkbenchDialog(props: CreateWorkbenchDialogProps): React.ReactElement {
  const tr = props.translate;
  const [draftName, setDraftName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) props.onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [props.onClose, busy]);

  const name = normalizeWorkbenchName(draftName);

  // One id per name: a Chinese-only name falls back to a random `wb-` id, and
  // keeping it in a memo stops it from changing on unrelated re-renders.
  const id = React.useMemo(
    () => (name === null ? '' : generateWorkbenchId(name, props.takenIds)),
    [name, props.takenIds],
  );

  const create = (): void => {
    if (name === null || id === '' || busy) return;
    setBusy(true);
    setError(null);
    void props.onCreate(name, id).catch((cause: unknown) => {
      setError(describeError(cause));
      setBusy(false);
    });
  };

  const canCreate = name !== null && !busy;

  return React.createElement(
    'div',
    {
      className: 'dshwb-overlay',
      onClick: () => {
        if (!busy) props.onClose();
      },
    },
    React.createElement(
      'div',
      {
        className: 'dshwb-dialog',
        role: 'dialog',
        'aria-modal': true,
        'aria-label': tr('dialog.title', '创建工作台'),
        onClick: (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation(),
      },
      React.createElement('h2', { className: 'dshwb-dialog-title' }, tr('dialog.title', '创建工作台')),
      React.createElement(
        'p',
        { className: 'dshwb-dialog-sub' },
        tr('dialog.sub', '给它起个名字，之后再配置子面板与版面。'),
      ),
      React.createElement(
        'label',
        { className: 'dshwb-label', htmlFor: 'dshwb-create-name' },
        tr('dialog.nameLabel', '工作台名称'),
      ),
      React.createElement('input', {
        id: 'dshwb-create-name',
        ref: inputRef,
        className: 'dshwb-input',
        type: 'text',
        value: draftName,
        placeholder: tr('dialog.namePlaceholder', '例如：我的工作台'),
        autoComplete: 'off',
        spellCheck: false,
        disabled: busy,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraftName(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          create();
        },
      }),
      React.createElement(
        'label',
        { className: 'dshwb-label dshwb-label-spaced', htmlFor: 'dshwb-create-id' },
        tr('dialog.idLabel', '工作台 id（自动生成，只读）'),
      ),
      React.createElement(
        'div',
        { className: 'dshwb-idrow' },
        React.createElement('input', {
          id: 'dshwb-create-id',
          className: 'dshwb-idvalue',
          type: 'text',
          value: id,
          readOnly: true,
          placeholder: tr('dialog.idPlaceholder', '输入名称后自动生成'),
          onFocus: (event: React.FocusEvent<HTMLInputElement>) => event.currentTarget.select(),
        }),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dshwb-secondary',
            disabled: id === '' || busy,
            onClick: () => copy(id),
          },
          copied ? tr('dialog.copied', '已复制') : tr('dialog.copy', '复制'),
        ),
      ),
      React.createElement(
        'p',
        { className: 'dshwb-dialog-hint' },
        tr('dialog.idHint', 'id 也是文件夹名，创建后不可修改；可以复制给 AI 使用。'),
      ),
      error !== null &&
        React.createElement('p', { className: 'dshwb-error', role: 'alert' }, error),
      React.createElement(
        'div',
        { className: 'dshwb-actions' },
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-secondary', disabled: busy, onClick: props.onClose },
          tr('dialog.cancel', '取消'),
        ),
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-primary', disabled: !canCreate, onClick: create },
          busy ? tr('dialog.creating', '创建中…') : tr('dialog.create', '创建'),
        ),
      ),
    ),
  );
}
