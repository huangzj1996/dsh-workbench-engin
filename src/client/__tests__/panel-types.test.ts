import { describe, expect, it } from 'vitest';

import {
  PANEL_TYPES,
  panelDefaultFields,
  panelTypeDefinition,
  panelTypeLabel,
  panelTypeTitle,
} from '../panel-types';

/** Translate by echoing the key, so tests assert which key was asked for. */
const keyTr = (key: string): string => key;

describe('panelDefaultFields', () => {
  it('gives the placeholder type its own text field', () => {
    expect(panelDefaultFields('reserved')).toEqual({ text: '' });
  });

  it('gives the session badge its three binding fields', () => {
    expect(panelDefaultFields('harness')).toEqual({
      sessionTitle: '',
      sessionId: '',
      pinTarget: [],
    });
  });

  it('returns a fresh field object each call so panels never share arrays', () => {
    const first = panelDefaultFields('harness');
    const second = panelDefaultFields('harness');
    expect(first).not.toBe(second);
    expect(first['pinTarget']).not.toBe(second['pinTarget']);
  });
});

describe('panel type metadata', () => {
  it('registers every offered type with its label and title keys', () => {
    for (const type of PANEL_TYPES) {
      const definition = panelTypeDefinition(type);
      expect(definition).toBeDefined();
      expect(definition?.labelKey).toBe(`panel.type.${type}`);
      expect(definition?.titleKey).toBe(`panel.new.${type}`);
      expect(panelTypeLabel(keyTr, type)).toBe(`panel.type.${type}`);
      expect(panelTypeTitle(keyTr, type)).toBe(`panel.new.${type}`);
    }
  });

  it('marks only the session badge as binding a shell session', () => {
    expect(panelTypeDefinition('harness')?.bindsSession).toBe(true);
    expect(panelTypeDefinition('reserved')?.bindsSession).toBe(false);
  });

  it('falls back to the raw name for a type the bundle does not know', () => {
    expect(panelTypeDefinition('flow')).toBeUndefined();
    expect(panelTypeLabel(keyTr, 'flow')).toBe('flow');
  });
});
