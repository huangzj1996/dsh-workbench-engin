import { describe, expect, it } from 'vitest';

import { planRootPick, type DirectoryPickerCapability } from '../picker';

/** Build a capability object the way the shell's seam would expose it. */
function capability(value: unknown): DirectoryPickerCapability {
  return value as DirectoryPickerCapability;
}

describe('root pick plan', () => {
  it('plans the OS chooser when the native capability can pick', () => {
    const native: DirectoryPickerCapability = {
      kind: 'native',
      pick: async () => null,
    };

    expect(planRootPick(native)).toEqual({ kind: 'native' });
  });

  it('treats a browse-only capability as unavailable (manual path form)', () => {
    const browse = capability({
      kind: 'browse',
      list: async () => ({ entries: [] }),
      createDirectory: async () => '/tmp/new',
    });

    expect(planRootPick(browse)).toEqual({ kind: 'unavailable' });
  });

  it('treats a shell without the service as unavailable', () => {
    expect(planRootPick(undefined)).toEqual({ kind: 'unavailable' });
  });

  it('treats a malformed native capability as unavailable', () => {
    expect(planRootPick(capability({ kind: 'native' }))).toEqual({ kind: 'unavailable' });
    expect(planRootPick(capability({ kind: 'something-else', pick: async () => null }))).toEqual({
      kind: 'unavailable',
    });
  });
});
