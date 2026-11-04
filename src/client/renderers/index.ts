/**
 * The panel renderer table: `type` → React component.
 *
 * Keyed by the registry's `PanelType`, so every type the config drawer offers
 * needs a body renderer here (the `Record` makes a missing entry a type error).
 * The grid still falls back to gray "unknown type" text for an AI-written type
 * the bundle does not know, so a future type never breaks the page.
 */
import * as React from 'react';

import { HarnessPanel } from './harness';
import { ReservedPanel } from './reserved';
import type { PanelRendererProps } from './types';
import type { PanelType } from '../panel-types';

/** One renderer per registered panel type, exhaustive by construction. */
const RENDERERS: Record<PanelType, React.ComponentType<PanelRendererProps>> = {
  reserved: ReservedPanel,
  harness: HarnessPanel,
};

/** Every renderer this bundle ships, keyed by the panel `type` it draws. */
export const PANEL_RENDERERS: Readonly<Record<string, React.ComponentType<PanelRendererProps>>> =
  RENDERERS;

/** The renderer for a panel `type`, or undefined when none is registered. */
export function panelRenderer(
  type: string,
): React.ComponentType<PanelRendererProps> | undefined {
  return Object.hasOwn(PANEL_RENDERERS, type) ? PANEL_RENDERERS[type] : undefined;
}
