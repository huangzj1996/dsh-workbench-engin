/// <reference types="node" />
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { WorkbenchStoreError } from '../../../shared/workbench/schema';
import { createWorkbenchStore, nodeFsAdapter } from '../store';

/** A fresh private directory under the OS temp dir. */
async function tempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

/** Capture a thrown WorkbenchStoreError so code and message can be asserted. */
async function rejection(promise: Promise<unknown>): Promise<WorkbenchStoreError> {
  try {
    await promise;
  } catch (error) {
    return error as WorkbenchStoreError;
  }
  throw new Error('expected the call to reject');
}

describe('root pointer', () => {
  it('reports no root before one is set', async () => {
    const dshHome = await tempDir('dsh-home');
    const store = createWorkbenchStore({ dshHome });

    await expect(store.getRootConfig()).resolves.toEqual({ root: null });
  });

  it('writes the chosen root to <DSH_HOME>/dsh-hello-word/config.json', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });

    await expect(store.setRoot({ root })).resolves.toEqual({ root });
    await expect(store.getRootConfig()).resolves.toEqual({ root });

    const configText = await readFile(path.join(dshHome, 'dsh-hello-word', 'config.json'), 'utf8');
    expect(JSON.parse(configText)).toEqual({ root });
  });

  it('rejects a root that does not exist with root-unreachable', async () => {
    const dshHome = await tempDir('dsh-home');
    const store = createWorkbenchStore({ dshHome });

    const error = await rejection(store.setRoot({ root: path.join(dshHome, 'missing') }));

    expect(error.code).toBe('root-unreachable');
    expect(error.message).toContain('无法访问工作台根目录');
  });

  it('rejects a root that is a file with root-unreachable', async () => {
    const dshHome = await tempDir('dsh-home');
    const store = createWorkbenchStore({ dshHome });
    const filePath = path.join(dshHome, 'not-a-dir');
    await writeFile(filePath, 'x', 'utf8');

    const error = await rejection(store.setRoot({ root: filePath }));

    expect(error.code).toBe('root-unreachable');
  });
});


/** Write a minimal valid workbench document under `<root>/<id>/<id>.json`. */
async function writeScene(root: string, id: string, name = id): Promise<void> {
  const dir = path.join(root, id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${id}.json`),
    JSON.stringify({ id, name, panels: [{ id: 'p1', title: 'One', type: 'reserved' }] }, null, 2),
    'utf8',
  );
}

/** Write the index file used to reconcile. */
async function writeIndex(root: string, workbenches: Array<{ id: string; order: number }>): Promise<void> {
  await writeFile(path.join(root, 'index.json'), JSON.stringify({ version: 1, workbenches }, null, 2), 'utf8');
}

describe('list: index reconciliation', () => {
  it('creates an empty index on first open', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });

    await expect(store.list(root)).resolves.toEqual({ root, entries: [] });

    const indexText = await readFile(path.join(root, 'index.json'), 'utf8');
    expect(JSON.parse(indexText)).toEqual({ version: 1, workbenches: [] });
  });

  it('auto-registers a workbench directory missing from the index and is idempotent', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeScene(root, 'alpha', 'Alpha');

    const first = await store.list(root);
    expect(first.entries).toEqual([{ id: 'alpha', name: 'Alpha', status: 'external', order: 1 }]);
    const indexAfterFirst = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(indexAfterFirst.workbenches).toEqual([{ id: 'alpha', order: 1 }]);

    const second = await store.list(root);
    expect(second.entries).toEqual([{ id: 'alpha', name: 'Alpha', status: 'ok', order: 1 }]);
    const indexAfterSecond = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(indexAfterSecond.workbenches).toEqual([{ id: 'alpha', order: 1 }]);
  });

  it('marks an indexed workbench whose directory is gone as missing, without dropping it', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeIndex(root, [{ id: 'gone', order: 1 }]);

    const result = await store.list(root);

    expect(result.entries).toEqual([{ id: 'gone', name: 'gone', status: 'missing', order: 1 }]);
    const indexText = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(indexText.workbenches).toEqual([{ id: 'gone', order: 1 }]);
  });

  it('marks bad JSON as corrupt and keeps the directory and its index entry', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await mkdir(path.join(root, 'bad'), { recursive: true });
    await writeFile(path.join(root, 'bad', 'bad.json'), '{ not json', 'utf8');
    await writeIndex(root, [{ id: 'bad', order: 1 }]);

    const result = await store.list(root);

    expect(result.entries).toEqual([{ id: 'bad', name: 'bad', status: 'corrupt', order: 1 }]);
    const indexText = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(indexText.workbenches).toEqual([{ id: 'bad', order: 1 }]);
  });

  it('orders entries by the index and appends newly discovered workbenches at the end', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeScene(root, 'beta', 'Beta');
    await writeScene(root, 'alpha', 'Alpha');
    await writeScene(root, 'gamma', 'Gamma');
    await writeIndex(root, [
      { id: 'beta', order: 2 },
      { id: 'alpha', order: 1 },
    ]);

    const result = await store.list(root);

    expect(result.entries.map((entry) => entry.id)).toEqual(['alpha', 'beta', 'gamma']);
    expect(result.entries.map((entry) => entry.status)).toEqual(['ok', 'ok', 'external']);
    expect(result.entries[2]?.order).toBe(3);
  });

  it('does not list leftover temporary files', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeScene(root, 'alpha', 'Alpha');
    await writeFile(path.join(root, '.index.json.123.1.tmp'), '{', 'utf8');
    await writeFile(path.join(root, 'alpha', '.alpha.json.123.1.tmp'), '{', 'utf8');

    const result = await store.list(root);

    expect(result.entries.map((entry) => entry.id)).toEqual(['alpha']);
  });

  it('rejects a root that does not exist with root-unreachable', async () => {
    const dshHome = await tempDir('dsh-home');
    const store = createWorkbenchStore({ dshHome });

    const error = await rejection(store.list(path.join(dshHome, 'missing')));

    expect(error.code).toBe('root-unreachable');
  });
});

describe('read', () => {
  it('reads a saved workbench back with unknown fields intact', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeScene(root, 'alpha', 'Alpha');

    const result = await store.read(root, 'alpha');

    expect(result.scene.id).toBe('alpha');
    expect(result.scene.name).toBe('Alpha');
    expect(result.scene.panels).toHaveLength(1);
  });

  it('reports a missing workbench as not-found', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });

    const error = await rejection(store.read(root, 'ghost'));

    expect(error.code).toBe('not-found');
  });

  it('reports bad JSON as file-corrupt', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await mkdir(path.join(root, 'bad'), { recursive: true });
    await writeFile(path.join(root, 'bad', 'bad.json'), '{ nope', 'utf8');

    const error = await rejection(store.read(root, 'bad'));

    expect(error.code).toBe('file-corrupt');
  });

  it('rejects an illegal id with id-invalid before touching disk', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });

    const error = await rejection(store.read(root, '../escape'));

    expect(error.code).toBe('id-invalid');
  });
});

describe('save', () => {
  it('writes the workbench atomically, registers it in the index, and leaves no temp file', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    const scene = { id: 'demo', name: 'Demo', panels: [{ id: 'p1', title: 'One', type: 'reserved' }] };

    await expect(store.save(root, scene)).resolves.toEqual({ scene });

    const saved = JSON.parse(await readFile(path.join(root, 'demo', 'demo.json'), 'utf8'));
    expect(saved).toEqual(scene);
    const workbenchDir = await readdir(path.join(root, 'demo'));
    expect(workbenchDir.sort()).toEqual(['demo-context.md', 'demo.json']);
    const indexText = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(indexText.workbenches).toEqual([{ id: 'demo', order: 1 }]);
  });

  it('creates the folder, the JSON, the context card and the index entry on the first save', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    const scene = { id: 'demo', name: 'Demo', description: '给 AI 看的说明', panels: [] };

    await store.save(root, scene);

    const saved = JSON.parse(await readFile(path.join(root, 'demo', 'demo.json'), 'utf8'));
    expect(saved).toEqual(scene);
    const card = await readFile(path.join(root, 'demo', 'demo-context.md'), 'utf8');
    expect(card).toContain('# Demo');
    expect(card).toContain('给 AI 看的说明');
    const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(index.workbenches).toEqual([{ id: 'demo', order: 1 }]);
  });

  it('never overwrites an existing context card when the workbench is saved again', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await store.save(root, { id: 'demo', name: 'Demo', panels: [] });
    const cardFile = path.join(root, 'demo', 'demo-context.md');
    await writeFile(cardFile, '# AI 改过的定位卡\n', 'utf8');

    await store.save(root, { id: 'demo', name: 'Demo 改名', panels: [] });

    expect(await readFile(cardFile, 'utf8')).toBe('# AI 改过的定位卡\n');
    const saved = JSON.parse(await readFile(path.join(root, 'demo', 'demo.json'), 'utf8'));
    expect(saved.name).toBe('Demo 改名');
  });

  it('rejects a scene larger than 256KB with too-large and writes nothing', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    const scene = {
      id: 'huge',
      name: 'Huge',
      panels: [{ id: 'p1', title: 'One', type: 'reserved', blob: 'x'.repeat(300 * 1024) }],
    };

    const error = await rejection(store.save(root, scene));

    expect(error.code).toBe('too-large');
    await expect(readFile(path.join(root, 'huge', 'huge.json'), 'utf8')).rejects.toThrow();
  });

  it('rejects a scene without a legal id with id-invalid', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });

    const error = await rejection(store.save(root, { id: 'Bad Id', name: 'Bad', panels: [] }));

    expect(error.code).toBe('id-invalid');
  });

  it('rejects a structurally invalid scene with scene-invalid', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });

    const error = await rejection(store.save(root, { id: 'demo', name: '', panels: [] }));

    expect(error.code).toBe('scene-invalid');
  });

  it('maps a filesystem write failure to write-failed and cleans the temp file', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const failingFs = {
      ...nodeFsAdapter,
      rename: async () => {
        throw new Error('disk full');
      },
    };
    const store = createWorkbenchStore({ dshHome, fs: failingFs });

    const error = await rejection(store.save(root, { id: 'demo', name: 'Demo', panels: [] }));

    expect(error.code).toBe('write-failed');
    expect(error.message).toContain('写入失败');
    const leftovers = await readdir(path.join(root, 'demo'));
    expect(leftovers).toEqual([]);
  });
});

describe('delete', () => {
  it('removes the directory and the index entry', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await store.save(root, { id: 'demo', name: 'Demo', panels: [] });

    await expect(store.delete(root, 'demo')).resolves.toEqual({ id: 'demo' });

    const indexText = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(indexText.workbenches).toEqual([]);
    await expect(readFile(path.join(root, 'demo', 'demo.json'), 'utf8')).rejects.toThrow();
  });

  it('reports an unknown workbench as not-found', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeIndex(root, []);

    const error = await rejection(store.delete(root, 'ghost'));

    expect(error.code).toBe('not-found');
  });

  it('rejects an illegal id with id-invalid', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });

    const error = await rejection(store.delete(root, '../escape'));

    expect(error.code).toBe('id-invalid');
  });
});

