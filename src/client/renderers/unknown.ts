/**
 * Fallback body for a panel whose `type` no bundled renderer knows: gray text,
 * never a throw. The point is to leave the rest of the grid readable so the
 * bad type can be found and fixed.
 */
import * as React from 'react';

import type { PanelRendererProps } from './types';

/** Gray "未知面板类型: xxx" body. */
export function UnknownPanel(props: PanelRendererProps): React.ReactElement {
  const { panel, tr } = props;
  return React.createElement(
    'p',
    { className: 'dshwb-unknown' },
    `${tr('panel.unknown', '未知面板类型')}: ${panel.type}`,
  );
}
