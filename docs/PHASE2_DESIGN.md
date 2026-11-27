# Phase 2 — design and delivery plan

Status: plan, 2026-11-26 (updated the same day: dynamic role-based home § 4.1, AI tiers § 5.0 and § 5.14–5.20,
research § 10, new build order § 8). Source of the intent: [GAPS.md § 3](GAPS.md#3-phase-2--reimagining-the-frontend-uiux-plan).
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
5. [AI assistant](#5-ai-assistant)
6. [Performance plan](#6-performance-plan)
7. [Accessibility plan](#7-accessibility-plan)
8. [Delivery plan (PR list)](#8-delivery-plan-pr-list)
9. [Risks and open questions](#9-risks-and-open-questions)
10. [Research: Frappe's own newer frontends](#10-research-frappes-own-newer-frontends)

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
| `Rail` | Docked, non-modal right region with tabs (Preview / Assistant / Activity), resizer, overlay mode under the dock threshold | new; resize ported from Desk `ui/side_panel.js` `setup_resize` | PR 2a |
| `Resizer` | `role="separator"` drag + arrow keys, double-click reset | new | PR 2a |
| `Sheet` | Phone bottom sheet with snap points (50 % / 92 %), drag handle, modal | SidePanel's sheet mode, split out | PR 2a |
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
| `Banner` | Page / form-level notice (info, warning, danger) | new | PR 2a |
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

**Home at 1920**: see § 4.1.9 (the dynamic home's wireframes at 1920, 1280 and 390).

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

### 4.1 Home: dynamic and role-based (GAPS 3.7; `/desk`)

Owner's brief: everything this user may need and may do is on the home, nothing is static, and it learns what the user
actually uses. So the home is **a ranked list of cards worked out from data on every load**. No card, DocType, route
or role name is hard-coded. The same algorithm gives a clerk, a storekeeper and a System Manager different homes.

#### 4.1.1 Which home opens

Same order as Desk (`frappe/apps.py` `get_default_path`, `frappe/boot.py` `app_home` hook, user `default_workspace`):
1. the user's `default_app` → that app's `app_home` route; 2. System Settings `default_app`; 3. otherwise the dynamic
home below. If the route is outside Desk (`/helpdesk`, an app's own page), Crema goes there (passthrough, as today).
A user's default workspace no longer replaces the home. It becomes the home's **context**: its cards rank first and
its title is the page title (§ 4.1.4). Classic `/desk` keeps the current apps grid.

#### 4.1.2 Starting point: a white-label app's desk home

A white-label Frappe app on the local bench replaces `/desk` with its own home (`app_home = "desk"` in `hooks.py`,
`www/desk.py` builds the page context on the server, `desk_dashboard.py` / `desk/api/dashboard.py` gather the data,
`public/js/*_dashboard.js` renders it, tokens in `public/css/*/_tokens.scss`).

| Kept (it works) | Fixed (it is static or wrong) | How Crema does it |
|---|---|---|
| Data is computed on the server and cached for 60 s per user (`frappe.cache().set_value(…, expires_in_sec=60)`) | The cache is never cleared, so a saved document stays missing for up to a minute | Same 60 s cache, plus it is cleared when the user saves, submits or acts on a workflow (§ 4.1.7) |
| Status label precedence `workflow_state` → `status` → `docstatus` (`_get_status_label`) | Tone is guessed from English keywords (`APPROVED_KEYWORDS`, `PENDING_KEYWORDS`) | Same precedence. Tone comes from Desk's own indicator (`frappe.get_indicator` port, `lib/ui/status.ts`) |
| Recent activity from Activity Log; recent documents of the user | Candidate DocTypes are a fixed list (`["Sales Order", "Purchase Order", …]`, `FALLBACK_DOCTYPES`) | Candidates come from the user's permissions and usage (§ 4.1.3) |
| A role-aware greeting and workspace ordering | The "profile" is a substring match on role names (`getDeskProfile`: "purchase", "sales", "account", …) plus keyword lists per profile (`getProfileKeywords`) | No role-name parsing. Role → DocPerm / Module Profile / Workspace roles decides what is possible, usage decides the order |
| KPI tiles that link to lists | KPIs ("approved", "pending", "draft") are counted from the 6 recent documents, so they look like totals but aren't | Counts come from `frappe.client.get_count` / Number Cards over the real filter, with a link to the same filter |
| Workspace map grouped by module; type-to-filter tiles; Ctrl+K to the awesomebar | Workspace access only checks `Workspace` read (`_has_workspace_access`): it ignores the workspace's `roles` table and the Module Profile. Routes are hard-coded as `/app/<slug>` | Workspaces come from boot `workspaces` / `module_sidebars`, which Desk already filters by roles and blocked modules |
| Branding through tokens; theme synced to `User.desk_theme` | `!important` overrides of Desk CSS; emoji icons | Tokens only (§ 2.1); site icons (§ 2.4) |

#### 4.1.3 What feeds the home (all from data Frappe already has)

**A. What the user may do** (permissions; recomputed when roles change):

| Signal | Source (Frappe) | Used for |
|---|---|---|
| DocTypes readable / creatable | boot `user.can_read`, `user.can_create`, `can_write`, `can_submit` (`frappe/boot.py` → `frappe.utils.user.get_user`) | Candidate set. Nothing outside `can_read` is ever shown |
| Modules and workspaces | boot `module_sidebars`, `workspaces` (already filtered by Workspace `roles`, Module Profile / Block Module) | "All workspaces" card, and the context workspace's cards |
| Number Cards the user may see | `Number Card` `get_permission_query_conditions` (`desk/doctype/number_card/number_card.py`: Report cards need an allowed report, DocType cards need read, module must be allowed) | KPI cards |
| Dashboard Charts | `Dashboard Chart` `has_permission` / query conditions (chart `roles` table, else DocType read) | Chart cards |
| Reports the user can run | `DeskViews.get_allowed_report_names` (Report `roles`, Role Permission for Page and Report) | "Your reports" card |
| Workflow work | `Workflow Action` (status Open, `Workflow Action Permitted Role` ∩ user roles: `workflow_action.py` `get_permission_query_conditions`) and `Workflow` transitions whose `allowed` role the user has | "Needs you": documents in a state the user can move, with the action names |
| Assignments, ToDos, mentions | `ToDo` (`allocated_to = user`, open), `Notification Log` (`for_user`, unread) | "Needs you", bell count |
| Today | `Event` (owner / participant / public, today and next 7 days), ToDo `date` | "Today" card |
| Drafts | `docstatus = 0`, `owner = user`, in the user's top DocTypes | "Continue" card |

**B. What the user actually uses** (usage; the learning part):

| Signal | Source | Weight | Notes |
|---|---|---|---|
| Created / submitted a document | `Version` rows by the user written on insert (`version.py` `for_insert`, data has `creation`) or with docstatus 0→1 | 3 | Strongest sign of "my work" |
| Edited a document | `Version` (`owner = user`, `ref_doctype`) | 2 | |
| Acted on a workflow | `Version` with `workflow_state` change by the user, `Workflow Action` completed by user | 3 | |
| Opened a form / list / report | `Route History` (`route`, `user`), `View Log` (`viewed_by`), `Access Log` (report exports) | 1 | Route strings are parsed as in `components/home/data.ts` `parseDeskRoute` |
| Logged activity | `Activity Log` (`user`, `reference_doctype`) | 1 | |
| Desk's own top 5 | boot `frequently_visited_links` (`route_history.py`) | used for cold start only | Available to every user without extra permission |

Two facts decide where this is computed:
- **Normal users can't read these logs.** Route History, Activity Log, View Log, Access Log and Version have one
  DocPerm, System Manager (checked in the v16 JSON). Only `frequently_visited_links` (top 5, own rows) is open.
  So the usage profile is computed by a **whitelisted method in the Crema Frappe app** (§ 5.14). It reads these
  tables with `ignore_permissions`, but **only rows where the user column is the session user**, returns only
  aggregates per DocType / report, and drops any DocType the user can no longer read.
- **Crema must write Route History.** Desk writes it from the browser (`public/js/frappe/router_history.js` → 
  `route_history.deferred_insert`, debounced 10 s). Crema's router does the same, with Desk's route strings
  (`List/Sales Order/List`, `Form/Sales Order/SO-0001`, `query-report/General Ledger`) so Desk's own
  `frequently_visited_links` improves too. Desk skips `Form` routes (`routes_to_skip`); Crema logs them, because
  opening records is the main usage signal.

Retention: Activity Log and Route History are cleared after 90 days (`frappe/hooks.py` `default_log_clearing_doctypes`),
so the window is 90 days.

#### 4.1.4 Ranking

For each candidate (a DocType, report, workspace or Number Card / chart) and the session user:

```
usage(x)  = Σ over events e on x in the last 90 days:  weight(e) · 0.5 ^ (age_days(e) / 14)
            (half-life 14 days: an event from 2 weeks ago counts half, 30 days ≈ a quarter, 90 days ≈ 1 %)
prior(x)  = role prior: share of users with the same role set who used x in 30 days (aggregate counts only)
            + 1 if x is a shortcut / card of the user's context workspace
            + 1 if the user can create x and it is submittable or has a workflow (a transaction, not a master)
n         = number of usage events of the user (90 days)
λ         = min(1, n / 30)                          cold start: new users lean on the prior
score(x)  = λ · norm(usage(x)) + (1 − λ) · norm(prior(x))
```

- **Cards inherit scores.** A Number Card scores as its `document_type` (or its report), a chart as its source,
  "Quick create" picks the top 6 creatable DocTypes by create-weighted usage, "Your reports" the top 6 reports.
- **Needs you always comes first** when it has items; it is about obligations, not habits. Inside it: overdue first,
  then by age.
- **Decay** is the half-life above; nothing has to be "unlearned". A user who moves from Selling to Buying sees the
  home follow in about two weeks.
- **Cold start** (new user, `n = 0`): the role prior. If the role set is new too, the prior is the context
  workspace's cards + the DocTypes the user can create, in workspace order. The home is never empty: "Needs you"
  shows "All clear", and Quick create always has the user's creatable transactions.
- **Role prior** is computed once a day per distinct role set (hash of sorted roles), cached in Redis, from the same
  log tables grouped by DocType. Only counts leave the method; no record names, no other users' names.
- **Stable order.** Ranks are recomputed at most every 10 minutes and a card moves only if its rank changes by ≥ 2
  places, so the home doesn't shuffle under the user's mouse.

#### 4.1.5 Card catalogue (types, not instances)

Every card on the home is one of these types, filled from the sources above. A card with no data is left out (no
zero tiles), except Needs you.

| Card type | Content | Size (12-col grid) | Shown when |
|---|---|---|---|
| Needs you | Workflow actions, assignments, overdue ToDos, mentions; one-click Approve / Reject where the transition has no extra fields (Desk `workflow.js` rules) | 4 × tall | Always (top-left) |
| Quick create | `+ <DocType>` buttons, top 6 creatable by usage | 4 | User can create anything |
| Continue | My drafts and documents I edited in the last 7 days, with status pills | 4 | Has drafts / edits |
| KPI | One permitted Number Card (`number_card.get_result`, trend vs previous period) | 2 | Score in top N |
| Auto KPI | Open count per status for a top DocType that has a `status` / `workflow_state` field and no Number Card (`get_count` grouped) | 2 | Top-3 DocType has no Number Card |
| Chart | Permitted Dashboard Chart (`dashboard_chart.get`) | 6 | Score in top N |
| Quick list | 5 rows of a top DocType with the user's last list filters (from `user_settings`) | 6 | Top DocType |
| Your reports | Top reports by usage, with last-used filters | 4 | Has used reports |
| Today | Events and ToDos due today / this week | 4 | Has any |
| Recent | Last 8 opened records (Route History) | 4 | Always after first use |
| Workspaces | Modules and workspaces from boot, ranked | 12, collapsed | Always (bottom) |
| Ask AI | Composer + 3 suggestions built from the cards above ("Summarise what's waiting on me") | 4 | Assistant enabled for the user (§ 5.11) |
| Onboarding | Module Onboarding steps not done (§ 4.10) | 4 | Incomplete onboarding |

Packing: cards in score order into the grid, left to right, row by row, with a 12-col dense packing (CSS grid
`grid-auto-flow: dense`). Width decides how many cards fit before "Show more" (≈ 8 cards at 1280, 14 at 1920).

#### 4.1.6 Same algorithm, different homes (examples only, nothing here is configured)

| User (roles) | What the data gives them (top of the home) |
|---|---|
| Sales clerk (Sales User) | Needs you: 2 assigned Quotations. Quick create: Sales Order, Quotation, Customer (most created). Continue: 3 draft Sales Orders. KPI: Sales Orders to deliver (Number Card), auto KPI "Quotations by status". Quick list: Sales Orders, last filter "My open". Reports: Sales Analytics |
| Storekeeper (Stock User) | Needs you: Material Requests in "Pending" (workflow). Quick create: Stock Entry, Delivery Note, Purchase Receipt. Chart: Stock Value by warehouse. Reports: Stock Balance, Stock Projected Qty. Today: none, so no card |
| Accountant (Accounts User) | Quick create: Payment Entry, Journal Entry, Sales Invoice. KPI: Receivables, Payables. Chart: Cash flow. Reports: General Ledger (last party filter), Accounts Receivable |
| Approver (role in Purchase Order workflow transitions) | Needs you fills the first column: 7 Purchase Orders "Pending Approval" with Approve / Reject. Little else ranks, because they mostly approve |
| Sales manager (Sales Manager) | Charts rank above lists (they open dashboards and reports more than forms): Sales trend, Top customers. Needs you: discount approvals. Quick list: Overdue invoices |
| System Manager | Needs you: Error Log count since last visit (if they open Error Log), failed jobs. Quick create: DocType, Custom Field, User (from usage). Reports: System Health Report. Workspaces card expanded |

#### 4.1.7 Server and client split, performance

```
Browser ── GET /api/desk/home ──► Crema server (RSC + route)  ──► Frappe: crema.api.home.get_home  (one call)
                                    cache per sid 60 s              │ usage profile   (Redis, 10 min, per user)
                                                                    │ role prior      (Redis, 24 h, per role set)
                                                                    │ needs-you, drafts, today, counts (60 s, per user)
                                                                    └ card data for the first 8 cards
                                  ◄── { cards: [{type, id, score, size, data | lazy}], layout, context }
```

- **One call.** `crema.api.home.get_home()` (Crema Frappe app, § 5.14) returns the ranked card list and the data for
  the first screen. Charts below the fold come back `lazy` and load on scroll (`dashboard_chart.get`, existing
  `app/api/desk/chart` route).
- **Permission-safe.** Lists use `frappe.get_list` / `get_count` (permission queries apply), Number Cards and charts
  their own permission hooks, reports `get_allowed_report_names`. Log tables are read only for the session user and
  only as aggregates.
- **Cache invalidation.** `doc_events` `on_update` / `on_submit` / `on_cancel` and workflow actions delete the
  user's 60 s key (`crema:home:<user>`); role changes (`User` `on_update`) delete the usage and prior keys.
- **Without the app** (a site that hasn't installed it): Crema computes a reduced home on its server from standard
  endpoints (today's My work: `components/home/api.ts`, boot `frequently_visited_links`, Number Cards,
  workspace shortcuts) with the same card types, no usage learning, and a System Manager hint "Install the Crema app
  for a home that learns". This keeps § 1 G3 / G7 testable on any site.
- **Server**: candidates, permissions, scores, counts, first-screen data. **Client**: grid packing by width, user
  layout overrides, filter-this-page, edit mode, lazy cards, chart rendering.
- **Budget**: `get_home` ≤ 150 ms p75 warm, ≤ 600 ms cold on the local bench (measured in `p2.home`); one browser
  request for the first screen; Lighthouse home ≥ 98 desktop.

#### 4.1.8 Per-user customisation and role defaults

- **Edit ✎**: pin (card always shown, keeps its place), hide (never shown; "Hidden cards (3)" at the bottom to
  restore), drag to reorder, resize (1 / 2 / 4 widths), "+ Add card" from every permitted card (catalogue grouped
  by type, search). Keyboard: focus card, Space to pick up, arrows move, Shift+arrows resize, Space drops
  (WCAG 2.5.7).
- **Stored** in `__UserSettings` via `frappe.model.utils.user_settings.save("Crema Home", …)`:
  `{pinned: [{card, x, y, w}], hidden: [card], sizes: {card: w}}`. Pinned cards keep their place; learned cards
  fill the remaining slots in score order. "Reset" clears it.
- **Role defaults**: a System Manager in edit mode picks "Publish as default for role…". Stored in a DocType
  `Crema Home Default` (role, layout JSON, priority) in the Crema app, so it is versioned and editable in Desk.
  Frappe CRM does the same (`crm/fcrm/doctype/crm_dashboard/home_layout.py` `RoleDefault`). Precedence:
  **user pins / hides > role default (highest-priority matching role) > learned order**. A role default is
  pins and hides, not a frozen page: learned cards still fill the gaps.

#### 4.1.9 Wireframes

```
1920 (sidebar 240 · grid 12 cols · ~14 cards before "Show more")
┌ header ── ⌂ Home ─────────────────────── 🔍 Search or ask ⌘K ───────────────────────── ✦  🔔 3  (AN) ┐
├ sidebar ┬ Good morning, Asha · Selling                              Filter this page…   [Edit ✎]   │
│ ⌂ Home  │ ┌ Needs you (6) ──────────────┐┌ Quick create ───────────────┐┌ Ask AI ✦ ─────────────────┐ │
│ ★ Pins  │ │ ● PO-0112 Approve  Zen   2h ││ + Sales Order  + Quotation  ││ Ask about your data…      │ │
│ Recent  │ │   [Approve] [Reject]        ││ + Customer     + Payment    ││ [What's waiting on me?]   │ │
│ ─────── │ │ ● SO-0042 Assigned Acme  1d ││ + Delivery Note + Item      ││ [Overdue invoices]        │ │
│ Selling │ │ ○ ToDo Call Ravi    overdue ││                             │└───────────────────────────┘ │
│ Buying  │ │ … See all 6                 │└─────────────────────────────┘┌ Continue ─────────────────┐ │
│ Stock   │ └─────────────────────────────┘┌ To deliver ┐┌ Quotations ┐ │ ◌ SO-0051 draft     1h    │ │
│ …       │ ┌ Sales trend (12 mo) ─────────────────────────┐│ 12   ▼ 2   ││ Open 9     │ │ ◌ QTN-031 draft     3h    │ │
│         │ │ ▁▂▃▅▆▇█▇▆▅▆▇                     [This year ▾]││            ││ Lost 2     │ └───────────────────────────┘ │
│         │ └──────────────────────────────────────────────┘└────────────┘└────────────┘┌ Today ────────────────────┐ │
│         │ ┌ Sales Orders · My open ───────────────────────┐┌ Your reports ────────────┐│ 10:00 Call with Zen       │ │
│         │ │ SO-0042 Acme  ● To deliver  24,500            ││ Sales Analytics  ·  AR   ││ ToDo: send price list     │ │
│         │ └───────────────────────────────────────────────┘└──────────────────────────┘└───────────────────────────┘ │
│         │ ▸ All workspaces (14)                                                    Show more (3)                     │
└─────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

1280 (sidebar rail 56 or 240 · grid 12 cols · ~8 cards)
┌ header ───────────────────────────────────────────── ✦ 🔔 (AN) ┐
├ sb ┬ Good morning, Asha · Selling       Filter…  [Edit ✎]       │
│    │ ┌ Needs you (6) ─────────┐┌ Quick create ──┐┌ Continue ───┐ │
│    │ │ ● PO-0112 Approve   2h ││ + Sales Order  ││ ◌ SO-0051   │ │
│    │ │   [Approve] [Reject]   ││ + Quotation    ││ ◌ QTN-031   │ │
│    │ │ ● SO-0042 Assigned  1d ││ + Customer     │└─────────────┘ │
│    │ └────────────────────────┘└────────────────┘┌ To del ┐┌ QTN ┐│
│    │ ┌ Sales trend ───────────────────────┐      │ 12     ││ 9   ││
│    │ │ ▁▂▃▅▆▇█▇▆▅▆▇                        │      └────────┘└─────┘│
│    │ └────────────────────────────────────┘ ┌ Your reports ──────┐ │
│    │ ▸ All workspaces · Show more (6)       └────────────────────┘ │
└────┴────────────────────────────────────────────────────────────────┘

390 (one column; order = score; KPIs as a swipe row)
┌──────────────────────────┐
│ ☰  Home          ✦  (AN) │
│ Good morning, Asha       │
│ Needs you (6)          › │
│ ● PO-0112 Approve    2h  │  swipe left on a row: Approve / Reject (only no-field transitions)
│ ● SO-0042 Assigned   1d  │
│ ┌ 12 ───┐ ┌ 9 ────┐  ←→  │  KPI cards scroll horizontally (snap)
│ │To del.│ │Quotes │      │
│ Quick create (2 × 3)     │
│ Continue · Today · Recent│  each a collapsible card
│ [Ask anything… ✦]        │
├──────────────────────────┤
│ ⌂   🔍   ＋   🔔   👤    │  ＋ = the Quick create list as a sheet
└──────────────────────────┘
```

- **States:** loading = card skeletons in the last layout (stored with the cache, no shift); a card error stays
  inside the card ("Couldn't load · Retry"); a card whose permission disappears is dropped on the next load.
- Suite `e2e/p2.home.mjs`: site home resolution; two seeded users with different roles get different first 5 cards;
  a user who creates 5 Stock Entries sees Stock Entry in Quick create after cache expiry; pin / hide / reorder /
  resize saved and reloaded; role default published and applied; no card for a DocType outside `can_read`;
  screenshots 390 / 1280 / 1920 / 2560. Python tests in the app: ranking (decay, cold start, stability), log reads
  limited to the session user.

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

## 5. AI assistant

**Can it…? (owner's questions, 2026-11-26)**

- **Can a chat box inside Crema use my own Claude subscription through MCP?** No. MCP goes one way: Claude calls the
  site's tools during a chat the user started in Claude. There is no API through which a website can send messages
  into a person's claude.ai subscription, and Anthropic's consumer terms keep a subscription for that person's own
  use in Claude's apps. An in-page chat box powered by a personal subscription is not possible. What comes closest:
  1. **"Ask in Claude" hand-off**: a Crema button opens Claude with the question and the record's context. The
     desktop link `claude://claude.ai/new?q=…` (prompt prefilled, ~14,000 characters max) is documented
     ([Claude Desktop links](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link),
     [mobile](https://support.claude.com/en/articles/14898120-open-the-claude-mobile-app-with-a-link)); the web
     `claude.ai/new?q=` isn't officially documented and reports conflict, so on the web Crema copies the prompt to
     the clipboard and opens `claude.ai/new`. With the connector, Claude's answer comes back as a draft in Crema with
     a link.
  2. **Claude in Chrome**: Anthropic's browser extension, generally available since 2026-08-26 on paid plans (Pro,
     Max, Ultra, Team, Enterprise; not Free; desktop Chrome and Edge; on Enterprise an admin enables it and can limit
     domains) ([announcement](https://claude.com/resources/articles/claude-in-chrome-generally-available),
     [help](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome)). It runs on the
     user's own plan in a side panel, reads the open Crema page and can click and type in it as the user. No Crema
     work needed; Crema's stable labels and `aria-*` (§ 7) help it.
  3. **Claude Desktop / Claude Code with the site's MCP** (tier 0 and tier 0-local, § 5.14).
- **Is the Claude connector like an API?** No API key and no per-token bill for the company. During the user's chat,
  Claude's cloud (or, for tier 0-local, the user's computer) calls the site's `/api/v2/mcp` endpoint with that user's
  OAuth token. The site only answers tool calls; the model's work counts against that user's Claude plan limits.
- **Can the in-app chat use any router?** Yes. OpenRouter is the default, and the provider setting accepts **any
  OpenAI-compatible base URL + key + model** (other routers, DeepSeek, OpenAI, Groq, Together, a self-hosted vLLM /
  Ollama), plus native Anthropic and Gemini (§ 5.16).
- **Is there a router with ~1 billion free tokens a month?** Not verified. The closest found: OpenRouter's own
  comparison says Mistral's free "Experiment" tier gives roughly 1 billion tokens a month **only if you opt into
  data training** ([OpenRouter blog](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/)), and open-source
  aggregators claim 1.6–7.4 billion by pooling many providers' free tiers (unverified marketing figures). Such free
  tiers have rate limits, may log or train on prompts, and change often (some disappeared in 2026). Crema offers
  them only as a **"Free / test provider" preset** in AI Settings, marked unsuitable for real company data.

**Every form of AI chat, side by side**

| Form | Where the chat lives | Who pays | Setup | Images | Public site needed | Editor shown | Delivered in |
|---|---|---|---|---|---|---|---|
| In-Crema chat, OpenRouter (default) | Crema panel, ⌘I | Company, per token (≈ $2 / active user / month, § 5.17) | AI Settings: key + model slots | Yes (vision slot) | No (outbound HTTPS) | The user | PR 4a, 4b, 4e |
| In-Crema chat, any router / provider | Crema panel | Company, per token (or free preset, test only) | AI Settings: base URL + key + model | If the model has vision, else OCR | No | The user | PR 4a (adapters), 4f |
| In-Crema chat, own model | Crema panel | Company hardware | Admin runs vLLM / Ollama; AI Settings: URL | Vision model needed | No | The user | PR 4a, 4f |
| Claude connector (claude.ai web / Desktop / mobile) | Claude | Each user's Claude plan (or Team / Enterprise seats) | Connect Claude page + add connector in Claude | Yes | **Yes** (public HTTPS, port 443) | The user | PR C1, C2 |
| Claude Desktop / Claude Code, local MCP | Claude on one computer | That user's plan | "On this computer" tab: copy command / config | Yes (Desktop) | No | The user | PR C1 (+ C2 tools) |
| Claude in Chrome | Chrome side panel over Crema | That user's paid plan | Install the extension | Reads the page / screenshots | No | The user (it acts in their browser session) | Nothing to build; § 7 accessibility helps |
| "Ask in Claude" hand-off | Claude | That user's plan | None | Paste / attach in Claude | No (yes if the result should come back through the connector) | The user | PR C1 (button), PR 10 (⌘K row) |

### 5.0 Two tiers, one tool layer (decision)

Owner's direction (2026-11-26): no expensive API by default; it should work "like normal Claude"; an in-app chat may
use any provider (e.g. DeepSeek) to keep costs low. A claude.ai subscription (Free / Pro / Max / Team / Enterprise)
is for that one person's own use in Claude's apps. Even the top Max plan can't be used by Crema's server to call the
model for other users (Anthropic's consumer terms; apps use API keys), so it can't power a chatbot inside Crema. Hence
two tiers (tier 0 also has a one-computer variant) that share **one tool layer** in the Crema Frappe app (§ 5.15) and the same review rules (drafts only,
confirm cards, the user submits).

| | **Tier 0: Claude connector (default)** | Tier 0-local: Claude on one computer | Tier 1: chat inside Crema, any provider |
|---|---|---|---|
| How | Each user adds the site as a custom connector in Claude (claude.ai, Desktop, mobile). Claude calls the site's MCP endpoint `/api/v2/mcp` with that user's OAuth token | Claude Code or Claude Desktop on the user's machine connects to the site's `/api/v2/mcp` directly (Desktop through a local bridge), so a site on `localhost` or a private network works (§ 5.14 "On this computer") | The Crema app runs the chat loop in Frappe against the provider set in AI Settings. **Default: OpenRouter** (one key, many models, a model per task); also Anthropic, other OpenAI-compatible APIs (DeepSeek, OpenAI, Groq, Together, self-hosted Ollama / vLLM) or Google Gemini (§ 5.16) |
| Cost to the company | **$0**: each user's own Claude plan (or Team / Enterprise seats) | $0: that person's own plan (personal use) | Pay per token: ≈ $0.35–2 per active user per month on the cheap models at 20 requests / day (§ 5.17); hardware if self-hosted |
| Setup | Browser: Connect Claude page (§ 5.14) + Claude settings. Needs a public HTTPS site URL | Copy one command (Claude Code) or one config snippet (Desktop) from Connect Claude → On this computer | Browser: AI Settings → provider, model, API key (Password field) |
| Where the chat lives | **In Claude**, not in Crema. Crema shows the results (drafts, links, activity) | In Claude Code / Desktop on that computer | Crema panel (§ 5.1–5.13), ⌘I, "Create from document" |
| Images / PDFs | Yes, read by Claude in the chat | Yes in Claude Desktop (drop the photo in the chat) | Through the "vision model" slot (§ 5.16), or OCR first |
| Who is the editor | The user (Frappe sets the session user from the OAuth token) | The user (OAuth token or that user's API key) | The user (session) |
| Data goes to | Anthropic, under the user's plan terms | Anthropic, under the user's plan terms (the site itself stays private) | The chosen provider (§ 5.16 privacy), or nowhere if self-hosted |
| Private network | No: Anthropic's servers must reach the site | **Yes**: only the user's computer must reach the site; one user per setup | Outbound HTTPS only; nothing if self-hosted |

**Recommended default: tier 0** (no company bill, Frappe v16 already has every protocol piece, § 5.14). Tier 1 is a
later PR for teams that want the chat inside Crema; its recommended provider is in § 5.17.

Sections 5.1–5.13 describe the **Crema panel** (tier 1). Tier 0's chat is Claude's own UI; § 5.14 covers what Crema
adds around it.

### Crema panel (tier 1)

Backend and rules: § 5.16 and [GAPS 3.9](GAPS.md#39-ai-assistant-inside-crema). References studied: Frappe CRM's "Flow" assistant (`frontend/src/components/FlowChat/*` in github.com/frappe/crm —
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
| Frappe MCP disabled (System Settings → AI Agents) | Tier 0 stops working; Connect Claude shows the check in red. The Crema panel (tier 1) is unaffected: its tools run in-process (§ 5.16) |
| Limit reached | § 5.6 |
| Provider down | Error card + Retry; the rest of Crema unaffected |

**AI Settings page** (System Manager, `/desk/ai-settings`, the app's `Crema AI Settings`, § 5.16): tier, on/off, API key (write-only
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

All use a **stub model** (GAPS 3.9: tests cost nothing): the Crema app's stub client (§ 5.18) replays
scripted turns against the real tools.
- `e2e/p2.ai.panel.mjs` (4a): open by button / ⌘I / ⌘K Tab / record menu; Esc and ✕ close; focus returns; state
  remembered; docked at 1600, overlay at 1024, sheet at 390; coexistence with Preview tab; read-only answer with
  tool lines and links; Stop; error + Retry; off / no-role states.
- `e2e/p2.ai.write.mjs` (4b): create → filled form, ✦ markers, user saves; update → confirm card old → new, stale
  check, confirm runs, list refreshes, timeline note; submit card separate.
- `e2e/p2.ai.setup.mjs` (4c): "create a DocType Vehicle…" → builder draft → save → cleanup.
- `e2e/p2.ai.log.mjs` (4d): activity log rows, daily limit banner.


### 5.14 Tier 0: Claude connected to the site (default)

**What Frappe v16 already provides** (read in the bench's source):

| Piece | Where | Default |
|---|---|---|
| MCP endpoint, Streamable HTTP (POST, JSON responses, no session store), protocol `2026-07-28` and `2025-11-25` | `frappe/api/v2.py` rule `/mcp` → `frappe/mcp/transport.py` `handle_request`, `frappe/mcp/protocol.py` | On: System Settings → AI Agents → `enable_mcp` |
| 13 tools: search DocTypes / methods, DocType / method schema, document methods, list / get / count / create / update / delete documents, call a whitelisted method, call a document method | `frappe/mcp/tools/{discover,documents,methods}.py` | All, filtered by the user's permissions (REST v2 checks) |
| Only desk users | `transport.py`: `SYSTEM_USER_ROLE` required, else 403 | Website users can't connect |
| Server instructions sent to the client on `initialize` | `mcp/server.py` `server_configuration` → System Settings → AI Agents → `agent_instructions` | Empty |
| OAuth authorization server metadata (RFC 8414): code flow, PKCE `S256`, refresh tokens, revocation, introspection, public clients (`none`) | `frappe/integrations/oauth2.py` `_get_authorization_server_metadata`, `/.well-known/oauth-authorization-server` | On (OAuth Settings `show_auth_server_metadata`) |
| Protected resource metadata (RFC 9728) and `WWW-Authenticate: Bearer resource_metadata=…` on 401 / 403 | `oauth2.py` `_get_protected_resource_metadata`, `frappe/app.py` `set_authenticate_headers` | On (`show_protected_resource_metadata`) |
| Dynamic client registration (RFC 7591), guest-accessible; redirect URIs must be HTTPS outside developer mode | `oauth2.py` `register_client`, `integrations/utils.py` `validate_dynamic_client_metadata` | **On** (`enable_dynamic_client_registration`) |
| Bearer token → session user | `frappe/auth.py` `validate_oauth` → `frappe.set_user(<token's user>)` | Every change is made and versioned as that user |
| OAuth Client restrictions | `OAuth Client.allowed_roles`, `skip_authorization` | — |
| A user's connected apps with revoke | `/third_party_apps` (`frappe/www/third_party_apps.py`, `delete_client`) | — |

Not supported: Client ID Metadata Documents (a URL as `client_id`). So in Claude's connector settings the "published
identity" option won't work; use "Register automatically" or "Use your own OAuth client".

**What Claude needs** ([custom connectors help](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp),
[MCP authorization spec](https://modelcontextprotocol.io/specification/latest/basic/authorization)):
- Plans: Free (one custom connector), Pro, Max, Ultra, Team, Enterprise. Works in claude.ai, Claude Desktop, Cowork
  and the mobile apps. On Team only Owners / Primary Owners add an organisation connector (Enterprise: also a custom
  role with "Manage access to Libraries"); each member then connects (signs in) individually. Pro / Max users add it
  themselves under Customize → Connectors.
- The URL is reached **from Anthropic's cloud**: public internet, HTTPS on port 443 (no custom port), not behind a
  VPN or firewall unless Anthropic's IP ranges are allowed
  ([IP addresses](https://platform.claude.com/docs/en/api/ip-addresses)). A bench on `localhost` needs a tunnel
  (e.g. Cloudflare Tunnel) or a hosted site; Frappe Cloud sites already qualify.
- OAuth: Claude discovers the server via `WWW-Authenticate` → protected-resource metadata → authorization-server
  metadata, uses PKCE, and either registers itself (DCR) or uses a client ID / secret entered in "Advanced". The
  callback to register is `https://claude.ai/api/mcp/auth_callback`.

**Decision: a dedicated OAuth Client, DCR off.** Crema's Connect Claude page creates one OAuth Client "Claude"
(redirect `https://claude.ai/api/mcp/auth_callback`, grant Authorization Code, response Code, scopes `all openid`,
`allowed_roles` = the roles the admin picks). Then it turns DCR off, because `register_client` is open to guests and
would let anyone on the internet create OAuth Clients on the site. One known client also lets the Crema app tell
"via Claude" changes apart (below).

**Minimal path** (works on a v16 site as installed, no Crema app needed): DCR is on by default and the
`/.well-known/oauth-*` endpoints answer (checked on the bench), so a user pastes `https://<site>/api/v2/mcp` into
Claude's "Add custom connector", leaves OAuth on "Register automatically", connects and signs in. The site only needs
a public HTTPS URL. The steps below are the recommended, hardened version.

**Setup, all in the browser** (after the Crema Frappe app is installed, § 5.15; on Frappe Cloud that's also a
browser step):

| # | Who | Where | Step |
|---|---|---|---|
| 1 | System Manager | Crema → ⌘K "Connect Claude" (`/desk/connect-claude`) | The page runs the checks below and fixes what it can with one click each |
| 2 | System Manager | same | Pick the roles allowed to connect → **Create Claude client**. Copy the **Connector URL** (`https://<site>/api/v2/mcp`), **Client ID**, **Client secret** (shown once) |
| 3 | Team / Enterprise Owner (or each Pro / Max user) | claude.ai → Settings / Customize → Connectors → Add custom connector ("Open Claude settings" button on the page links there) | Name "<Company> ERP", paste the URL; Advanced → "Use your own OAuth client" → Client ID + secret; Authentication "Sign in when needed" |
| 4 | Each user | Claude → Connectors → the ERP connector → Connect | A Frappe login page opens (Crema's login if the site uses it); sign in; Frappe shows "Allow Claude to access your account" → Allow. Done |
| 5 | Each user | Crema → My settings → Connected apps | Sees "Claude · connected 26 Nov · last used 2 h ago" with **Revoke** |

Checks on the Connect Claude page (green / red, each with a fix button where possible):

| Check | How | Fix |
|---|---|---|
| Site URL is HTTPS and public | Crema's server fetches `https://<site>/.well-known/oauth-protected-resource` through the public host name and compares `resource`. A `localhost` / private IP / non-443 port fails with an explanation and a link to tunnel docs | — |
| MCP enabled | System Settings `enable_mcp` | Turn on |
| OAuth metadata published | OAuth Settings `show_auth_server_metadata`, `show_protected_resource_metadata` | Turn on |
| Claude client exists with the right callback | OAuth Client where `redirect_uris` contains the Claude callback | Create |
| DCR off | OAuth Settings `enable_dynamic_client_registration` | Turn off |
| Agent Instructions set | System Settings `agent_instructions` | Fill with the recommended text: use `crema.ai.tools.*` for matching and drafts, never submit, reply with the Crema link for each draft (Crema's base URL included) |
| Drafts-only guard on | Crema AI Settings `mcp_drafts_only` (default on) | Turn on |

Per-user status: "My connected apps" (any user; same data and `delete_client` revoke as Frappe's
`/third_party_apps`). System Managers also get **Connections**: every OAuth Bearer Token of the Claude client (user,
created, expires, last used, status) with Revoke and "Revoke all".

**What Crema (with its Frappe app) adds around Claude's chat:**
- **Tools that make the use cases reliable** (§ 5.15): item / supplier matching, "create draft from lines", price and
  stock, reorder and trend analysis. Frappe's MCP lets Claude find and call any whitelisted method
  (`search_methods` → `get_method_schema` → `call_method`), so these need no change to Frappe.
- **Drafts only, enforced on the server.** A `doc_events` hook on `before_submit`, `before_cancel` and `on_trash`
  throws "Submit / cancel / delete this in Crema" when the request is an MCP request (`frappe.local.mcp_request` is
  set by `mcp/transport.py`) and `mcp_drafts_only` is on. Claude's own "allow this tool?" prompt is a second,
  weaker layer.
- **"via Claude" on the timeline.** An `after_insert` / `on_update` hook adds a Comment "Created / Updated via Claude"
  when the request is MCP and the bearer token belongs to the Claude client (Frappe itself records only the user).
- **AI activity** (System Manager list, and per-user in My settings): one row per MCP tool call (user, tool,
  DocType / method, document, result, time), written by a `before_request` / `after_request` hook on `/api/v2/mcp`.
- **Links back.** Draft-creating tools return the Crema URL of the draft, and the Agent Instructions tell Claude to
  show it, so the user taps from Claude into Crema to review and submit. Crema's form shows the "Created via Claude,
  check and Submit" banner (§ 5.8) for drafts with that comment.
- **Home**: "Drafts from Claude (3)" appears in Needs you / Continue (§ 4.1.5) through the normal ranking.

**Use cases on tier 0:**

| Ask (in Claude) | What happens | Tools |
|---|---|---|
| Photo of a supplier quote: "make a PO for this" | Claude reads the photo itself (vision, in the user's plan). Calls `match_lines(lines, supplier_hint)` → gets matched / check / unmatched lines. Asks the user in the chat about the unclear ones (shows the 3 candidates). Calls `draft_purchase_order(supplier, lines, schedule_date)` → a **draft** PO (ERPNext's validate fills UOM, price list rate, taxes, warehouse). Replies with the totals and "Open in Crema ↗" | `crema.ai.tools.match_lines`, `match_party`, `draft_purchase_order` (or MCP `create_document`, which works but costs Claude many `list_documents` calls to match items) |
| "10 A4 paper, 5 blue pens for Acme, deliver Friday" | `match_party("Acme", "Customer")`, `match_lines`, `price_and_stock(items, customer)` shows rate, stock and projected qty; `draft_sales_order` → link | same + `price_and_stock`, `draft_sales_order` / `draft_quotation` |
| "What should I buy this week?" | `reorder_suggestions(days=7)` returns a computed table (projected qty, reorder level, average outflow, lead time, suggested qty). Claude explains it and offers "Create a draft Material Request with these?" → `draft_material_request(lines)` → link | `reorder_suggestions`, `draft_material_request` |
| "Which customers are slowing down?" / "Sales trend for item X" | `customer_slowdown(months=3)` / `item_sales_trend(item)`; Claude can draw a chart in its own UI from the returned rows | analysis tools |
| Submit / cancel / delete | Refused by the drafts-only guard with "Do this in Crema" and the link | — |

**Limits (said plainly in the page and in the docs):**
- The conversation is in Claude. Crema can't show it, continue it or search it; it sees only the tool calls (AI
  activity) and the resulting drafts.
- A subscription can't be driven by Crema's server, so there is no ✦ panel, no "drop a photo on the PO list", no
  ⌘I on tier 0. Crema's "Ask AI" entry points instead hand off to Claude: the desktop link
  `claude://claude.ai/new?q=…` opens Claude Desktop with the prompt prefilled; on the web Crema copies a ready prompt
  ("About Sales Order SO-0042 on <site>: …") to the clipboard and opens `claude.ai/new`.
- The uploaded photo stays in Claude. If the user wants it on the PO, they attach it in Crema (the banner offers
  "Attach the original document").
- Usage limits are the user's plan limits. Free has one custom connector.
- The site must be reachable from Anthropic's IP ranges over public HTTPS.

#### Tier 0-local: Claude on one computer, site not public

For one person using their own Claude plan on their own machine (personal use, allowed by the plan) against a site
that isn't on the public internet, e.g. a bench at `http://mysite.localhost:8000`. The connection starts on that
computer, so Anthropic's cloud never needs to reach the site.

| Client | How it connects | Auth |
|---|---|---|
| **Claude Code** | `claude mcp add --transport http frappe http://mysite.localhost:8000/api/v2/mcp` then `claude mcp login frappe` (commands from Frappe's MCP guide, docs.frappe.io/framework/guides-integration/mcp). Runs locally, so `localhost` works | OAuth: browser opens Frappe's login, then Allow. Frappe accepts `http://localhost` / loopback redirect URIs for dynamic registration even outside developer mode (`integrations/utils.py` `_is_secure_redirect_uri`) |
| **Claude Desktop** | Its "Add custom connector" is called from Anthropic's cloud, so `localhost` fails there. Instead add a **local MCP server** in `claude_desktop_config.json` that bridges stdio to the site's HTTP endpoint with the [`mcp-remote`](https://github.com/geelen/mcp-remote) package (`npx -y mcp-remote <url>`). For a plain-`http` URL that isn't loopback, `mcp-remote` needs `--allow-http` | Either OAuth through the bridge (it opens the browser and uses a localhost callback), or, simplest for one user, Frappe's API key: header `Authorization: token <api_key>:<api_secret>` passed with `--header-file` (keeps the secret out of the process list) |

Claude Desktop snippet that Crema generates (token variant):

```json
{
  "mcpServers": {
    "frappe": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://mysite.localhost:8000/api/v2/mcp",
               "--header-file", "/Users/<you>/.config/crema/frappe-mcp-headers.txt"]
    }
  }
}
```
`frappe-mcp-headers.txt` holds one line: `Authorization: token <api_key>:<api_secret>`.

**What Crema adds: Connect Claude → "On this computer" tab** (every allowed user, not only System Managers):
- Detects the site URL Crema talks to and shows the exact **Claude Code commands** and the **Claude Desktop
  snippet** for it, with Copy buttons and the config file location per OS.
- **Create / regenerate my API key** (token variant): a Crema app method that calls Frappe's key generation for the
  **session user only** (Frappe's own `generate_keys` is System Manager-only); the secret is shown once, with
  "Download headers file". **Revoke** clears the secret. Allowed only for roles ticked in AI Settings.
- Security note on the tab: "This key acts as you, with all your permissions, until you revoke it. Keep the file
  private; don't paste it into chats." The drafts-only guard and AI activity log apply to these requests too (they
  are MCP requests).
- Photo → PO works in Claude Desktop exactly as in tier 0 (drop the photo, Claude calls `match_lines` and
  `draft_purchase_order`); Claude Code is better for typed and analysis asks.

### 5.15 The shared tool layer (Crema Frappe app)

One Frappe app named **`crema`** (not `crema_ai`), installed on the site. Phase 3 adds the frontend to the same app,
so sites never install a second one. Modules: `Crema Home` (§ 4.1.7) and `Crema AI`. Every tool is a whitelisted
Python method with type hints and a docstring (Frappe's discovery reads them for `get_method_schema`), runs as the
session user without `ignore_permissions`, and returns compact JSON plus a `crema_url` for anything created.

| Tool (`crema.ai.tools.*`) | Does | Reads (permission-checked) | Writes |
|---|---|---|---|
| `match_lines(lines, supplier=None, customer=None)` | Matches free-text lines to Items in order: barcode (`Item Barcode`), supplier part no. (`Item Supplier`), item code, then link search on description (`frappe.desk.search.search_widget`, Item search fields + permission query); score, top 3 candidates for unclear lines | Item | — |
| `match_party(text, party_type)` | Supplier / Customer by tax id, name search, Contact email / phone → Dynamic Link | Supplier / Customer, Contact | — |
| `price_and_stock(items, customer=None, supplier=None, company=None)` | Rate, UOM, `actual_qty`, `projected_qty` via ERPNext `get_item_details` (pricing rules, price list) | Item, Bin, Item Price | — |
| `draft_purchase_order`, `draft_purchase_invoice`, `draft_material_request`, `draft_sales_order`, `draft_quotation` | `frappe.new_doc` → set party and rows → `insert()` (docstatus 0; controller validate fills item details) | — | **Draft only**; never submits |
| `reorder_suggestions(warehouse=None, item_group=None, days=7)` | Projected qty, reorder level / qty (`Item Reorder`), average daily outflow 30 / 90 days (`Stock Ledger Entry`), lead time (Item `lead_time_days`, else median PO → Purchase Receipt days), days of cover, suggested qty | Bin, Item Reorder, SLE, PO, PR | — |
| `item_sales_trend(item, months=12)` | Qty and amount per month vs last year | Sales Invoice Item (submitted) | — |
| `customer_slowdown(months=3)` | Per customer: last N vs previous N months, days since last order vs usual gap, drop > 30 % flagged | Sales Invoice | — |
| `run_report(name, filters)` | Any report the user may run | `frappe.desk.query_report.run` | — |

The numbers are computed in SQL / Python, so a model only explains them. Results are capped at 50 rows with a total
line. Python tests run each tool on seeded data (`crema/ai/tests`).

### 5.16 Tier 1: chat inside Crema, any provider

**Where it runs.** In the Crema Frappe app, not on Crema's Next server: the key sits in a Frappe **Password** field
(encrypted in `__Auth`, readable only by `frappe.utils.password.get_decrypted_password` on the server, shown as `*****`
to everyone including System Managers), tools run in-process as the session user, and Desk could use the same method
later. Frappe Builder stores its AI key the same way (`builder/ai/llm.py` `settings_api_key`).

**AI Settings** (single DocType `Crema AI Settings`, System Manager only):

| Field | Notes |
|---|---|
| Tier 0 options | `mcp_drafts_only` (default on), links to Connect Claude |
| Chat enabled, roles allowed | Boot flag per user: enabled ∧ role allowed ∧ key set |
| **Provider**: OpenRouter (default) / Anthropic / OpenAI-compatible / Gemini; base URL (prefilled: `https://openrouter.ai/api/v1`, `https://api.deepseek.com`, `http://<host>:11434/v1` for Ollama, …); API key (**Password**) | One key for all slots on OpenRouter; a slot can override provider + key |
| **Chat model** | Used for every turn |
| **Test mode** (OpenRouter `:free` models) | For trying the panel without paying (§ 5.17 limits); a red "Test mode" badge shows in the panel; blocked when any user outside System Manager is allowed |
| **Vision model** (optional slot: same four fields) | Used to read photos / PDFs when the chat model has no image input. Empty → OCR route (below) |
| **Analysis model** (optional slot) | Used when the user presses "Ask a stronger model" or for analysis tools' explanations |
| **Fallback model** (optional slot) | Retried once when the provider errors (5xx, timeout, 429 after retries) |
| Per-user daily limit (default 50 requests), **monthly budget cap** (currency amount; at 80 % System Managers get a notification, at 100 % the chat pauses until next month or the cap is raised) | Prices per million tokens are fields per slot (input, cached input, output) so the log can estimate cost for any provider |
| Data rules: **blocked DocTypes** and **blocked fields** (Table: DocType, field) | Tool results drop these before anything is sent; tools refuse to read blocked DocTypes; default blocks Salary Slip, Employee bank / tax fields, User, OAuth / Password-type fields |
| "What is sent" notice, upload limits (10 MB, PDF ≤ 20 pages), concurrency cap (2), delivery (stream / realtime), `stub_mode` (developer mode only) | |

**One adapter layer.** Tools are defined once (name, description, JSON Schema of inputs, Python handler). A
provider adapter converts tools, messages, tool calls, tool results, images and streaming events:

| Adapter | API | Tools | Streaming | Images | Caching |
|---|---|---|---|---|---|
| `anthropic` | Messages API, official `anthropic` SDK (`client.messages.stream(...)`) | `tools` with `input_schema`, `strict: true`; `tool_use` / `tool_result` blocks | SDK event stream | `image` / `document` blocks | `cache_control` on tools + system |
| `openai_compatible` | Chat Completions with `tools` (`type: function`), official `openai` SDK with `base_url` (**OpenRouter**, DeepSeek, OpenAI, Groq, Together, Ollama, vLLM). OpenRouter extras sent in the body: provider routing (`data_collection: deny`, ZDR) and `models` fallback list | `tool_calls` / `role: tool` messages | `stream: true` deltas, tool-call arguments assembled from chunks | `image_url` content parts when the model supports them | Provider-side automatic prefix caching where offered (DeepSeek, OpenAI); keep the prefix stable |
| `gemini` | Gemini API, official `google-genai` SDK | function declarations / function responses | streamed generate | inline image / PDF parts | explicit context cache (billed per hour of storage, so used only above a traffic threshold) |

One loop for all: send → stream text to the panel → for each tool call, validate → run → append result → repeat
(max 8 tool calls per turn, 90 s per turn). Fallback model on provider error.

**Streaming without background workers.** The method returns a werkzeug `Response` with a generator
(`frappe/handler.py` passes `Response` objects through). Frappe closes the request with a `ClosingIterator` that
calls `frappe.destroy` only after the body is sent (`frappe/app.py` `after_response_wrapper`), so the session and DB
stay valid while streaming; log writes commit explicitly. Headers `text/event-stream`, `Cache-Control: no-cache`,
`X-Accel-Buffering: no`. Crema's generic proxy buffers (`lib/frappe/proxy.ts` `arrayBuffer()`), so `/api/ai/chat` is
its own pass-through route. Each answer holds a gunicorn worker: 90 s cap (bench default timeout 120 s), per-site
concurrency cap; fallback delivery through `frappe.publish_realtime` (socketio, no workers).

**The model gets no write tools.** It gets reads plus `propose_document` (→ open a filled form, § 5.8) and
`propose_update` / `propose_action` (→ confirm card, § 5.7). Confirm calls `crema.ai.api.confirm(card_id)`, which
re-checks `modified` and runs the write as the user. The `draft_*` tools create drafts only.

**Photos and PDFs** ("Create from document"):
1. Vision slot set (or the chat model accepts images): the image (downscaled to ≤ 2,000 px) goes to that model with a
   strict JSON schema for header + lines.
2. No vision model: **OCR first, on the server**: text PDFs through `pypdf` (already in a bench), images through
   Tesseract (`pytesseract`, needs the `tesseract` binary on the server, a hosting step) → the chat model structures
   the OCR text into lines with the same schema. Handwriting is poor with OCR; the card says "Couldn't read reliably
   — check every line" when OCR confidence is low.
3. Matching, review card and filled form as in § 5.18.

**Privacy.** ERP data goes to the provider the admin chose. On OpenRouter: prompts and completions are not logged by default; the account's privacy settings should be **"ZDR only" and model training off**, and Crema sends `provider.data_collection = "deny"` on every request so a model whose hosts log or train is not used (the request fails instead). The underlying host still sees the data: Anthropic and OpenAI (US), Google (Gemini paid tier: not
used to improve products, per its pricing page), DeepSeek (servers in China, under Chinese law), OpenRouter (routes to
many hosts; pick hosts and data policy in its settings), or nowhere when self-hosted (Ollama / vLLM on the company's
own machine; a model that reads documents and calls tools well needs a GPU with roughly 24–48 GB memory; CPU-only is
too slow for chat). What is sent: the question, context chips, **only the tool results the model asked for**
(capped at 50 rows, blocked DocTypes / fields removed), and uploads. Never whole tables, never the key, never other
users' chats. The AI Settings page shows the provider's region next to its name, and the panel footer shows "Answers
by <provider · model>".

**Guardrails that matter more with cheap models:**
- **Strict validation**: every tool call's arguments are validated against the JSON Schema (pydantic) before running;
  on failure the error goes back as the tool result once, then the turn stops with "The assistant couldn't form a
  valid request".
- **Small tool set per task**: the panel sends 5–8 tools chosen by context (form: record tools; document drop:
  extraction + matching + draft; analysis question: analysis tools), not all 25.
- **Numbers computed on the server** (§ 5.15); the model only explains. Every number in an answer must appear in a
  tool result; answers with numbers not found in tool results get a "check these figures" marker.
- **Drafts only + confirm cards** (above); never auto-submit.
- **Eval set before switching provider**: `crema/ai/evals/` holds ~30 real tasks from the bench (5 photo → PO, 5 typed
  lines → SO, 5 "what should I buy", 5 summaries, 5 lookups, 5 refusals / permission cases), each with an automatic
  check (draft lines match, right tool chosen, no write without a card, numbers from tools). `bench --site … execute
  crema.ai.evals.run --kwargs "{'slot': 'chat'}"` prints pass rate, cost and latency per provider; a provider is
  switched only if it passes ≥ 90 % of the set.

### 5.17 Providers and cost (checked 2026-11-26)

Prices per million tokens from the providers' pricing pages on 2026-11-26
([Anthropic](https://platform.claude.com/docs/en/about-claude/pricing),
[DeepSeek](https://api-docs.deepseek.com/quick_start/pricing),
[Google](https://aistudio.google.com/docs/pricing), [OpenAI](https://developers.openai.com/api/docs/pricing)).
Recheck before choosing; they change often.

| Provider · model | Input | Cached input | Output | Images | Tools | Notes |
|---|---|---|---|---|---|---|
| Anthropic · Claude Haiku 5.5 (prompts ≤ 100k) | 0.10 | 0.01 | 0.50 | Yes | Yes | 1M context; same vendor as tier 0 |
| DeepSeek · `deepseek-flash` (V4.1 Flash) | 0.15 off-peak / 0.30 peak | 0.003 / 0.006 | 0.60 / 1.20 | Yes | Yes | 1M context; peak = 01–04 and 06–10 UTC weekdays; data in China |
| DeepSeek · `deepseek-v4-pro` | 0.66 / 1.32 | 0.022 / 0.044 | 1.98 / 3.96 | No | Yes | Analysis slot only |
| Google · `gemini-3.1-flash-lite` | 0.25 | 0.025 (+ storage per hour) | 1.50 | Yes | Yes | |
| OpenAI · `gpt-5-nano` | 0.05 | 0.005 | 0.40 | Not stated on the pricing page | Yes | Cheapest listed; quality to be shown by the eval set |
| Anthropic · Claude Sonnet 5.5 | 2.00 | 0.10 | 10.00 | Yes | Yes | Analysis / fallback slot |
| Open model, self-hosted (Ollama / vLLM) | — | — | — | model-dependent | model-dependent | Hardware cost only |

**OpenRouter (the default provider)** ([FAQ](https://openrouter.ai/docs/faq), [limits](https://openrouter.ai/docs/limits),
checked 2026-11-26): one key reaches all the models above at the **provider's own token price** (no markup); the
cost is a **5.5 % fee on credit purchases** (min. $0.80). OpenAI-compatible API, streaming, tool calls, images and
PDFs as base64; automatic fallback to the next host when one errors; variant `:exacto` routes to hosts with the
most reliable tool calling. Prompts and completions are not logged by default; Crema requires the account set to
ZDR-only with training off (§ 5.16 privacy).
- **Free models (`:free`) = test mode only.** Capped at 20 requests / minute and 50 requests / day for accounts that
  have bought less than $10 of credits, 1,000 / day after $10; hosts may throttle further. There is no large free
  token allowance. Free models are often served only by hosts that log or train on prompts, so they need the
  training toggle on. Fine for trying the panel with demo data; not for a company's daily use or real data.
- **Recommended paid trio on OpenRouter** (by today's price and tool-calling quality; the eval set confirms):

  | Slot | Model | Why |
  |---|---|---|
  | Chat | Claude Haiku 5.5 | Lowest price among strong tool callers; reads images; cached prefix at $0.01 / M |
  | Vision (photo / PDF → lines) | Claude Haiku 5.5 (same model, so no extra slot); alternative Gemini 3.1 Flash-Lite | Both read images; escalate a bad read to the analysis model |
  | Analysis / fallback | DeepSeek V4 Pro (cheap, strong reasoning, no images), or Claude Sonnet 5.5 where data must not be processed by a host in China | Explains computed tables; second opinion when the chat model fails |

Typical requests (tokens are rough; "cached" = the stable tools + system prefix):

| Request | Uncached in | Cached in | Out |
|---|---|---|---|
| Question from 1–2 reads | 4k | 18k | 0.6k |
| Typed lines → Sales Order | 6k | 18k | 0.8k |
| Photo of a quote → PO (one page, 2 turns) | 8k (image ≈ 3k) | 6k | 2k |
| "What should I buy this week?" | 20k | 12k | 1.2k |

| USD | Question | Text → SO | Photo → PO | What to buy | Per user per month* |
|---|---|---|---|---|---|
| Claude Haiku 5.5 | 0.0009 | 0.0012 | 0.0019 | 0.0027 | **≈ 0.57** |
| DeepSeek flash (peak; off-peak ≈ half) | 0.0020 | 0.0029 | 0.0048 | 0.0075 | ≈ 1.41 (0.71) |
| Gemini 3.1 Flash-Lite | 0.0024 | 0.0032 | 0.0052 | 0.0071 | ≈ 1.52 |
| GPT-5 nano | 0.0005 | 0.0007 | 0.0012 | 0.0015 | ≈ 0.34 |
| Claude Sonnet 5.5 (for comparison) | 0.016 | 0.022 | 0.037 | 0.053 | ≈ 10.6 |
| **OpenRouter trio** (Haiku 5.5 chat + vision, DeepSeek V4 Pro for analysis, + 5.5 % credit fee) | 0.0009 | 0.0012 | 0.0019 | ≈ 0.032 (peak) | **≈ 1.9** (≈ 1.2 off-peak) |
| OpenRouter `:free` (test mode) | $0 | $0 | $0 | $0 | $0, but max 50–1,000 requests / day for the whole account |

\* 20 requests / working day × 22 days = 440 requests: 50 % questions, 25 % text → order, 15 % photos, 10 %
analysis. Thinking / reasoning tokens and retries can multiply output 2–3×, so budget **≈ $1–2 per active user per
month** on the cheap models. Every request's real tokens and cost go to `Crema AI Log`.

**Default (owner's choice): OpenRouter with the trio above.** One key and one bill, a model per task, switchable in
AI Settings without code, and the 5.5 % fee is small next to the token prices. Haiku 5.5 does the daily chat and
reads photos, so photo → PO needs no OCR. The analysis slot only runs for analysis questions. Other providers stay
selectable: Anthropic direct (no fee, prompt caching under our control), DeepSeek direct (cheapest off-peak; data
processed in China), Gemini, OpenAI (GPT-5 nano is the cheapest listed; run it through the eval set), self-hosted.
The eval set decides, not the price table.

AI analysis cost (2026-11-26): the analysis column with DeepSeek V4 Pro at peak is 20k × 1.32 + 12k × 0.044 + 1.2k ×
3.96 per million ≈ $0.032 before thinking; with the request mix above the trio costs ≈ $1.9 / user / month including the fee, about
$1.2 off-peak.

**Tests**: the stub provider (`crema.ai.stub.StubClient`, `stub_mode`) replays scripted turns in either message
shape; adapter unit tests convert a fixture conversation (text, tool call, tool result, image) to and from each
provider format; no test calls a paid API.

**DocTypes** (answers § 9 Q1): `Crema AI Settings` (above), `Crema AI Chat` (owner-only), `Crema AI Log` (tier 0
MCP tool calls and tier 1 requests: user, provider, model, tools, tokens, estimated cost, result; System Manager read).

### 5.18 Capabilities: flows, review step, tests

The same four capabilities on every tier; only where the chat happens differs.

| Capability | Flow | Review step before anything is saved | Tests (no real model) |
|---|---|---|---|
| **A. Photo / PDF → Purchase Order / Invoice / Material Request** | Read the document (Claude vision on tier 0; the vision slot or OCR on tier 1) → `match_party` + `match_lines` → user resolves unclear lines (tier 0: in Claude's chat; tier 1: review card with ⚠ rows, 3 candidates, "Create item" quick entry) → `draft_*` (tier 0) or filled form (tier 1, rows set through the form engine so ERPNext's `item_code` trigger fetches price / UOM / tax as for a typed row) | Draft PO opens in Crema with the "Created via Claude / Filled by the assistant" banner; totals check vs the document's total; user saves / submits | Matching unit tests (barcode, supplier part no., fuzzy); stub extraction fixtures (quote, invoice, handwritten list); `e2e/p2.ai.document.mjs` (tier 1) and `e2e/p2.ai.mcp.mjs` (tier 0: drives `/api/v2/mcp` with a test OAuth token, checks a draft exists and that submit is refused) |
| **B. Typed lines → Sales Order / Quotation** | `match_party` + `match_lines` + `price_and_stock` (price list, pricing rules, projected qty, ⚠ when qty > projected) → `draft_sales_order` / filled form | Same | Stub turns; API check that the SO is a draft with the bench's prices |
| **C. Analysis and advice** ("what should I buy", trends, slowing customers) | Analysis tools compute; the model explains; answer = text + table + chart (Claude's chart on tier 0; Crema `DataTable` + chart component from the tool's chart spec on tier 1) + "Create draft Material Request / POs by supplier" | Ends with "Suggestions from stock and sales data up to <time>. You decide." Missing permissions are named, not guessed | Tool tests on seeded data with expected suggestions |
| **D. Everyday asks** (summaries, what's waiting, follow-up drafts, explain a report or error) | Reads only; emails are drafted into Desk's Communication composer (tier 1) or as text (tier 0); ToDo / Event as drafts or filled forms | User sends / saves | Stub turns |

**Guardrails (all tiers):** permissions of the session user only; drafts only (server-side guard on tier 0, no
write tools on tier 1); submit / cancel / delete always by the user in Crema; uploads limited by type and size
(tier 1: ≤ 10 MB, PDFs ≤ 20 pages); text in documents and uploads is treated as data, writes always pass a human
review; every tool call logged (Crema AI Log); "via Claude / via assistant" comment on changed documents.

**Stub model**: `Crema AI Settings.stub_mode` (developer mode only) swaps the client for `crema.ai.stub.StubClient`,
replaying scripted turns from `crema/ai/fixtures/*.json` against the real tools. Tier 0 tests call `/api/v2/mcp`
directly with a token minted for a test user. No test calls a paid API.

### 5.19 Where it appears in Crema

| Place | Tier 0 (Claude connector) | Tier 1 (Crema panel) |
|---|---|---|
| Header ✦ / ⌘I | Opens a small popover: "Ask in Claude ↗" (copies a prompt about the current page) + Connected status | Opens the panel (§ 5.2) |
| Home | "Drafts from Claude" in Needs you / Continue; Ask AI card → Claude link | Ask AI card with suggestions from the home's data (§ 4.1.5); drop a file to start A |
| List toolbar "Create from document" (PO, PI, PR, MR, SO, Quotation lists the user can create) | Hidden | Opens the panel with the file picker, target preset |
| Form | Banner on drafts made via Claude: "Check and Submit" + "Attach the original document" | Drop a file on the Items grid → "Add lines from this document" (drafts only) |
| Settings | Connect Claude (System Manager), My connected apps (everyone), AI activity | AI Settings, AI activity |

### 5.20 Similar apps studied

| App | Model access | Pattern | Take from it |
|---|---|---|---|
| "Bizak AI" | Not found. The only public trace is a "Bizak" ERP user guide ([github.com/bizakerp/bizak-user-guide](https://github.com/bizakerp/bizak-user-guide)) with module docs and no AI pages. How its AI works is unknown | — | — |
| Frappe Assistant Core ([github.com/buildswithpaul/Frappe_Assistant_Core](https://github.com/buildswithpaul/Frappe_Assistant_Core)) | Free path: an MCP server in Frappe; users connect Claude / ChatGPT / Cursor with OAuth as themselves ("you bring the LLM"). In-Desk "FAC Chat" is a separate paid SaaS | Tier 0 + a paid tier 1 | The same split as ours; their admin page shows the MCP endpoint URL to copy |
| ERPNext AI Assistant ([github.com/ahmad18189/erpnext_ai_assistant](https://github.com/ahmad18189/erpnext_ai_assistant)) | The site's own OpenAI-compatible key in "ERP AI Settings" (default `gpt-4o-mini`, base URL configurable) | In-Desk panel calling the model server-side with session-scoped tools; writes wait for confirmation | Cheap small model by default; configurable base URL (our provider setting); "Show the list" buttons that open real Desk lists |
| Vyogo AI / `frappe_ai` ([github.com/vyogotech/frappe_ai](https://github.com/vyogotech/frappe_ai)) | An external agent service (`frappe_ai_agent_url` in site config) that holds the model access | Desk sidebar; streams through `frappe.realtime`; Allow / Deny cards; writes run on a one-time token the app mints | Realtime streaming fallback; one-time tokens for approved writes |

A "Bizak-like" chat inside Frappe is almost certainly the second or third pattern: an in-Desk panel calling a
model API from the server with the site's (or the vendor's) key. Any chat that lives inside Frappe / Crema needs
model API access paid by someone; only tier 0 uses the users' own Claude plans, and its chat lives in Claude.

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
green with the switch off. Suite names are new files under `crema-frontend/e2e/`. PRs marked **app** also change the
Crema Frappe app (§ 5.15) and include its Python tests (`bench run-tests --app crema`).

**Build order (owner's priority, 2026-11-26).** PR 0, then side by side: **Connect Claude (C1, C2) and the dynamic
home (2b, 2c)**, then **wide screens (2a)**, the **DocType builder (3a–3c)**, the **in-Crema chat (4a, 4b, 4e, 4c,
4d, 4f)**, then the rest in the order below. PR ids are kept from the first version of this plan so other sections'
references stay valid.

| Order | PR | Title | Contains | Suite(s) | Must include in the PR | Depends on |
|---|---|---|---|---|---|---|
| 1 | 0 | Measuring + switch at first paint | `e2e/lighthouse.mjs` (S7), `NEW_LAYOUT=1` and `t.axe()` in `e2e/lib.mjs`, `crema_ui` cookie mirror so SSR renders the chosen layout (§ 6.3), tokens from § 2.1 and § 10, `Tooltip`/`Kbd`/`Toast` | `p2.foundation` (extended) | Baseline Lighthouse table for all § 6.1 routes, Desk and Crema | — |
| 2 | C1 | **app** Crema Frappe app + Connect Claude (tier 0) | App skeleton (`crema`, modules Crema Home / Crema AI), `Crema AI Settings`, Connect Claude page (§ 5.14 checks, create the Claude OAuth Client, DCR off, Agent Instructions text; "On this computer" tab with Claude Code / Desktop snippets and own API key), My connected apps + System Manager Connections with revoke, drafts-only guard on MCP requests, "via Claude" comment, `Crema AI Log` for MCP tool calls, AI activity list | `p2.connectclaude` (checks, client created, revoke) + `p2.ai.mcp` (MCP call with a test token: draft allowed, submit refused, comment and log written) | Screens of the page with all checks green / one red; a manual run with a real Claude connector against a tunnelled bench, noted in the PR | 0 |
| 3 | 2b | **app** Dynamic home | `crema.api.home.get_home` (candidates from permissions, Needs you / Quick create / Continue / KPI / Auto KPI / Chart / Quick list / Today / Recent / Workspaces cards, § 4.1.3–4.1.5), reduced home without the app, CardGrid, edit mode (pin / hide / reorder / resize, keyboard), `user_settings` layout, cache invalidation hooks | `p2.home` | Home for 3 seeded roles side by side; `get_home` timings; Lighthouse home ≥ 98 desktop | 0, C1 (app skeleton) |
| 4 | C2 | **app** Shared tools | `crema.ai.tools.*` (§ 5.15): `match_lines`, `match_party`, `price_and_stock`, `draft_*`, `reorder_suggestions`, `item_sales_trend`, `customer_slowdown`, `run_report`; discoverable through MCP `search_methods` | Python tool tests on seeded data; `p2.ai.mcp` extended (photo-to-PO and typed-lines flows driven through MCP with fixture lines) | A recorded Claude session (tier 0) doing PO-from-photo and "what should I buy", screenshots without client names | C1 |
| 5 | 2c | **app** Home learning | Crema writes Route History (Desk route strings, `deferred_insert`), usage profile + role prior + ranking (§ 4.1.4), stable order, `Crema Home Default` + "Publish for role", "Drafts from Claude" in Needs you | `p2.home` (extended: usage changes Quick create; role default applied) | Ranking unit tests; before / after home for a user with seeded history | 2b |
| 6 | 2a | Large screens | Fluid shell (§ 3.4: no 1290 cap, sidebar 240 / rail 56 with pin + collapse, dock rule, `--field-max`, `--measure`), `Rail` / `Resizer` / `Sheet` / `Banner` primitives (moved here from PR 1 / 5a), form 2 → 3 columns by container, form Activity / Info docked at ≥ 1600, list filters pane and form outline at ≥ 1920, second right column at ≥ 2240, pane state remembered | `p2.widths` | Screens of home / list / form at 1280 / 1600 / 1920 / 2560 | 0 |
| 7 | 3a | DocType builder: start + checks | Start dialog with naming example, live checks from `form_builder/store.js`, ErrorSummary | `p2.doctypebuilder` | — | 0 |
| 8 | 3b | DocType builder: canvas + permissions + done | Palette with plain names, properties panel, permissions step, after-save actions; reuses `FormBuilder.tsx` | `p2.doctypebuilder`, `doctype.create` | Builder screens 1280 / 1600 | 3a |
| 9 | 3c | Customize Form in the builder | Custom Field + Property Setter path, allowed properties | `p2.customizeform` | — | 3b |
| 10 | 4a | **app** In-Crema chat (tier 1): settings + panel | `crema.ai.api.chat` (streaming in the request, § 5.16), provider adapter layer (`anthropic`, `openai_compatible`; OpenRouter default with the chat / vision / analysis / fallback slots), strict tool-input validation, budget cap, test mode, stub client; `/api/ai/chat` pass-through; panel in Rail / Sheet, open / close rules, chips, streaming, tool lines, Stop / Retry / errors, empty state, history, off / no-role states | `p2.ai.panel` | Panel at 390 / 1024 / 1600; a11y 100 with panel open; panel chunk size; cost per request from the log on 10 stub-free manual asks | 2a, C2 |
| 11 | 4b | AI: filled form + confirm cards | open_form flow with ✦ markers and banner; ConfirmCard (old → new, stale check, submit / cancel / delete separate); refresh + timeline note | `p2.ai.write` | Card screenshots; API checks that nothing ran before Confirm | 4a |
| 12 | 4e | AI: create from a document (tier 1 UI) | Drop / camera / 📎 in the panel, "Create from document" on lists, drop on Items grid; review card (matched / check / unmatched, create item); vision slot or OCR route | `p2.ai.document` | Review card screens; extraction cost per page from the log | 4b |
| 13 | 4c | AI: setup changes via builders | Drafts into DocType builder / Workflow builder / Print Format Builder; server-script rule | `p2.ai.setup` | — | 4b, 3b |
| 14 | 4d | AI: limits and cost | Per-user daily limit, concurrency cap, usage counter in the panel, cost columns in the AI activity list | `p2.ai.log` | — | 4a |
| 15 | 4f | AI: Gemini adapter + eval harness | `gemini` adapter; `crema.ai.evals` (~30 tasks, pass rate / cost / latency per provider) | adapter unit tests; eval run with the stub | Eval table for the default trio and one alternative | 4a |
| 16 | 1 | Record preview + wiring | Preview tab porting Desk `ui/side_panel.js` (history / back, Esc rule, close on route change, open full page, width saved); list row preview (§ 4.2 preview row), report link cells (`link_side_panel.js`), link hover card (`ui/link_preview.js`); My work linked from sidebar; ⌘K "Go to My work" | `p2.preview`, `p2.mywork` | Preview at 1280 / 1600, sheet-not-used on phone (routes to page), INP of ↑/↓ | 2a |
| 17 | 5a | Form: header, summary, sections | Sticky header with one primary action, SummaryCard, sections as cards, More fields, `Field` / `FieldGroup` | `p2.form` + `formsave`, `form.salesorder`, `workflow`, `formmenu`, `formnav` (NEW_LAYOUT=1) | Task 1 click count, classic vs new | 2a |
| 18 | 5b | Form: errors, unsaved, restore, undo, success action | ErrorSummary, unsaved bar, IndexedDB restore, `undo_manager.js` port, `success_action.js` port | `p2.form` | — | 5a |
| 19 | 6 | Child tables | `DataTable` grid mode: sticky / resize columns, totals row, row in Rail, phone cards | `p2.grid` + `grid*` (NEW_LAYOUT=1) | INP typing in a grid cell | 5a |
| 20 | 7 | Lists | ViewTabs, FilterChips, BulkBar, InlineEdit (report_view rules), phone cards, empty states | `p2.list` + `list.salesorder`, `listlayouts`, `bulk`, `listhooks`, `listrowextras` | Task 3 click count; list Lighthouse | 1, 6 (DataTable) |
| 21 | 8 | Timeline | Filters, day groups, collapsed calculated changes, Activity tab comment box | `p2.timeline` + `timeline` | — | 5a |
| 22 | 9 | Reports | Filter chips + More filters panel, saved filter sets, chart collapse, column state, link preview | `p2.report` + `report`, `reportview`, `reportgroupby`, `financials`, `reportsave` | Task 5 click count | 6, 1 |
| 23 | 10 | Search | ⌘K groups and ranking from `search_utils.js`, results page, #tag, Ask AI row (tier 0: "Ask in Claude ↗"; tier 1: panel) | `p2.search` + `awesomebar` | — | C1 |
| 24 | 11 | Mobile | Bottom nav, Create sheet, scanner (`scanner/`) for Item / barcode fields, camera for Attach (`ui/capture.js`), keyboard-aware bars, Needs you action sheet | `p2.mobile` + `mobile` | Screens at 390 / 768; mobile Lighthouse | 5a, 7 |
| 25 | 12 | Settings pages | My settings page, Single DocType "Find a setting" | `p2.settings` | — | 5a |
| 26 | 13 | Onboarding | Checklist card, tours via driver.js, first-visit tips | `p2.onboarding` | — | 2b |
| 27 | 14 | Speed | S1 compression (can land any time after 0), S3 batching, S4 server first paint, S5/S6 JS + fonts, S8 prefetch, CI budget check | `p2.speed` (checks requests count and `content-encoding`) + all p2 suites | Lighthouse table for all routes: ≥ 95 / 100 | 0; S4 after 5a |
| 28 | 15 | Accessibility pass | § 7 fix list on remaining classic-shared parts, `p2.keyboard` | `p2.keyboard`, axe in all p2 | Lighthouse a11y 100 table | 0 |
| 29 | 16 | Usability check + default on | G1/G2 session, write-up; then make New layout the default for new users (classic stays one switch away) | `p2.tasks` | Usability notes | all |

S1 (compression) and 15's contrast fixes have no screen dependency; split them out and land early if a quick win is
wanted. Tier 0 (C1, C2) needs no Crema screen work beyond the settings page, so it ships first and gives users an
assistant while the rest is built.

```
0 ─┬─ C1 ─┬─ C2 ─────────────────────────┐
   │      ├─ 2b ─ 2c                      │
   │      │    └─ 13                      │
   │      └─ 10 (search)                  │
   ├─ 2a ─┬─ 4a ◄─────────────────────────┘
   │      │   ├─ 4b ─┬─ 4e
   │      │   │      └─ 4c ◄── 3b
   │      │   ├─ 4d
   │      │   └─ 4f
   │      ├─ 1 ──────────────┐
   │      └─ 5a ─┬─ 5b       │
   │             ├─ 6 ─ 7 ◄──┤─ 11
   │             │      └ 9 ◄┘
   │             ├─ 8
   │             └─ 12
   ├─ 3a ─ 3b ─ 3c
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
| R7 | Tier 0 needs a public HTTPS site; some clients run on private networks | Connect Claude explains the failure; tunnel or hosted site; tier 1 / 2 need only outbound HTTPS or nothing |
| R8 | Claude (tier 0) can call any whitelisted method the user may call, including submit | Drafts-only guard in the Crema app on MCP requests; OAuth Client `allowed_roles`; AI activity log; revoke per user |
| R9 | Sites must install the Crema Frappe app for learning home, tier 0 hardening and tools | Home and minimal tier 0 work without it (reduced); the app is small and is the phase 3 app anyway |
| R10 | A streaming chat holds a gunicorn worker (tier 1) | 90 s turn cap, per-site concurrency cap, realtime delivery fallback |
| R11 | Cheap models call tools badly or invent numbers | Strict schema validation, small tool sets, server-computed numbers, drafts only, eval set before switching (§ 5.16) |
| R12 | ERP data processed by a third-party host (OpenRouter routes to many) | ZDR-only + training off required, `data_collection: deny` per request, blocked DocTypes / fields, self-host option |

### Open questions for the owner

1. **Crema Frappe app now, not in phase 3?** The learning home, the tier 0 hardening and the tools need server
   code (§ 4.1.3, § 5.15). Recommendation: create the `crema` app now (chat history, AI log, home defaults live in its
   DocTypes). Confirm, and say whether it lives in this repo (`crema-app/`) or its own repo.
2. **Role-published home layouts:** decided: DocType `Crema Home Default` in the app (§ 4.1.8), as Frappe CRM does.
3. **Accent colour source:** Navbar Settings has a logo but no colour field in v16 — add a field in Crema settings,
   or keep espresso black? Recommendation: keep black until phase 3's `Crema Settings`.
4. **Confirm-card totals:** showing recalculated totals before Confirm needs a server dry run Frappe doesn't offer.
   Accept "recalculated on save" for numeric changes, or add a whitelisted dry-run method in phase 3?
5. **Tier 1 provider and limits:** OpenRouter with Haiku 5.5 (chat + vision) and DeepSeek V4 Pro or Sonnet 5.5
   (analysis), 50 requests / user / day, monthly budget cap (§ 5.17). Is processing by hosts in China acceptable
   (decides DeepSeek vs Sonnet for analysis)? What monthly cap per site?
7. **Tier 0 accounts:** will users connect with their own Claude plans, or will the company buy Team seats so an Owner
   adds the connector once for everyone?
8. **Public URL:** which sites are reachable over public HTTPS today? The local bench needs a tunnel to test tier 0.
9. **"Bizak AI":** nothing public found (§ 5.20). If you have a link or a screenshot, it can be compared properly.
6. **Usability sessions:** who are the 3–5 users and which site's data is used (screenshots must stay free of client
   names)?

---

## 10. Research: Frappe's own newer frontends

Frappe's newer apps are Vue SPAs on [frappe-ui](https://ui.frappe.io) (shells, sidebar rail, list, settings
dialog, editor; semantic tokens `ink-gray-*`, `surface-*`, `outline-gray-*`). File paths below are in each repo's
frontend.

| App (source) | Borrow | Avoid |
|---|---|---|
| **Frappe CRM** ([frappe/crm](https://github.com/frappe/crm), `frontend/src/components`) | 1. **Home of widgets with role defaults**: a 20-column grid with 42 px rows (`Home/widgets.js`), per-user layout, manager-published `RoleDefault` (`crm/fcrm/doctype/crm_dashboard/home_layout.py`): our § 4.1.8. 2. **"Today's brief"** (`Home/Brief.vue`, `crm_dashboard/brief.py`): a short list of what needs attention with age in red when late; our Needs you. 3. **Record page = activity in the middle + editable side panel** (`SidePanelLayout.vue`, `SidePanelLayoutEditor.vue`, `Activities/`): emails, calls, notes, tasks and changes in one timeline. 4. **ViewControls** (`ViewControls.vue`, `ColumnSettings.vue`, `GroupBy.vue`, `Kanban/`): saved views, quick filters, column picker and kanban in one toolbar | Settings spread over many modals; CRM-only concepts (Lead / Deal) baked into components |
| **Helpdesk** ([frappe/helpdesk](https://github.com/frappe/helpdesk), `desk/src/components`) | 1. **Conversation + details panel** with a `Resizer.vue` between them. 2. **Saved replies** picker (`SavedRepliesSelectorModal.vue`): for Crema's comment / email composer. 3. **UnsavedBadge** and **TypingIndicator**: small state signals. 4. `ListViewBuilder.vue`: one list component configured per DocType | Separate agent / customer portals duplicating screens |
| **Gameplan** ([frappe/gameplan](https://github.com/frappe/gameplan), `frontend/src/components`) | 1. **Separate desktop and mobile layouts** (`DesktopLayout.vue`, `MobileLayout.vue`, `MobileListRow.vue`) rather than one squeezed layout. 2. **App rail** (`AppRail/`) + `CommandPalette/`. 3. **Reading width** for prose and comments. 4. `ListRowSkeleton.vue`, `LoadError.vue`: every list has a skeleton and an error row | Discussion-first navigation doesn't fit ERP data |
| **Insights** ([frappe/insights](https://github.com/frappe/insights), `frontend/src2`) | 1. **Workbook → chart → dashboard** flow and a chart config pane. 2. **DataTable with footer totals** (`components/DataTable.vue`, `DataTableFooter.vue`) and per-column number formats (`table_number_formats.ts`). 3. **TabbedSidebarLayout** for settings | Query-builder UI for end users who just want a report |
| **Drive** ([frappe/drive](https://github.com/frappe/drive), `frontend/src/components`) | 1. **Grid / list toggle** (`GridView.vue`, `ListView.vue`). 2. **Right-click context menu** (`ContextMenu.vue`) for row actions. 3. **Upload tray** (`UploadTracker.vue`): for attachments and "Create from document". 4. **Shortcuts dialog** (`ShortcutsDialog.vue`, "?" key) | — |
| **LMS** ([frappe/lms](https://github.com/frappe/lms), `frontend/src/components`) | 1. **PWA install prompt** (`InstallPrompt.vue`) for phone users. 2. **BottomSheet** on mobile. 3. **Empty states with actions** (`EmptyStateActions.vue`) | Course-specific chrome |
| **HRMS mobile PWA** ([frappe/hrms](https://github.com/frappe/hrms), `frontend/src/components`) | 1. **Bottom tabs** (`BottomTabs.vue`). 2. **Approve / reject as an action sheet** (`WorkflowActionSheet.vue`, `RequestActionSheet.vue`): our phone Needs you. 3. **Filters as an action sheet** (`ListFiltersActionSheet.vue`). 4. **Quick links home** (`QuickLinks.vue`) | Ionic as a second UI stack |
| **Builder** ([frappe/builder](https://github.com/frappe/builder), `frontend/src/components`) | 1. **Three panes**: layers left, canvas centre, properties right (`BuilderLeftPanel.vue`, `BuilderCanvas.vue`, `BuilderRightPanel.vue`): our DocType builder (§ 4.9). 2. **AI chat panel that lists what it changed** (`BuilderAIChatPanel.vue`, `AIAffectedItems.vue`): our "changed by the assistant" summary. 3. AI key in a Settings Password field (`builder/ai/llm.py`) | Running AI in background jobs + realtime only (needs workers; § 5.16 streams in the request) |
| **Frappe v16 Desk** (`frappe/public/js/frappe`, `frappe/boot.py`) | 1. **App-scoped sidebars** (`module_sidebars`, Workspace Sidebar DocType): one sidebar per app. 2. **Desktop of app icons** (Desktop Icon / Desktop Layout DocTypes). 3. **Espresso tokens** (already copied into Crema) | Fixed ~1280 px page width |

**What makes the "modern Frappe" look, and Crema's tokens for it** (adds to § 2.1):

| Trait | In frappe-ui apps | Crema rule |
|---|---|---|
| Type | Inter; sizes as classes with weight baked in (`text-base-medium`, `text-lg-semibold`); weights 400 / 500 / 600 only | Keep Inter and 14 px base. Add `--type-*-medium` / `-semibold` pairs; no 700 in UI chrome; tables 13 px in compact |
| Ink | Grays for text (`ink-gray-9` headings, `-7` body, `-5` meta), colour only for status | `--ink-*` aliases already map this; headings use `--ink-default`, meta `--ink-muted`. No coloured text outside status and links |
| Surfaces and lines | White cards on a white page separated by 1 px `outline-gray-*` borders, very light shadows only on overlays | `--surface-*` + `--outline-default`; `--elevation-1` only for overlays and dragged cards |
| Density | Compact lists (36–40 px rows), roomy dialogs and settings | Comfortable default (§ 2.2) for forms and home; lists default to compact rows on ≥ 1280 |
| Radius | Small and consistent (frappe-ui `rounded-5…7`) | Keep the three `--round-control / card / panel` steps; nothing ad hoc (no `rounded-[…]` in new code) |
| Motion | Short, no bounce; panels slide, menus fade | § 2.3 durations; `--ease-enter` / `--ease-exit`, nothing over 320 ms |
| Loading | Skeleton rows, never full-page spinners | Skeletons in the final layout (§ 4.11) |
| Naming | `ink-*`, `surface-*`, `outline-*` | Keep these names (§ 2.1 already does) so phase 3 can share CSS with frappe-ui apps |
