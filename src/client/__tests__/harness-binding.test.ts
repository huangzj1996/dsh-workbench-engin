import { describe, expect, it } from 'vitest';

import {
  bindingPatch,
  harnessBinding,
  normalizePinTarget,
  parsePinTargetText,
  type HarnessSessionRef,
} from '../harness-binding';
import {
  parseWorkbench,
  serializeWorkbench,
  type WorkbenchPanel,
  type Workbench,
} from '../../shared/workbench/schema';

/** A `harness` panel with the three binding fields; overrides merge in. */
function harnessPanel(fields: Partial<WorkbenchPanel> = {}): WorkbenchPanel {
  return {
    id: 'panel-1',
    title: '会话门牌',
    type: 'harness',
    sessionTitle: '示例会话',
    sessionId: 's-1',
    pinTarget: [],
    ...fields,
  };
}

/** One picked session as the drawer hands it over. */
function picked(id: string, title = ''): HarnessSessionRef {
  return { id, title };
}

describe('parsePinTargetText', () => {
  it('splits the drawer input on both the ASCII and the Chinese comma', () => {
    expect(parsePinTargetText('a, b，c')).toEqual(['a', 'b', 'c']);
  });

  it('trims entries and drops blank ones, so one parser serves the drawer and the JSON', () => {
    expect(parsePinTargetText(' a ，, b , ')).toEqual(['a', 'b']);
    expect(parsePinTargetText('')).toEqual([]);
    expect(parsePinTargetText(' ， , ')).toEqual([]);
  });
});

describe('normalizePinTarget', () => {
  it('keeps a string array, trimming entries and dropping blanks and non-strings', () => {
    expect(normalizePinTarget([' a ', '', 'b', 3, null])).toEqual(['a', 'b']);
  });

  it('turns a comma-separated string into the array form', () => {
    expect(normalizePinTarget('a, b，c')).toEqual(['a', 'b', 'c']);
  });

  it('falls back to an empty array for anything else', () => {
    expect(normalizePinTarget(undefined)).toEqual([]);
    expect(normalizePinTarget('')).toEqual([]);
    expect(normalizePinTarget({ pinned: true })).toEqual([]);
    expect(normalizePinTarget(42)).toEqual([]);
  });
});

describe('harnessBinding', () => {
  it('reads the three fields and cleans what the JSON carries', () => {
    const panel = harnessPanel({
      sessionTitle: '  会话 A  ',
      sessionId: '  s-1  ',
      pinTarget: [' a ', '', 'b'],
    });

    expect(harnessBinding(panel)).toEqual({
      sessionTitle: '会话 A',
      sessionId: 's-1',
      pinTarget: ['a', 'b'],
    });
  });

  it('defaults a panel that carries none of the binding fields', () => {
    const panel: WorkbenchPanel = { id: 'panel-1', title: '门牌', type: 'harness' };

    expect(harnessBinding(panel)).toEqual({ sessionTitle: '', sessionId: '', pinTarget: [] });
  });

  it('does not read conversation content off the panel', () => {
    const panel = harnessPanel({
      messages: [{ role: 'user', text: '会话正文不应进工作台' }],
      transcript: '会话正文不应进工作台',
    });

    expect(JSON.stringify(harnessBinding(panel))).not.toContain('会话正文');
  });
});

describe('bindingPatch', () => {
  it('writes all three binding fields for the picked session', () => {
    const panel = harnessPanel({ pinTarget: ['a'] });

    expect(bindingPatch(panel, picked('s-9', ' 新会话 '))).toEqual({
      sessionId: 's-9',
      sessionTitle: '新会话',
      pinTarget: ['a'],
    });
  });

  it('rejects a picked session whose id is blank', () => {
    expect(bindingPatch(harnessPanel(), picked(''))).toBeNull();
    expect(bindingPatch(harnessPanel(), picked('   '))).toBeNull();
  });

  it('accepts an empty title and stores it as an empty string', () => {
    expect(bindingPatch(harnessPanel(), picked('s-2'))).toMatchObject({
      sessionId: 's-2',
      sessionTitle: '',
    });
  });

  it('leaves fields outside the binding untouched so unknown fields survive a merge', () => {
    const panel = harnessPanel({ col: 2, futureField: { keep: true } });
    const patch = bindingPatch(panel, picked('s-9', '新会话'));
    const merged = { ...panel, ...(patch ?? {}) };

    expect(merged).toMatchObject({
      id: 'panel-1',
      title: '会话门牌',
      col: 2,
      futureField: { keep: true },
      sessionId: 's-9',
    });
  });
});

describe('harness binding on disk', () => {
  it('keeps type-specific fields and unknown panel fields intact through save and read', () => {
    const workbench: Workbench = {
      id: 'demo',
      name: 'Demo',
      cols: 4,
      panels: [
        harnessPanel({
          sessionTitle: '会话 A',
          sessionId: 's-1',
          pinTarget: ['a', 'b'],
          futureField: 'ai 可能写入的未来字段',
        }),
      ],
    };

    const read = parseWorkbench(serializeWorkbench(workbench));

    expect(read.panels[0]).toEqual(workbench.panels[0]);
    expect(harnessBinding(read.panels[0])).toEqual({
      sessionTitle: '会话 A',
      sessionId: 's-1',
      pinTarget: ['a', 'b'],
    });
  });
});
