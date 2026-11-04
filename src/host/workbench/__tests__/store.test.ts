/// <reference types="node" />
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { WorkbenchStoreError } from '../../../shared/workbench/errors';
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
async function writeWorkbench(root: string, id: string, name = id): Promise<void> {
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
    await writeWorkbench(root, 'alpha', 'Alpha');

    const first = await store.list(root);
    expect(first.entries).toEqual([{ id: 'alpha', name: 'Alpha', status: 'adopted', order: 1 }]);
    const indexAfterFirst = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(indexAfterFirst.workbenches).toEqual([{ id: 'alpha', order: 1 }]);

    const second = await store.list(root);
    expect(second.entries).toEqual([{ id: 'alpha', name: 'Alpha', status: 'adopted', order: 1 }]);
    const indexAfterSecond = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(indexAfterSecond.workbenches).toEqual([{ id: 'alpha', order: 1 }]);
  });

  it('keeps flagging a reconciled workbench as adopted until it is opened', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeWorkbench(root, 'alpha', 'Alpha');
    await writeWorkbench(root, 'beta', 'Beta');

    await expect(store.list(root)).resolves.toMatchObject({
      entries: [
        { id: 'alpha', status: 'adopted' },
        { id: 'beta', status: 'adopted' },
      ],
    });

    await store.read(root, 'alpha');

    const afterOpen = await store.list(root);
    expect(afterOpen.entries).toEqual([
      { id: 'alpha', name: 'Alpha', status: 'ok', order: 1 },
      { id: 'beta', name: 'Beta', status: 'adopted', order: 2 },
    ]);
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

  it('marks a workbench whose JSON id does not match its folder as corrupt', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await mkdir(path.join(root, 'alpha'), { recursive: true });
    await writeFile(
      path.join(root, 'alpha', 'alpha.json'),
      JSON.stringify({ id: 'beta', name: 'Beta', panels: [] }),
      'utf8',
    );

    const result = await store.list(root);

    expect(result.entries).toEqual([{ id: 'alpha', name: 'alpha', status: 'corrupt', order: 1 }]);
  });

  it('backfills a missing context card for a workbench that appeared on disk', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeWorkbench(root, 'alpha', 'Alpha');

    await store.list(root);

    const card = await readFile(path.join(root, 'alpha', 'alpha-context.md'), 'utf8');
    expect(card).toContain('# Alpha');
  });

  it('does not overwrite an existing context card while backfilling on list', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeWorkbench(root, 'alpha', 'Alpha');
    const cardFile = path.join(root, 'alpha', 'alpha-context.md');
    await writeFile(cardFile, '# AI 写过的定位卡\n', 'utf8');

    await store.list(root);

    expect(await readFile(cardFile, 'utf8')).toBe('# AI 写过的定位卡\n');
  });

  it('keeps listing when the missing context card cannot be written', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({
      dshHome,
      fs: {
        ...nodeFsAdapter,
        writeFile: async (file: string, data: string, encoding: 'utf8') => {
          if (file.includes('-context.md')) throw new Error('read-only root');
          await nodeFsAdapter.writeFile(file, data, encoding);
        },
      },
    });
    await writeWorkbench(root, 'alpha', 'Alpha');

    const result = await store.list(root);

    expect(result.entries).toEqual([{ id: 'alpha', name: 'Alpha', status: 'adopted', order: 1 }]);
  });

  it('orders entries by the index and appends newly discovered workbenches at the end', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeWorkbench(root, 'beta', 'Beta');
    await writeWorkbench(root, 'alpha', 'Alpha');
    await writeWorkbench(root, 'gamma', 'Gamma');
    await writeIndex(root, [
      { id: 'beta', order: 2 },
      { id: 'alpha', order: 1 },
    ]);

    const result = await store.list(root);

    expect(result.entries.map((entry) => entry.id)).toEqual(['alpha', 'beta', 'gamma']);
    expect(result.entries.map((entry) => entry.status)).toEqual(['ok', 'ok', 'adopted']);
    expect(result.entries[2]?.order).toBe(3);
  });

  it('does not list leftover temporary files', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeWorkbench(root, 'alpha', 'Alpha');
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
    await writeWorkbench(root, 'alpha', 'Alpha');

    const result = await store.read(root, 'alpha');

    expect(result.workbench.id).toBe('alpha');
    expect(result.workbench.name).toBe('Alpha');
    expect(result.workbench.panels).toHaveLength(1);
  });

  it('backfills the context card when reading a workbench that has none', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeWorkbench(root, 'alpha', 'Alpha');

    await store.read(root, 'alpha');

    const card = await readFile(path.join(root, 'alpha', 'alpha-context.md'), 'utf8');
    expect(card).toContain('# Alpha');
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

  it('refuses to read alpha/alpha.json when the JSON claims id beta', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await mkdir(path.join(root, 'alpha'), { recursive: true });
    await writeFile(
      path.join(root, 'alpha', 'alpha.json'),
      JSON.stringify({ id: 'beta', name: 'Beta', panels: [] }),
      'utf8',
    );

    const error = await rejection(store.read(root, 'alpha'));

    expect(error.code).toBe('file-corrupt');
    expect(error.message).toContain('alpha');
    expect(error.message).toContain('beta');
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
    const workbench = { id: 'demo', name: 'Demo', panels: [{ id: 'p1', title: 'One', type: 'reserved' }] };

    await expect(store.save(root, workbench)).resolves.toEqual({ workbench });

    const saved = JSON.parse(await readFile(path.join(root, 'demo', 'demo.json'), 'utf8'));
    expect(saved).toEqual(workbench);
    const workbenchDir = await readdir(path.join(root, 'demo'));
    expect(workbenchDir.sort()).toEqual(['demo-context.md', 'demo.json']);
    const indexText = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(indexText.workbenches).toEqual([{ id: 'demo', order: 1 }]);
  });

  it('creates the folder, the JSON, the context card and the index entry on the first save', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    const workbench = { id: 'demo', name: 'Demo', description: '给 AI 看的说明', panels: [] };

    await store.save(root, workbench);

    const saved = JSON.parse(await readFile(path.join(root, 'demo', 'demo.json'), 'utf8'));
    expect(saved).toEqual(workbench);
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

  it('writes the context card atomically and leaves no partial card when the rename fails', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({
      dshHome,
      fs: {
        ...nodeFsAdapter,
        rename: async (from: string, to: string) => {
          if (to.endsWith('demo-context.md')) throw new Error('disk full');
          await nodeFsAdapter.rename(from, to);
        },
      },
    });

    const error = await rejection(store.save(root, { id: 'demo', name: 'Demo', panels: [] }));

    expect(error.code).toBe('write-failed');
    await expect(readFile(path.join(root, 'demo', 'demo-context.md'), 'utf8')).rejects.toThrow();
    const leftovers = await readdir(path.join(root, 'demo'));
    expect(leftovers.sort()).toEqual(['demo.json']);
  });

  it('rejects a workbench larger than 256KB with too-large and writes nothing', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    const workbench = {
      id: 'huge',
      name: 'Huge',
      panels: [{ id: 'p1', title: 'One', type: 'reserved', blob: 'x'.repeat(300 * 1024) }],
    };

    const error = await rejection(store.save(root, workbench));

    expect(error.code).toBe('too-large');
    await expect(readFile(path.join(root, 'huge', 'huge.json'), 'utf8')).rejects.toThrow();
  });

  it('rejects a workbench without a legal id with id-invalid', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });

    const error = await rejection(store.save(root, { id: 'Bad Id', name: 'Bad', panels: [] }));

    expect(error.code).toBe('id-invalid');
  });

  it('rejects a structurally invalid workbench with workbench-invalid', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });

    const error = await rejection(store.save(root, { id: 'demo', name: '', panels: [] }));

    expect(error.code).toBe('workbench-invalid');
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

  it('drops an indexed workbench whose folder is gone and reports success', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await writeIndex(root, [{ id: 'gone', order: 1 }]);

    await expect(store.delete(root, 'gone')).resolves.toEqual({ id: 'gone' });

    const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(index.workbenches).toEqual([]);
  });

  it('rejects a save racing with the delete of the same workbench and never recreates it', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    let releaseRemove = (): void => undefined;
    let noteRemoveStarted = (): void => undefined;
    const removeGate = new Promise<void>((resolve) => {
      releaseRemove = resolve;
    });
    const removeStarted = new Promise<void>((resolve) => {
      noteRemoveStarted = resolve;
    });
    const gatedFs = {
      ...nodeFsAdapter,
      rm: async (target: string, options: { force?: boolean; recursive?: boolean }) => {
        if (options.recursive === true && target.endsWith('demo')) {
          noteRemoveStarted();
          await removeGate;
        }
        await nodeFsAdapter.rm(target, options);
      },
    };
    const store = createWorkbenchStore({ dshHome, fs: gatedFs });
    await store.save(root, { id: 'demo', name: 'Demo', panels: [] });

    const deleting = store.delete(root, 'demo');
    await removeStarted;
    const error = await rejection(store.save(root, { id: 'demo', name: 'Demo', panels: [] }));
    releaseRemove();
    await expect(deleting).resolves.toEqual({ id: 'demo' });

    expect(error.code).toBe('write-failed');
    await expect(readFile(path.join(root, 'demo', 'demo.json'), 'utf8')).rejects.toThrow();
    const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(index.workbenches).toEqual([]);
  });

  it('clears the delete tombstone once the delete finished', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const store = createWorkbenchStore({ dshHome });
    await store.save(root, { id: 'demo', name: 'Demo', panels: [] });
    await store.delete(root, 'demo');

    await expect(
      store.save(root, { id: 'demo', name: 'Demo again', panels: [] }),
    ).resolves.toEqual({ workbench: { id: 'demo', name: 'Demo again', panels: [] } });
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

