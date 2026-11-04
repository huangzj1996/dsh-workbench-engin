/**
 * The "create workbench" modal: name input, cancel/create buttons, Enter and
 * Esc handling.
 *
 * It owns only the draft name; the panel shell owns the remembered workbench
 * and the trigger button whose focus comes back when the modal closes. The
 * class names it renders are defined once by the panel shell's stylesheet.
 */
import * as React from 'react';

import { normalizeWorkbenchName } from './workbench-name';

/** Translate a key, falling back to the literal when the locale has no entry. */
export type Translate = (key: string, fallback: string) => string;

/** Props injected by the panel shell. */
export interface CreateWorkbenchDialogProps {
  /** Locale translate function bound to this plugin's namespace. */
  translate: Translate;
  /** Dismiss without creating; the shell restores trigger focus. */
  onClose: () => void;
  /** Called with the trimmed, non-empty name. */
  onCreate: (name: string) => void;
}

/** The creation dialog: mounted only while it is open. */
export function CreateWorkbenchDialog(props: CreateWorkbenchDialogProps): React.ReactElement {
  const tr = props.translate;
  const [draftName, setDraftName] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      props.onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [props.onClose]);

  const create = (): void => {
    const name = normalizeWorkbenchName(draftName);
    if (name === null) return;
    props.onCreate(name);
  };

  const canCreate = normalizeWorkbenchName(draftName) !== null;

  return React.createElement(
    'div',
    {
      className: 'dshwb-overlay',
      onClick: props.onClose,
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
      React.createElement('p', { className: 'dshwb-dialog-sub' }, tr('dialog.sub', '给它起个名字，之后可以随时修改。')),
      React.createElement(
        'label',
        { className: 'dshwb-label' },
        tr('dialog.nameLabel', '工作台名称'),
        React.createElement('input', {
          ref: inputRef,
          className: 'dshwb-input',
          type: 'text',
          value: draftName,
          placeholder: tr('dialog.namePlaceholder', '例如：我的工作台'),
          autoComplete: 'off',
          spellCheck: false,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraftName(event.target.value),
          onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            create();
          },
        }),
      ),
      React.createElement(
        'div',
        { className: 'dshwb-actions' },
        React.createElement(
          'button',
          { type: 'button', className: 'dshwb-secondary', onClick: props.onClose },
          tr('dialog.cancel', '取消'),
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dshwb-primary',
            disabled: !canCreate,
            onClick: create,
          },
          tr('dialog.create', '创建'),
        ),
      ),
    ),
  );
}
