/// <reference types="node" />
import { describe, expect, it } from 'vitest';

import { parseWorkbench, serializeWorkbench, WorkbenchStoreError } from '../schema';

/** Capture a thrown WorkbenchStoreError so both code and message can be asserted. */
function thrown(fn: () => unknown): WorkbenchStoreError {
  try {
    fn();
  } catch (error) {
    return error as WorkbenchStoreError;
  }
  throw new Error('expected the call to throw');
}

describe('parseWorkbench', () => {
  it('parses a valid workbench and keeps unknown fields on the scene and panels', () => {
    const text = JSON.stringify({
      id: 'alpha',
      name: 'Alpha',
      cols: 3,
      future: { nested: true },
      panels: [{ id: 'p1', title: 'One', type: 'reserved', futurePanelField: 42 }],
    });

    const scene = parseWorkbench(text);

    expect(scene.id).toBe('alpha');
    expect(scene.name).toBe('Alpha');
    expect(scene.cols).toBe(3);
    expect(scene.panels[0]?.type).toBe('reserved');
    expect((scene.panels[0] as unknown as Record<string, unknown>)['futurePanelField']).toBe(42);
    expect((scene as unknown as Record<string, unknown>)['future']).toEqual({ nested: true });
    // Round-trip: serializing then parsing again must not drop the unknown fields.
    expect(JSON.parse(serializeWorkbench(scene))).toEqual(JSON.parse(text));
  });

  it('reports unparseable JSON as file-corrupt with a readable Chinese message', () => {
    const error = thrown(() => parseWorkbench('{ definitely not json'));
    expect(error.code).toBe('file-corrupt');
    expect(error.message).toContain('文件损坏');
  });

  it('reports structurally invalid JSON as scene-invalid', () => {
    const error = thrown(() => parseWorkbench(JSON.stringify({ name: 'no id', panels: [] })));
    expect(error.code).toBe('scene-invalid');
    expect(error.message).toContain('配置不合法');
  });
});
