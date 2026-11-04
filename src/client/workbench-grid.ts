/**
 * The workbench grid: lays one workbench's panels out on a CSS grid and draws
 * each panel's chrome — zero-padded ordinal, title, subtitle, actions — around
 * a body chosen from the renderer table.
 *
 * Placement comes from `panelGridPlacement` (shared, unit-tested); panels that
 * write no coordinate are left to the CSS auto flow. Out-of-bounds coordinates
 * are reported, never blocked: a console warning plus a small header badge.
 */
import * as React from 'react';

import {
  gridTemplateColumns,
  panelBoundsIssues,
  panelGridPlacement,
  panelIndexLabel,
} from '../shared/workbench/grid';
import {
  DEFAULT_COLS,
  type WorkbenchPanel,
  type WorkbenchScene,
} from '../shared/workbench/schema';
import { panelRenderer } from './renderers';
import { UnknownPanel } from './renderers/unknown';
import type { Translate } from './translate';

/** Styles for the grid and the panel chrome; injected once with the component. */
export const GRID_CSS = `
.dshwb-grid-wrap{flex:1;min-height:0;width:100%;overflow:auto}
.dshwb-grid{display:grid;gap:12px;width:100%;min-height:100%;grid-auto-rows:minmax(150px,1fr);align-content:stretch}
.dshwb-panel{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:rgba(9,15,26,.62);backdrop-filter:blur(12px);box-shadow:0 14px 36px rgba(0,0,0,.28);color:#eef3fb}
.dshwb-panel-head{display:flex;align-items:flex-start;gap:8px;padding:10px 12px 8px;border-bottom:1px solid rgba(255,255,255,.09)}
.dshwb-panel-index{flex:0 0 auto;padding-top:1px;color:rgba(169,206,255,.85);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;letter-spacing:.06em}
.dshwb-panel-heading{flex:1;min-width:0}
.dshwb-panel-title{margin:0;overflow:hidden;font-size:13px;font-weight:600;line-height:1.45;white-space:nowrap;text-overflow:ellipsis}
.dshwb-panel-sub{margin:2px 0 0;overflow:hidden;color:rgba(226,234,248,.55);font-size:11.5px;line-height:1.45;white-space:nowrap;text-overflow:ellipsis}
.dshwb-panel-actions{display:flex;flex:0 0 auto;align-items:center;gap:6px}
.dshwb-panel-type{padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.07);color:rgba(226,234,248,.6);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10.5px;line-height:1.6;white-space:nowrap}
.dshwb-panel-warn{padding:2px 7px;border-radius:999px;background:rgba(255,196,84,.16);color:#ffd88e;font-size:10.5px;line-height:1.6;white-space:nowrap;cursor:help}
.dshwb-panel-body{flex:1;min-height:0;overflow:auto;padding:11px 12px}
.dshwb-reserved{display:flex;flex-direction:column;gap:6px}
.dshwb-reserved-text{margin:0;color:rgba(226,234,248,.72);font-size:12.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
.dshwb-reserved-type{margin:0;color:rgba(226,234,248,.4);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}
.dshwb-unknown{margin:0;color:rgba(226,234,248,.5);font-size:12.5px;line-height:1.65;word-break:break-word}
.dshwb-grid-empty{margin:0;color:rgba(226,234,248,.62);font-size:12.5px;line-height:1.7}
`;

export interface WorkbenchGridProps {
  /** The workbench to draw; `cols` and panel coordinates come straight from it. */
  scene: WorkbenchScene;
  /** Translate helper bound to the workbench namespace. */
  tr: Translate;
}

/** The grid for one workbench, or an empty hint when it has no panels. */
export function WorkbenchGrid(props: WorkbenchGridProps): React.ReactElement {
  const { scene, tr } = props;
  const cols = scene.cols ?? DEFAULT_COLS;
  return React.createElement(
    'div',
    { className: 'dshwb-grid-wrap' },
    React.createElement('style', { dangerouslySetInnerHTML: { __html: GRID_CSS } }),
    scene.panels.length === 0
      ? React.createElement(
          'p',
          { className: 'dshwb-grid-empty' },
          tr(
            'panel.empty',
            '这个工作台还没有子面板。在工作台 JSON 的 panels 里加一个，再点「刷新」。',
          ),
        )
      : React.createElement(
          'div',
          {
            className: 'dshwb-grid',
            style: { gridTemplateColumns: gridTemplateColumns(cols) },
          },
          scene.panels.map((panel, index) =>
            React.createElement(PanelFrame, {
              key: panel.id,
              panel,
              index,
              cols,
              tr,
            }),
          ),
        ),
  );
}

interface PanelFrameProps {
  panel: WorkbenchPanel;
  /** Zero-based position in `panels`; the header shows it one-based, padded. */
  index: number;
  /** Resolved `cols` for bounds reporting. */
  cols: number;
  tr: Translate;
}

/** One sub-panel: grid placement, header chrome, renderer body. */
function PanelFrame(props: PanelFrameProps): React.ReactElement {
  const { panel, index, cols, tr } = props;
  const issues = panelBoundsIssues(panel, cols);
  const issuesText = issues.join('；');
  const ordinal = panelIndexLabel(index + 1);

  React.useEffect(() => {
    if (issuesText === '') return;
    console.warn(`[workbench] 子面板 ${ordinal}「${panel.title}」坐标越界：${issuesText}`);
  }, [issuesText, ordinal, panel.title]);

  const Renderer = panelRenderer(panel.type);
  return React.createElement(
    'article',
    {
      className: 'dshwb-panel',
      style: { ...panelGridPlacement(panel) },
      'data-panel-id': panel.id,
      'data-panel-type': panel.type,
    },
    React.createElement(
      'header',
      { className: 'dshwb-panel-head' },
      React.createElement('span', { className: 'dshwb-panel-index' }, ordinal),
      React.createElement(
        'div',
        { className: 'dshwb-panel-heading' },
        React.createElement('h3', { className: 'dshwb-panel-title', title: panel.title }, panel.title),
        panel.sub !== undefined &&
          panel.sub.trim() !== '' &&
          React.createElement('p', { className: 'dshwb-panel-sub', title: panel.sub }, panel.sub),
      ),
      React.createElement(
        'div',
        { className: 'dshwb-panel-actions' },
        issuesText !== '' &&
          React.createElement(
            'span',
            { className: 'dshwb-panel-warn', title: issuesText },
            tr('panel.outOfBounds', '坐标越界'),
          ),
        React.createElement('span', { className: 'dshwb-panel-type' }, panel.type),
      ),
    ),
    React.createElement(
      'div',
      { className: 'dshwb-panel-body' },
      Renderer === undefined
        ? React.createElement(UnknownPanel, { panel, tr })
        : React.createElement(Renderer, { panel, tr }),
    ),
  );
}
