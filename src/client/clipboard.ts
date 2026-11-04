/**
 * Clipboard helpers for the read-only workbench id.
 *
 * The id is meant to be handed to an AI, so copy is the main way it leaves the
 * panel. `navigator.clipboard` can be missing or denied (insecure context); the
 * UI then just leaves the id selectable instead of throwing.
 */
import * as React from 'react';

/** Copy `text`; resolves to whether the browser accepted it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard === undefined || typeof clipboard.writeText !== 'function') return false;
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Transient "copied" flag plus the copy action, for a copy button. */
export function useCopyToClipboard(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  const copy = React.useCallback((text: string): void => {
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setCopied(false);
      }, 1500);
    });
  }, []);

  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return { copied, copy };
}
