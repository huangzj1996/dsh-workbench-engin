/**
 * Draft helpers: build and edit a workbench scene locally before it is saved.
 *
 * The editor mutates a plain scene object and renders from it immediately; the
 * autosave layer persists whatever the object becomes. These helpers are pure
 * so the ordering/identity rules are testable without a DOM, and they replace
 * (never mutate) the scene so React sees a new value.
 */
import { DEFAULT_COLS, type WorkbenchPanel, type WorkbenchScene } from '../shared/workbench/schema';

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
export function createWorkbenchScene(
  id: string,
  name: string,
  panelTitle: string,
): WorkbenchScene {
  return {
    id,
    name,
    cols: DEFAULT_COLS,
    panels: [createPanel('reserved', [], panelTitle)],
  };
}

/** Swap in a new panel list, leaving every other workbench field untouched. */
function withPanels(scene: WorkbenchScene, panels: WorkbenchPanel[]): WorkbenchScene {
  return { ...scene, panels };
}

/** Append a freshly created panel, keeping the existing order. */
export function addPanel(
  scene: WorkbenchScene,
  type: PanelType,
  title: string,
): WorkbenchScene {
  return withPanels(scene, [...scene.panels, createPanel(type, scene.panels, title)]);
}

/** Drop one panel by id; an unknown id keeps the same scene object (no save). */
export function removePanel(scene: WorkbenchScene, id: string): WorkbenchScene {
  const panels = scene.panels.filter((panel) => panel.id !== id);
  return panels.length === scene.panels.length ? scene : withPanels(scene, panels);
}

/** Move one panel by `delta` positions; moving past either end is a no-op. */
export function movePanel(scene: WorkbenchScene, id: string, delta: number): WorkbenchScene {
  const from = scene.panels.findIndex((panel) => panel.id === id);
  if (from === -1) return scene;
  const to = from + delta;
  if (to < 0 || to >= scene.panels.length) return scene;
  const panels = [...scene.panels];
  const [moved] = panels.splice(from, 1);
  panels.splice(to, 0, moved);
  return withPanels(scene, panels);
}

/**
 * Merge a patch into one panel.
 *
 * A field set to `undefined` is removed rather than stored as `null`, which is
 * how the drawer clears `col`/`row` and hands the panel back to the auto flow.
 */
export function updatePanel(
  scene: WorkbenchScene,
  id: string,
  patch: Partial<WorkbenchPanel>,
): WorkbenchScene {
  const index = scene.panels.findIndex((panel) => panel.id === id);
  if (index === -1) return scene;
  const next: WorkbenchPanel = { ...scene.panels[index], ...patch };
  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined) delete next[key];
  }
  const panels = [...scene.panels];
  panels[index] = next;
  return withPanels(scene, panels);
}

/** Patch the workbench-level fields; an `undefined` field is removed. */
export function updateWorkbench(
  scene: WorkbenchScene,
  patch: Partial<Pick<WorkbenchScene, 'name' | 'description' | 'cols'>>,
): WorkbenchScene {
  const next: WorkbenchScene = { ...scene, ...patch };
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
  scene: WorkbenchScene,
  id: string,
  type: PanelType,
): WorkbenchScene {
  const current = scene.panels.find((panel) => panel.id === id);
  if (current === undefined || current.type === type) return scene;
  const next: WorkbenchPanel = { ...current, type };
  const defaults: WorkbenchPanel =
    type === 'harness'
      ? { id, title: current.title, type, sessionTitle: '', sessionId: '', pinTarget: [] }
      : { id, title: current.title, type, text: '' };
  for (const key of Object.keys(defaults)) {
    if (next[key] === undefined) next[key] = defaults[key];
  }
  return updatePanel(scene, id, next);
}
