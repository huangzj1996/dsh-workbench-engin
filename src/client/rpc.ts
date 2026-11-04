/**
 * Client half of the workbench RPC.
 *
 * Calls the Host route through the shell's `/api` carrier, exactly like the
 * installed deck plugin: `connection.rpc.call('/api', 'workbench', { method,
 * payload })`. Failures are rethrown as `WorkbenchRpcError` with the Host's
 * stable `code` and its readable Chinese `message`.
 */
import type {
  PickRootResult,
  RootConfig,
  WorkbenchList,
  WorkbenchRpcMethod,
  WorkbenchRpcResult,
} from '../shared/workbench/protocol';
import type { WorkbenchScene } from '../shared/workbench/schema';

/** `/api` carrier channel; the real endpoint name travels in the body. */
const CARRIER_CHANNEL = '/api';
const CARRIER_ENDPOINT = 'workbench';

/** Upper bound for waiting on the shell's connection service. */
const CONNECTION_WAIT_MS = 5000;

/** A failed workbench RPC; `code` is the Host contract code. */
export class WorkbenchRpcError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'WorkbenchRpcError';
    this.code = code;
  }
}

/** The part of `ctx.get('connection')` this client uses. */
interface ConnectionService {
  rpc?: {
    call(
      channel: string,
      endpoint: string,
      message: { method: string; payload: unknown },
    ): Promise<unknown>;
  };
}

/** The Client context slice needed to reach the Host. */
export interface ClientRpcContext {
  get(service: string): unknown;
  inject?(services: string[], callback: () => void): void;
}

/** The seven workbench calls, typed for the panel UI. */
export interface WorkbenchClient {
  getRootConfig(): Promise<RootConfig>;
  setRoot(root: string): Promise<{ root: string }>;
  pickRoot(): Promise<PickRootResult>;
  list(): Promise<WorkbenchList>;
  read(id: string): Promise<{ scene: WorkbenchScene }>;
  save(scene: WorkbenchScene): Promise<{ scene: WorkbenchScene }>;
  delete(id: string): Promise<{ id: string }>;
}

/** Wait for the connection service only when it is not ready yet. */
async function resolveConnection(ctx: ClientRpcContext): Promise<ConnectionService | undefined> {
  const existing = ctx.get('connection') as ConnectionService | undefined;
  if (existing !== undefined && existing.rpc !== undefined) return existing;
  if (typeof ctx.inject !== 'function') return existing;

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      ctx.inject?.(['connection'], done);
    } catch {
      done();
    }
    setTimeout(done, CONNECTION_WAIT_MS);
  });
  return ctx.get('connection') as ConnectionService | undefined;
}

/** Build the workbench client over one Client context. */
export function createWorkbenchClient(ctx: ClientRpcContext): WorkbenchClient {
  async function call<T>(method: WorkbenchRpcMethod, payload: unknown): Promise<T> {
    const connection = await resolveConnection(ctx);
    const rpc = connection?.rpc;
    if (rpc === undefined || typeof rpc.call !== 'function') {
      throw new WorkbenchRpcError('internal', '连接服务不可用，请稍后重试');
    }

    let reply: unknown;
    try {
      reply = await rpc.call(CARRIER_CHANNEL, CARRIER_ENDPOINT, { method, payload });
    } catch (error) {
      throw new WorkbenchRpcError(
        'internal',
        error instanceof Error ? error.message : String(error),
      );
    }

    const envelope = reply as WorkbenchRpcResult | null;
    if (typeof envelope === 'object' && envelope !== null && 'ok' in envelope) {
      if (envelope.ok) return envelope.value as T;
      throw new WorkbenchRpcError(envelope.error.code, envelope.error.message);
    }
    throw new WorkbenchRpcError('internal', `RPC 返回格式不正确：${method}`);
  }

  return {
    getRootConfig: () => call<RootConfig>('getRootConfig', {}),
    setRoot: (root) => call<{ root: string }>('setRoot', { root }),
    pickRoot: () => call<PickRootResult>('pickRoot', {}),
    list: () => call<WorkbenchList>('list', {}),
    read: (id) => call<{ scene: WorkbenchScene }>('read', { id }),
    save: (scene) => call<{ scene: WorkbenchScene }>('save', { scene }),
    delete: (id) => call<{ id: string }>('delete', { id }),
  };
}
