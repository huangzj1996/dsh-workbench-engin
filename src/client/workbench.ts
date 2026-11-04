/**
 * The Workbench main panel: the panel shell that composes the hero backdrop,
 * the empty/created state and the creation dialog.
 *
 * Composition and state only — the backdrop lives in `hero-backdrop.ts`, the
 * creation flow in `create-workbench-dialog.ts` (+ `workbench-name.ts` for the
 * pure name rules). `src/client/index.ts` keeps importing `HelloPanel` and
 * `PANEL_ID` from here unchanged.
 */
import * as React from 'react';

import { CreateWorkbenchDialog } from './create-workbench-dialog';
import { HeroBackdrop, HERO_BASE } from './hero-backdrop';

/** The main-panel key this bundle owns. */
export const PANEL_ID = 'hello-word';

/**
 * Component-local styles: hover/focus states need real class selectors.
 * Injected once by the shell; the creation dialog's `.dshwb-overlay` …
 * `.dshwb-actions` classes are defined here too.
 */
const PANEL_CSS = `
.dshwb-content{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;padding:24px}
.dshwb-stack{display:flex;flex-direction:column;align-items:center;gap:10px;max-width:440px;text-align:center}
.dshwb-hint{margin:0;color:#eef3fb;font-size:17px;font-weight:500;letter-spacing:.02em}
.dshwb-sub{margin:0;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.7}
.dshwb-created-name{margin:0;color:#eef3fb;font-size:24px;font-weight:600;letter-spacing:.02em;word-break:break-word}
.dshwb-primary{display:inline-flex;align-items:center;justify-content:center;margin-top:8px;padding:9px 20px;border:1px solid transparent;border-radius:10px;background:var(--dsw-alias-brand-primary);color:#fff;font-family:inherit;font-size:13px;font-weight:500;line-height:1.4;cursor:pointer;transition:filter .15s ease,transform .15s ease}
.dshwb-primary:hover{filter:brightness(1.08)}
.dshwb-primary:active{transform:translateY(1px)}
.dshwb-primary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-primary:disabled{opacity:.45;cursor:not-allowed;filter:none;transform:none}
.dshwb-secondary{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;font-weight:500;line-height:1.4;cursor:pointer;transition:background .15s ease}
.dshwb-secondary:hover{background:var(--dsw-alias-bg-layer-2)}
.dshwb-secondary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dshwb-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(3,7,16,.58)}
.dshwb-dialog{box-sizing:border-box;width:360px;max-width:100%;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 24px 70px rgba(0,0,0,.5);text-align:left}
.dshwb-dialog-title{margin:0 0 4px;font-size:15px;font-weight:600;line-height:1.4}
.dshwb-dialog-sub{margin:0 0 14px;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.6}
.dshwb-label{display:block;margin:0 0 6px;color:var(--dsw-alias-label-secondary);font-size:12px}
.dshwb-input{box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:1.4;outline:none;transition:border-color .15s ease}
.dshwb-input:focus{border-color:var(--dsw-alias-brand-primary)}
.dshwb-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.dshwb-actions .dshwb-primary{margin-top:0}
`;

/** In-memory workbench so switching panels and coming back keeps it. */
let rememberedWorkbench: string | null = null;

/** Props injected by the panel slot. */
export interface HelloPanelProps {
  /** Locale translate function bound to this plugin's namespace. */
  t?: (key: string) => string;
}

/**
 * The central panel: hero backdrop, an empty state that creates a workbench,
 * and the creation dialog.
 */
export function HelloPanel(props: HelloPanelProps): React.ReactElement {
  const translate = props.t;
  const tr = (key: string, fallback: string): string => {
    if (typeof translate !== 'function') return fallback;
    const value = translate(key);
    return value === key ? fallback : value;
  };

  const [workbench, setWorkbench] = React.useState<string | null>(() => rememberedWorkbench);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const closeDialog = React.useCallback((): void => {
    setDialogOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openDialog = React.useCallback((): void => {
    setDialogOpen(true);
  }, []);

  const createWorkbench = React.useCallback((name: string): void => {
    rememberedWorkbench = name;
    setWorkbench(name);
    closeDialog();
  }, [closeDialog]);

  const empty = workbench === null;

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
    React.createElement('style', {
      dangerouslySetInnerHTML: { __html: PANEL_CSS },
    }),
    React.createElement(HeroBackdrop),
    React.createElement(
      'div',
      { className: 'dshwb-content' },
      empty
        ? React.createElement(
            'div',
            { className: 'dshwb-stack' },
            React.createElement('p', { className: 'dshwb-hint' }, tr('empty.hint', '还没有工作台')),
            React.createElement('p', { className: 'dshwb-sub' }, tr('empty.sub', '创建你的第一个工作台，沉淀任务、资料与工作流。')),
            React.createElement(
              'button',
              {
                type: 'button',
                ref: triggerRef,
                className: 'dshwb-primary',
                onClick: openDialog,
              },
              tr('empty.action', '创建工作台'),
            ),
          )
        : React.createElement(
            'div',
            { className: 'dshwb-stack' },
            React.createElement('p', { className: 'dshwb-hint' }, tr('created.hint', '当前工作台')),
            React.createElement('p', { className: 'dshwb-created-name' }, workbench),
            React.createElement(
              'button',
              {
                type: 'button',
                ref: triggerRef,
                className: 'dshwb-secondary',
                onClick: openDialog,
              },
              tr('created.action', '新建工作台'),
            ),
          ),
    ),
    dialogOpen &&
      React.createElement(CreateWorkbenchDialog, {
        translate: tr,
        onClose: closeDialog,
        onCreate: createWorkbench,
      }),
  );
}
