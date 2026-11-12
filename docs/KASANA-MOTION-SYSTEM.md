# Kasana Motion System — architecture and QA

This document applies to the unmerged integration PR #10. Animations are meant to communicate
state changes and spatial relationships, **not** make every static surface move. It is not a
claim that every one of Kasana's Vue files has a unique animation.

## Decisions and sources

- **Vue 3 Transition** for route entry/exit, validation and status icons. **TransitionGroup**
  for additions, removals and reorders in *small keyed lists*. References:
  [Vue Transition](https://vuejs.org/guide/built-ins/transition.html),
  [Vue TransitionGroup](https://vuejs.org/guide/built-ins/transition-group.html).
- Keep **Reka UI** presence/overlay lifecycle for modal dialogs, selects, popovers and tooltips;
  preserve the CSS `data-state=open/closed` animations. Do not wrap a Reka portal in another
  presence manager. Reference: [Reka animation guide](https://reka-ui.com/docs/guides/animation).
- Keep **Vaul** for touch-aware drawers, Vue Sonner for notifications, and the app's existing
  notification stack-motion controller. Duplicating their transforms breaks swipe/focus/exit behavior.
- **No blanket AutoAnimate integration**: AutoAnimate observes immediate children only, can
  modify positioning and may clash with flexbox/virtualized or absolutely positioned content.
  Evaluate it for isolated future forms only if a native TransitionGroup is insufficient.
  Reference: [AutoAnimate docs](https://auto-animate.formkit.com/).
- Avoid a new Motion for Vue runtime until a concrete shared-element/layout case justifies its
  dependency and performance cost. Reference: [Motion Vue layout animation](https://motion.dev/docs/vue-layout-animations).

## Motion vocabulary

All values are in `packages/frontend/src/styles/global.css`:

| Motion | Timing | Scope |
| --- | --- | --- |
| `--kasana-motion-fast` | 140 ms | Form validation, nested page changes, icon feedback |
| `--kasana-motion-normal` | 210 ms | Shell fade, dashboard pages, tab content, small lists |
| `--kasana-motion-slow` | 320 ms | Existing longer panels where needed |
| `--kasana-motion-ease` | cubic-bezier(0.22, 1, 0.36, 1) | Gentle deceleration |

`kasana-shell` fades layout changes; `kasana-page` handles dashboard parent routes;
`kasana-section` handles nested routes. Dashboard uses the **matched parent route** as its
key so moving between settings/analytics subpages doesn't destroy sidebar state.
`kasana-tab-content` reveals active Reka tabs; `kasana-feedback` and `kasana-icon`
animate short-lived messages and task completion states. Nested AI/Security tab routes use
independent child keys so their parent tab bars stay mounted. Compact settings/analytics
navigation uses `kasana-section` on its sidebar presence.

`kasana-list` is an *opt-in* FLIP (First–Last–Invert–Play) transition for keyed DOM children.
Tag and tracker lists use it only when the displayed collection has **40 or fewer** rows.
The wrapper is positioned relative so leaving rows can be absolutely positioned without
moving the whole document. Do not add this to the virtualized transaction list, drag handles,
scrollable infinite lists, or screen-sized layouts without profiling.

## Accessibility and interaction policy

- The app honors OS `prefers-reduced-motion: reduce`: nonessential CSS motion lasts at
  most 0.01 ms; existing sliding panels also set duration to zero via VueUse.
  Collapsible auto-scrolling uses instant behavior under this preference.
- Never animate essential information so slowly that submitting, navigation, validation or
  keyboard focus is delayed. Do not animate focus rings out of view or move a dragged item
  using a generic hover/press transform.
- Avoid `transition: all` in newly introduced components and heavy animation of
  `height`/`width` on large layouts; prefer `opacity` and `transform`.
- Interactions which stay static are intentional: long transaction tables, initial critical
  loading, financial totals that must remain legible, and destructive confirmation states
  where movement would distract from the consequence.

## Verification map

1. Auth -> dashboard and back: shell fade, correct focus and authentication redirects.
2. Dashboard -> Settings -> General/Appearance/Tags -> back: parent navigation persists;
   nested section appears smoothly without a flash or scroll overflow.
3. Analytics and Planned child routes: content changes smoothly; header and navigation stay.
4. Active tab content and underline/pill tabs: no double entrance or hidden/overlapping inputs.
5. Scrollable dialogs, select, popover, drawers: open/close geometry, Escape, swipe, focus trap.
6. Tag/tracker lists (empty, 1, 10, 40, 41+ rows): responsive insert/remove/reorder.
7. Form validation, transaction optional fields, investment settlement panels and Quick Start
   task completion: legible immediate feedback without disrupting focus.
8. Combobox popups and checkbox/radio indicators: open/close presence, keyboard selection and Escape.
9. OS Reduce Motion on and off: compare CSS computed durations and keyboard usability.
10. Mobile 360/390 px, desktop 1280 px, browser zoom 80%/100%/125%: no clipping.
11. Virtualized 100+ transactions, slow Android hardware, fast repeated navigation and
    interrupted drawer gestures: watch for dropped frames, layout shifts and broken focus.

The isolated Playwright smoke exercises computed route motion durations at normal/reduced
preferences and verifies desktop settings navigation and nested AI/Security tab persistence. It does **not** validate
every component or real low-end Android GPU performance; those remain release gates.
