/**
 * The Client ↔ Host protocol for the workbench RPC.
 *
 * Shared by both halves so the request/reply shape, the method names and the
 * error codes cannot drift; nothing here touches the filesystem or the DOM.
 */
import type { WorkbenchScene } from './schema';

/** The six methods the Host route accepts. */
export type WorkbenchRpcMethod =
  | 'getRootConfig'
  | 'setRoot'
  | 'list'
  | 'read'
  | 'save'
  | 'delete';

/** The pointer file content: which folder is the workbench root. */
export interface RootConfig {
  root: string | null;
}

/** One workbench as the list RPC reports it. */
export interface WorkbenchListEntry {
  id: string;
  name: string;
  /** `external` = newly adopted from disk, `missing`/`corrupt` = flagged, never deleted. */
  status: 'ok' | 'external' | 'missing' | 'corrupt';
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
  | { ok: false; error: { code: string; message: string } };

/** Method-specific value shapes, for the Client helper's return types. */
export interface WorkbenchRpcValues {
  getRootConfig: RootConfig;
  setRoot: { root: string };
  list: WorkbenchList;
  read: { scene: WorkbenchScene };
  save: { scene: WorkbenchScene };
  delete: { id: string };
}
