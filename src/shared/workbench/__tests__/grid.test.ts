import { describe, expect, it } from 'vitest';

import {
  gridTemplateColumns,
  panelBoundsIssues,
  panelGridPlacement,
  panelIndexLabel,
} from '../grid';

describe('panelGridPlacement', () => {
  it('converts one-based coordinates to grid-column and grid-row spans', () => {
    expect(panelGridPlacement({ col: 2, row: 1, w: 3, h: 2 })).toEqual({
      gridColumn: '2 / span 3',
      gridRow: '1 / span 2',
    });
  });

  it('defaults the span to 2 when w or h is missing', () => {
    expect(panelGridPlacement({ col: 1, row: 2 })).toEqual({
      gridColumn: '1 / span 2',
      gridRow: '2 / span 2',
    });
  });

  it('leaves unpositioned panels to the auto flow', () => {
    expect(panelGridPlacement({})).toEqual({});
    expect(panelGridPlacement({ w: 3, h: 1 })).toEqual({});
  });
});

describe('panelIndexLabel', () => {
  it('pads a one-digit ordinal to two places', () => {
    expect(panelIndexLabel(1)).toBe('01');
    expect(panelIndexLabel(9)).toBe('09');
  });

  it('leaves ordinals of two or more digits untouched', () => {
    expect(panelIndexLabel(10)).toBe('10');
    expect(panelIndexLabel(123)).toBe('123');
  });
});

describe('gridTemplateColumns', () => {
  it('builds one equal, non-overflowing column per workbench column', () => {
    expect(gridTemplateColumns(6)).toBe('repeat(6, minmax(0, 1fr))');
  });

  it('falls back to the default four columns', () => {
    expect(gridTemplateColumns()).toBe('repeat(4, minmax(0, 1fr))');
    expect(gridTemplateColumns(undefined)).toBe('repeat(4, minmax(0, 1fr))');
  });
});

describe('panelBoundsIssues', () => {
  it('reports nothing for a panel that fits', () => {
    expect(panelBoundsIssues({ col: 3, w: 2 }, 6)).toEqual([]);
    expect(panelBoundsIssues({ col: 1, w: 4 }, 4)).toEqual([]);
  });

  it('reports a start column beyond the last column', () => {
    expect(panelBoundsIssues({ col: 5, w: 1 }, 4)).toEqual(['起始列 5 超出列数 4']);
  });

  it('reports a span that overhangs the last column', () => {
    expect(panelBoundsIssues({ col: 3, w: 3 }, 4)).toEqual(['第 3 列起跨 3 列，超出列数 4']);
  });

  it('reports an auto-flow panel whose default span is wider than the grid', () => {
    expect(panelBoundsIssues({ w: 6 }, 4)).toEqual(['跨度 6 超过列数 4']);
  });

  it('defaults cols to four and span to two', () => {
    expect(panelBoundsIssues({ col: 4 })).toEqual(['第 4 列起跨 2 列，超出列数 4']);
  });
});
