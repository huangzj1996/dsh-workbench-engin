/**
 * The workbench Host RPC: one `{ method, payload }` endpoint that maps onto the
 * data layer and turns every failure into a structured `{ code, message }`.
 *
 * HTTP-agnostic below `route`: tests call `dispatch` directly, while the Host
 * entry registers `route` on `connection.fetch`.
 */
import { WorkbenchStoreError } from '../../shared/workbench/schema';
import type { WorkbenchRpcMethod, WorkbenchRpcResult } from '../../shared/workbench/protocol';
import { pickRootDirectory, type DirectoryPickerLookup } from './picker';
import { createWorkbenchStore, type WorkbenchStoreOptions } from './store';

/** The exact Fetch route the Host half registers on the `/api` carrier. */
export const WORKBENCH_RPC_PATH = '/api/workbench';

/** The RPC surface handed to the Host entry (and to tests). */
export interface WorkbenchRpc {
  dispatch(request: unknown): Promise<WorkbenchRpcResult>;
  route(request: Request): Promise<Response>;
}

/** Store options plus the lazy directory-picker lookup the Host composes in. */
export interface WorkbenchRpcOptions extends WorkbenchStoreOptions {
  /**
   * The shell's `directoryPicker` service, resolved per pick because it may be
   * mounted after this plugin activates; absent means "no chooser here".
   */
  getDirectoryPicker?: DirectoryPickerLookup;
}

/** Read one field from a payload object without trusting its shape. */
function field(payload: unknown, key: string): unknown {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)[key]
    : undefined;
}

/** Map any thrown error to the RPC envelope, keeping store codes stable. */
function failure(error: unknown): WorkbenchRpcResult {
  if (error instanceof WorkbenchStoreError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  return {
    ok: false,
    error: { code: 'internal', message: error instanceof Error ? error.message : String(error) },
  };
}

/** Create the RPC dispatcher bound to one DSH home. */
export function createWorkbenchRpc(options: WorkbenchRpcOptions): WorkbenchRpc {
  const store = createWorkbenchStore(options);
  const getDirectoryPicker = options.getDirectoryPicker ?? (() => undefined);

  /** The configured root, or `root-unset` when the pointer has not been written. */
  async function resolveRoot(): Promise<string> {
    const config = await store.getRootConfig();
    if (config.root === null) throw new WorkbenchStoreError('root-unset');
    return config.root;
  }

  async function dispatch(request: unknown): Promise<WorkbenchRpcResult> {
    if (
      typeof request !== 'object' ||
      request === null ||
      typeof (request as Record<string, unknown>)['method'] !== 'string'
    ) {
      return failure(new WorkbenchStoreError('internal', 'RPC 请求缺少 method'));
    }
    const call = request as { method: WorkbenchRpcMethod | string; payload?: unknown };
    try {
      switch (call.method) {
        case 'getRootConfig':
          return { ok: true, value: await store.getRootConfig() };
        case 'setRoot':
          return { ok: true, value: await store.setRoot(call.payload) };
        case 'pickRoot':
          return { ok: true, value: await pickRootDirectory(getDirectoryPicker) };
        case 'list':
          return { ok: true, value: await store.list(await resolveRoot()) };
        case 'read':
          return { ok: true, value: await store.read(await resolveRoot(), field(call.payload, 'id')) };
        case 'save':
          return { ok: true, value: await store.save(await resolveRoot(), field(call.payload, 'scene')) };
        case 'delete':
          return { ok: true, value: await store.delete(await resolveRoot(), field(call.payload, 'id')) };
        default:
          return failure(new WorkbenchStoreError('internal', `未知的 RPC 方法：${call.method}`));
      }
    } catch (error) {
      return failure(error);
    }
  }

  async function route(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(failure(new WorkbenchStoreError('internal', '请求体不是合法的 JSON')), {
        status: 400,
      });
    }
    return Response.json(await dispatch(body));
  }

  return { dispatch, route };
}
