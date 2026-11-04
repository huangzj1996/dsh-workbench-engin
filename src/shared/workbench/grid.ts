/**
 * Coordinates → CSS Grid placement.
 *
 * The JSON stores one-based `col`/`row` and the spans `w`/`h`; a panel without
 * a coordinate is left to the grid's auto flow. `w`/`h` default to 2.
 */
import { DEFAULT_COLS, DEFAULT_SPAN, type WorkbenchPanel } from './schema';

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

/** The two-digit ordinal shown in a panel header: 1 → '01', 10 → '10'. */
export function panelIndexLabel(index: number): string {
  return String(index).padStart(2, '0');
}

/**
 * The grid track template for a workbench: `cols` equal, non-overflowing columns.
 * `minmax(0, 1fr)` keeps a wide panel body from stretching its column.
 */
export function gridTemplateColumns(cols?: number): string {
  return `repeat(${cols ?? DEFAULT_COLS}, minmax(0, 1fr))`;
}

/**
 * Readable borders problems for one panel, empty when it fits the grid.
 *
 * Only the horizontal axis can overflow: `col`/`w` are bounded by `cols`, while
 * rows grow as needed. The list never blocks rendering — callers surface it as
 * a console warning and a small badge.
 */
export function panelBoundsIssues(
  panel: Pick<WorkbenchPanel, 'col' | 'w'>,
  cols?: number,
): string[] {
  const columns = cols ?? DEFAULT_COLS;
  const w = panel.w ?? DEFAULT_SPAN;
  if (panel.col === undefined) {
    return w > columns ? [`跨度 ${w} 超过列数 ${columns}`] : [];
  }
  if (panel.col > columns) return [`起始列 ${panel.col} 超出列数 ${columns}`];
  if (panel.col + w - 1 > columns) {
    return [`第 ${panel.col} 列起跨 ${w} 列，超出列数 ${columns}`];
  }
  return [];
}
