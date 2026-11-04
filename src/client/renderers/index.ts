/**
 * The panel renderer table: `type` → React component.
 *
 * v1 registers only `reserved`; the grid falls back to gray "unknown type" text
 * for anything else, so an AI-written future type never breaks the page.
 */
import * as React from 'react';

import { ReservedPanel } from './reserved';
import type { PanelRendererProps } from './types';

/** Every renderer this bundle ships, keyed by the panel `type` it draws. */
export const PANEL_RENDERERS: Readonly<Record<string, React.ComponentType<PanelRendererProps>>> = {
  reserved: ReservedPanel,
};

/** The renderer for a panel `type`, or undefined when none is registered. */
export function panelRenderer(
  type: string,
): React.ComponentType<PanelRendererProps> | undefined {
  return Object.hasOwn(PANEL_RENDERERS, type) ? PANEL_RENDERERS[type] : undefined;
}
