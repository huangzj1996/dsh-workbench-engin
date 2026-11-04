/**
 * Client half of the workbench root picker.
 *
 * The Host owns the shell's `directoryPicker` seam; the Client only reads the
 * one outcome that matters for the root form:
 *
 * - `picked` → hand the path to the same `setRoot` validation as a typed path;
 * - `cancelled` → do nothing (cancel is not an error);
 * - `fallback` → keep the manual path form and explain why in one sentence.
 *
 * Kept as a pure function over a narrow client slice so the mapping is tested
 * without React or the RPC carrier.
 */
import type { PickRootResult } from '../shared/workbench/protocol';
import { WorkbenchRpcError } from './rpc';

/** Why the shell could not provide a folder chooser. */
export type RootPickFallbackReason = 'picker-unavailable' | 'picker-failed';

/** What the root form should do after asking the shell for a folder. */
export type RootPickOutcome =
  | { kind: 'picked'; path: string }
  | { kind: 'cancelled' }
  | { kind: 'fallback'; reason: RootPickFallbackReason };

/** The one Host call the root picker needs. */
export interface RootPickerClient {
  pickRoot(): Promise<PickRootResult>;
}

/** Ask the shell for one folder and classify the reply for the root form. */
export async function requestRootPick(client: RootPickerClient): Promise<RootPickOutcome> {
  let reply: PickRootResult;
  try {
    reply = await client.pickRoot();
  } catch (error) {
    const unavailable = error instanceof WorkbenchRpcError && error.code === 'picker-unavailable';
    return { kind: 'fallback', reason: unavailable ? 'picker-unavailable' : 'picker-failed' };
  }
  if (reply !== null && typeof reply === 'object' && reply.path === null) return { kind: 'cancelled' };
  const path = reply !== null && typeof reply === 'object' ? reply.path : undefined;
  if (typeof path === 'string' && path.trim() !== '') return { kind: 'picked', path };
  // A malformed reply means the round-trip broke, not that the user cancelled.
  return { kind: 'fallback', reason: 'picker-failed' };
}
