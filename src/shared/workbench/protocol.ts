/**
 * The Client ↔ Host protocol for the workbench RPC.
 *
 * Shared by both halves so the request/reply shape, the method names and the
 * error codes cannot drift; nothing here touches the filesystem or the DOM.
 */
import type { WorkbenchErrorCode } from './errors';
import type { Workbench } from './schema';

/** The seven methods the Host route accepts. */
export type WorkbenchRpcMethod =
  | 'getRootConfig'
  | 'setRoot'
  | 'pickRoot'
  | 'list'
  | 'read'
  | 'save'
  | 'delete';

/** The pointer file content: which folder is the workbench root. */
export interface RootConfig {
  root: string | null;
}

/**
 * The `pickRoot` reply: the absolute folder the shell's chooser returned, or
 * `null` when the operator cancelled — a cancel is an outcome, not an error.
 */
export interface PickRootResult {
  path: string | null;
}

/** One workbench as the list RPC reports it. */
export interface WorkbenchListEntry {
  id: string;
  name: string;
  /**
   * `ok` = registered and readable, `adopted` = found on disk by reconciliation
   * and not opened yet (the flag survives refreshes until `read` succeeds),
   * `missing`/`corrupt` = flagged in the index, never deleted automatically.
   */
  status: 'ok' | 'adopted' | 'missing' | 'corrupt';
  order: number;
}

/** The list reply: the resolved root plus its workbenches in index order. */
export interface WorkbenchList {
  root: string;
  entries: WorkbenchListEntry[];
}

/** One RPC reply: a value on success, a stable code + Chinese message on failure. */
export type WorkbenchRpcResult =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: WorkbenchErrorCode; message: string } };

/** Method-specific value shapes, for the Client helper's return types. */
export interface WorkbenchRpcValues {
  getRootConfig: RootConfig;
  setRoot: { root: string };
  pickRoot: PickRootResult;
  list: WorkbenchList;
  read: { workbench: Workbench };
  save: { workbench: Workbench };
  delete: { id: string };
}
