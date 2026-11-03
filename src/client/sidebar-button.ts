/**
 * Sidebar header button, composed on top of the shell's DOM.
 *
 * The sidebar shell (ui-sidebar) declares no seat inside the New Session row,
 * so the entry cannot be a `sidebar.panellist` row: this module clones the
 * shell's own New Session button (same class list, so geometry, palette and
 * hover treatment are identical by construction), swaps its glyph and label,
 * and places it beside the original while splitting the row in two.
 * `ctx.layout.selectPanel()` switches to the panel; the shell button's inline
 * width is restored when the disposer runs.
 */
import { PANEL_ID } from './workbench';

/** The part of the Client context this module needs. */
export interface HeaderButtonContext {
  layout: { selectPanel(panelId: string): void };
}

/** Locale translate function bound to this plugin's namespace. */
type Translate = (key: string) => string;

/** Marker that survives React's className rewrites (React never touches it). */
const ROOT_ATTR = 'data-dsh-workbench-root';
const BUTTON_MARK = 'dsh-workbench-header-button';
const BUTTON_ATTR = 'data-dsh-workbench-button';
const STYLE_ATTR = 'data-dsh-workbench';
/** Space between the two buttons in the New Session row. */
const GAP_PX = 6;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** True when the element carries a CSS-module class with this local name. */
function hasClassSuffix(element: Element, suffix: string): boolean {
  return Array.from(element.classList).some((name) => name.endsWith(suffix));
}

/** The shell's New Session button; ours carries a marker so it is skipped. */
function findHeaderButton(): HTMLButtonElement | null {
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    if (button.hasAttribute(BUTTON_ATTR)) continue;
    if (hasClassSuffix(button, '_newSession')) return button;
  }
  return null;
}

/** Nearest ancestor that owns the brand row — the sidebar column shell. */
function findSidebarRoot(button: Element): HTMLElement | null {
  let element: Element | null = button.parentElement;
  while (element !== null && element !== document.body) {
    if (Array.from(element.children).some((child) => hasClassSuffix(child, '_logoRow'))) {
      return element as HTMLElement;
    }
    element = element.parentElement;
  }
  return null;
}

/** The sidebar glyph: a speech bubble that inherits the button's color. */
function glyph(size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'block';
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M2.5 3.5h11v7.5h-6l-3 2.5v-2.5h-2z');
  svg.appendChild(path);
  return svg;
}

/** Clone the shell button (same classes) and swap its glyph and label. */
function cloneHeaderButton(shell: HTMLButtonElement, label: string): HTMLButtonElement {
  const button = shell.cloneNode(true) as HTMLButtonElement;
  button.setAttribute(BUTTON_ATTR, '');
  button.setAttribute('aria-label', label);
  button.removeAttribute('aria-keyshortcuts');
  const parts = Array.from(button.querySelectorAll('span'));
  const shortcut = parts.find((part) => hasClassSuffix(part, '_newSessionShortcut'));
  if (shortcut !== undefined) shortcut.remove();
  const text = parts.find((part) => hasClassSuffix(part, '_newSessionLabel'));
  if (text !== undefined) text.textContent = label;
  const icon = button.querySelector('svg');
  if (icon !== null) icon.replaceWith(glyph(14));
  return button;
}

/**
 * Mount the header button and keep it beside the shell's New Session button.
 * @param ctx - Client context (`ctx.layout.selectPanel` is required).
 * @param t - locale bound to this plugin's namespace.
 * @returns disposer that removes every trace of the composition.
 */
export function mountHeaderButton(ctx: HeaderButtonContext, t: Translate): () => void {
  if (document.querySelector(`style[${STYLE_ATTR}]`) === null) {
    const style = document.createElement('style');
    style.setAttribute(STYLE_ATTR, '');
    style.textContent =
      '[' + ROOT_ATTR + ']{position:relative}' +
      '.' + BUTTON_MARK + '{position:absolute;margin:0;z-index:1}' +
      '.' + BUTTON_MARK + ':focus-visible{outline:var(--dsw-focus-ring-width) solid ' +
      'var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}';
    document.head.appendChild(style);
  }

  let shell: HTMLButtonElement | null = null;
  let root: HTMLElement | null = null;
  let button: HTMLButtonElement | null = null;
  let frame = 0;
  let rootObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let bodyObserver: MutationObserver | null = null;

  const schedule = (): void => {
    if (frame !== 0) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };

  /** Switch the main panel to the Workbench panel. */
  const onActivate = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    try {
      ctx.layout.selectPanel(PANEL_ID);
    } catch (error) {
      console.error('[dsh-hello-word] cannot select the workbench panel', error);
    }
  };

  /** Watch the column for collapse/expand and width changes. */
  const observe = (): void => {
    if (root === null || shell === null) return;
    if (rootObserver !== null) rootObserver.disconnect();
    rootObserver = new MutationObserver(schedule);
    rootObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    if (resizeObserver !== null) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);
    resizeObserver.observe(shell);
  };

  const removeButton = (): void => {
    if (button === null) return;
    button.removeEventListener('click', onActivate);
    if (button.parentNode !== null) button.parentNode.removeChild(button);
    button = null;
  };

  const update = (): void => {
    const nextShell = findHeaderButton();
    if (nextShell === null) return;
    if (nextShell !== shell) {
      removeButton();
      shell = nextShell;
      root = findSidebarRoot(shell);
      if (root === null) {
        shell = null;
        return;
      }
      root.setAttribute(ROOT_ATTR, '');
      observe();
    }
    if (shell === null || root === null) return;
    if (!shell.isConnected || !root.isConnected) return;
    if (!root.hasAttribute(ROOT_ATTR)) root.setAttribute(ROOT_ATTR, '');

    const label = t('menu.label');
    const collapsed = hasClassSuffix(root, '_collapsed') || hasClassSuffix(root, '_fading');
    if (collapsed) {
      if (button !== null) button.style.display = 'none';
      shell.style.removeProperty('width');
      return;
    }

    let target = button;
    if (target === null || !target.isConnected) {
      removeButton();
      target = cloneHeaderButton(shell, label);
      target.classList.add(BUTTON_MARK);
      target.addEventListener('click', onActivate);
      root.appendChild(target);
      button = target;
    } else {
      const text = Array.from(target.querySelectorAll('span')).find((part) =>
        hasClassSuffix(part, '_newSessionLabel'),
      );
      if (text !== undefined && text.textContent !== label) text.textContent = label;
      target.setAttribute('aria-label', label);
    }

    const rootStyle = getComputedStyle(root);
    const padLeft = parseFloat(rootStyle.paddingLeft) || 0;
    const padRight = parseFloat(rootStyle.paddingRight) || 0;
    const contentWidth = root.clientWidth - padLeft - padRight;
    const shellStyle = getComputedStyle(shell);
    const marginLeft = parseFloat(shellStyle.marginLeft) || 0;
    const marginRight = parseFloat(shellStyle.marginRight) || 0;
    const half = Math.max(60, (contentWidth - marginLeft - marginRight - GAP_PX) / 2);

    shell.style.width = half + 'px';
    const shellRect = shell.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    target.style.position = 'absolute';
    target.style.margin = '0';
    target.style.display = '';
    target.style.width = half + 'px';
    target.style.height = shellRect.height + 'px';
    target.style.left = shellRect.right - rootRect.left + GAP_PX + 'px';
    target.style.top = shellRect.top - rootRect.top + 'px';
  };

  bodyObserver = new MutationObserver(() => {
    if (
      shell !== null &&
      shell.isConnected &&
      root !== null &&
      root.isConnected &&
      button !== null &&
      button.isConnected
    ) {
      return;
    }
    schedule();
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);
  schedule();

  return () => {
    if (frame !== 0) window.cancelAnimationFrame(frame);
    if (rootObserver !== null) rootObserver.disconnect();
    if (resizeObserver !== null) resizeObserver.disconnect();
    if (bodyObserver !== null) bodyObserver.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule, true);
    removeButton();
    if (shell !== null) shell.style.removeProperty('width');
    if (root !== null) root.removeAttribute(ROOT_ATTR);
    const style = document.querySelector(`style[${STYLE_ATTR}]`);
    if (style !== null) style.remove();
  };
}
