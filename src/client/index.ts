/**
 * Client half entry: the Workbench bundle.
 *
 * Registers the central `main` panel and composes the sidebar header entry
 * beside the shell's own New Session button. Disposal follows the plugin fiber
 * (`ctx.effect`), so disabling the bundle removes both again.
 */
import * as React from 'react';

import { createWorkbenchClient, type ClientRpcContext } from './rpc';
import { mountHeaderButton } from './sidebar-button';
import { HelloPanel, PANEL_ID, type HelloPanelProps } from './workbench';

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
  'root.title': '设置工作台根目录',
  'root.sub': '工作台的索引与每个工作台的 JSON 都会写在这个文件夹里。',
  'root.label': '根目录路径',
  'root.placeholder': '例如：D:\\work\\my-workbenches',
  'root.save': '保存并继续',
  'root.saving': '校验中…',
  'root.needPath': '请先填写文件夹路径',
  'root.change': '更换根目录',
  'root.cancel': '取消',
  'list.loading': '正在读取…',
  'list.refresh': '刷新',
  'list.retry': '重试',
  'list.empty.title': '还没有工作台',
  'list.empty.sub': '这个根目录里暂时没有工作台。可以让 AI 在根目录放一个 <id>/<id>.json，或稍后用「新建工作台」创建。',
  'list.status.external': '外部新建',
  'list.status.missing': '缺失',
  'list.status.corrupt': '损坏',
  'scene.back': '返回列表',
  'scene.refresh': '刷新',
  'scene.opening': '正在打开…',
  'scene.colsUnit': '列',
  'scene.panelsUnit': '个子面板',
  'scene.error.title': '打开工作台失败',
  'panel.empty': '这个工作台还没有子面板。在工作台 JSON 的 panels 里加一个，再点「刷新」。',
  'panel.unknown': '未知面板类型',
  'panel.outOfBounds': '坐标越界',
  'panel.reserved.placeholder': '占位面板，内容待补充',
  'error.title': '读取失败',
  'error.connection': '连接服务不可用，请稍后重试',
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
  'root.title': 'Set the workbench root folder',
  'root.sub': 'The index and every workbench JSON will be written into this folder.',
  'root.label': 'Root folder path',
  'root.placeholder': 'e.g. D:\\work\\my-workbenches',
  'root.save': 'Save and continue',
  'root.saving': 'Checking…',
  'root.needPath': 'Enter a folder path first',
  'root.change': 'Change root',
  'root.cancel': 'Cancel',
  'list.loading': 'Loading…',
  'list.refresh': 'Refresh',
  'list.retry': 'Retry',
  'list.empty.title': 'No workbench yet',
  'list.empty.sub': 'This root has no workbench yet. Ask an AI to drop an <id>/<id>.json here, or create one later with “New workbench”.',
  'list.status.external': 'New on disk',
  'list.status.missing': 'Missing',
  'list.status.corrupt': 'Corrupt',
  'scene.back': 'Back to list',
  'scene.refresh': 'Refresh',
  'scene.opening': 'Opening…',
  'scene.colsUnit': 'columns',
  'scene.panelsUnit': 'panels',
  'scene.error.title': 'Could not open the workbench',
  'panel.empty': 'This workbench has no panel yet. Add one to panels in the workbench JSON, then hit Refresh.',
  'panel.unknown': 'Unknown panel type',
  'panel.outOfBounds': 'Out of bounds',
  'panel.reserved.placeholder': 'Placeholder panel — content to come later',
  'error.title': 'Could not load',
  'error.connection': 'The connection service is unavailable; try again shortly',
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
export interface ClientContext extends ClientRpcContext {
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

  const rpc = createWorkbenchClient(ctx);
  const panel = (props: HelloPanelProps): React.ReactElement =>
    React.createElement(HelloPanel, { ...props, t: props.t ?? t, rpc });

  ctx.slots.inject('main', () =>
    ctx.slots.register(
      { name: 'main', key: PANEL_ID, locale: NS },
      panel,
    ),
  );

  ctx.effect(() => mountHeaderButton(ctx, t), 'workbench: sidebar header button');
}
