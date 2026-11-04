/**
 * Draft helpers: build and edit a workbench workbench locally before it is saved.
 *
 * The editor mutates a plain workbench object and renders from it immediately; the
 * autosave layer persists whatever the object becomes. These helpers are pure
 * so the ordering/identity rules are testable without a DOM, and they replace
 * (never mutate) the workbench so React sees a new value.
 */
import { DEFAULT_COLS, type WorkbenchPanel, type Workbench } from '../shared/workbench/schema';

/** The panel types the v1 config drawer offers. */
export const PANEL_TYPES = ['reserved', 'harness'] as const;

/** One of the panel types the config drawer offers. */
export type PanelType = (typeof PANEL_TYPES)[number];

/** First free `panel-N` id, so a created panel never collides with a placed one. */
function nextPanelId(panels: readonly Pick<WorkbenchPanel, 'id'>[]): string {
  const taken = new Set(panels.map((panel) => panel.id));
  let index = 1;
  while (taken.has(`panel-${index}`)) index += 1;
  return `panel-${index}`;
}

/**
 * Build a new panel of `type` with the type's default fields.
 *
 * `title` is passed in already localised: titles are user-facing content, so
 * this module stays free of locale coupling.
 */
export function createPanel(
  type: PanelType,
  panels: readonly Pick<WorkbenchPanel, 'id'>[],
  title: string,
): WorkbenchPanel {
  const id = nextPanelId(panels);
  if (type === 'harness') {
    return { id, title, type, sessionTitle: '', sessionId: '', pinTarget: [] };
  }
  return { id, title, type, text: '' };
}

/** A brand-new workbench: four columns and one reserved placeholder panel. */
export function createWorkbench(
  id: string,
  name: string,
  panelTitle: string,
): Workbench {
  return {
    id,
    name,
    cols: DEFAULT_COLS,
    panels: [createPanel('reserved', [], panelTitle)],
  };
}

/** Swap in a new panel list, leaving every other workbench field untouched. */
function withPanels(workbench: Workbench, panels: WorkbenchPanel[]): Workbench {
  return { ...workbench, panels };
}

/** Append a freshly created panel, keeping the existing order. */
export function addPanel(
  workbench: Workbench,
  type: PanelType,
  title: string,
): Workbench {
  return withPanels(workbench, [...workbench.panels, createPanel(type, workbench.panels, title)]);
}

/** Drop one panel by id; an unknown id keeps the same workbench object (no save). */
export function removePanel(workbench: Workbench, id: string): Workbench {
  const panels = workbench.panels.filter((panel) => panel.id !== id);
  return panels.length === workbench.panels.length ? workbench : withPanels(workbench, panels);
}

/** Move one panel by `delta` positions; moving past either end is a no-op. */
export function movePanel(workbench: Workbench, id: string, delta: number): Workbench {
  const from = workbench.panels.findIndex((panel) => panel.id === id);
  if (from === -1) return workbench;
  const to = from + delta;
  if (to < 0 || to >= workbench.panels.length) return workbench;
  const panels = [...workbench.panels];
  const [moved] = panels.splice(from, 1);
  panels.splice(to, 0, moved);
  return withPanels(workbench, panels);
}

/**
 * Merge a patch into one panel.
 *
 * A field set to `undefined` is removed rather than stored as `null`, which is
 * how the drawer clears `col`/`row` and hands the panel back to the auto flow.
 */
export function updatePanel(
  workbench: Workbench,
  id: string,
  patch: Partial<WorkbenchPanel>,
): Workbench {
  const index = workbench.panels.findIndex((panel) => panel.id === id);
  if (index === -1) return workbench;
  const next: WorkbenchPanel = { ...workbench.panels[index], ...patch };
  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined) delete next[key];
  }
  const panels = [...workbench.panels];
  panels[index] = next;
  return withPanels(workbench, panels);
}

/** Patch the workbench-level fields; an `undefined` field is removed. */
export function updateWorkbench(
  workbench: Workbench,
  patch: Partial<Pick<Workbench, 'name' | 'description' | 'cols'>>,
): Workbench {
  const next: Workbench = { ...workbench, ...patch };
  for (const key of Object.keys(patch)) {
    if (patch[key as keyof typeof patch] === undefined) delete next[key];
  }
  return next;
}

/**
 * Switch one panel to another type.
 *
 * The panel keeps its identity and layout fields; the new type's own fields are
 * only filled in when absent, so switching back and forth never destroys data
 * the other type happened to keep.
 */
export function changePanelType(
  workbench: Workbench,
  id: string,
  type: PanelType,
): Workbench {
  const current = workbench.panels.find((panel) => panel.id === id);
  if (current === undefined || current.type === type) return workbench;
  const next: WorkbenchPanel = { ...current, type };
  const defaults: WorkbenchPanel =
    type === 'harness'
      ? { id, title: current.title, type, sessionTitle: '', sessionId: '', pinTarget: [] }
      : { id, title: current.title, type, text: '' };
  for (const key of Object.keys(defaults)) {
    if (next[key] === undefined) next[key] = defaults[key];
  }
  return updatePanel(workbench, id, next);
}
