/**
 * Root-directory picking: the Host half of the shell's `ctx.directoryPicker`
 * seam.
 *
 * The shell exposes a discriminated capability rather than one method set: a
 * `native` backend opens one OS folder chooser on the host display, while a
 * `browse` backend only serves listing/creation primitives for an in-app
 * browser. Only the native shape can hand us one folder in one call, so a
 * browse-only composition reports `picker-unavailable` and the Client keeps
 * the manual path form (the documented fallback). Cancelling a native chooser
 * is an outcome (`path: null`), never an error.
 *
 * The service may be mounted after this plugin activates, so the lookup is a
 * caller-supplied thunk evaluated per pick instead of a captured instance.
 */
import { WorkbenchStoreError } from '../../shared/workbench/errors';
import type { PickRootResult } from '../../shared/workbench/protocol';

/** The `native` capability: one OS chooser, absolute path or `null` on cancel. */
export interface NativeDirectoryPickerCapability {
  kind: 'native';
  pick(signal: AbortSignal): Promise<string | null>;
}

/**
 * The capability object the seam returns. The vocabulary is merge-extensible
 * in the shell, so an unrecognized kind is treated as "cannot pick here".
 */
export type DirectoryPickerCapability = NativeDirectoryPickerCapability | { kind: string };

/** The subset of the `ctx.directoryPicker` service this plugin consumes. */
export interface DirectoryPickerService {
  capability(): DirectoryPickerCapability;
}

/** Resolve the picker service lazily; `undefined` means the shell has none. */
export type DirectoryPickerLookup = () => DirectoryPickerService | undefined;

/**
 * How a capability can serve a root pick: the shell's OS chooser, or nothing
 * this flow can use (browse-only compositions and missing services both leave
 * the manual path form in charge).
 */
export type RootPickPlan = { kind: 'native' } | { kind: 'unavailable' };

/** True when the capability can open the OS chooser and hand back one folder. */
function isNative(capability: DirectoryPickerCapability): capability is NativeDirectoryPickerCapability {
  return capability.kind === 'native' && typeof (capability as NativeDirectoryPickerCapability).pick === 'function';
}

/** Decide the pick plan from one capability object (pure; the seam's table). */
export function planRootPick(
  capability: DirectoryPickerCapability | undefined,
): RootPickPlan {
  return capability !== undefined && isNative(capability) ? { kind: 'native' } : { kind: 'unavailable' };
}

/** Readable text for a chooser failure, kept to one line for the Client. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Open the shell's folder chooser once.
 *
 * @returns the chosen absolute path, or `{ path: null }` when the operator
 *          cancelled (not an error).
 * @throws WorkbenchStoreError `picker-unavailable` when the shell has no
 *         native chooser, `picker-failed` when opening it threw or aborted.
 */
export async function pickRootDirectory(lookup: DirectoryPickerLookup): Promise<PickRootResult> {
  let capability: DirectoryPickerCapability | undefined;
  try {
    capability = lookup()?.capability();
  } catch {
    capability = undefined;
  }
  const plan = planRootPick(capability);
  if (plan.kind !== 'native' || capability === undefined) {
    throw new WorkbenchStoreError('picker-unavailable');
  }
  try {
    const picked = await (capability as NativeDirectoryPickerCapability).pick(new AbortController().signal);
    if (picked === null) return { path: null };
    if (typeof picked !== 'string' || picked.trim() === '') {
      throw new Error('选择框没有返回文件夹路径');
    }
    return { path: picked.trim() };
  } catch (error) {
    throw new WorkbenchStoreError('picker-failed', describe(error));
  }
}
