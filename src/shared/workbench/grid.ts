/**
 * Coordinates → CSS Grid placement.
 *
 * The JSON stores one-based `col`/`row` and the spans `w`/`h`; a panel without
 * a coordinate is left to the grid's auto flow. `w`/`h` default to 2.
 */
import { DEFAULT_SPAN, type WorkbenchPanel } from './schema';

/** The subset of CSS style a positioned panel needs. */
export interface PanelPlacement {
  gridColumn?: string;
  gridRow?: string;
}

/** Placement for one panel; empty means "let the auto flow place it". */
export function panelGridPlacement(
  panel: Pick<WorkbenchPanel, 'col' | 'row' | 'w' | 'h'>,
): PanelPlacement {
  const placement: PanelPlacement = {};
  const w = panel.w ?? DEFAULT_SPAN;
  const h = panel.h ?? DEFAULT_SPAN;
  if (panel.col !== undefined) placement.gridColumn = `${panel.col} / span ${w}`;
  if (panel.row !== undefined) placement.gridRow = `${panel.row} / span ${h}`;
  return placement;
}
