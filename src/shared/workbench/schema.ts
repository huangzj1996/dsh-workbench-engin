/**
 * Workbench JSON schema: the one shape written to `<root>/<id>/<id>.json`.
 *
 * Parsing never reshapes the document: unknown fields on the scene and on each
 * panel are part of the contract (an AI may write future fields), so validation
 * checks the known fields and returns the parsed object untouched.
 */
import { WorkbenchStoreError } from './errors';

export { WorkbenchStoreError };
export type { WorkbenchErrorCode } from './errors';

/** Legal workbench id: lowercase ASCII, starts alphanumeric, at most 64 chars. */
export const WORKBENCH_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** One grid cell: the persisted identity is `id`, `type` picks the renderer. */
export interface WorkbenchPanel {
  id: string;
  title: string;
  type: string;
  sub?: string;
  col?: number;
  row?: number;
  w?: number;
  h?: number;
  expand?: boolean;
  [key: string]: unknown;
}

/** A workbench: `<root>/<id>/<id>.json` is the single source of truth. */
export interface WorkbenchScene {
  id: string;
  name: string;
  description?: string;
  cols?: number;
  panels: WorkbenchPanel[];
  [key: string]: unknown;
}

/** Default grid columns when the JSON omits `cols`. */
export const DEFAULT_COLS = 4;

/** Default panel span when the JSON omits `w` / `h`. */
export const DEFAULT_SPAN = 2;

/** True when `value` is a legal workbench id. */
export function isWorkbenchId(value: unknown): value is string {
  return typeof value === 'string' && WORKBENCH_ID_PATTERN.test(value);
}

/** True for a plain JSON object (not null, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for a positive integer, as used by `cols`, `col`, `row`, `w`, `h`. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/** Reject one panel field with a scene-invalid error. */
function invalid(reason: string): never {
  throw new WorkbenchStoreError('scene-invalid', reason);
}

/** Validate one panel, leaving it untouched so unknown fields survive. */
function validatePanel(raw: unknown, index: number): WorkbenchPanel {
  if (!isRecord(raw)) invalid(`第 ${index + 1} 个子面板不是对象`);
  const panel = raw as Record<string, unknown>;
  if (typeof panel['id'] !== 'string' || panel['id'].trim() === '') {
    invalid(`第 ${index + 1} 个子面板缺少 id`);
  }
  if (typeof panel['title'] !== 'string') invalid(`第 ${index + 1} 个子面板缺少标题`);
  if (typeof panel['type'] !== 'string' || panel['type'].trim() === '') {
    invalid(`第 ${index + 1} 个子面板缺少类型`);
  }
  if (panel['sub'] !== undefined && typeof panel['sub'] !== 'string') {
    invalid(`第 ${index + 1} 个子面板的副标题必须是字符串`);
  }
  for (const key of ['col', 'row', 'w', 'h'] as const) {
    if (panel[key] !== undefined && !isPositiveInteger(panel[key])) {
      invalid(`第 ${index + 1} 个子面板的 ${key} 必须是正整数`);
    }
  }
  if (panel['expand'] !== undefined && typeof panel['expand'] !== 'boolean') {
    invalid(`第 ${index + 1} 个子面板的 expand 必须是布尔值`);
  }
  return panel as WorkbenchPanel;
}

/** Validate a parsed workbench document; throws scene-invalid on any mismatch. */
export function validateScene(raw: unknown): WorkbenchScene {
  if (!isRecord(raw)) invalid('配置必须是 JSON 对象');
  const scene = raw as Record<string, unknown>;
  if (!isWorkbenchId(scene['id'])) invalid('缺少合法的 id');
  if (typeof scene['name'] !== 'string' || scene['name'].trim() === '') invalid('缺少名称');
  if (scene['description'] !== undefined && typeof scene['description'] !== 'string') {
    invalid('description 必须是字符串');
  }
  if (scene['cols'] !== undefined && !isPositiveInteger(scene['cols'])) invalid('cols 必须是正整数');
  if (!Array.isArray(scene['panels'])) invalid('panels 必须是数组');
  scene['panels'].forEach((panel, index) => validatePanel(panel, index));
  return scene as WorkbenchScene;
}

/** Parse a workbench file body; bad JSON is file-corrupt, bad shape scene-invalid. */
export function parseWorkbench(text: string): WorkbenchScene {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new WorkbenchStoreError('file-corrupt', error instanceof Error ? error.message : String(error));
  }
  return validateScene(raw);
}

/** Serialize a workbench back to disk: stable 2-space JSON with a trailing newline. */
export function serializeWorkbench(scene: WorkbenchScene): string {
  return `${JSON.stringify(scene, null, 2)}\n`;
}
