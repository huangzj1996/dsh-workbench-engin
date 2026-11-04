/**
 * Translate helper bound to this plugin's locale namespace.
 *
 * The panel receives `t` from the slot and wraps it so a missing key falls back
 * to the Chinese default written at the call site.
 */
export type Translate = (key: string, fallback: string) => string;
