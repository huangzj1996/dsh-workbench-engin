import { describe, expect, it } from 'vitest';

import {
  addPanel,
  changePanelType,
  createPanel,
  createWorkbenchScene,
  movePanel,
  removePanel,
  updatePanel,
  updateWorkbench,
} from '../workbench-draft';

describe('createPanel', () => {
  it('creates a reserved panel with the first free sequential id and its default fields', () => {
    const panel = createPanel('reserved', [{ id: 'panel-1' }], '占位面板');

    expect(panel).toEqual({
      id: 'panel-2',
      title: '占位面板',
      type: 'reserved',
      text: '',
    });
  });

  it('creates a harness panel with the session-badge default fields', () => {
    const panel = createPanel('harness', [], '会话门牌');

    expect(panel).toEqual({
      id: 'panel-1',
      title: '会话门牌',
      type: 'harness',
      sessionTitle: '',
      sessionId: '',
      pinTarget: [],
    });
  });
});

describe('createWorkbenchScene', () => {
  it('starts with four columns and one reserved placeholder panel', () => {
    expect(createWorkbenchScene('demo', 'Demo', '占位面板')).toEqual({
      id: 'demo',
      name: 'Demo',
      cols: 4,
      panels: [{ id: 'panel-1', title: '占位面板', type: 'reserved', text: '' }],
    });
  });
});

describe('addPanel', () => {
  it('appends a panel of the chosen type without mutating the input scene', () => {
    const scene = createWorkbenchScene('demo', 'Demo', '占位面板');

    const next = addPanel(scene, 'harness', '会话门牌');

    expect(next.panels.map((panel) => panel.id)).toEqual(['panel-1', 'panel-2']);
    expect(next.panels[1]).toMatchObject({ type: 'harness' });
    expect(scene.panels).toHaveLength(1);
  });
});

describe('removePanel', () => {
  it('removes the named panel and keeps the rest in order', () => {
    const first = createWorkbenchScene('demo', 'Demo', '占位面板');
    const scene = addPanel(first, 'reserved', '第二块');

    const next = removePanel(scene, 'panel-1');

    expect(next.panels.map((panel) => panel.id)).toEqual(['panel-2']);
  });

  it('keeps the same scene object when the id is unknown', () => {
    const scene = createWorkbenchScene('demo', 'Demo', '占位面板');

    expect(removePanel(scene, 'ghost')).toBe(scene);
  });
});

describe('movePanel', () => {
  it('swaps a panel one position up', () => {
    const first = createWorkbenchScene('demo', 'Demo', '占位面板');
    const scene = addPanel(first, 'reserved', '第二块');

    const next = movePanel(scene, 'panel-2', -1);

    expect(next.panels.map((panel) => panel.id)).toEqual(['panel-2', 'panel-1']);
  });

  it('keeps the same scene object at either end', () => {
    const first = createWorkbenchScene('demo', 'Demo', '占位面板');
    const scene = addPanel(first, 'reserved', '第二块');

    expect(movePanel(scene, 'panel-1', -1)).toBe(scene);
    expect(movePanel(scene, 'panel-2', 1)).toBe(scene);
  });
});

describe('updatePanel', () => {
  it('merges the patch into the selected panel only', () => {
    const scene = createWorkbenchScene('demo', 'Demo', '占位面板');

    const next = updatePanel(scene, 'panel-1', { title: '改名', col: 2 });

    expect(next.panels[0]).toMatchObject({ id: 'panel-1', title: '改名', col: 2 });
  });

  it('drops a field cleared with undefined so it falls back to the auto flow', () => {
    const scene = updatePanel(createWorkbenchScene('demo', 'Demo', '占位面板'), 'panel-1', {
      col: 2,
    });

    const next = updatePanel(scene, 'panel-1', { col: undefined });

    expect(next.panels[0]).not.toHaveProperty('col');
  });
});

describe('updateWorkbench', () => {
  it('patches the workbench-level fields and keeps the panels', () => {
    const scene = createWorkbenchScene('demo', 'Demo', '占位面板');

    const next = updateWorkbench(scene, { name: '改名', cols: 6 });

    expect(next).toMatchObject({ id: 'demo', name: '改名', cols: 6 });
    expect(next.panels).toBe(scene.panels);
  });

  it('drops a field cleared with undefined', () => {
    const scene = updateWorkbench(createWorkbenchScene('demo', 'Demo', '占位面板'), {
      description: '说明',
    });

    expect(updateWorkbench(scene, { description: undefined })).not.toHaveProperty('description');
  });
});

describe('changePanelType', () => {
  it('keeps the identity and common fields while adding the new type default fields', () => {
    const scene = createWorkbenchScene('demo', 'Demo', '占位面板');

    const next = changePanelType(scene, 'panel-1', 'harness');

    expect(next.panels[0]).toMatchObject({
      id: 'panel-1',
      title: '占位面板',
      type: 'harness',
      sessionTitle: '',
      sessionId: '',
      pinTarget: [],
    });
  });

  it('keeps the same scene object when the id is unknown', () => {
    const scene = createWorkbenchScene('demo', 'Demo', '占位面板');

    expect(changePanelType(scene, 'ghost', 'harness')).toBe(scene);
  });
});
