import { describe, expect, it } from 'vitest';

import { requestRootPick, type RootPickerClient } from '../root-picker';
import { WorkbenchRpcError } from '../rpc';

/** A client whose only relevant call is the root picker. */
function client(pickRoot: () => Promise<{ path: string | null }>): RootPickerClient {
  return { pickRoot };
}

describe('requesting a root pick', () => {
  it('reports the absolute path the chooser picked', async () => {
    await expect(requestRootPick(client(async () => ({ path: 'D:\\work\\my-workbenches' })))).resolves.toEqual({
      kind: 'picked',
      path: 'D:\\work\\my-workbenches',
    });
  });

  it('reports a cancel without an error and without a path', async () => {
    await expect(requestRootPick(client(async () => ({ path: null })))).resolves.toEqual({
      kind: 'cancelled',
    });
  });

  it('falls back with picker-unavailable when the shell has no chooser', async () => {
    await expect(
      requestRootPick(
        client(async () => {
          throw new WorkbenchRpcError('picker-unavailable', '系统文件夹选择框不可用');
        }),
      ),
    ).resolves.toEqual({ kind: 'fallback', reason: 'picker-unavailable' });
  });

  it('falls back with picker-failed for a failed chooser and for unroutable replies', async () => {
    await expect(
      requestRootPick(
        client(async () => {
          throw new WorkbenchRpcError('picker-failed', '系统文件夹选择框调用失败');
        }),
      ),
    ).resolves.toEqual({ kind: 'fallback', reason: 'picker-failed' });
    await expect(
      requestRootPick(
        client(async () => {
          throw new Error('connection lost');
        }),
      ),
    ).resolves.toEqual({ kind: 'fallback', reason: 'picker-failed' });
    await expect(requestRootPick(client(async () => ({}) as { path: null }))).resolves.toEqual({
      kind: 'fallback',
      reason: 'picker-failed',
    });
  });
});
