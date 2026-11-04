/**
 * The workbench data layer: everything the Host RPC needs to touch disk.
 *
 * Paths are derived from a `dshHome` and a workbench `root` handed in by the
 * caller, never from process state, so tests can point both at temp dirs. The
 * fs adapter is injectable for the same reason (and to exercise write failures).
 */
import * as nodeFs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { WorkbenchStoreError } from '../../shared/workbench/schema';
import type {
  RootConfig,
  WorkbenchList,
  WorkbenchListEntry,
} from '../../shared/workbench/protocol';
import {
  isWorkbenchId,
  parseWorkbench,
  serializeWorkbench,
  validateScene,
  type WorkbenchScene,
} from '../../shared/workbench/schema';

/** The Host config directory name inside the DSH home. */
const CONFIG_DIR = 'dsh-hello-word';
const CONFIG_FILE = 'config.json';

/** The index file under the workbench root, and its on-disk version. */
export const INDEX_FILE = 'index.json';
export const INDEX_VERSION = 1;

/** One workbench file may not exceed this size; larger files are refused. */
export const MAX_FILE_BYTES = 256 * 1024;

/** One `{ id, order }` row of `index.json`. */
interface IndexEntry {
  id: string;
  order: number;
}

/** `index.json`; unknown top-level fields are preserved on rewrite. */
interface IndexData {
  version: number;
  workbenches: IndexEntry[];
  [key: string]: unknown;
}

/** The subset of `node:fs/promises` the store uses. */
export interface FsLike {
  readFile(file: string, encoding: 'utf8'): Promise<string>;
  writeFile(file: string, data: string, encoding: 'utf8'): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(target: string, options: { force?: boolean; recursive?: boolean }): Promise<void>;
  mkdir(dir: string, options: { recursive: true }): Promise<void>;
  readdir(dir: string): Promise<Array<{ name: string; isDirectory(): boolean }>>;
  stat(target: string): Promise<{ isDirectory(): boolean; isFile(): boolean; size: number }>;
}

/** Default adapter over the real filesystem. */
export const nodeFsAdapter: FsLike = {
  readFile: (file, encoding) => nodeFs.readFile(file, encoding),
  writeFile: (file, data, encoding) => nodeFs.writeFile(file, data, encoding),
  rename: (from, to) => nodeFs.rename(from, to),
  rm: (target, options) => nodeFs.rm(target, options),
  mkdir: async (dir, options) => {
    await nodeFs.mkdir(dir, options);
  },
  async readdir(dir) {
    const entries = await nodeFs.readdir(dir, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, isDirectory: () => entry.isDirectory() }));
  },
  stat: (target) => nodeFs.stat(target),
};

/** Options accepted by {@link createWorkbenchStore}. */
export interface WorkbenchStoreOptions {
  /** DSH home directory (`$DSH_HOME` or `<homedir>/.dsh`). */
  dshHome: string;
  /** Injectable fs; defaults to `node:fs/promises`. */
  fs?: FsLike;
}

/** The workbench data layer surface shared with the RPC layer. */
export interface WorkbenchStore {
  getRootConfig(): Promise<RootConfig>;
  setRoot(payload: unknown): Promise<{ root: string }>;
  list(root: string): Promise<WorkbenchList>;
  read(root: string, id: unknown): Promise<{ scene: WorkbenchScene }>;
  save(root: string, scene: unknown): Promise<{ scene: WorkbenchScene }>;
  delete(root: string, id: unknown): Promise<{ id: string }>;
}

/** Resolve the DSH home the Host should use (`$DSH_HOME`, else `~/.dsh`). */
export function resolveDshHome(env: Record<string, string | undefined>): string {
  const fromEnv = env['DSH_HOME'];
  return fromEnv !== undefined && fromEnv.trim() !== '' ? fromEnv : path.join(os.homedir(), '.dsh');
}

let temporaryCounter = 0;

/** Write a file through a sibling temp file + rename, cleaning the temp on failure. */
async function atomicWrite(fs: FsLike, file: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  temporaryCounter += 1;
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${temporaryCounter}.tmp`,
  );
  try {
    await fs.writeFile(temporary, data, 'utf8');
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

/** Reason text for a filesystem failure, kept short and readable. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True for a missing path (the only fs failure callers treat as "absent"). */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

/** Ensure the workbench root exists and is a folder. */
async function assertRoot(fs: FsLike, root: string): Promise<void> {
  try {
    const stats = await fs.stat(root);
    if (!stats.isDirectory()) throw new Error('不是文件夹');
  } catch (error) {
    throw new WorkbenchStoreError('root-unreachable', `路径不存在或不是文件夹：${root}`);
  }
}

/** Read `index.json`, creating an empty in-memory index when the file is absent. */
async function readIndex(fs: FsLike, root: string): Promise<{ data: IndexData; created: boolean }> {
  let text: string;
  try {
    text = await fs.readFile(path.join(root, INDEX_FILE), 'utf8');
  } catch (error) {
    if (isNotFound(error)) {
      return { data: { version: INDEX_VERSION, workbenches: [] }, created: true };
    }
    throw new WorkbenchStoreError('file-corrupt', `索引文件无法读取：${describe(error)}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new WorkbenchStoreError('file-corrupt', `索引文件不是合法 JSON：${describe(error)}`);
  }
  const workbenches =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)['workbenches'] : undefined;
  const valid =
    Array.isArray(workbenches) &&
    workbenches.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const row = entry as Record<string, unknown>;
      return (
        typeof row['id'] === 'string' &&
        typeof row['order'] === 'number' &&
        Number.isInteger(row['order']) &&
        row['order'] >= 1
      );
    });
  if (!valid) throw new WorkbenchStoreError('file-corrupt', '索引文件结构不正确');
  const data = raw as Record<string, unknown>;
  return { data: data as unknown as IndexData, created: false };
}

/** Persist `index.json` atomically, preserving unknown top-level fields. */
async function writeIndex(fs: FsLike, root: string, data: IndexData): Promise<void> {
  const next: IndexData = {
    ...data,
    version: typeof data.version === 'number' ? data.version : INDEX_VERSION,
    workbenches: data.workbenches,
  };
  try {
    await atomicWrite(fs, path.join(root, INDEX_FILE), `${JSON.stringify(next, null, 2)}\n`);
  } catch (error) {
    throw new WorkbenchStoreError('write-failed', describe(error));
  }
}

/** Find workbench directories: `<id>/<id>.json` with a legal id as the folder name. */
async function scanWorkbenchIds(fs: FsLike, root: string): Promise<string[]> {
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await fs.readdir(root);
  } catch (error) {
    throw new WorkbenchStoreError('root-unreachable', `无法读取根目录：${root}（${describe(error)}）`);
  }
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isWorkbenchId(entry.name)) continue;
    try {
      const stats = await fs.stat(path.join(root, entry.name, `${entry.name}.json`));
      if (stats.isFile()) ids.push(entry.name);
    } catch {
      // A folder without its `<id>.json` is not a workbench; leave it alone.
    }
  }
  return ids.sort();
}

/** Read and validate one workbench JSON; `null` means corrupt (for the list flag). */
async function readSceneOrNull(fs: FsLike, file: string): Promise<WorkbenchScene | null> {
  try {
    return parseWorkbench(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Reject an illegal id before any path is built from it. */
function assertWorkbenchId(value: unknown): string {
  if (!isWorkbenchId(value)) {
    throw new WorkbenchStoreError('id-invalid', typeof value === 'string' ? value : '');
  }
  return value;
}

/** The payload of `setRoot` may be `{ root }`; reject anything else readably. */
function rootFrom(payload: unknown): string {
  const raw = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>)['root'] : payload;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new WorkbenchStoreError('root-unreachable', '请填写文件夹路径');
  }
  return raw.trim();
}

/** Probe writability by creating and removing a temp file inside the root. */
async function assertWritable(fs: FsLike, root: string): Promise<void> {
  temporaryCounter += 1;
  const probe = path.join(root, `.workbench-write-probe-${process.pid}-${temporaryCounter}`);
  try {
    await fs.writeFile(probe, '', 'utf8');
  } catch (error) {
    throw new WorkbenchStoreError('root-unreachable', describe(error));
  } finally {
    await fs.rm(probe, { force: true }).catch(() => undefined);
  }
}

/** Create the workbench data layer bound to one DSH home. */
export function createWorkbenchStore(options: WorkbenchStoreOptions): WorkbenchStore {
  const fs = options.fs ?? nodeFsAdapter;
  const configFile = path.join(options.dshHome, CONFIG_DIR, CONFIG_FILE);

  async function getRootConfig(): Promise<RootConfig> {
    let text: string;
    try {
      text = await fs.readFile(configFile, 'utf8');
    } catch {
      return { root: null };
    }
    try {
      const raw: unknown = JSON.parse(text);
      const root =
        typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)['root'] : undefined;
      return { root: typeof root === 'string' && root.trim() !== '' ? path.resolve(root) : null };
    } catch {
      return { root: null };
    }
  }

  async function setRoot(payload: unknown): Promise<{ root: string }> {
    const root = path.resolve(rootFrom(payload));
    try {
      const stats = await fs.stat(root);
      if (!stats.isDirectory()) throw new Error('不是文件夹');
    } catch (error) {
      throw new WorkbenchStoreError('root-unreachable', `路径不存在或不是文件夹：${root}（${describe(error)}）`);
    }
    await assertWritable(fs, root);
    try {
      await atomicWrite(fs, configFile, `${JSON.stringify({ root }, null, 2)}\n`);
    } catch (error) {
      throw new WorkbenchStoreError('write-failed', describe(error));
    }
    return { root };
  }

  async function list(rootInput: string): Promise<WorkbenchList> {
    const root = path.resolve(rootInput);
    await assertRoot(fs, root);
    const { data: index, created } = await readIndex(fs, root);
    const scanned = await scanWorkbenchIds(fs, root);
    const scannedSet = new Set(scanned);
    const registered = new Set(index.workbenches.map((entry) => entry.id));
    const external = new Set<string>();
    let nextOrder = index.workbenches.reduce((max, entry) => Math.max(max, entry.order), 0);
    let changed = created;

    for (const id of scanned) {
      if (registered.has(id)) continue;
      nextOrder += 1;
      index.workbenches.push({ id, order: nextOrder });
      external.add(id);
      changed = true;
    }
    if (changed) await writeIndex(fs, root, index);

    const ordered = [...index.workbenches].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id),
    );
    const entries: WorkbenchListEntry[] = [];
    for (const entry of ordered) {
      if (!scannedSet.has(entry.id)) {
        entries.push({ id: entry.id, name: entry.id, status: 'missing', order: entry.order });
        continue;
      }
      const scene = await readSceneOrNull(fs, path.join(root, entry.id, `${entry.id}.json`));
      if (scene === null) {
        entries.push({ id: entry.id, name: entry.id, status: 'corrupt', order: entry.order });
        continue;
      }
      entries.push({
        id: entry.id,
        name: scene.name,
        status: external.has(entry.id) ? 'external' : 'ok',
        order: entry.order,
      });
    }
    return { root, entries };
  }

  async function read(rootInput: string, idInput: unknown): Promise<{ scene: WorkbenchScene }> {
    const id = assertWorkbenchId(idInput);
    const root = path.resolve(rootInput);
    await assertRoot(fs, root);
    const file = path.join(root, id, `${id}.json`);
    let text: string;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch (error) {
      if (isNotFound(error)) throw new WorkbenchStoreError('not-found', `工作台 ${id}`);
      throw new WorkbenchStoreError('file-corrupt', `无法读取 ${id}/${id}.json：${describe(error)}`);
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) {
      throw new WorkbenchStoreError('too-large', `${id}/${id}.json`);
    }
    try {
      return { scene: parseWorkbench(text) };
    } catch (error) {
      if (error instanceof WorkbenchStoreError) throw error;
      throw new WorkbenchStoreError('file-corrupt', describe(error));
    }
  }

  async function save(rootInput: string, payload: unknown): Promise<{ scene: WorkbenchScene }> {
    const root = path.resolve(rootInput);
    const rawId =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)['id']
        : undefined;
    const id = assertWorkbenchId(rawId);
    const scene = validateScene(payload);
    const text = serializeWorkbench(scene);
    if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) {
      throw new WorkbenchStoreError('too-large', `${id}/${id}.json`);
    }
    await assertRoot(fs, root);
    try {
      await atomicWrite(fs, path.join(root, id, `${id}.json`), text);
    } catch (error) {
      throw new WorkbenchStoreError('write-failed', describe(error));
    }
    const { data: index } = await readIndex(fs, root);
    if (!index.workbenches.some((entry) => entry.id === id)) {
      const nextOrder = index.workbenches.reduce((max, entry) => Math.max(max, entry.order), 0) + 1;
      index.workbenches.push({ id, order: nextOrder });
      await writeIndex(fs, root, index);
    }
    return { scene };
  }

  async function deleteWorkbench(rootInput: string, idInput: unknown): Promise<{ id: string }> {
    const id = assertWorkbenchId(idInput);
    const root = path.resolve(rootInput);
    await assertRoot(fs, root);
    const dir = path.join(root, id);
    let exists = false;
    try {
      exists = (await fs.stat(dir)).isDirectory();
    } catch {
      exists = false;
    }
    const { data: index } = await readIndex(fs, root);
    const hadEntry = index.workbenches.some((entry) => entry.id === id);
    if (!exists && !hadEntry) throw new WorkbenchStoreError('not-found', `工作台 ${id}`);
    if (exists) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        throw new WorkbenchStoreError('write-failed', describe(error));
      }
    }
    if (hadEntry) {
      index.workbenches = index.workbenches.filter((entry) => entry.id !== id);
      await writeIndex(fs, root, index);
    }
    return { id };
  }

  return { getRootConfig, setRoot, list, read, save, delete: deleteWorkbench };
}
