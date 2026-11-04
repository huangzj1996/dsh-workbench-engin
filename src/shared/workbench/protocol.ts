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

/**
 * One RPC reply: a value on success, a stable code + Chinese message on failure.
 * `details` is part of the shell's envelope contract — it must always be a
 * record, so every Host failure carries at least `{}`.
 */
export type WorkbenchRpcResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      error: { code: WorkbenchErrorCode; message: string; details: Record<string, unknown> };
    };

/** Correlation-id shape the shell's generic RPC caller accepts. */
const RPC_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** The one shell RPC endpoint this route serves (`/api/<endpoint>`). */
export const WORKBENCH_RPC_ENDPOINT = 'workbench';

/**
 * Read the correlation id off an envelope-like body, or `null` when the body
 * cannot carry one. A readable id lets the Host answer with a real envelope
 * instead of a bare 400 the Client can only report as a transport failure.
 */
export function readWorkbenchRpcId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const rpcId = (body as Record<string, unknown>)['rpcId'];
  return typeof rpcId === 'string' && RPC_ID_PATTERN.test(rpcId) ? rpcId : null;
}

/** The envelope the shell's `connection.rpc.call` posts to our route. */
export interface WorkbenchClientRequest {
  type: 'client-request';
  rpcId: string;
  /** The shell-level endpoint name (`workbench`), not the workbench method. */
  method: string;
  /** The workbench call itself, carried inside the envelope's payload. */
  payload: unknown;
}

/** One workbench call carried inside the shell envelope's `payload`. */
export interface WorkbenchCall {
  method: string;
  payload: unknown;
}

/** The envelope the shell validates before handing the inner `result` back. */
export interface WorkbenchServerResponse {
  type: 'server-response';
  rpcId: string;
  result: WorkbenchRpcResult;
}

/**
 * Validate the workbench call the Client put in the envelope's `payload`.
 * Returns `null` for anything malformed so the Host can answer 400.
 */
export function parseWorkbenchCall(payload: unknown): WorkbenchCall | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (typeof record['method'] !== 'string' || record['method'] === '') return null;
  return { method: record['method'], payload: record['payload'] };
}

/**
 * Validate one request body against the shell's client-request envelope.
 * Returns `null` for anything malformed so the Host can answer 400 without
 * inventing an rpcId the Client would then reject as a mismatch.
 */
export function parseWorkbenchClientRequest(body: unknown): WorkbenchClientRequest | null {
  const rpcId = readWorkbenchRpcId(body);
  if (rpcId === null) return null;
  const record = body as Record<string, unknown>;
  if (record['type'] !== 'client-request') return null;
  const method = record['method'];
  if (typeof method !== 'string' || method === '') return null;
  return { type: 'client-request', rpcId, method, payload: record['payload'] };
}

/** Wrap one dispatch result in the envelope the shell's Client unwraps. */
export function workbenchServerResponse(
  rpcId: string,
  result: WorkbenchRpcResult,
): WorkbenchServerResponse {
  return { type: 'server-response', rpcId, result };
}

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
