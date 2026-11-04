import { describe, expect, it } from 'vitest';

import { panelGridPlacement } from '../grid';

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
