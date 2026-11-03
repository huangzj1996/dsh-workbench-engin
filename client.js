/**
 * Client half of the Hello Word bundle.
 *
 * Two registrations, one feature:
 *  1. `sidebar.panellist` — the sidebar owns the row button; this entry only
 *     supplies the glyph (props: {size, active}) and the label metadata. The
 *     list id is also the main-panel id the sidebar dispatches on click.
 *  2. `main` — the keyed central-panel cell for that same id. It renders a
 *     blank panel whose only content is the words "hello word".
 *
 * Every registration goes through `ctx.slots.inject` (a slot must be declared
 * before it can be registered into) and is owned by this plugin's fiber, so
 * disabling the bundle removes the row and the panel again.
 */
window.__ModuleLoader__.load({
  id: 'dsh-hello-word',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace owned by this plugin. */
    const NS = 'hello-word';

    /** Simplified Chinese dictionary (the demo text is intentionally literal). */
    const zh = {
      'menu.label': 'Hello Word',
      'panel.body': 'hello word',
    };

    /** English dictionary. */
    const en = {
      'menu.label': 'Hello Word',
      'panel.body': 'hello word',
    };

    /**
     * Sidebar glyph: a speech bubble that inherits the row's own color, so the
     * shipped hover/selected states keep working without extra styling.
     */
    function HelloIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 16;
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: 'M2.5 3.5h11v7.5h-6l-3 2.5v-2.5h-2z' }),
      );
    }

    /** The central panel: deliberately blank apart from the requested words. */
    function HelloPanel(props) {
      const t = props !== null && props !== undefined && typeof props.t === 'function' ? props.t : undefined;
      const body = t === undefined ? 'hello word' : t('panel.body');
      return h(
        'div',
        {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            color: 'var(--dsw-alias-label-primary)',
            fontSize: '16px',
            userSelect: 'none',
          },
        },
        h('span', null, body),
      );
    }

    return {
      /** Diagnostics label for this Client half (used by slot registrant stamps). */
      name: 'dsh-hello-word',
      /** Client services this plugin requires. */
      inject: ['slots', 'locale'],

      /** Register the panel and the sidebar row; disposal follows the fiber. */
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'hello-word: dictionaries');

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: 'hello-word', locale: NS },
            HelloPanel,
          ),
        );

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'hello-word',
              // plugins = 0, schedules = 10: order 5 sits directly below Plugins.
              order: 5,
              label: () => t('menu.label'),
            },
            HelloIcon,
          ),
        );
      },
    };
  },
});
