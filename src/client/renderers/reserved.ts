/**
 * The `reserved` renderer: a placeholder for a panel whose content is not wired
 * up yet. It shows the panel's own `text` when the JSON carries one, otherwise
 * the default placeholder line.
 */
import * as React from 'react';

import type { PanelRendererProps } from './types';

/** Trimmed string field of a panel, if it carries one. */
function textField(panel: PanelRendererProps['panel'], key: string): string | null {
  const value = panel[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Placeholder body plus the panel's type-specific `text`. */
export function ReservedPanel(props: PanelRendererProps): React.ReactElement {
  const { panel, tr } = props;
  const text = textField(panel, 'text') ?? tr('panel.reserved.placeholder', '占位面板，内容待补充');
  return React.createElement(
    'div',
    { className: 'dshwb-reserved' },
    React.createElement('p', { className: 'dshwb-reserved-text' }, text),
    React.createElement('p', { className: 'dshwb-reserved-type' }, `type: ${panel.type}`),
  );
}
