/// <reference types="node" />
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createWorkbenchRpc } from '../rpc';

/** A fresh private directory under the OS temp dir. */
async function tempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

describe('workbench RPC', () => {
  it('reports root-unset while no root has been chosen', async () => {
    const rpc = createWorkbenchRpc({ dshHome: await tempDir('dsh-home') });

    const result = await rpc.dispatch({ method: 'list' });

    expect(result).toMatchObject({ ok: false, error: { code: 'root-unset' } });
    if (!result.ok) expect(result.error.message).toContain('尚未设置工作台根目录');
  });

  it('round-trips all six methods end-to-end against a temporary root', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const rpc = createWorkbenchRpc({ dshHome });
    const scene = { id: 'demo', name: 'Demo', panels: [{ id: 'p1', title: 'One', type: 'reserved' }] };

    await expect(rpc.dispatch({ method: 'getRootConfig' })).resolves.toEqual({
      ok: true,
      value: { root: null },
    });
    await expect(rpc.dispatch({ method: 'setRoot', payload: { root } })).resolves.toEqual({
      ok: true,
      value: { root },
    });
    await expect(rpc.dispatch({ method: 'getRootConfig' })).resolves.toEqual({
      ok: true,
      value: { root },
    });
    await expect(rpc.dispatch({ method: 'list' })).resolves.toEqual({
      ok: true,
      value: { root, entries: [] },
    });
    await expect(rpc.dispatch({ method: 'save', payload: { scene } })).resolves.toEqual({
      ok: true,
      value: { scene },
    });
    await expect(rpc.dispatch({ method: 'list' })).resolves.toEqual({
      ok: true,
      value: {
        root,
        entries: [{ id: 'demo', name: 'Demo', status: 'ok', order: 1 }],
      },
    });
    await expect(rpc.dispatch({ method: 'read', payload: { id: 'demo' } })).resolves.toEqual({
      ok: true,
      value: { scene },
    });
    await expect(rpc.dispatch({ method: 'delete', payload: { id: 'demo' } })).resolves.toEqual({
      ok: true,
      value: { id: 'demo' },
    });
    await expect(rpc.dispatch({ method: 'list' })).resolves.toEqual({
      ok: true,
      value: { root, entries: [] },
    });
  });

  it('creates a workbench from a default scene and lands all three artifacts on disk', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const rpc = createWorkbenchRpc({ dshHome });
    await rpc.dispatch({ method: 'setRoot', payload: { root } });
    const scene = {
      id: 'demo',
      name: 'Demo',
      cols: 4,
      panels: [{ id: 'panel-1', title: '占位面板', type: 'reserved', text: '' }],
    };

    await expect(rpc.dispatch({ method: 'save', payload: { scene } })).resolves.toEqual({
      ok: true,
      value: { scene },
    });
    await expect(rpc.dispatch({ method: 'list' })).resolves.toEqual({
      ok: true,
      value: { root, entries: [{ id: 'demo', name: 'Demo', status: 'ok', order: 1 }] },
    });
    await expect(rpc.dispatch({ method: 'read', payload: { id: 'demo' } })).resolves.toEqual({
      ok: true,
      value: { scene },
    });
    await expect(readFile(path.join(root, 'demo', 'demo.json'), 'utf8')).resolves.toContain('"name": "Demo"');
    await expect(readFile(path.join(root, 'demo', 'demo-context.md'), 'utf8')).resolves.toContain('# Demo');
  });

  it('returns root-unreachable for a root folder that is gone', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const rpc = createWorkbenchRpc({ dshHome });
    await rpc.dispatch({ method: 'setRoot', payload: { root } });
    await rm(root, { recursive: true, force: true });

    const result = await rpc.dispatch({ method: 'list' });

    expect(result).toMatchObject({ ok: false, error: { code: 'root-unreachable' } });
  });

  it('returns stable codes for bad payloads', async () => {
    const dshHome = await tempDir('dsh-home');
    const root = await tempDir('workbenches');
    const rpc = createWorkbenchRpc({ dshHome });
    await rpc.dispatch({ method: 'setRoot', payload: { root } });

    await expect(rpc.dispatch({ method: 'read', payload: { id: '../escape' } })).resolves.toMatchObject({
      ok: false,
      error: { code: 'id-invalid' },
    });
    await expect(rpc.dispatch({ method: 'read', payload: { id: 'ghost' } })).resolves.toMatchObject({
      ok: false,
      error: { code: 'not-found' },
    });
    await expect(
      rpc.dispatch({
        method: 'save',
        payload: {
          scene: {
            id: 'huge',
            name: 'Huge',
            panels: [{ id: 'p1', title: 'One', type: 'reserved', blob: 'x'.repeat(300 * 1024) }],
          },
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'too-large' } });
    await expect(rpc.dispatch({ method: 'nope' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'internal' },
    });
  });

  it('serves the POST carrier route shape used by the Host registration', async () => {
    const dshHome = await tempDir('dsh-home');
    const rpc = createWorkbenchRpc({ dshHome });
    const request = new Request('http://localhost/api/workbench', {
      method: 'POST',
      body: JSON.stringify({ method: 'getRootConfig', payload: {} }),
    });

    const response = await rpc.route(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, value: { root: null } });
    const methodNotAllowed = await rpc.route(
      new Request('http://localhost/api/workbench', { method: 'GET' }),
    );
    expect(methodNotAllowed.status).toBe(405);
  });
});
