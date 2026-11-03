/**
 * Client half entry: the Workbench bundle.
 *
 * Registers the central `main` panel and composes the sidebar header entry
 * beside the shell's own New Session button. Disposal follows the plugin fiber
 * (`ctx.effect`), so disabling the bundle removes both again.
 */
import { mountHeaderButton } from './sidebar-button';
import { HelloPanel, PANEL_ID } from './workbench';

/** Locale namespace owned by this plugin. */
const NS = 'workbench';

/** Simplified Chinese dictionary. */
const zh: Record<string, string> = {
  'menu.label': '工作台',
  'empty.hint': '还没有工作台',
  'empty.sub': '创建你的第一个工作台，沉淀任务、资料与工作流。',
  'empty.action': '创建工作台',
  'dialog.title': '创建工作台',
  'dialog.sub': '给它起个名字，之后可以随时修改。',
  'dialog.nameLabel': '工作台名称',
  'dialog.namePlaceholder': '例如：我的工作台',
  'dialog.cancel': '取消',
  'dialog.create': '创建',
  'created.hint': '当前工作台',
  'created.action': '新建工作台',
};

/** English dictionary. */
const en: Record<string, string> = {
  'menu.label': 'Workbench',
  'empty.hint': 'No workbench yet',
  'empty.sub': 'Create your first workbench to keep tasks, files and flows together.',
  'empty.action': 'Create workbench',
  'dialog.title': 'Create workbench',
  'dialog.sub': 'Give it a name — you can change it later.',
  'dialog.nameLabel': 'Workbench name',
  'dialog.namePlaceholder': 'e.g. My workbench',
  'dialog.cancel': 'Cancel',
  'dialog.create': 'Create',
  'created.hint': 'Current workbench',
  'created.action': 'New workbench',
};

/** The part of the Client locale service this plugin uses. */
interface LocaleFace {
  bind(ns: string): (key: string) => string;
  register(ns: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): () => void;
}

/** The part of the Client slots service this plugin uses. */
interface SlotsFace {
  inject(key: string, callback: () => unknown): () => void;
  register(options: { name: string; key?: string; locale?: string }, component: unknown): () => void;
}

/** The Client context shape handed to a Client half. */
export interface ClientContext {
  locale: LocaleFace;
  slots: SlotsFace;
  effect(setup: () => (() => void) | void, label?: string): void;
  layout: { selectPanel(panelId: string): void };
}

/** Diagnostics label for this Client half (used by slot registrant stamps). */
export const name = 'dsh-hello-word';

/** Client services this plugin requires. */
export const inject = ['slots', 'locale', 'layout'];

/** Register the panel and compose the sidebar header button. */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'workbench: dictionaries');

  ctx.slots.inject('main', () =>
    ctx.slots.register(
      { name: 'main', key: PANEL_ID, locale: NS },
      HelloPanel,
    ),
  );

  ctx.effect(() => mountHeaderButton(ctx, t), 'workbench: sidebar header button');
}
