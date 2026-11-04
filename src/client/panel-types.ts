/**
 * The panel-type registry: the one place that knows each panel type's default
 * fields, its locale keys and whether it binds to a shell session.
 *
 * The config drawer, the editor's "add panel" action, the draft helpers and the
 * renderer table all read from here, so a new type is one entry plus its
 * renderer component. This module stays free of React and of the DOM so the
 * metadata is unit-testable on the Node seam.
 */
import type { Translate } from './translate';

/** Every panel type this bundle offers. */
export const PANEL_TYPES = ['reserved', 'harness'] as const;

/** One of the panel types this bundle offers. */
export type PanelType = (typeof PANEL_TYPES)[number];

/** Metadata for one panel type. */
export interface PanelTypeDefinition {
  readonly type: PanelType;
  /** Locale key for the human type name shown in the drawer. */
  readonly labelKey: string;
  /** Fallback for {@link labelKey} when the locale has no entry. */
  readonly labelFallback: string;
  /** Locale key for the default title of a newly created panel. */
  readonly titleKey: string;
  /** Fallback for {@link titleKey}. */
  readonly titleFallback: string;
  /** Fields written when a panel is created or switched to this type. */
  defaultFields(): Record<string, unknown>;
  /** True when the panel binds to a shell session (drawer shows the picker). */
  readonly bindsSession: boolean;
}

/** One entry per offered type; `Record` keeps the table exhaustive. */
export const PANEL_TYPE_DEFINITIONS: Readonly<Record<PanelType, PanelTypeDefinition>> = {
  reserved: {
    type: 'reserved',
    labelKey: 'panel.type.reserved',
    labelFallback: '占位',
    titleKey: 'panel.new.reserved',
    titleFallback: '占位面板',
    defaultFields: () => ({ text: '' }),
    bindsSession: false,
  },
  harness: {
    type: 'harness',
    labelKey: 'panel.type.harness',
    labelFallback: '会话门牌',
    titleKey: 'panel.new.harness',
    titleFallback: '会话门牌',
    defaultFields: () => ({ sessionTitle: '', sessionId: '', pinTarget: [] }),
    bindsSession: true,
  },
};

/** The definition for one type, or undefined for an unknown/AI-written type. */
export function panelTypeDefinition(type: string): PanelTypeDefinition | undefined {
  return Object.hasOwn(PANEL_TYPE_DEFINITIONS, type)
    ? PANEL_TYPE_DEFINITIONS[type as PanelType]
    : undefined;
}

/** Default type-specific fields for a freshly created panel of `type`. */
export function panelDefaultFields(type: PanelType): Record<string, unknown> {
  return PANEL_TYPE_DEFINITIONS[type].defaultFields();
}

/** Human label for a type; unknown types fall back to their raw name. */
export function panelTypeLabel(tr: Translate, type: string): string {
  const definition = panelTypeDefinition(type);
  return definition === undefined ? type : tr(definition.labelKey, definition.labelFallback);
}

/** Default title for a newly added panel of `type`. */
export function panelTypeTitle(tr: Translate, type: PanelType): string {
  const definition = PANEL_TYPE_DEFINITIONS[type];
  return tr(definition.titleKey, definition.titleFallback);
}
