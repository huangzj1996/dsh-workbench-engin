/**
 * Subscribe to the shell's session list from a React component.
 *
 * The shell bridge is an external store (the same native `subscribe` /
 * `getSnapshot` pair), so the badge and the drawer both follow shell title and
 * running-state changes without polling. A missing shell degrades to one stable
 * "unavailable" snapshot; `refresh()` runs once on mount so a session service
 * that appears after this bundle activated is picked up.
 */
import * as React from 'react';

import type { HarnessSessionSnapshot, SessionShell } from './session-shell';

/** The snapshot a plugin sees when the shell exposes no session service. */
const NO_SHELL_SNAPSHOT: HarnessSessionSnapshot = {
  available: false,
  sessions: [],
  currentId: null,
};

/** Stable fallbacks: `useSyncExternalStore` compares them across renders. */
const noShellSnapshot = (): HarnessSessionSnapshot => NO_SHELL_SNAPSHOT;
const noShellSubscribe = (): (() => void) => () => undefined;

/** The current shell session snapshot, following every shell list change. */
export function useSessionSnapshot(shell: SessionShell | undefined): HarnessSessionSnapshot {
  const snapshot = React.useSyncExternalStore(
    shell?.subscribe ?? noShellSubscribe,
    shell?.getSnapshot ?? noShellSnapshot,
    shell?.getSnapshot ?? noShellSnapshot,
  );

  // A late-registering `sessions` service is recovered on the next refresh.
  React.useEffect(() => {
    shell?.refresh();
  }, [shell]);

  return snapshot;
}
