# Phase 2 — design and delivery plan

Status: plan, 2026-11-26. Source of the intent: [GAPS.md § 3](GAPS.md#3-phase-2--reimagining-the-frontend-uiux-plan).
This file turns § 3 into decisions a developer can build from, screen by screen, PR by PR.

Ground rules (from GAPS § 3 and CLAUDE.md, repeated because every section depends on them):

- **Presentation only.** Same APIs, same client scripts, same permissions, same save / submit rules. When a screen needs
  behaviour, it is ported from Desk v16 (`apps/frappe/frappe/public/js/frappe/…`) and the file is named here and in a
  code comment.
- **Behind the switch.** Every new screen renders only when `useNewLayout()` is true (`lib/ui/newLayout.ts`). The
  classic screen stays untouched and its e2e suites stay green.
- **No per-app code.** Everything comes from metadata, the site's own settings and hooks.

Contents

1. [Goals and how they are measured](#1-goals-and-how-they-are-measured)
2. [Design system](#2-design-system)
3. [App shell and navigation](#3-app-shell-and-navigation)
4. [Screens](#4-screens)
5. [AI assistant UI](#5-ai-assistant-ui)
6. [Performance plan](#6-performance-plan)
7. [Accessibility plan](#7-accessibility-plan)
8. [Delivery plan (PR list)](#8-delivery-plan-pr-list)
9. [Risks and open questions](#9-risks-and-open-questions)

---

## 1. Goals and how they are measured

| # | Goal | Target | How it is measured | When |
|---|---|---|---|---|
| G1 | Faster daily tasks | −30 % median task time vs Desk on the 6 top tasks (below) | Moderated session, 3–5 users (clerk, storekeeper, accountant, approver), same site, same data; stopwatch from "start" to the server showing the result. Recorded in `docs/research/usability-<date>.md` | Before PR 5 (forms) as baseline, after PR 7 and PR 14 |
| G2 | Fewer clicks | −40 % clicks + keystrokes (excluding typed values) on the same tasks | Each top task has a Playwright "task" script in `e2e/p2.tasks.mjs` that counts `click` / `press` calls per layout (classic, new). The counts go in the PR | Every screen PR that touches a top task |
| G3 | Performance | Lighthouse performance ≥ 95, desktop and mobile preset, every route in the table in § 6.1 | `e2e/lighthouse.mjs` (PR 0), 3 runs, median, logged in, production build | Every PR |
| G4 | Accessibility | Lighthouse accessibility 100 + zero axe-core violations (WCAG 2.2 A/AA tags) | Same script + `@axe-core/playwright` inside each `p2.*` suite | Every PR |
| G5 | Layout stability | CLS ≤ 0.05 per route (today ≤ 0.08) | Lighthouse CLS + a `PerformanceObserver('layout-shift')` sum in the p2 suite after the screen settles | Every PR |
| G6 | Responsiveness | INP ≤ 200 ms (field, p75); lab: each scripted interaction ≤ 100 ms | Lab: `PerformanceObserver({type:'event', durationThreshold:16})` in `e2e/lib.mjs` around the suite's interactions (open row, type in grid, switch tab, open panel), max reported. Field: opt-in `web-vitals` beacon (§ 6.6) | Every PR (lab); monthly (field) |
| G7 | Parity kept | All classic suites green with the switch off, and with it on for the suites that drive behaviour (formsave, grid*, workflow, dayofwork) | `node e2e/run-all.mjs` and `NEW_LAYOUT=1 node e2e/run-all.mjs` (PR 0 adds the env flag to `e2e/lib.mjs`) | Before merging each PR |

**Top tasks** (used by G1/G2; revisit after the first user session, GAPS § 3.5):
1. Sales Order → Sales Invoice → submit. 2. Approve a document waiting on me (workflow). 3. Find a customer's
outstanding amount. 4. Stock Entry (material transfer, 3 items). 5. General Ledger for one party, last quarter, export.
6. Create a DocType with a child table and a Link, then its first record.

Lighthouse does not measure INP on a page load, so INP is measured as above; TBT (Lighthouse) is the lab proxy and must
stay ≤ 150 ms desktop.

---

## 2. Design system

Everything lives in `crema-frontend/app/globals.css` (tokens) and `components/crema-ui/*` (primitives), shown at
`/desk/ui-kit` (`app/(desk)/desk/ui-kit/UiKit.tsx`, suite `e2e/p2.foundation.mjs`). What exists is kept; this section
fills the gaps.

### 2.1 Tokens

Already in `globals.css` (keep): espresso gray/blue scales and semantic aliases (`--bg-color`, `--text-color`, …, a 1:1
copy of Frappe's `public/css/espresso/*`), fluid spacing (`--space-gutter|stack|section|field|column`), type scale
(`--type-display … --type-caption`), radii (`--round-control|card|panel|pill`), elevation (`--elevation-0…4`), motion
(`--duration-*`, `--ease-*`), density, status colours, focus ring, high contrast (`data-contrast="more"` and
`prefers-contrast`), reduced motion, chart series.

To add (one block under "Phase 2 design tokens"; nothing above it changes):

| Group | Tokens | Value / rule |
|---|---|---|
| Surfaces | `--surface-base` (page), `--surface-raised` (cards, panels), `--surface-sunken` (wells, table header), `--surface-overlay` (menus, sheets), `--surface-hover`, `--surface-selected` | Light: `#fff / #fff / gray-50 / #fff / gray-100 / blue-50-ish #eef6fe`. Dark: `#171717 / #1f1f1f / #141414 / #242424 / #292929 / #0f2a45`. Cards separate from the page by border + `--elevation-1`, never by background alone (high contrast keeps borders) |
| Ink | `--ink-default`, `--ink-muted`, `--ink-subtle`, `--ink-inverse`, `--ink-link`, `--ink-disabled` | Aliases of `--text-color`, `--text-muted`, `--text-light`, … so high contrast keeps working. `--ink-subtle` is **only** for decoration (≥ 3:1 not guaranteed for text) |
| Outline | `--outline-default`, `--outline-strong`, `--outline-focus` | `--border-color`, `--dark-border-color`, `--focus-color` |
| Accent | `--accent`, `--accent-fg`, `--accent-soft` | Default = espresso primary (ink black / white in dark). Overridable per site (§ 9 Q3). Used for the primary button, selected nav item, progress; never for status |
| Status | existing `--status-{neutral,info,success,warning,danger}-{bg,fg,border}` | Keep; plus `--status-*-solid` for dots and chart marks (≥ 3:1 against surface). Frappe indicator colours map through `lib/ui/status.ts` (`toneFromIndicator`) |
| AI | `--ai-tint` (very light violet `#f4f1fe` / dark `#211b38`), `--ai-fg` | Only on the assistant's chrome (panel header icon, "filled by assistant" field marker). Never on data |
| Layout | `--header-height: 48px`, `--sidebar-width: 240px`, `--sidebar-rail: 56px`, `--rail-width` (right panel, user-resizable, default 400px), `--bottomnav-height: 56px`, `--measure: 75ch`, `--field-max: 32rem`, `--pane-left: 260px`, `--outline-width: 200px` | See § 3.4; no page-level max width in the new layout |
| Layers | `--z-header 40`, `--z-sidebar 35`, `--z-bottombar 30`, `--z-rail 45`, `--z-panel 50` (modal sheet), `--z-toast 60`, `--z-popover 70` | One scale; replaces literal `z-40` / `z-[9999]` in new code |
| Breakpoints | Tailwind 4 `@theme`: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1600`, `3xl 2240` | `3xl` is new; container queries (`@container`) for anything inside a card or panel |

**Type.** Inter (already via `next/font`), body 14 px (`html` is 14 px, as Desk). Scale stays as defined; numbers in
tables use `font-variant-numeric: tabular-nums` (utility `tabular`). Line length capped at `--measure` for prose
(descriptions, help, AI answers), not for tables.

**Spacing.** Fluid tokens between blocks; inside components a fixed 4 px grid (Tailwind's default `1 = 4px`).

**Dark and high contrast.** Every new token gets a dark value and, where it carries text or a boundary, a
`data-contrast="more"` value. The `/desk/ui-kit` page shows each component in light / dark / high contrast side by
side; `p2.foundation.mjs` runs axe on all three.

### 2.2 Density

Two modes, already wired (`useDensity()`, `<html data-density>`): **Comfortable** (default for the new layout:
40 px controls, 44 px rows) and **Compact** (Desk-like: 28 / 30 px). Touch screens keep 40 px targets even in compact
(`@media (pointer: coarse)`, already in CSS). Rule for new components: heights and paddings come only from
`--density-*` tokens, so a component never needs a `density` prop.

### 2.3 Motion

| Use | Duration | Easing |
|---|---|---|
| Hover, press, toggle | `--duration-instant` 80 ms | standard |
| Menus, popovers, tooltips | `--duration-fast` 140 ms | enter / exit |
| Side panel, bottom sheet, rail | `--duration-base` 220 ms | enter / exit |
| Page-level (dashboard card move) | `--duration-slow` 320 ms | standard |

Only `transform` and `opacity` animate. Reduced motion collapses all to 0 (already). No animation on data that
changes (numbers, rows): they update in place.

### 2.4 Icons

- `lucide-react` for UI chrome (already used). Sizes: 16 px default, 14 px in compact rows, 20 px in nav, 24 px in the
  phone bottom nav. Stroke 1.75.
- Workspace / module / desktop icons come from the **site** (Frappe's icon sprite names, `SidebarIcon` in
  `components/DeskSidebar.tsx`), never replaced by lucide guesses.
- An icon-only button always has `aria-label` and a tooltip with the shortcut (`Kbd`).
- The assistant uses lucide `Sparkles`; nothing else does.

### 2.5 Component inventory

Existing (keep, extend where noted):

| Component | Where | Notes |
|---|---|---|
| Button, Input, Textarea, Select, Checkbox, Label, Dialog, DropdownMenu, Popover, Tabs, Card, Badge, Avatar, Calendar | `components/shadcn/*` | Base layer. Button gets variants `primary / secondary / ghost / danger / link` and sizes from density |
| PageHeader, Section, StatusPill, EmptyState, SidePanel, BottomBar, Stepper, LayoutSwitch, DensitySwitch | `components/crema-ui/*` | SidePanel is **modal** (`aria-modal`, focus trap). Keep it for phone sheets and short edits; the docked right panel is a new non-modal `Rail` (below) |
| Skeleton | `components/Skeleton.tsx` | Move into `crema-ui/Skeleton.tsx` (re-export from the old path) |
| CommandPalette (cmdk) | `components/CommandPalette.tsx` | Extended in PR 10 |
| Toasts (`sonner`) | `lib/frappe/errors.ts` `toastError` | Wrap as `crema-ui/Toast` |

To add (each one file in `components/crema-ui/`, exported from `index.ts`, shown in `/desk/ui-kit`):

| Component | Purpose | Built on | First used in |
|---|---|---|---|
| `Rail` | Docked, non-modal right region with tabs (Preview / Assistant / Activity), resizer, overlay mode under the dock threshold | new; resize ported from Desk `ui/side_panel.js` `setup_resize` | PR 1 |
| `Resizer` | `role="separator"` drag + arrow keys, double-click reset | new | PR 1 |
| `Sheet` | Phone bottom sheet with snap points (50 % / 92 %), drag handle, modal | SidePanel's sheet mode, split out | PR 1 |
| `Field` | Label + control + help + error + "required" marker, one layout for every fieldtype; wraps `lib/crema-form` controls without changing them | new | PR 5 |
| `FieldGroup` | Grid of Fields, columns by container width (1/2/3) | new | PR 5 |
| `SummaryCard` | Key facts of a record (§ 4.3) | Card | PR 5 |
| `ErrorSummary` | GOV.UK-style list of errors with links to fields | new | PR 6 |
| `DataTable` | Virtualised table: sticky header + first column, resize, sort, selection, keyboard grid, inline edit cell slot, row → card under 640 px | `@tanstack/react-virtual` (§ 6.4) | PR 7 |
| `Toolbar` | Row of actions with overflow into "More" by container width | new | PR 7 |
| `FilterChip` / `FilterBar` | Chip per filter, popover editor, "Clear all" | Popover + existing `components/list/FilterEditor.tsx` | PR 7 |
| `ViewTabs` | Saved views as tabs, overflow menu, "+ Save view" | Tabs | PR 7 |
| `BulkBar` | Sticky bottom bar when rows are selected | BottomBar | PR 7 |
| `InlineEdit` | Click / Enter to edit a cell, Esc cancels, Enter saves | Field | PR 7 |
| `Toast` | Success / undo / error toasts, `aria-live` | sonner | PR 1 |
| `Tooltip` + `Kbd` | Tooltip with shortcut keys shown in the OS form (⌘ / Ctrl) — as Desk `ui/components/tooltip.js` | `@radix-ui/react-tooltip` | PR 1 |
| `Banner` | Page / form-level notice (info, warning, danger) | new | PR 5 |
| `NumberCard`, `ChartCard` | Dashboard cards on the site's Number Card / Dashboard Chart | existing `components/desk/Widgets.tsx`, `DeskChart.tsx` | PR 2b |
| `CardGrid` | Draggable / resizable grid with keyboard move | `@dnd-kit` (already a dependency) | PR 2b |
| `SegmentedControl`, `Switch`, `Progress`, `ScrollArea` | small primitives | Radix (installed) | as needed |
| `ChatMessage`, `ToolLine`, `ConfirmCard`, `ContextChip`, `Composer` | Assistant parts (§ 5) | new | PR 4a/4b |

Naming and layout rules:

- Primitives: `components/crema-ui/<PascalCase>.tsx`, no data fetching, no Frappe imports.
- Screens: `components/phase2/<screen>/` (like `phase2/home`), one folder per screen: `<Screen>View.tsx` (layout),
  parts, `use<Thing>.ts` hooks, `api.ts`. A screen reuses the classic screen's hooks (`useDocForm`, `useListRows`, …)
  rather than copying them, so behaviour cannot drift.
- Route files pick the layout: `newLayout ? <NewX/> : <ClassicX/>` at the top of the existing route component;
  no new URLs for the same thing.
- Props: `variant`, `tone` (status), `size` only where density does not decide; booleans named `isX` only for state.
- Every primitive has an entry in `/desk/ui-kit` with light / dark / high-contrast and keyboard notes.

---

## 3. App shell and navigation

Today: `components/CremaShell.tsx` (client component, header 48 px, sidebar 220 px, main capped at 1290 px unless
"Full width"), `DeskSidebar.tsx`, `Breadcrumbs.tsx`, `NotificationsPanel.tsx`, `desk/UserMenu.tsx`,
`CommandPalette.tsx`. Desk sources: `ui/toolbar/navbar.html`, `toolbar.js`, `ui/sidebar/*`, `ui/keyboard.js`.

### 3.1 Header (48 px, sticky)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ☰  [logo] App ▾ │ Selling › Sales Order › SO-0042        [ 🔍 Search or ask…  ⌘K ]  ✦  🔔3  (AN)│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
  sidebar  app switcher  breadcrumbs (truncate middle)     search trigger (opens ⌘K)   AI bell  user
```

- **App switcher** (`App ▾`): installed apps from boot `app_data` (as today). The logo is the site's `app_logo`
  (Navbar Settings), so a white-label app keeps its brand.
- **Breadcrumbs:** module › DocType › record, truncating the middle item first; on phones only the parent ("‹ Sales
  Order") shows as a back link.
- **Search trigger** is a button that looks like a field and opens ⌘K (§ 4.8). Placeholder "Search or ask…" only when
  the assistant is available to the user, else "Search…".
- **✦ Assistant** toggle (§ 5). **Bell** opens notifications in a popover (desktop) / sheet (phone), tabs as Desk
  `ui/notifications/notifications.js` (Notifications, Today's Events). **Avatar** opens the user menu.
- Theme switcher moves from the header into the user menu (one icon fewer); `shift+mod+g` stays.

### 3.2 Sidebar

```
expanded (240)            rail (56)
┌───────────────────┐     ┌────┐
│ ⌂ Home            │     │ ⌂  │
│ ✓ My work      4  │     │ ✓• │
│ ───────────────── │     │ ── │
│ ★ Pinned          │     │ ★  │
│   Sales Order     │     │    │
│   Stock Balance   │     │    │
│ ───────────────── │     │ ── │
│ Selling        ▸  │     │ 🛒 │
│ Buying         ▸  │     │ 📦 │
│ Stock          ▾  │     │    │
│   Item            │     │    │
│   Stock Entry     │     │    │
│ ───────────────── │     │ ── │
│ ⚙ Settings        │     │ ⚙  │
│ «  Collapse  ⌘/   │     │ »  │
└───────────────────┘     └────┘
```

- Content: Home, My work (with count of items waiting on me), **Pinned** (user's own, max 10, drag to order, stored in
  UI prefs), then the workspace / module tree exactly as today (`module_sidebars` from boot; Desk `ui/sidebar/*`), then
  Settings.
- **Pin:** a ☆ on every list / report / workspace header and in each sidebar item's hover menu.
- **Collapse** (`mod+/`, already bound) toggles 240 ↔ 56 px rail; rail items show a tooltip and open a flyout for
  children. State per user in UI prefs.
- Module switcher = the app switcher in the header; the sidebar shows the current app's modules (Desk v16 behaviour).

### 3.3 User menu

Avatar → My settings (§ 4.9), Appearance (theme, density, high contrast, **New layout** switch — the existing
`LayoutSwitch`), Keyboard shortcuts (`ShortcutsDialog`), Session defaults, Toggle full width (classic only), About,
Classic Desk (opens `/desk` on the site), Log out. Same items as Desk `ui/toolbar/navbar.html` plus Appearance.

### 3.4 Layout by width

**Full use of large screens is a top priority** (owner, 2026-11-26). Desk, and Crema today, cap content at ~1290 px
(`CremaShell.tsx` `max-w-[1290px]`, Desk `variables.scss` `$container-max-widths`), so most of a 1600–2560 px monitor
is empty. The new layout is **fluid to 100 % of the window** and fills extra width by **adding panes and columns,
never by stretching controls or text**. That is what makes it easier, not just denser:

1. **Add panes before widening anything**: filters / group-by pane on the left of a list, record preview or Activity
   on the right, the assistant docked. More context visible = fewer clicks and page changes.
2. **Add columns by container width**: dashboard grid 4 → 6 → 8 → 12 card columns; form sections 1 → 2 → 3 columns
   (container queries, so a docked panel automatically reduces columns).
3. **Never stretch a control**: an input is at most 32 rem (448 px) wide (`--field-max`); a section's columns get
   gaps, not wider fields. Numbers keep `tabular-nums` and right alignment.
4. **Keep reading length**: prose (descriptions, help, comments, AI answers) is capped at `--measure` (75ch).
5. **Same targets and type**: font size and hit areas don't grow or shrink with width (only headings' `clamp()`);
   density stays the user's choice.
6. **Panes are optional and remembered**: each pane has a toggle in the toolbar (and a shortcut); open/closed and
   widths are saved per user per screen type in UI prefs, so a user who doesn't want three panes gets one.

Breakpoints: phone < 640, tablet 640–1023, laptop 1024–1279, desktop 1280–1599, wide 1600–1919, full-HD 1920–2239,
ultra ≥ 2240. Right panel ("rail", § 3.5) default 400 px, user-resizable 340 – min(640, 45 vw).

| Width | Header | Sidebar | Content | Right panel | Bottom nav |
|---|---|---|---|---|---|
| **390** (phone) | 48 px: ☰, title / back, ✦, avatar | hidden; ☰ opens it as a modal sheet from the left | full width, 16 px gutter, one column; lists as cards | `Sheet` (modal bottom sheet) | yes, 56 px + safe area |
| **768** (tablet) | full header, search icon only | rail 56 px; tap expands as overlay | fluid; forms 1–2 columns; dashboard 2 card columns | overlay drawer from the right, no dim, Esc closes | no |
| **1280** (desktop) | full, search field 320 px | 240 px; auto-collapses to 56 px while the right panel is open | fluid (no 1290 cap); forms 2 columns; dashboard 4 columns | docked (pushes content) when content keeps ≥ 760 px, else overlay | no |
| **1600** (wide) | full, search 400 px | 240 px | list + preview by default; forms 2–3 columns (container ≥ 1100 px); dashboard 6 columns | docked; list Preview and form Activity open by default | no |
| **1920** (full HD) | full, search 480 px | 240 px | list: filters pane (260) + table + preview; form: section outline (200) + 3 columns + Activity; dashboard 8 columns + My work column | docked 400–480 | no |
| **2560** (ultra) | full | 240 px (or 56 rail by choice) | list: filters + table + preview 520; form: outline + 3 columns (fields capped) + Activity + assistant both docked possible (two rails, § 3.5); dashboard 12 columns | docked, default 480 | no |

Dock rule (one function, `lib/ui/rail.ts`): `dock = viewport − sidebar(collapsed if needed) − railWidth ≥ 760`.
At 1280 the sidebar collapses to its rail while the right panel is open and restores when it closes (Linear and
Frappe CRM both trade the left nav for the detail pane at this width).

Left panes (list filters, form outline) appear only when `viewport ≥ 1920` **and** the content area keeps ≥ 900 px
after the right panel; below that they live in a popover ("Filters", "Jump to section ⌘J").

### 3.5 The right panel ("Rail")

One right region for the whole app, so preview, assistant and activity never stack:

```
┌─ Rail ───────────────────────────── ↔ ┐
│ [Preview] [✦ Assistant •] [Activity]  │  ← tabs only when >1 is open; • = working / needs you
│ ───────────────────────────────────── │
│  (active tab content)                 │
└───────────────────────────────────────┘
```

- **One visible at a time, tabs keep the others alive.** Opening a preview while the assistant is open switches to
  the Preview tab; the conversation and any streaming answer continue, and its tab shows a dot (working) or a
  badge (waiting for your confirmation). Closing a tab closes that view; closing the last closes the rail.
- **Exception at ≥ 2240 px:** the user may drag the Assistant tab out into a second docked column ("Show side by
  side"), so a record's Activity / Preview and the assistant are both visible. Only when content keeps ≥ 1100 px; the
  choice is remembered. Never more than two right columns.
- **Desktop docked:** `<aside role="complementary" aria-label="…">`, non-modal, no focus trap. F6 / Shift+F6 move
  focus between header, sidebar, main and rail (the Microsoft 365 pane convention).
- **Overlay (640–dock threshold):** same component floating over main with `--elevation-4`, no backdrop, still
  non-modal; Esc closes; clicking in main does **not** close it (the user may be copying from the page) except the
  Preview tab, which closes on click-away like Desk's drawer.
- **Phone:** each view opens as a `Sheet`; no tabs.
- Width is one value for the rail, saved in UI prefs (Desk stores `side_panel_width` in localStorage —
  `ui/side_panel.js`); double-click on the resizer resets it.

### 3.6 Phone bottom nav

```
┌────────┬────────┬────────┬────────┬────────┐
│   ⌂    │   🔍   │   ＋   │   🔔   │   👤   │
│  Home  │ Search │ Create │ Alerts │   Me   │
└────────┴────────┴────────┴────────┴────────┘
```

- 56 px + `env(safe-area-inset-bottom)`, labels always shown (Material 3 navigation bar), 48 px targets.
- Create opens a sheet: "New <current DocType>" first, then the user's 5 most created DocTypes (from `Version` /
  recent docs), then "Other…" (DocType search).
- Hidden while the on-screen keyboard is up (`visualViewport` height drop) and on full-screen builders.
- A form's sticky action bar (`BottomBar`) sits **above** the bottom nav, never under it.

### 3.7 Keyboard (global)

Kept from Desk (`ui/keyboard.js`, `form/toolbar.js`) and already bound in `CremaShell`: `mod+k` / `mod+g` search,
`mod+/` sidebar, `mod+s` save, `shift+mod+g` theme, `shift+mod+r` reload, `mod+j` jump to field, `mod+b` new (lists).
New: `mod+i` assistant (§ 5.2), `F6` region cycle, `[` / `]` previous / next record in preview and forms (Desk uses
`ctrl+<` / `ctrl+>` for previous / next — both stay), `?` (outside inputs) shortcuts dialog, `mod+.` toggle the
right panel, `mod+shift+.` toggle the left pane (list filters / form outline).

### 3.8 Wide screens: home, list and form at 1920+ px

**Home at 1920** (8 card columns + a fixed My work column; at 2560 the grid has 12 columns and charts get 6):

```
┌ header ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
├ sidebar 240 ┬ My work 360 ──────────────┬ Dashboard grid (8 cols) ─────────────────────────────────────────────────────────┤
│ ⌂ Home      │ Waiting on me (4)         │ Selling ▾  Good morning, Asha                    🔍 Filter this page…  [Edit ✎]  │
│ ✓ My work 4 │ ● SO-0042 Approve   2h    │ ┌ Sales ─┐┌ Orders ┐┌ To del ┐┌ Overdue┐┌ AR ────┐┌ Margin ┐┌ Returns┐┌ New cus┐  │
│ ★ Pinned    │ ● PI-0101 Review    1d    │ │ 1.2M ▲ ││ 38   ▼ ││ 12     ││ 3   ⚠  ││ 4.5M   ││ 21 %   ││ 4.1 %  ││ 9      │  │
│   …         │ ToDos (3)                 │ └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘└────────┘└────────┘  │
│ Selling     │ ○ Call Ravi        today  │ ┌ Sales trend (12 mo) ─────────────────────┐┌ Top customers ──────────────────────┐ │
│ Buying      │ My drafts (5)             │ │ ▁▂▃▅▆▇█▇▆▅▆▇                              ││ Acme ███████████  1.1M               │ │
│ Stock       │ ◌ SINV-0110 Acme  1h      │ └──────────────────────────────────────────┘└──────────────────────────────────────┘ │
│ Accounts    │ Recent                    │ ┌ Quick list: Overdue invoices ────────────┐┌ Shortcuts ──────────────────────────┐ │
│ …           │ SO-0042 · Item ABC · …    │ │ SINV-0091 Acme 12,000 31 d               ││ + Sales Order  + Customer  Stock Bal │ │
│ ⚙ Settings  │ [Ask anything… ✦]         │ └──────────────────────────────────────────┘└──────────────────────────────────────┘ │
└─────────────┴───────────────────────────┴──────────────────────────────────────────────────────────────────────────────────┘
```

**List at 1920** (filters pane + table + preview; each pane toggles; ↑/↓ moves the preview):

```
├ sidebar ┬ Filters 260 ────────┬ Sales Order ☆  [All][My open][To deliver 12][Overdue 3][+] ─┬ Preview 480 ────────────┤
│         │ Status              │ 🔍 Search…  [Customer: Acme ✕] +Filter    Sort ▾  ⚙  [+ New]  │ SO-0042   ↗  ✕          │
│         │ ☑ To Deliver   12   │ ☐ ID       Customer   Status        Date    Delivery  Total    │ ● To Deliver and Bill    │
│         │ ☐ Draft         4   │ ☐ SO-0042▸ Acme       ● To deliver  12 Nov  20 Nov   24,500   │ Acme · 12 Nov · 24,500   │
│         │ ☐ Completed   140   │ ☐ SO-0041  Zen Ltd    ● Draft       11 Nov  18 Nov    8,000   │ Items (3)                │
│         │ Customer            │ ☐ SO-0040  Acme       ● Completed   10 Nov  15 Nov   12,100   │  ABC × 10   5,000        │
│         │ Acme           31   │  … (more columns shown because width allows: the DocType's     │ Activity · 2 comments    │
│         │ Zen Ltd        12   │   in_list_view fields first, then the user's extra columns)     │ [Create ▾] [Open page]   │
│         │ Assigned to · Tags  │ 1–50 of 1,204                                     ‹ ›           │                          │
└─────────┴─────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────────┘
```
The filters pane is the Desk list sidebar's group-by counts (`list/list_sidebar_group_by.js`, `list_sidebar_stat.html`)
as checkable facets plus the standard filters; it writes the same filters as the chips (one source of truth).

**Form at 1920** (section outline + 3-column sections with capped fields + Activity docked):

```
├ sidebar ┬ Outline 200 ───┬ ‹ Sales Order  SO-0042 ✎  ● To Deliver and Bill  ‹ ›   [Create ▾][⋯] [Submit] ┬ Activity 440 ────────┤
│         │ Summary        │ ┌ Summary ───────────────────────────────────────────────────────────────┐ │ [Activity][Info]     │
│         │ ▌Customer      │ │ Customer Acme ↗   Date 12 Nov   Delivery 20 Nov   Total 24,500.00      │ │ Today                │
│         │ Items (3) ⚠    │ └────────────────────────────────────────────────────────────────────────┘ │  AN changed Delivery │
│         │ Taxes          │ ┌ Customer ──────────────────────────────────────────────────────────────┐ │  12 Nov → 20 Nov     │
│         │ Totals         │ │ Customer*  [Acme Corp     ]  Order type [Sales ▾]  PO no. [      ]     │ │ Yesterday            │
│         │ Terms          │ │ Date*      [12-11-2026    ]  Delivery*  [20-11-26]  Currency [NPR ▾]   │ │  Created by AN       │
│         │ More fields 14 │ └────────────────────────────────────────────────────────────────────────┘ │                      │
│         │                │ ┌ Items ──────── full-width grid: all in_list_view columns + 3 more ──────┐ │ ┌ Comment… ───────┐ │
│         │                │ └────────────────────────────────────────────────────────────────────────┘ │ └──────────────────┘ │
└─────────┴────────────────┴───────────────────────────────────────────────────────────────────────────┴──────────────────────┘
```
- Outline = the form's tabs and sections as anchors (scroll-spy, ⚠ on sections with errors); `mod+J` (Desk "Jump to
  field") also jumps here. Below 1920 it is the "Jump to section" popover.
- Grids are full width of the content column and show more columns as width allows (Desk v16 picks visible
  columns in `form/grid.js` `setup_visible_columns` with static pixel widths; the new layout keeps that order and
  adds columns while they fit; the user's column settings still win).
- At 2560 the assistant can dock beside Activity (§ 3.5 exception).

Suite: `e2e/p2.widths.mjs` screenshots home / list / form at 1280, 1600, 1920 and 2560 and asserts: no horizontal
scroll, no input wider than `--field-max`, prose ≤ 75ch, panes remembered after reload.

---

## 4. Screens

Each spec lists: layout, behaviour to port (with Desk source), states, and the suite. Wireframes: desktop at 1600,
phone at 390.

### 4.1 Home / dashboard (GAPS 3.7; `/desk`)

**Which home opens.** In this order, as Desk does (`frappe/apps.py` `get_default_path`, `frappe/boot.py` `app_home`
hook, user `default_workspace`):
1. User's `default_app` → that app's `app_home` route; 2. System Settings `default_app`; 3. the user's default
workspace; 4. the Crema dashboard below. If the resolved route is a Desk workspace, Crema shows the dashboard **built
from that workspace** (its number cards, charts, shortcuts, quick lists) plus My work. If it is an app route outside
Desk (`/helpdesk`, a white-label app's page), Crema navigates there (passthrough, as today). Classic `/desk` keeps the
current apps grid.

```
desktop 1600
┌ header ─────────────────────────────────────────────────────────────────────────────────────┐
├ sidebar ┬─────────────────────────────────────────────────────────────────────────────────────┤
│         │ Good morning, Asha                                   [Selling ▾ workspace] [Edit ✎] │
│         │ ┌ Waiting on me (4) ───────────┐ ┌ Number ┐ ┌ Number ┐ ┌ Number ┐ ┌ Number ┐       │
│         │ │ ● SO-0042 Approve  Acme  2h  │ │ 1.2M   │ │ 38     │ │ 12     │ │ 4.1%   │       │
│         │ │ ● PI-0101 Review   Zen   1d  │ │ Sales  │ │ Orders │ │ To     │ │ Returns│       │
│         │ │ ○ ToDo: call Ravi        3d  │ │ ▲ 8%   │ │ ▼ 2    │ │ deliver│ │        │       │
│         │ │            See all in My work│ └────────┘ └────────┘ └────────┘ └────────┘       │
│         │ └──────────────────────────────┘ ┌ Chart: Sales trend (12 mo) ───────────────────┐ │
│         │ ┌ Shortcuts ───────────────────┐ │  ▁▂▃▅▆▇█▇▆                                     │ │
│         │ │ + Sales Order  + Customer    │ │                         [This year ▾] [⋯]      │ │
│         │ │ Stock Balance  AR report     │ └────────────────────────────────────────────────┘ │
│         │ └──────────────────────────────┘ ┌ Quick list: Overdue invoices ─────────────────┐ │
│         │ ┌ Recent ──────────────────────┐ │ SINV-0091  Acme   12,000  31 days             │ │
│         │ │ SO-0042, Item ABC, …         │ │ …                                              │ │
│         │ └──────────────────────────────┘ └────────────────────────────────────────────────┘ │
└─────────┴─────────────────────────────────────────────────────────────────────────────────────┘

phone 390
┌──────────────────────────┐
│ ☰  Home          ✦  (AN) │
│ Waiting on me (4)      › │
│ ● SO-0042 Approve    2h  │
│ ● PI-0101 Review     1d  │
│ ┌ 1.2M ─┐ ┌ 38 ───┐  ←→  │  number cards scroll horizontally (snap)
│ │ Sales │ │ Orders│      │
│ Sales trend  ▁▂▃▅▆▇█     │
│ Shortcuts (2 × n grid)   │
│ Recent                   │
├──────────────────────────┤
│ ⌂   🔍   ＋   🔔   👤    │
└──────────────────────────┘
```

**Learned from a white-label app's desk home.** A white-label Frappe app on the local bench replaces `/desk` with its
own home (`app_home = "desk"` in `hooks.py`, a `www/desk.py` context that loads the data server-side, a client
renderer in `public/js/*_dashboard.js`, tokens in `public/css/*/_tokens.scss`). What it does well, and how Crema
adopts each point **generically**:

| It does well | How it does it (there) | Crema adopts it as (no per-app code) |
|---|---|---|
| Home is fast and complete on first paint | Data loaded in the page context on the server (`www/desk.py` → `get_desk_dashboard_data`), cached 60 s per user | Home is a Server Component fed by one batched call (S3), cached per user 60 s on the Next server; skeleton only for slow cards |
| A greeting with the user's role context ("Sales command center") | Guesses a profile from role names containing "sales", "purchase", … | Title = the resolved workspace's title ("Selling") and the user's first name; no role-name guessing |
| A row of clickable KPI cards that lead to lists | Counts of open / overdue ToDos, unread notifications, drafts / pending / approved | Row 1 = **My work counts** (waiting on me, overdue ToDos, my drafts, unread notifications), each a link to the filtered list; then the workspace's own Number Cards. Vanity counts (number of workspaces, number of shortcuts) are not shown |
| "Your recent documents" with a clear status | Recent docs with a status label from `workflow_state` → `status` → `docstatus`, and a tone | Same order of precedence for the label (it matches Desk's `frappe.get_indicator`), StatusPill tones; doctypes come from the user's recent activity, not a fixed list |
| Recent activity feed | Activity Log for the user, last 30 days | "Recent" card from the user's Activity Log / Version entries, grouped by day |
| Workspace map grouped by module with counts | Public workspaces grouped by `module` | "All workspaces" card (collapsed by default) from boot `workspaces` / `module_sidebars`, grouped by module, permission-filtered as Desk does |
| Quick jumps | A fixed list of six DocTypes | Workspace shortcuts + the user's pinned items (§ 3.2) + "New <DocType>" for the 4 DocTypes the user creates most |
| Type-to-filter on the home itself, ⌘K for global search | A search field that hides non-matching tiles instantly; Ctrl+K opens Desk's awesomebar | "Filter this page…" field in the home header filters cards and lists client-side; Enter or ⌘K hands the text to ⌘K (§ 4.8) |
| Branding everywhere | `app_logo_url`, splash image, brand tokens (primary green scale, warm neutrals, low green-tinted shadows), theme synced to `User.desk_theme` | Logo from Navbar Settings / `app_logo_url` hook (boot), accent token from the site (§ 9 Q3), theme stored in `User.desk_theme` as Desk does; the token file is the only place a brand changes |
| Sidebar that collapses to a rail; mobile drawer | Custom sidebar, 52 px collapsed | Same pattern (§ 3.2) |

Not adopted: hard-coded DocType lists and routes, role-name keyword matching, emoji icons, `!important` overrides of
Desk CSS, and metrics computed from only the last few recent documents (they look like KPIs but aren't).

- **Grid:** `CardGrid`, 12 columns; card spans 3 (number), 6 (chart / list), 12 (wide chart). Columns collapse 12 → 6 →
  1 by container width. On wide screens the grid **adds** card columns rather than widening cards: number cards are
  ≥ 180 px and ≤ 280 px wide, so 1280 shows 4 per row, 1600 six, 1920 eight (§ 3.8), 2560 twelve. Card data from the site's own Number Card / Dashboard Chart / workspace quick lists
  (`frappe.desk.doctype.number_card.number_card.get_result`, `dashboard_chart.get`; existing `app/api/desk/number-card`
  and `chart` routes). Date range and filters on the card's ⋯ menu.
- **Edit mode** (Edit ✎): drag to move, handle to resize (1 / 2 / 4 width steps), × to hide, "+ Add card" picks from
  the workspace's cards and the site's Number Cards / Charts the user can read. Keyboard: focus a card, Space to
  pick up, arrows to move, Shift+arrows to resize, Space to drop (WCAG 2.5.7 dragging alternative). Saved per user in
  `user_settings` key `Crema Home:<workspace>`; "Reset to workspace layout".
- **Role layouts:** a System Manager gets "Publish for role…" in edit mode; stored as a `Crema Home:<workspace>` value
  on a role-level default (§ 9 Q2 on storage). User layout wins over role layout.
- **States:** loading = card-shaped skeletons in the saved layout (no shift); a card error shows inside the card
  ("Couldn't load · Retry") — the page never fails as a whole; no permission on a card's DocType → the card is left out.
- Suite: `e2e/p2.home.mjs` (site home respected for user default app / system default app / workspace; pin, move,
  resize saved and reloaded; screenshots 390 / 1280 / 1600 / 2560).

### 4.2 List (`/desk/doctype/[doctype]`; Desk `list/list_view.js`, `base_list.js`, `list_filter.js`, `bulk_operations.js`)

```
desktop 1600 (preview open)
├ sidebar ┬───────────────────────────────────────────────────────┬─ Rail (Preview) ───────────┤
│         │ Sales Order ☆                         [⋯] [+ New ⌘B] │ SO-0042        ↗ open  ✕    │
│         │ [All] [My open] [To deliver 12] [Overdue 3] [+ view] │ ● To Deliver and Bill        │
│         │ 🔍 Search…  [Customer: Acme ✕] [Status: Open ✕] +Filter│ Acme Corp · 12 Nov · 24,500  │
│         │                       Sort: Modified ▾  ⚙ Columns    │ ─────────────────────────── │
│         │ ☐ ID        Customer   Status        Date    Total   │ Items (3)                    │
│         │ ☐ SO-0042 ▸ Acme       ● To deliver  12 Nov  24,500  │  ABC × 10  …                 │
│         │ ☐ SO-0041   Zen Ltd    ● Draft       11 Nov   8,000  │ Delivery 20 Nov              │
│         │ ☐ SO-0040   Acme       ● Completed   10 Nov  12,100  │ ─────────────────────────── │
│         │   …  (virtualised)                                    │ Activity  · 2 comments       │
│         │ 1–20 of 1,204                       [20 ▾] ‹ › Load more│ [Create ▾]  [Open full page] │
└─────────┴───────────────────────────────────────────────────────┴──────────────────────────────┘
           with rows selected the footer becomes the BulkBar:
           │ 3 selected  [Edit] [Assign] [Print] [Submit] [⋯ More]          [Clear ✕] │

phone 390
┌──────────────────────────┐
│ ‹  Sales Order   🔍  ⋯   │
│ [All][My open][To deliver]→
│ [Acme ✕][Open ✕] [+]     │
│ ┌──────────────────────┐ │
│ │ SO-0042   ● To deliver│ │  row = card: title, status, 2–3 list-view fields
│ │ Acme · 12 Nov  24,500 │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ SO-0041   ● Draft     │ │
│ └──────────────────────┘ │
│                    (＋)  │  FAB = New (above bottom nav)
├──────────────────────────┤
│ ⌂   🔍   ＋   🔔   👤    │
└──────────────────────────┘
```

| Element | Decision | Port from / reuse |
|---|---|---|
| Saved views as tabs | Tabs = the user's **pinned** saved layouts (v16 List Filter, already in Crema: `components/list/Layouts.tsx`, `useListLayouts.ts`) + "All". Count badge from `frappe.client.get_count` per tab, lazily after first paint. Overflow → "More views ▾". "+ view" saves current filters / sort / columns | Desk v16 `list_filter.js`; `e2e/listlayouts.mjs` stays green |
| Filters as chips | One chip per filter (`Field op value`), click edits in a popover (`FilterEditor.tsx`), × removes. Standard filters (`in_standard_filter` fields) show as empty chips "Status ▾" ready to fill | `ui/filters/*`, `list_view.js` `setup_filter_area` |
| Search | Searches the DocType's `search_fields` + name (as Desk's list "ID" field + `name` like) | `base_list.js` |
| Preview | Row click on wide (≥ 1600) opens the Rail Preview; ↑/↓ moves the preview, Enter opens full page, Esc closes. On 1280 click opens the page (as now) and Space opens preview. On phones row tap opens the page (Desk disables split view on mobile: `views/reports/link_side_panel.js` `split_view_enabled`) | Behaviour from Desk `ui/side_panel.js` (history / back, close on route change, Esc yields to an open dialog or grid row, "Open in full page", width stored) |
| Bulk bar | Appears at the bottom when ≥ 1 row is checked; actions = Desk's Actions menu for the DocType (edit, assign, apply assignment rule, add tags, print, delete, submit, cancel, export) + `listview_settings` bulk actions (already wired in `ListHooksUI.tsx`) | `list/bulk_operations.js` |
| Inline edit | Double-click / Enter on a cell edits **only** fields that Desk's Report view lets you edit: writable by permlevel, not read-only, not a Table / Text Editor / Attach, docstatus 0 or `allow_on_submit` | `views/reports/report_view.js` (`get_editing_object`, `is_editable`) → `frappe.client.set_value` |
| Row extras | Assignees, comments count, like, unread bold (done in M5) | `RowExtras.tsx` |
| Group-by sidebar | Becomes the left **Filters pane** (facets with counts) at ≥ 1920 (§ 3.8); below that a "Filters" popover with the same facets | `list_sidebar_group_by.js` |
| Empty | No records: illustration-free `EmptyState` "No Sales Orders yet" + [New Sales Order] + [Import] (Data Import, if permitted). No match: "No Sales Orders match these filters" + [Clear filters] | `list_view.js` `get_no_result_message` (wording) |
| Loading | 8 skeleton rows at row height; header and tabs real immediately (from meta) | — |
| Error | Inline banner above the table with the server message + Retry; the toolbar stays usable | — |

Suites: `e2e/p2.list.mjs` (tabs from saved layouts, chip add / edit / remove, preview ↑↓ Enter Esc, inline edit saved
and verified via API, bulk submit 2 drafts, phone cards), plus classic `list.salesorder`, `listlayouts`, `bulk`,
`listhooks`, `listrowextras` with `NEW_LAYOUT=1`.

### 4.3 Form (`/desk/doctype/[doctype]/[name]`; Desk `form/form.js`, `toolbar.js`, `layout.js`, `save.js`)

```
desktop 1600
├ sidebar ┬────────────────────────────────────────────────────────────┬─ Rail (Activity) ──────┤
│         │ ‹ Sales Order  SO-0042 ✎   ● To Deliver and Bill   ‹ ›     │ [Activity][Info]        │
│         │ Draft ─● Submitted ─○ Delivered ─○ Billed  (workflow bar)  │ Filter: All ▾           │
│         │                         [Create ▾] [⋯]   [ Submit ]        │ Today                   │
│         │ ┌ Summary ───────────────────────────────────────────────┐ │  AN edited Delivery date│
│         │ │ Customer Acme Corp ↗   Date 12 Nov   Delivery 20 Nov    │ │  12 Nov → 20 Nov        │
│         │ │ Grand total 24,500.00  Outstanding 24,500.00            │ │  Ravi commented …       │
│         │ └─────────────────────────────────────────────────────────┘ │ Yesterday               │
│         │ [Details] [Address & Contact] [Terms] [More ▾]   (tabs)    │  Created by AN          │
│         │ ┌ Customer ───────────────────────── ▾ ┐                    │                         │
│         │ │ Customer*  [Acme Corp     ]   Order type [Sales ▾]  …     │ ┌ Comment… ───────────┐ │
│         │ └──────────────────────────────────────┘                    │ └─────────────────────┘ │
│         │ ┌ Items ─────────────────────────────── ▾ ┐                 │                         │
│         │ │ grid (§ 4.4)                             │                 │                         │
│         │ │                         Total qty 30  Net 22,000        │                         │
│         │ └──────────────────────────────────────────┘                │                         │
│         │ ▸ Taxes (2)       ▸ More fields (14 empty)                  │                         │
└─────────┴────────────────────────────────────────────────────────────┴─────────────────────────┘
  unsaved: ┌ ● Unsaved changes          [Discard]  [Save ⌘S] ┐  sticky bottom bar, replaces "Not Saved"

phone 390
┌──────────────────────────┐
│ ‹ Sales Order        ⋯   │
│ SO-0042                  │
│ ● To Deliver and Bill    │
│ ┌ Acme Corp · 24,500 ──┐ │  summary card (2 lines)
│ │ 12 Nov → 20 Nov      │ │
│ └──────────────────────┘ │
│ [Details][Terms][More]→  │
│ Customer*                │
│ [Acme Corp           ▾]  │
│ Items (3)              › │  grid as cards (§ 4.4)
│ ▸ Taxes  ▸ More fields   │
│ Activity (5)           › │  opens a sheet
├──────────────────────────┤
│ [Create ▾]   [ Submit ]  │  BottomBar (primary on the right)
├──────────────────────────┤
│ ⌂   🔍   ＋   🔔   👤    │
└──────────────────────────┘
```

| Element | Decision | Port from |
|---|---|---|
| Sticky header | Title (editable via ✎ when `title_field` is editable — already done in M1), status `StatusPill` from `frappe.get_indicator` (same function as classic), previous / next, workflow bar under the title (M2 `WorkflowBar.tsx`) | `form/toolbar.js` `set_title`, `set_indicator`; `form/workflow.js` |
| One primary action | Exactly the button Desk makes primary (`toolbar.js` `set_primary_action`: Save / Submit / Update / workflow action / custom primary set by script). Everything else (Create ▾, Actions, script buttons via `frm.add_custom_button` groups) goes into "Create ▾" and "⋯" menus, grouped as Desk groups them | `form/toolbar.js` |
| Summary card | Up to 6 facts, chosen from meta, no per-DocType code: fields with `in_preview` (Desk link preview uses the same flag, `ui/link_preview.js`), else `bold` + `in_list_view` fields; currency / total fields right-aligned, tabular. Hidden on new docs until a value exists | `ui/link_preview.js`, meta |
| Sections as cards | Each Section Break = a card with its label, collapsible when `collapsible` (Desk rule, kept). Empty optional sections collapse by default; all empty non-mandatory fields of a section collapse into "More fields (n)" when a section has > 6 empty optional fields (§ 3.1 rule 2). `depends_on` / `mandatory_depends_on` / permlevel evaluated exactly as today (`lib/crema-form`, GAPS 2.15) | `form/layout.js`, `section.js` |
| Tabs | Tab Breaks as tabs (as Desk); > 4 tabs → overflow "More ▾"; tab with an error shows a red dot + count | `form/tab.js` |
| Columns | DocType's Column Breaks are the minimum; at container ≥ 1100 px a 2-column section may flow into 3 only if it has ≥ 9 fields (keeps the author's grouping) | `form/column.js` |
| Errors | On a failed save: `ErrorSummary` at the top ("There are 2 problems": links that focus the field), the tab dot, and the message under each field. Server validation messages (`frappe.throw`) stay Desk's dialog (`frappe.msgprint`) because scripts depend on it; mandatory errors use the summary | `form/save.js` `check_mandatory`, `validate_form` |
| Autosave | **No silent server save** (behaviour stays Desk's). Unsaved field changes are kept in IndexedDB per user + doc every 2 s; on reopen a `Banner` offers "Restore unsaved changes from 10:42 · Discard". Cleared on save | Desk has none; new, client-only |
| Unsaved bar | Sticky bottom bar with Discard / Save when the doc is dirty (replaces the small "Not Saved" pill); on phones it merges into the BottomBar | `form/form.js` `dirty` |
| Right panel | ≥ 1600: Rail opens on "Activity" by default (timeline + comment box) and "Info" (assigned, tags, attachments, shared, created / modified, followers — today's `FormSidebar.tsx`). 1280–1599: Activity stays below the form (Desk position) with "Open beside ⇥" | `form/sidebar/*`, `form/footer/*` |
| Dashboard / connections | Stays under the summary as a collapsible "Connections (12)" card | `form/dashboard.js` (`Connections.tsx`) |
| Success action | After submit, toast "Sales Order submitted · Create Delivery Note · Print" from the Success Action DocType | `form/success_action.js` (GAPS 2.1 [P2]) |
| Undo | `mod+z` / `mod+y` on field changes, toast "Changed Delivery date · Undo" | `form/undo_manager.js` |

New form, quick entry: a Link's "+ Create" and "New" from a list open Desk's quick entry dialog when the DocType has
`quick_entry` and ≤ the mandatory rule (`form/quick_entry.js`, `QuickEntry.tsx`) — unchanged, restyled with `Field`.

States: loading = header with title from the URL + summary/section skeletons in the DocType's section count (meta is
cached), then values; server first paint in PR 14 makes this mostly invisible. Not permitted / not found = full
`EmptyState` with the Desk wording (M1).

Suites: `e2e/p2.form.mjs` (primary action matches Desk for draft / submitted / workflow states; error summary links
focus; restore unsaved; summary card fields from `in_preview`), plus `formsave`, `form.salesorder`, `workflow`,
`formmenu`, `formnav` with `NEW_LAYOUT=1`.

### 4.4 Child table (Desk `form/grid.js`, `grid_row.js`, `grid_row_form.js`)

```
desktop
┌ Items ───────────────────────────────────────────────────────── [Add multiple] [⚙] ┐
│ #  Item code ▾       Qty    Rate      Amount     Warehouse          ⋯             │
│ 1  ABC-001 Bolt      10     500.00    5,000.00   Stores - DC        ⋯             │
│ 2  ABC-002 Nut  ▌    20     850.00   17,000.00   Stores - DC        ⋯             │  ▌ = focused cell
│ +  Add row (⌘↵)                                                                    │
│ ───────────────────────────────────────────────────────────────────────────────── │
│    Total             30              22,000.00                                     │  totals row (Currency/Float/Int with non-zero sum)
└────────────────────────────────────────────────────────────────────────────────────┘
row ⋯ → Edit row (opens Rail "Row 2" on ≥ 1280, Sheet on phone), Insert above / below, Duplicate, Move, Delete

phone
┌ Items (2) ────────── + ┐
│ ┌ 1 · ABC-001 Bolt   ⋯ ┐│
│ │ 10 × 500.00 = 5,000  ││
│ │ Stores - DC          ││
│ └──────────────────────┘│
│ Total 30 · 22,000.00    │
└─────────────────────────┘
```

- Keyboard, paste, Add Multiple, column settings, row menu: all done in M3 (`Grid*.tsx`, `useGridKeys.ts`) — reused,
  only styles change.
- Totals row: shown for numeric columns that are `in_list_view`; computed client-side from rows (display only).
- Row details: Desk opens the row form inline (`grid_row_form.js`); the new layout opens it in the Rail on ≥ 1280
  (non-modal, so the grid stays visible), Sheet on phones. Row events (`<child>_add`, field triggers) unchanged.
- Sticky first column + header and drag-resize column edges (GAPS 2.2 [P2], Desk v16): `DataTable` features.
- Suite: `e2e/p2.grid.mjs` + `grid`, `gridkeys`, `gridmulti`, `gridcols`, `gridrows`, `gridmove` with `NEW_LAYOUT=1`.

### 4.5 Timeline (Desk `form/footer/form_timeline.js`, `version_timeline_content_builder.js`)

```
┌ Activity ───────────────────────── [All ▾] ┐   All · Comments · Changes · Emails · Attachments
│ Today                                      │
│ (AN) Asha changed Delivery date            │
│      12 Nov → 20 Nov            10:42  ⋯   │
│ (RV) Ravi: "Can we ship partial?"  09:10   │   comments: reply, edit, delete as Desk
│      ♥ 1   Reply                           │
│ ▸ 4 calculated fields changed              │   collapsed group (GAPS 2.15)
│ Yesterday                                  │
│ ✉  Email to acme@… "Order confirmation"    │
│ ✦  Updated via AI assistant by Asha        │   § 5 note, links to the AI log entry
│ ┌ Write a comment… @mention ───── [Send] ┐ │
└────────────────────────────────────────────┘
```

- Same items and wording as Desk (done in M1, `Timeline.tsx`); new: filter menu, day groups, collapsed runs of
  changes to fields that are read-only / `fetch_from` (system-calculated) into "n calculated fields changed".
- Comment box at the bottom of the Activity tab, `mod+enter` sends (Desk `form/footer/form_timeline.js`).
- Suite: `e2e/p2.timeline.mjs` + `timeline` with `NEW_LAYOUT=1`.

### 4.6 Reports (Desk `views/reports/query_report.js`, `report_view.js`, `report_utils.js`)

```
desktop 1600
│ General Ledger ☆                      [Saved: Q3 Acme ▾] [Export ▾] [⋯]          │
│ [Company: DC ✕] [From 01-07 → 30-09 ✕] [Party: Acme ✕]  [+ More filters (6)]      │
│ ┌ chart (collapsible, remembered) ─────────────────────────────────────────────┐ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ summary cards (report_summary) ───────────────────────────────────────────────┐ │
│ DataTable: sticky header + first col, tree rows, totals row, group-by           │
│ Link cell click → Rail Preview (Desk v16 link_side_panel.js)                    │
```

- Filters: the report's mandatory filters + first 3 others as chips; the rest under "More filters" in the Rail on
  desktop / Sheet on phone. Applying is live as in Desk (`query_report.js` `refresh` on filter change, debounced).
- **Saved filter sets:** stored in the user's report settings (`user_settings` for the report, as Desk's "Save As"
  stores a Report; both offered: "Save filters" (personal, user_settings) and "Save as report" (Desk behaviour,
  `reportsave` suite).
- Chart above the table, collapsible; state remembered. Export menu = Desk's (Excel / CSV, with filters), Print / PDF.
- Column resize / reorder persisted (GAPS 2.6 [P2]).
- Link cells open the record preview on ≥ 1280 (Desk v16 `views/reports/link_side_panel.js`, honouring
  `desk_settings.report_split_view`); the ID column still routes.
- Suites: `e2e/p2.report.mjs` + `report`, `reportview`, `reportgroupby`, `financials` with `NEW_LAYOUT=1`.

### 4.7 Settings pages

Two kinds:
1. **Single DocTypes** (System Settings, Selling Settings, …) render with the form layout plus a "Find a setting"
   search box that filters fields by label / description and expands their sections; left anchor nav of sections at
   ≥ 1280.
2. **My settings** (`/desk/settings`, `SettingsClient.tsx`): a page (not Desk's dialog) with left nav — Profile,
   Appearance (theme, density, contrast, New layout), Email signature, Notifications, Keyboard shortcuts, Assistant
   (§ 5.11), Sessions. Items and saves from Desk v16 `ui/settings_dialog.js` / `user_settings_dialog.bundle.js`.

```
│ My settings                                                                  │
│ ┌──────────────┐ ┌ Appearance ──────────────────────────────────────────┐   │
│ │ Profile      │ │ Theme      (•) Light ( ) Dark ( ) System             │   │
│ │ Appearance ▌ │ │ Density    [Comfortable | Compact]                    │   │
│ │ Email        │ │ Contrast   [ ] High contrast                          │   │
│ │ Notifications│ │ Layout     [■] New layout (beta)                      │   │
│ │ Shortcuts    │ └───────────────────────────────────────────────────────┘   │
│ │ Assistant    │                                                             │
```
Phone: the left nav becomes the first screen; each item pushes a page.

### 4.8 Search (⌘K; Desk `ui/toolbar/awesome_bar.js`, `search_utils.js`, `fuzzy_match.js`)

```
┌ 🔍 sales ord                                              esc ┐
│ Recent                                                        │
│   📄 SO-0042 · Acme · Sales Order                       ↵     │
│ Go to                                                         │
│   ☰ Sales Order list              ☰ Sales Order Analysis      │
│ Create                                                        │
│   ＋ New Sales Order                                   ⌘↵     │
│ Records (global search)                                       │
│   📄 SO-0040 · Acme …                                         │
│ Actions / Settings / Help                                     │
│ ✦ Ask AI: "sales ord"                                  Tab    │   only when the assistant is available
│ Search for "sales ord" in all records →                       │
└───────────────────────────────────────────────────────────────┘
```

- Groups and ranking ported from `search_utils.js` (recent + frequent first, `fuzzy_match.js` scoring); `#tag`
  search; calculator (done, `lib/search/calculator.ts`).
- **Ask AI** row last; **Tab** sends the text to the assistant (Frappe CRM's palette does the same with "Flow":
  `frontend/src/components/CommandPalette/CommandPalette.vue`).
- Full results page `/desk/search?q=` (GAPS 2.8 [P2]).
- Phone: full-screen sheet from the bottom nav "Search".
- Suite: `e2e/p2.search.mjs` + `awesomebar` with `NEW_LAYOUT=1`.

### 4.9 DocType builder (GAPS 3.8; Desk `public/js/form_builder/*`, `core/doctype/doctype/doctype.py`)

Crema already has a visual builder (`components/form/FormBuilder.tsx`, dnd-kit, tabs → sections → columns → fields,
properties panel). Phase 2 wraps it in a guided flow; the canvas is reused.

```
Step 1 · Start (Dialog, ≤ 6 fields)            Step 2 · Fields (full page)
┌ New DocType ───────────────────────┐   ┌ Vehicle  ● Draft (not saved)    [Preview] [Save DocType] ┐
│ Name*      [Vehicle             ]  │   │ ┌ Palette ──┐ ┌ Canvas ─────────────────┐ ┌ Field ─────┐ │
│ Module*    [Fleet            ▾]   │   │ │ Text      │ │ [Details] [+ tab]        │ │ Label      │ │
│ Kind       (•) Records            │   │ │ Number    │ │ ┌ Section ───────────┐   │ │ Plate no.  │ │
│            ( ) Rows of another    │   │ │ Amount    │ │ │ Plate no.*  Owner  │   │ │ Type Text  │ │
│                record (child)     │   │ │ Date      │ │ │ Insurance expiry   │   │ │ ☑ Mandatory│ │
│            ( ) One settings page  │   │ │ Choose one│ │ └────────────────────┘   │ │ ☐ Unique   │ │
│ ☐ Can be submitted (approve/lock) │   │ │ Link to … │ │ + section                │ │ ☑ In list  │ │
│ Naming     [Series ▾] VEH-.#####  │   │ │ Table     │ │                          │ │ ▸ Advanced │ │
│ Example    VEH-00001              │   │ │ Check     │ │                          │ │            │ │
│                   [Cancel] [Next] │   │ └───────────┘ └──────────────────────────┘ └────────────┘ │
└────────────────────────────────────┘   │ ⚠ 1 problem: "Owner" links to "Employe" (no such DocType) │
                                         └───────────────────────────────────────────────────────────┘
Step 3 · Permissions                       Step 4 · Done
│ Role            Read Write Create Submit Cancel Delete │   ✓ Vehicle created
│ System Manager   ☑    ☑     ☑      –      –      ☑     │   [Open the list] [Create first Vehicle]
│ + Add role                                             │   [Add to workspace ▾]
```

| Step | Decision | Port from |
|---|---|---|
| Start | Plain words map to Desk properties: Kind → `istable` / `issingle`; "Can be submitted" → `is_submittable`; Naming → `autoname` (`naming_series:` / `field:x` / `prompt` / `hash` / `autoincrement`) with a live example from `frappe.model.naming` rules | `core/doctype/doctype/doctype.js`, `model/naming.py` |
| Palette | Plain names: Text→Data, Long text→Small Text, Number→Int, Decimal→Float, Amount→Currency, Date, Date & time→Datetime, Choose one→Select, Yes/no→Check, Link to another record→Link, Table of rows→Table, Attachment→Attach, Rich text→Text Editor; "All field types…" shows the raw list | `form_builder/components/Sidebar.vue`, `AddFieldButton.vue` |
| Properties | Essentials (label, type, options as a list editor for Select, target picker for Link / Table), common toggles (mandatory, unique, in list view, in standard filter, read only, default), Advanced (depends on, fetch from, permlevel, …) | `form_builder/components/FieldProperties.vue` |
| Checks | Live, before Save: duplicate / reserved fieldnames, Link / Table target exists, Select has options, Table target is a child DocType, `amended_from` added when submittable, fieldname from label (snake_case) | `form_builder/store.js` `validate_fields`; server `doctype.py` `validate_fields` stays the authority — its message is shown in the ErrorSummary |
| Permissions | Grid of roles × rights; default row: System Manager full + the creator's highest non-admin role read/write/create. Submit/Cancel/Amend only if submittable | `core/doctype/docperm` |
| Done | Links; "Add to workspace" appends a shortcut to a chosen workspace (Workspace save as Desk) | `views/workspace` |
| Customize Form | Same canvas on a standard DocType writes Custom Field + Property Setter through Customize Form (`frappe.custom.doctype.customize_form`); standard fields locked except allowed properties (Desk's `allowed_properties`) | `custom/doctype/customize_form/customize_form.py` |
| Developer mode | Standard DocTypes are never edited unless `developer_mode`; then a warning banner | Desk |

The AI assistant fills this builder as a draft (§ 5.8).
Suite: `e2e/p2.doctypebuilder.mjs` (DocType with a table and a Link, permissions, first record, cleanup), plus
`doctype.create` with `NEW_LAYOUT=1`.

### 4.10 Onboarding (Desk `widgets/onboarding_widget.js`, Module Onboarding, Onboarding Step, `form/form_tour.js`)

- **First-run checklist** on Home for users whose roles have an incomplete Module Onboarding (site data, not Crema's):
  card "Get started with Selling · 3 of 6 done", steps open their action (create / show list / watch video /
  open settings) as Desk's step types do; steps complete on the same server condition.
- **Tours** (Form Tour DocType) run with the existing `driver.js` dependency, started from "⋯ → Take a tour"; never
  automatic after the first visit.
- **Contextual tips**: one dismissible `Banner` per screen for the first visit of the new layout ("Rows open on the
  right — press Enter to open the full page"), dismissal saved in UI prefs.
- Suite: `e2e/p2.onboarding.mjs`.

### 4.11 Empty, loading and error states (all screens)

| State | Rule |
|---|---|
| Loading < 300 ms | Show nothing new (avoid flashes); keep the previous screen |
| Loading ≥ 300 ms | Skeleton in the final layout's shape (row count, section count from cached meta). No spinners except inside buttons (`aria-busy`) |
| Empty (none exist) | `EmptyState`: what it is in one line, primary action (Create), secondary (Import / Learn). No illustrations (weight) |
| Empty (filtered) | "No X match" + Clear filters |
| Error (part) | Inline in the card / table: message from the server (`lib/frappe/errors.ts`), Retry, "Details" (existing `ErrorDetails.tsx`) |
| Error (page) | `app/(desk)/desk/error.tsx` restyled: title, message, Retry, Go home, Report (copy details) |
| Offline | Header banner "You're offline — changes stay on this device until you're back" (drafts only; no offline submit) |
| No permission | Desk wording ("You don't have access to …"), no action except Home / request access contact (System Manager email from boot) |

---

## 5. AI assistant UI

Backend and rules are in [GAPS 3.9](GAPS.md#39-ai-assistant-inside-crema) (Claude via `/api/ai/chat`, tool calls through
Frappe's MCP at `/api/v2/mcp` with the user's session, reads run, creates open a filled form, other writes need a
confirm card, setup goes through builders). This section is the UI.

References studied: Frappe CRM's "Flow" assistant (`frontend/src/components/FlowChat/*` in github.com/frappe/crm —
one shared chat opened from Home and the command palette, approval cards with Approve / Deny / Approve all, chat
history popover with search, states idle / working / needs_you / answered / error, a removable record-context chip);
Microsoft 365 Copilot (chat pane on the right of the document; F6 reaches it —
[support.microsoft.com](https://support.microsoft.com/en-US/Microsoft-365-Copilot/how-copilot-chat-works-in-Microsoft-365-apps));
Notion AI (bottom-right launcher, shortcut ⇧⌘J in the desktop app —
[notion.com help](https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai)); GitHub Copilot Chat and
Intercom Fin (streaming with visible "steps", stop, retry, thumbs feedback).

### 5.1 Where it lives

| Width | Placement | Modal? |
|---|---|---|
| ≥ dock threshold (§ 3.4; in practice ≥ 1280) | **Docked in the Rail** on the right, pushes content; resizable 340 – min(640, 45 vw), default 400 (480 at ≥ 2240) | No. Page stays fully usable — the user can read a record while asking about it |
| 640 – threshold | Rail in **overlay** mode over the right side of main, no dim | No |
| < 640 | **Bottom sheet** (`Sheet`), snap 60 % / 92 %, drag handle; header shows "Assistant ▾" | Yes (focus trapped) |
| ≥ 2240 (opt-in) | Its own docked column beside Preview / Activity ("Show side by side", § 3.5) | No |

Decision vs alternatives: a floating bubble (Notion, Intercom) hides content and fights the form's BottomBar; a full
page loses the context the user is asking about. A docked right pane matches Microsoft 365 Copilot, Frappe CRM's
detail-pane habit and Crema's own preview, and keeps "one right panel" (§ 3.5).

### 5.2 Opening and closing

Open:
- **✦ button** in the header (desktop and phone). Tooltip "Assistant ⌘I".
- **⌘I / Ctrl+I** anywhere, toggles. Exception: when focus is in a rich-text editor (Quill, Desk's
  `form/controls/text_editor.js` binds `ctrl+i` to italic) or a code editor, the editor keeps the key; the tooltip
  there says "Use ⌘K → Ask AI". `mod+i` is not bound elsewhere in Desk (checked in `public/js/frappe/**`).
- **⌘K → "Ask AI: …"** (row or Tab) — opens with the typed text sent.
- **Record "⋯" menu → "Ask AI about this"** and list BulkBar "⋯ → Ask AI about 3 selected" — open with that context
  chip and the cursor in the composer (nothing sent).
- **Home**: an "Ask anything…" composer card at the top of My work when available (Frappe CRM puts Flow on Home).

Close:
- **Esc** when focus is inside the panel and no menu / popover in it is open (that Esc closes the menu first). Esc
  outside the panel does not close it (Esc belongs to dialogs / grid / preview — Desk's side panel rule).
- **✕** in the panel header; **⌘I** again; on phones swipe down past the lower snap point or tap the scrim.
- **Click-away:** docked never closes; overlay never closes on click-away (unlike Preview) because the user often
  copies values from the page into the question.
- **Route change** does **not** close it (unlike Desk's preview, which closes on route change); the context chips
  update to the new page instead.
- Closing while an answer streams lets it finish in the background; the ✦ button shows a dot (working) or a badge
  (needs your confirmation). Stop is explicit (§ 5.6).

Remembered per user (UI prefs `assistant: {open, width, tab}`): open/closed and width on desktop. Phones never
reopen it automatically on load.

Focus: on open, focus goes to the composer (or to the first confirm card's heading if one is waiting). On close,
focus returns to the element that opened it, else to `<main>`.

### 5.3 Panel anatomy

```
desktop, docked (400 px)
┌──────────────────────────────────────────────┐
│ ✦ Assistant   [New chat ✎] [History ⏱] [⋯] ✕ │  ⋯ = Activity log, Settings (admins), What is sent
├──────────────────────────────────────────────┤
│ Earlier today                                │
│                 ┌──────────────────────────┐ │
│                 │ Which sales orders are   │ │  user message, right, muted bubble
│                 │ overdue for delivery?    │ │
│                 │ ⌂ Sales Order list · 2 ⚲ │ │  chips that were attached, small
│                 └──────────────────────────┘ │
│ ✓ Listed Sales Orders (delivery < today) ▸   │  tool line, collapsed
│ ✓ Counted 7 results                       ▸  │
│ 7 orders are past their delivery date:       │  answer, full width, markdown
│ ┌──────────┬────────┬───────────┬─────────┐  │
│ │ SO-0031↗ │ Acme   │ 02 Nov    │ 12,000  │  │  table: links open in Preview tab
│ │ …        │        │           │         │  │
│ └──────────┴────────┴───────────┴─────────┘  │
│ [Open as list ↗]  👍 👎  ⧉ Copy   ↻ Retry     │
├──────────────────────────────────────────────┤
│ [📄 SO-0042 ✕] [☰ Sales Order · 2 filters ✕] │  context chips for the next message
│ ┌──────────────────────────────────────────┐ │
│ │ Ask about your data…                     │ │  composer, grows to 8 lines
│ │                                    [↑]   │ │  Enter sends, Shift+Enter newline
│ └──────────────────────────────────────────┘ │
│ Uses Claude · answers can be wrong · What's sent │
└──────────────────────────────────────────────┘
```

- User messages: right-aligned, `--surface-sunken`, max 85 % width. Assistant: full width, no bubble, markdown with
  `--measure`, tables rendered with `DataTable` (compact), record names as links (`<a data-doctype data-name>` →
  Preview tab on desktop, page on phone — same as Desk's side panel link handling).
- Every answer that lists records offers **Open as list ↗** (route with the same filters) so the user lands in a
  real Crema list, not a dead table.
- Code / scripts in answers: CodeMirror read-only block with Copy (lazy-loaded).

### 5.4 Context chips

| Chip | When added automatically | Sent as |
|---|---|---|
| 📄 Record `SO-0042` | On a form, or opened via "Ask AI about this" | doctype + name (assistant reads it with the user's permissions) |
| ☰ List `Sales Order · 2 filters` | On a list / report | doctype / report + filters |
| ☑ Selection `3 Sales Orders` | From the BulkBar | doctype + names |
| ⚲ Filters, 🗓 date range | From a report | filters |

- Shown above the composer; ✕ removes for the next message (Frappe CRM: "Leave this record out"). "+" adds a record
  by search.
- Chips follow navigation until the user removes one; a removed chip stays removed for that page.
- The chips used are frozen onto the sent message (small, under the bubble), so history shows what the question
  was about.

### 5.5 Streaming and tool activity

- Server sends Server-Sent Events from `/api/ai/chat`: `text` deltas, `tool_start {name, label, args_summary}`,
  `tool_end {ok, summary}`, `confirm {card}`, `open_form {route}`, `done`, `error`.
- Text renders as it arrives (batched per animation frame; markdown re-parsed at most every 100 ms).
- Each tool call is one **tool line**: spinner → ✓ / ✕, plain label from a map
  (`list_documents` → "Listed Sales Orders", `get_document` → "Read SO-0042", `get_doctype_schema` → "Read the
  Sales Order fields"), never raw JSON by default; ▸ expands arguments and a short result.
- While working, the composer's Send turns into **Stop ■**; a status line under the last message reads "Working ·
  12 s" (Frappe CRM shows "Flow · 12 s").
- Screen readers: the message list is `role="log"` with `aria-live="off"` while streaming (token-by-token
  announcements are noise); a separate visually hidden `aria-live="polite"` region announces state changes only:
  "Assistant is working", "Answer ready", "Waiting for your confirmation", "Stopped", "Error: …".

### 5.6 Stop, retry, errors

| Case | UI |
|---|---|
| Stop | Aborts the stream (AbortController → server cancels the model call); partial answer kept, marked "Stopped"; tool calls already done stay listed |
| Retry ↻ | On the last answer: resends the last user message with the same chips; the old answer is replaced (kept in history as an earlier attempt, "1 of 2" switcher) |
| Edit last question | ↑ in an empty composer puts the last question back for editing; sending replaces from there |
| Model / network error | Inline error card "Couldn't reach the assistant. ↻ Try again"; details in ⋯ |
| Frappe refused (permission, validation) | The tool line shows ✕ with Frappe's message verbatim (it is the truth the user needs), the assistant explains |
| Daily limit reached | Banner in the panel "You've used today's 50 requests. Resets at 00:00 (site time)." Composer disabled; history readable |
| Context too long | Answer suggests "Start a new chat"; button inline |

### 5.7 Confirm cards (writes other than create)

```
┌ Update 2 Sales Orders ─────────────────── waiting ┐
│ SO-0031 ↗                                          │
│   Delivery date      02 Nov 2026  →  20 Nov 2026   │
│   Status             To Deliver   →  (unchanged)   │
│ SO-0034 ↗                                          │
│   Delivery date      05 Nov 2026  →  20 Nov 2026   │
│ ────────────────────────────────────────────────── │
│ Totals: no change                                  │
│ [ Confirm update ]  [ Cancel ]   Edit in form ↗    │
└────────────────────────────────────────────────────┘

┌ Submit Sales Invoice SINV-0102 ───────── ⚠ final ┐  submit / cancel / delete: one card each, danger tone,
│ Customer Acme · Grand total 24,500.00            │  never batched with "confirm all"
│ After submitting it can only be cancelled.       │  wording from Desk's own confirm (form/save.js)
│ [ Submit invoice ]  [ Not now ]                  │
└──────────────────────────────────────────────────┘
```

- Rows: **field label (from meta), old → new**, values formatted with Crema's formatters (currency, dates, links).
  Old values are read just before the card is shown; child-table changes listed per row ("Items row 2: Qty 10 → 12").
- **Totals:** for DocTypes with `grand_total` / `total` / numeric `in_list_view` fields, the card asks the server for
  the recalculated values (dry run via `frappe.client.validate`-style `run_doc_method` is not available without
  saving, so: the card shows "Totals are recalculated on save" unless the change only touches non-numeric fields)
  — see § 9 Q4.
- Bulk (> 5 records): first 5 shown, "and 37 more ▾".
- Buttons name the action ("Confirm update", "Submit invoice", "Delete 3 ToDos"); Enter does **not** confirm —
  the user must press the button (keyboard: Tab to it + Enter/Space).
- **Stale check:** each record's `modified` is captured with the card; on Confirm, if it changed, the card turns into
  "SO-0031 changed since this was prepared · Review again" and nothing runs.
- "Approve all" (Frappe CRM) only for ≥ 2 plain updates; never for submit / cancel / delete / setup.
- After running: card collapses to "✓ Updated 2 Sales Orders" with links; open lists / forms refresh (react-query
  invalidation, GAPS 3.9); each record's timeline gets "Updated via AI assistant by <user>".
- "Edit in form ↗" opens the record with the proposed values filled but unsaved, for users who prefer to check there.

### 5.8 "Open filled form" (create) and setup drafts

```
┌ New Purchase Invoice ready ─────────────────────┐
│ Supplier X · 1 item · 10 × Item Y @ 500 = 5,000 │
│ [ Open and review ]                             │
└─────────────────────────────────────────────────┘
```

- **Open and review** routes main to `/desk/doctype/Purchase Invoice/new` with route options (Desk
  `frappe.route_options`), so the site's client scripts run as for any new form. The panel stays docked (phone: the
  sheet minimises to a pill "✦ Assistant" above the BottomBar).
- The form shows a `Banner`: "Filled by the assistant — check the values and Save." Fields the assistant set carry
  a small ✦ marker next to the label (`--ai-fg`) until the user edits them; the marker has `aria-label` "set by the
  assistant".
- Nothing is saved by the assistant for creates; the user's Save is the confirmation. If the user navigates away
  unsaved, the normal unsaved-changes guard applies.
- Setup changes (DocType, Custom Field, Client / Server Script, Report, Workflow, Print Format, Notification) use the
  same card, "Open draft in DocType builder / Workflow builder / Print Format Builder"; the builder opens with the
  draft and the same banner. Server Scripts when `server_script_enabled` is off: the card says so and offers a Client
  Script or nothing.

### 5.9 History

- **History ⏱** opens a popover (desktop) / page in the sheet (phone): searchable list of the user's chats, title
  (first question, editable), date; pick to reopen; ⋯ Delete. Frappe CRM's `ChatHistory.vue` is the model.
- New chat ✎ starts empty with current page chips. A chat older than 24 h opened from history shows "This chat is from
  12 Nov — data may have changed".
- Stored server-side per user (§ 9 Q1). Users see only their own; System Managers see everyone's in the AI activity
  log, not in this panel.

### 5.10 Empty state (new chat)

```
│ ✦ Ask about your data or tell me what to do.        │
│ I act as you: I can only see and change what you can.│
│                                                      │
│ On this Sales Order:                                 │
│  [Summarise this order]  [What's blocking submit?]   │
│  [Create the delivery note]                          │
│ Anywhere:                                            │
│  [What's waiting for my approval?]                   │
│  [Overdue invoices this month]                       │
│ What's sent to the AI provider ↗                     │
```

Suggestions by context: form (summarise, what's blocking submit — reads mandatory / workflow, create next document
from the form's Create menu items), list (count by status, overdue, "filter to…"), report (explain this report,
compare periods), home (approvals, my drafts), DocType list as System Manager ("Create a DocType…"). At most 5; plain
buttons that fill and send.

### 5.11 Availability, permission, settings

| Situation | What the user sees |
|---|---|
| Assistant off for the site, or no API key | No ✦ button, no ⌘I, no "Ask AI" in ⌘K. System Managers see "Set up the AI assistant" in ⌘K and in My settings → Assistant, linking to AI Settings |
| On, but the user's role is not allowed | Same as off (no teasing), except My settings → Assistant says "Your administrator hasn't enabled the assistant for your role." |
| Frappe MCP disabled (System Settings → AI Agents) | Panel opens with a Banner "The site's AI tools are off. A System Manager can turn on MCP in System Settings." (link shown to System Managers only) |
| Limit reached | § 5.6 |
| Provider down | Error card + Retry; the rest of Crema unaffected |

**AI Settings page** (System Manager, `/desk/ai-settings`, a settings page per § 4.7): on/off, API key (write-only
field, shows "set · ends with …abcd"), model, roles allowed, per-user daily limit, "what is sent" text (shown to users
via the footer link), link to Frappe's "Agent Instructions" (System Settings → AI Agents), activity log.

**My settings → Assistant:** remember panel open, default width, clear my chat history.

### 5.12 Accessibility of the panel

- Docked / overlay: `<aside aria-label="Assistant">`, non-modal, no trap; F6 reaches it; heading `h2` "Assistant".
- Sheet (phone): `role="dialog" aria-modal="true" aria-labelledby`, focus trapped (existing `useFocusTrap`), Esc /
  swipe / scrim close.
- Composer: `<textarea aria-label="Message the assistant">`, `aria-describedby` the footer notice; Send / Stop are
  real buttons with labels.
- Confirm cards: `role="group" aria-labelledby` the card title; old → new read as "Delivery date, from 02 Nov 2026 to
  20 Nov 2026" (visually hidden text, the arrow is `aria-hidden`).
- Live region rules in § 5.5. Tool lines are `<details>` elements (native keyboard).
- Every chip's ✕ is a button "Remove context: SO-0042".

### 5.13 Assistant suites

All use a **stub model** (GAPS 3.9: tests cost nothing): `/api/ai/chat` honours `CREMA_AI_STUB=1` and replays scripted
turns.
- `e2e/p2.ai.panel.mjs` (4a): open by button / ⌘I / ⌘K Tab / record menu; Esc and ✕ close; focus returns; state
  remembered; docked at 1600, overlay at 1024, sheet at 390; coexistence with Preview tab; read-only answer with
  tool lines and links; Stop; error + Retry; off / no-role states.
- `e2e/p2.ai.write.mjs` (4b): create → filled form, ✦ markers, user saves; update → confirm card old → new, stale
  check, confirm runs, list refreshes, timeline note; submit card separate.
- `e2e/p2.ai.setup.mjs` (4c): "create a DocType Vehicle…" → builder draft → save → cleanup.
- `e2e/p2.ai.log.mjs` (4d): activity log rows, daily limit banner.

---

## 6. Performance plan

Baseline: GAPS 3.10 (Crema 86–97 performance, LCP 1.2–2.6 s, 118–186 requests, 1.3–2.0 MB).

### 6.1 Budgets per route (production build, logged in, gzip/brotli sizes)

| Route | First-load JS (KB) | Requests (first load) | LCP desktop / mobile | CLS | Lighthouse perf (desktop / mobile) |
|---|---|---|---|---|---|
| Home `/desk` | ≤ 200 | ≤ 35 | ≤ 1.0 s / ≤ 2.0 s | ≤ 0.05 | ≥ 98 / ≥ 95 |
| List `/desk/doctype/Sales Order` | ≤ 230 | ≤ 30 | ≤ 1.2 s / ≤ 2.2 s | ≤ 0.05 | ≥ 95 / ≥ 95 |
| Form `/desk/doctype/Sales Order/<name>` | ≤ 280 (no site scripts counted) | ≤ 40 | ≤ 1.2 s / ≤ 2.5 s | ≤ 0.05 | ≥ 95 / ≥ 95 |
| New form | ≤ 280 | ≤ 40 | ≤ 1.2 s / ≤ 2.5 s | ≤ 0.05 | ≥ 95 / ≥ 95 |
| Report (General Ledger) | ≤ 260 | ≤ 30 | ≤ 1.2 s / ≤ 2.5 s | ≤ 0.05 | ≥ 95 / ≥ 95 |
| Assistant panel (lazy chunk) | + ≤ 45 on first open | + ≤ 3 | — | 0 (docking animates `transform`, reserves width in one frame) | no change to the page score |
| DocType builder | ≤ 320 | ≤ 30 | ≤ 1.5 s / — | ≤ 0.05 | ≥ 90 / — (admin page) |

### 6.2 Work items (from GAPS 3.10, in order)

| # | Item | Decision |
|---|---|---|
| S1 | Compress route handlers | One helper `lib/http/compress.ts`: brotli (q 4) when `accept-encoding` has `br`, else gzip, for `application/json`, `text/*`, `application/javascript`, `image/svg+xml` > 1 KB; applied in `lib/frappe/proxy.ts`, the site passthrough, legacy page route, asset proxy, `/api/desk/context`. Sets `Vary: Accept-Encoding`. Skips if upstream already encoded |
| S2 | Accessibility to 100 | § 7 |
| S3 | Batch start-up calls | One `GET /api/desk/shell` (exists) returns boot subset + navigation + notifications count + UI prefs; one `GET /api/desk/form-context?doctype&name` returns meta (with child metas), doc, docinfo, user settings, list of client scripts. react-query seeds each existing query key from the batch (`setQueryData`) so components don't change |
| S4 | Server-rendered first paint for forms | The form route becomes a Server Component that loads meta + doc through `frappeServerFetch` and renders the **read view** of the new form (header, summary, sections, values formatted, `depends_on` evaluated with the same pure evaluator from `lib/crema-form`), then the client form engine hydrates over it with the same data (no refetch). Fields that client scripts hide appear briefly — mitigated by rendering sections in their final collapsed/expanded state and reserving no space for script-only buttons (they come into menus) |
| S5 | Less JavaScript | `next/dynamic` for Quill, CodeMirror, Leaflet, frappe-gantt, charts, `driver.js`, dnd-kit (builders / dashboard edit), the assistant, the print builder; jQuery and the Desk runtime bridge (`lib/desk-runtime`) load only when the DocType has client scripts or a page needs them (measure first: § 9 R2). `optimizePackageImports` for `lucide-react`, `date-fns` |
| S6 | CSS and fonts | `next/font` Inter: latin subset, weights 400 / 500 / 600 only, `display: swap`, `adjustFontFallback`; Geist Mono loaded only on code surfaces. Critical CSS is Next's default; no CSS-in-JS |
| S7 | Lighthouse script | `e2e/lighthouse.mjs`: logs in once, runs Lighthouse (desktop + mobile preset) 3× per route on Crema and optionally Desk, writes `out/lighthouse/<date>.json` and a Markdown table to paste into the PR |
| S8 | Prefetch | List rows: on hover / focus > 100 ms, `prefetchQuery` the form-context (S3) for that row; Preview ↑/↓ prefetches the next row; form "next record" prefetched on idle. Next `<Link prefetch>` only for sidebar items in view |
| S9 | Virtualisation | `@tanstack/react-virtual` in `DataTable` for lists > 100 rows and grids > 50 rows (largelist suite measured; keep its numbers) |
| S10 | Images | Avatars and attachments via `/files` with `loading="lazy"`, explicit `width/height`; no `next/image` optimiser (Frappe serves files; phase 3 is same-origin) |

### 6.3 Rules every PR follows

- No layout shift from late data: skeletons with final dimensions; images with sizes; the New layout pref is mirrored
  into a `crema_ui` cookie so SSR renders the right layout first (today SSR renders classic then switches —
  `lib/ui/newLayout.ts` comment) — PR 0.
- No new dependency > 20 KB gzip without a line in the PR saying why and that it's lazy.
- Interactions: work on input in < 50 ms; anything heavier goes to `startTransition` or a worker.

### 6.4 How each PR is verified

1. `npm run build` → paste the route table's First Load JS for touched routes (Next prints it).
2. `node e2e/lighthouse.mjs <routes>` → paste the table (perf, a11y, LCP, CLS, TBT, requests, KB) for classic and new.
3. The p2 suite's CLS sum and max interaction duration (G5, G6).
4. A PR that breaks a budget explains why and opens a follow-up, or is not merged.

### 6.5 CI

CI cannot reach a bench (CLAUDE.md), so budgets in CI check only build output: `scripts/check-budgets.mjs` reads
`.next` build stats and fails when a route's first-load JS exceeds § 6.1 (added in PR 14). Lighthouse stays local.

### 6.6 Field data (opt-in)

`web-vitals` (≈ 2 KB) reports LCP / CLS / INP with attribution to `/api/rum` when the site enables "Share
performance data" in AI/Crema settings; stored as a plain log (Error Log-like DocType or file) for the owner. Off by
default.

---

## 7. Accessibility plan

Target: Lighthouse 100 and axe 0 violations (WCAG 2.2 A + AA) on every route, keyboard-only use of every task.

### 7.1 Fix list (from the Lighthouse run, GAPS 3.10 #2)

| Finding | Fix |
|---|---|
| Colour contrast | Use `--ink-*` tokens only; `--text-light` (#999 on white = 2.8:1) never for text the user needs — replace with `--ink-muted` (#7c7c7c → bump to #6b6b6b for 5.3:1 in the new layout). Placeholder text is not a label |
| Heading order | One `h1` per page (PageHeader title); sections `h2`, cards `h3`; workspace widgets get real headings |
| Links without a name | Icon links get `aria-label`; record links in tables include the record title |
| Label differs from visible text (2.5.3) | `aria-label` starts with the visible label ("Save" → "Save", not "Save document") |
| `[role]` children without parent | Menus via Radix (correct roles); lists of cards are `<ul>`; custom grids use `role="grid"` with `row` / `gridcell` |

### 7.2 Rules (new components)

- **Focus visible** everywhere: `.crema-focus` ring (2 px + gap, ≥ 3:1).
- **Focus not obscured (2.4.11):** sticky header, BottomBar, BulkBar and bottom nav set `scroll-padding-top/bottom`
  on the scroller so a focused field is never under them.
- **Target size (2.5.8):** ≥ 24 × 24 px everywhere, ≥ 40 px on coarse pointers (token), 48 px in the bottom nav.
- **Dragging alternative (2.5.7):** dashboard cards, builder fields, grid rows, sidebar pins all have keyboard /
  button moves.
- **Status not by colour alone:** StatusPill has icon + text (exists).
- **Forms:** every control has a `<label>`; required = text "(required)" for screen readers + `*`; errors linked with
  `aria-describedby` and `aria-invalid`; ErrorSummary gets focus after a failed save (GOV.UK pattern).
- **Live regions:** one polite region in the shell for toasts and saves ("Saved"), one for the assistant (§ 5.5).
- **Dialogs and sheets** trap focus and restore it; side panels that are docked do not.
- **Landmarks:** `header`, `nav` (sidebar, bottom nav — distinct labels), `main`, `aside` (Rail), skip link (exists in
  `app/layout.tsx`) also offers "Skip to assistant" when open.
- **Reduced motion and high contrast:** tokens (exist); verified in `/desk/ui-kit`.
- **Zoom / reflow (1.4.10):** 320 px CSS width without horizontal scroll (the 390 px phone layout at 200 % zoom on
  640 px).

### 7.3 Keyboard map (new layout)

| Where | Keys |
|---|---|
| Global | ⌘K search, ⌘I assistant, ⌘/ sidebar, F6 / ⇧F6 regions, ? shortcuts |
| List | ↑/↓ rows, Space select / preview (1280), Enter open, x toggle check, ⌘A select all, Esc clear / close preview, ⌘B new |
| Preview | [ / ] previous / next, Enter open full page, Esc close |
| Form | ⌘S save, ⌘J jump to field, ⌘Z / ⌘Y undo / redo, ⌘↵ add grid row, Alt+1…9 tabs |
| Grid | as M3 (`useGridKeys.ts`) |
| Assistant | Enter send, ⇧Enter newline, ↑ edit last (empty composer), Esc close |

### 7.4 Verification

`@axe-core/playwright` in `e2e/lib.mjs` as `t.axe(name)` (WCAG 2.2 AA tags), called on each p2 suite's screens in light,
dark and high contrast; `e2e/p2.keyboard.mjs` does top tasks 1, 2 and 4 with keyboard only (no `click`). Manual check
with VoiceOver (macOS / iOS) before PR 11 and PR 4b.

---

## 8. Delivery plan (PR list)

Every PR: behind the New layout switch; before / after screenshots at 390 / 768 / 1280 / 1600 / 1920 (+ 2560 where
the screen changes on wide); Lighthouse table for touched routes; the listed suites green; React Doctor 0 errors; classic suites
green with the switch off. Suite names are new files under `crema-frontend/e2e/`.

| PR | Title | Contains | Suite(s) | Must include in the PR | Depends on |
|---|---|---|---|---|---|
| 0 | Measuring + switch at first paint | `e2e/lighthouse.mjs` (S7), `NEW_LAYOUT=1` and `t.axe()` in `e2e/lib.mjs`, `crema_ui` cookie mirror so SSR renders the chosen layout (§ 6.3), tokens from § 2.1, `Tooltip`/`Kbd`/`Toast` | `p2.foundation` (extended) | Baseline Lighthouse table for all § 6.1 routes, Desk and Crema | — |
| 1 | Record preview + wiring | `Rail`, `Resizer`, `Sheet`; Preview tab porting Desk `ui/side_panel.js` (history / back, Esc rule, close on route change, open full page, width saved); list row preview (§ 4.2 preview row), report link cells (`link_side_panel.js`), link hover card (`ui/link_preview.js`); My work linked from sidebar and as a home option; ⌘K "Go to My work" | `p2.preview`, `p2.mywork` | Preview at 1280 / 1600, sheet-not-used on phone (routes to page), INP of ↑/↓ | 0 |
| 2a | Large screens | Fluid shell (§ 3.4: no 1290 cap, sidebar 240 / rail 56 with pin + collapse, dock rule, `--field-max`, `--measure`), form 2 → 3 columns by container, form Activity / Info docked at ≥ 1600, list filters pane and form outline at ≥ 1920, second right column at ≥ 2240, pane state remembered | `p2.widths` | Screens of home / list / form at 1280 / 1600 / 1920 / 2560 | 1 |
| 2b | Dashboard home | Site home resolution (§ 4.1), CardGrid, NumberCard / ChartCard on site sources, edit mode with keyboard moves, per-user layout, role publish | `p2.home` | Home Lighthouse ≥ 98 desktop | 2a |
| 3a | DocType builder: start + checks | Start dialog with naming example, live checks from `form_builder/store.js`, ErrorSummary | `p2.doctypebuilder` | — | 0 |
| 3b | DocType builder: canvas + permissions + done | Palette with plain names, properties panel, permissions step, after-save actions; reuses `FormBuilder.tsx` | `p2.doctypebuilder`, `doctype.create` | Builder screens 1280 / 1600 | 3a |
| 3c | Customize Form in the builder | Custom Field + Property Setter path, allowed properties | `p2.customizeform` | — | 3b |
| 4a | AI: settings + chat panel (read-only tools) | AI Settings page, `/api/ai/chat` SSE with stub, panel in Rail / Sheet, open / close rules, chips, streaming, tool lines, Stop / Retry / errors, empty state, history, off / no-role states | `p2.ai.panel` | Panel at 390 / 1024 / 1600; a11y 100 with panel open; panel chunk size | 1 |
| 4b | AI: filled form + confirm cards | open_form flow with ✦ markers and banner; ConfirmCard (old → new, stale check, submit / cancel / delete separate); refresh + timeline note | `p2.ai.write` | Card screenshots; API checks that nothing ran before Confirm | 4a, 5a (Banner) |
| 4c | AI: setup changes via builders | Drafts into DocType builder / Workflow builder / Print Format Builder; server-script rule | `p2.ai.setup` | — | 4b, 3b |
| 4d | AI: activity log + limits | Activity log list (System Manager), per-user daily limit, usage counter in the panel | `p2.ai.log` | — | 4a |
| 5a | Form: header, summary, sections | Sticky header with one primary action, SummaryCard, sections as cards, More fields, `Field` / `FieldGroup` / `Banner` | `p2.form` + `formsave`, `form.salesorder`, `workflow`, `formmenu`, `formnav` (NEW_LAYOUT=1) | Task 1 click count, classic vs new | 2a |
| 5b | Form: errors, unsaved, restore, undo, success action | ErrorSummary, unsaved bar, IndexedDB restore, `undo_manager.js` port, `success_action.js` port | `p2.form` | — | 5a |
| 6 | Child tables | `DataTable` grid mode: sticky / resize columns, totals row, row in Rail, phone cards | `p2.grid` + `grid*` (NEW_LAYOUT=1) | INP typing in a grid cell | 5a |
| 7 | Lists | ViewTabs, FilterChips, BulkBar, InlineEdit (report_view rules), phone cards, empty states | `p2.list` + `list.salesorder`, `listlayouts`, `bulk`, `listhooks`, `listrowextras` | Task 3 click count; list Lighthouse | 1, 6 (DataTable) |
| 8 | Timeline | Filters, day groups, collapsed calculated changes, Activity tab comment box | `p2.timeline` + `timeline` | — | 5a |
| 9 | Reports | Filter chips + More filters panel, saved filter sets, chart collapse, column state, link preview | `p2.report` + `report`, `reportview`, `reportgroupby`, `financials`, `reportsave` | Task 5 click count | 6, 1 |
| 10 | Search | ⌘K groups and ranking from `search_utils.js`, results page, #tag, Ask AI row | `p2.search` + `awesomebar` | — | 4a (Ask AI row hidden until then) |
| 11 | Mobile | Bottom nav, Create sheet, scanner (`scanner/`) for Item / barcode fields, camera for Attach (`ui/capture.js`), keyboard-aware bars | `p2.mobile` + `mobile` | Screens at 390 / 768; mobile Lighthouse | 5a, 7 |
| 12 | Settings pages | My settings page, Single DocType "Find a setting" | `p2.settings` | — | 5a |
| 13 | Onboarding | Checklist card, tours via driver.js, first-visit tips | `p2.onboarding` | — | 2b |
| 14 | Speed | S1 compression (can land any time after 0), S3 batching, S4 server first paint, S5/S6 JS + fonts, S8 prefetch, CI budget check | `p2.speed` (checks requests count and `content-encoding`) + all p2 suites | Lighthouse table for all routes: ≥ 95 / 100 | 0; S4 after 5a |
| 15 | Accessibility pass | § 7 fix list on remaining classic-shared parts, `p2.keyboard` | `p2.keyboard`, axe in all p2 | Lighthouse a11y 100 table | 0 |
| 16 | Usability check + default on | G1/G2 session, write-up; then make New layout the default for new users (classic stays one switch away) | `p2.tasks` | Usability notes | all |

S1 (compression) and 15's contrast fixes have no screen dependency; split them out and land early if a quick win is
wanted. Builder (3) and AI (4) are independent of each other until 4c.

```
0 ─┬─ 1 ─┬─ 2a ─┬─ 2b ── 13
   │     │      └─ 5a ─┬─ 5b      ┌─ 4b ─ 4c
   │     ├─ 4a ────────┼──────────┤    └ 4d
   │     │             ├─ 6 ─ 7 ─ 11     ▲
   │     │             ├─ 8   └─ 9       │
   │     │             └─ 12             3b
   ├─ 3a ─ 3b ─ 3c ──────────────────────┘
   ├─ 14 (S1 early; S4 after 5a)
   └─ 15
```

---

## 9. Risks and open questions

### Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Client scripts assume Desk's DOM (`frm.page.body`, `$wrapper` positions) and break in the new form layout | Keep the same wrapper ids / classes the bridge exposes (`lib/desk-runtime`); run `scriptdom`, `scripts.salesorder`, `itemdashboard` with `NEW_LAYOUT=1` on every form PR |
| R2 | jQuery + Desk runtime are needed by most ERPNext forms, so S5 savings on forms may be small | Measure per DocType in PR 0; budget counts Crema's JS only; site scripts reported separately |
| R3 | Server first paint shows fields that a script hides a moment later (CLS) | Measure in PR 14; fall back to skeleton for DocTypes whose scripts toggle `hidden` in `onload` / `refresh` (detectable from the script text only roughly — decide on numbers) |
| R4 | Two layouts double the test surface | New layout reuses the classic hooks; suites parametrised by `NEW_LAYOUT`; classic is frozen except fixes |
| R5 | Assistant writes the wrong thing | Creates never save; other writes need a card with old → new and stale check; activity log; per-user limits |
| R6 | Data sent to the AI provider | Settings page states it; context chips are visible and removable; off by default |

### Open questions for the owner

1. **Where do chat history and the AI activity log live** before phase 3 (no Crema app yet)? Recommendation: two custom
   DocTypes (`custom = 1`) created by the AI Settings page on first enable ("Crema AI Chat", "Crema AI Log"), moved into
   the Crema app in phase 3. Alternative: user_settings (size-limited) — not recommended.
2. **Role-published home layouts:** store as a custom DocType too, or as a Workspace (Desk's own, editable in Desk)?
   Recommendation: a Workspace copy per role, so Desk users see the same.
3. **Accent colour source:** Navbar Settings has a logo but no colour field in v16 — add a field in Crema settings,
   or keep espresso black? Recommendation: keep black until phase 3's `Crema Settings`.
4. **Confirm-card totals:** showing recalculated totals before Confirm needs a server dry run Frappe doesn't offer.
   Accept "recalculated on save" for numeric changes, or add a whitelisted dry-run method in phase 3?
5. **Default model and cost limits** for the assistant (GAPS says Claude Opus 5.5): confirm the default daily limit
   (proposal: 50 requests / user / day).
6. **Usability sessions:** who are the 3–5 users and which site's data is used (screenshots must stay free of client
   names)?
