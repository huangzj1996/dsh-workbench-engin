/**
 * Host half of the Workbench bundle.
 *
 * The panel UI lives in the Client half; everything that touches disk lives
 * here. The Host registers one exact Fetch route on the shell's `connection`
 * carrier — the same `connection.fetch.register` / `/api` pattern the installed
 * deck plugin uses — and delegates every call to the workbench RPC dispatcher.
 */
import { createWorkbenchRpc, WORKBENCH_RPC_PATH } from './workbench/rpc';
import type { DirectoryPickerService } from './workbench/picker';
import { resolveDshHome } from './workbench/store';

/** The slice of the Host `connection` service this plugin registers on. */
interface FetchRegistry {
  register(options: {
    path: string;
    methods: string[];
    requestBody: 'buffered';
    fetch: (request: Request) => Promise<Response>;
  }): () => void;
}

/** The part of the Host context (cordis plugin ctx) this plugin uses. */
export interface HostContext {
  get(service: 'connection'): { fetch?: FetchRegistry } | undefined;
  get(service: 'directoryPicker'): DirectoryPickerService | undefined;
  inject?(services: string[], callback: () => void): void;
  effect?(setup: () => (() => void) | void, label?: string): void;
}

/** Host services this plugin needs before it can register its route. */
export const inject = ['connection'];

/**
 * Resolve the shell's folder chooser at call time (not activation time): the
 * picker may be mounted later, and a composition without one must still boot.
 */
function lookupDirectoryPicker(ctx: HostContext): DirectoryPickerService | undefined {
  try {
    return ctx.get('directoryPicker');
  } catch {
    return undefined;
  }
}

/** Register the workbench RPC route once the connection service is ready. */
export function apply(ctx: HostContext): void {
  let registered = false;

  const register = (): void => {
    if (registered) return;
    const registry = ctx.get('connection')?.fetch;
    if (registry === undefined || typeof registry.register !== 'function') return;

    const rpc = createWorkbenchRpc({
      dshHome: resolveDshHome(process.env),
      getDirectoryPicker: () => lookupDirectoryPicker(ctx),
    });
    try {
      const dispose = registry.register({
        path: WORKBENCH_RPC_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: (request) => rpc.route(request),
      });
      registered = true;
      if (typeof dispose === 'function' && typeof ctx.effect === 'function') {
        ctx.effect(() => dispose, 'dsh-hello-word: workbench RPC route');
      }
    } catch {
      // A duplicate registration means another activation already owns the
      // route; keep the rest of the plugin alive rather than failing activation.
    }
  };

  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['connection'], register);
      return;
    } catch {
      // Fall through to a direct registration attempt below.
    }
  }
  register();
}
