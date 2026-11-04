/**
 * The contract every panel renderer implements.
 *
 * A renderer owns only the panel body: the frame (ordinal, title, subtitle,
 * actions) is drawn by the grid around it.
 */
import type { WorkbenchPanel } from '../../shared/workbench/schema';
import type { SessionShell } from '../session-shell';
import type { Translate } from '../translate';

export interface PanelRendererProps {
  /** The panel as written in the workbench JSON, unknown fields included. */
  panel: WorkbenchPanel;
  /** Translate helper bound to the workbench namespace. */
  tr: Translate;
  /** The shell's session list, for renderers that bind to a session. */
  shell?: SessionShell;
}
