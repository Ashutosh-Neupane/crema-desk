# Trevo ↔ Frappe Desk: what's left, and how we get there

Last audit: 2026-10-17 (Frappe v16 + ERPNext v16 on vendor1.localhost, hub hub).
Legend: ✅ done + e2e · 🟡 partial / exists but unverified · ❌ missing.
Order inside each section = impact on daily use. `node e2e/run-all.mjs` runs every suite (26 today, all passing).

---

## 0. Phases

| Phase | Goal | Repos |
|---|---|---|
| **1 — transcription** (now) | Everything a user can do in Desk works in Trevo, verified against a live bench | `trevo` (Next.js) + benches in `School_saas` |
| **2 — UI/UX** | Improve space use, navigation, density, inline editing once behaviour is pinned by e2e | same |
| **3 — Frappe app** | Ship Trevo as a Frappe custom app that replaces `/desk` on any site | `trevo` becomes an app (python package + built frontend) |

Rule for phase 1: never hard-code an app (ERPNext, hub). Behaviour comes from metadata, the site's own JS,
and whitelisted methods — so any Frappe app works.

---

## 1. How Frappe's JavaScript runs in Trevo (compatibility architecture)

Frappe's frontend is four kinds of code; each gets a different strategy.

| Layer | What it is | Strategy | Status |
|---|---|---|---|
| **L1 Metadata UI** | DocType forms, lists, views, reports | Native React driven by meta; the site's JS (`__js`, `__list_js`, `__tree_js`, `__calendar_js`, report JS, Client Scripts) runs in the Desk runtime (`lib/desk-runtime`) against a `frappe` / `frm` / `cur_frm` compatibility API | ✅ core done |
| **L2 Script DOM** | Form scripts that write into the page: `frm.fields_dict.x.$wrapper.html()`, `$(frm.wrapper).find()`, `frm.dashboard.add_section()` | Load **real jQuery** into the runtime and give scripts real DOM nodes: each HTML field renders a container whose node is `fields_dict[f].wrapper` / `$wrapper`; `frm.dashboard`, `frm.page.body`, `frm.layout.wrapper` get containers too. Unknown members stay chainable no-ops (NOOP) | 🟡 NOOP stubs today; real-DOM containers ❌ |
| **L3 Desk widgets** | jQuery widgets Desk mounts inside forms: RoleEditor, ModuleEditor, Permission Manager, form tour, dashboard heatmap/graph | Rebuild natively, keyed by DocType + HTML field (`components/form/widgets`), writing to the **same child tables** as Desk so saving is identical | ✅ RoleEditor + ModuleEditor |
| **L4 Whole pages** | Desk Pages built with jQuery/Vue: POS, Setup Wizard, Visual Plant Floor, BOM Comparison, Sales Funnel, any app's `/app/<page>` | **Legacy page host**: `/desk/page/<name>` mounts Frappe's own page (served at Trevo's `/app/<path>`) in a same-origin frame; `/assets`, `/files`, `/api/method`, `/api/resource` proxied; Desk chrome hidden; title and Form/List/Report navigation bridged back to Trevo. Replace page by page with native rebuilds where UX matters (POS first) | ✅ (`e2e/legacy.mjs` — ERPNext POS) |

Why not import Frappe's whole `desk.bundle.js` into React? It assumes it owns `document`, the router,
`frappe.boot`, global CSS and jQuery event delegation; mixing it with React rendering breaks both. L4 isolates it in
a frame instead — which is exactly how it will run in phase 3 (same origin, no proxy).

### User & roles (done)
- User form: `roles_html` / `modules_html` render native editors (filter, select all/none, counts). Checked roles ⇔
  `roles` rows (Has Role); unchecked modules ⇔ `block_modules` rows (Block Module), like `frappe.RoleEditor` /
  `frappe.ModuleEditor`. Disabled when Role Profiles / a Module Profile drive them.
- Role Profile and Module Profile use the same editors. Verified by `e2e/users.mjs`.
- Still to do for users: Permission Manager page (L3), User Permission flows, "Reset Password" / "Send Login Link"
  custom buttons (verify), impersonation banner, API key dialog.

### POS, Banking and other app pages (next step)
1. ✅ L4 host: `/desk/page/point-of-sale`, `/desk/page/<any page>`; sidebar/workspace Page links go there.
2. Native POS (phase 2 candidate): ERPNext POS is `erpnext.PointOfSale.Controller` (jQuery) over whitelisted APIs
   (`erpnext.selling.page.point_of_sale.point_of_sale.*`) — rebuildable on the same APIs.
3. Vue / frappe-ui apps with their own SPA at `/<app>` (Helpdesk, CRM, Banking) aren't Desk pages — link out.

---

## 2. Remaining features (phase 1 checklist)

### 2.1 Forms
- ✅ Save/submit/cancel/amend/delete, scripts, ERPNext transaction logic, grid (drag, pages, CSV), quick entry,
  shortcuts, sidebar, timeline + mentions + email, print, rename/links/remind/customize, workflow, realtime,
  Get Items From, attach fields, route_options.
- ❌ L2 real-DOM containers + real jQuery (app scripts that draw HTML).
- ❌ Form dashboard beyond Connections: heatmap, stats, `frm.dashboard.add_indicator/add_progress/add_comment`.
- ❌ Undo/redo (form/undo_manager.js), form tour, success action.
- ❌ Grid: multi-row edit, "Insert Above", per-user grid column settings.
- 🟡 Virtual / single DocTypes (System Health Report) should render read-only like Desk.
- ❌ Email Template picker, reply/forward from a timeline email, composer attachments.
- ❌ Permlevel read-only sections and permission banners; Attachment Gallery control; header avatar from image_field.

### 2.2 Field controls (lib/trevo-form/controls)
- ✅ Data, Int, Float, Currency, Percent, Check, Select, Link, Dynamic Link, Date, Datetime, Table, Attach,
  Attach Image, HTML, Code.
- 🟡 Exist but not verified against Desk: Text Editor (Quill: images, mentions, tables), Markdown, HTML Editor, JSON,
  Small/Long Text, Time, Duration, Rating, Color, Phone, Password, Signature, Barcode, Geolocation, Icon,
  Autocomplete (method-backed), Table MultiSelect, MultiSelect/Pills, MultiCheck, Button, Heading, Date Range.
- ❌ Attachment Gallery; Data `options` validation (Email/URL/Phone/IBAN); `show_title_field_in_link`.

### 2.3 Lists and views
- ✅ List (filters, group-by, sort, paging, bulk actions, realtime), Report view, Kanban, Calendar, Gantt, Tree, Image,
  Inbox, File manager, Import/Export.
- ❌ Map view (Geolocation, Leaflet).
- ❌ List sidebar (Assigned To / Created By / Tags counts), saved filters (List Filter), "Assigned to me".
- ❌ List settings dialog, likes / comment counts / assignee avatars in rows.

### 2.4 Reports
- ✅ Query/Script reports (filters, formatter, tree, totals, chart, summary, prepared), Report Builder reports.
- ❌ Save a Query Report as a custom report, report PDF (`report_to_pdf`), Auto Email Report setup, column
  reorder/resize persistence.

### 2.5 Pages (Page doctype — 17 on this site)
| Page | Plan | Status |
|---|---|---|
| permission-manager | L3 native on `core.page.permission_manager.*` | ❌ (redirects to Role list) |
| print-format-builder (+ beta) | L3 native builder on Print Format `format_data` | ❌ |
| backups | L3 native (backup files, schedule files backup) | ❌ (redirects) |
| setup-wizard | L4 host, later native | ✅ via L4 |
| point-of-sale | L4 host now, native later | ✅ via L4 |
| sales-funnel, stock-balance, warehouse-capacity-summary, bom-comparison-tool, visual-plant-floor | L4 host | ✅ via L4 |
| workspace-restore, component-explorer | L4 host | ✅ via L4 |
| workflow-builder | 🟡 prototype — verify against the Workflow doc | 🟡 |
| desktop, dashboard-view, print | native | ✅ |

### 2.6 Shell, navigation, search
- ✅ Sidebar from boot, workspaces, ⌘K awesomebar, shortcuts, notifications, breadcrumbs.
- ❌ Awesomebar extras: calculator, "New X", "Search X in DocType", help, recents ranking.
- ❌ Workspace editing (blocks, sidebar customization), user language (`__()` + lang_dict), desk theme per user,
  user settings dialog, Module Onboarding, What's New.

### 2.7 Customization and builders
- ✅ DocType create + form builder, Client/Server Scripts.
- 🟡 Customize Form (opens with doc_type ✅) — verify field edits save, Reset to defaults.
- ❌ Print Format Builder, Web Form field builder, Workflow builder parity, Custom Field from the form menu,
  Translation tool, Naming Series tool.

### 2.8 Admin and integrations
- ✅ Users + role/module editors, generic forms for settings, Data Import.
- 🟡 System Console (verify).
- ❌ Permission Manager, User Permissions UX, Backups, scheduler/RQ status, Recorder, OAuth/Connected Apps,
  Email Account setup messages.

### 2.9 Email and notifications
- ✅ Timeline email, composer, Inbox.
- ❌ Email templates, Auto Email Report, reply/forward, energy points.

### 2.10 Hardening
- ❌ React Doctor warnings (~110); split DocForm/ListView further.
- ❌ Virtualized lists and report grids for large data.
- ❌ `e2e/run-all.mjs` on both benches in CI (`SKIP_ERPNEXT=1` on the hub).
- ❌ Mobile layouts, keyboard-only pass, a11y labels everywhere.

---

## 3. Phase 3 — Trevo as a Frappe custom app

Target: `bench get-app trevo && bench --site X install-app trevo` → `/desk` is Trevo.

1. **App skeleton**: `trevo/` python package, `hooks.py` with `website_route_rules` mapping `/desk/<path:app_path>`
   to the built SPA shell; built assets in `trevo/public/`.
2. **Build**: Next.js `output: "export"` served by Frappe (or a Node server behind nginx). Static export fits best:
   the BFF routes (`app/api/*`) go away because the SPA is same-origin with Frappe.
3. **Data layer**: every call already goes through `deskCall` / `lib/frappe/client`; switch the base from
   `/api/frappe/*` (proxy) to `/api/*` (direct) with one flag. CSRF token and boot come from the inlined
   `frappe.boot` instead of scraping `/desk`.
4. **Assets and files**: `/assets`, `/files`, `/private/files` served by Frappe/nginx — proxy routes removed.
5. **L4 pages** become same-origin frames of Frappe's own `/app/<page>`.
6. **Realtime**: socket.io on the same host (no `NEXT_PUBLIC_SOCKETIO_URL`).
7. **Rollout**: keep classic Desk at `/app` with a "Use classic Desk" link; a `Trevo Settings` single DocType for
   feature flags.

Prep now (while repos stay separate): keep backend calls behind `deskCall` / `frappeServerFetch`, no Node-only
APIs in client components, BFF routes stay thin.
