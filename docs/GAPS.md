# Crema ↔ Frappe Desk: what's left, and how we get there

Last audit: 2026-10-18 (Frappe v16 + ERPNext v16 on a local bench, and a second site without ERPNext); plan updated 2026-10-28.
Legend: ✅ done + e2e · 🟡 partial / exists but unverified · ❌ missing.
Order inside each section = impact on daily use. `node e2e/run-all.mjs` runs every suite (52 today).

**Where to go:** § 0.1 is the plan to finish phase 1, § 2 the item-by-item checklist, § 3 the phase 2 UI/UX plan.
Beyond parity (multi-site, AI, SDK): [PLAN.md](PLAN.md). Positioning and launch: [MARKETING.md](MARKETING.md).

---

## 0. Phases

| Phase | Goal | Repos |
|---|---|---|
| **1 — transcription** (now) | Everything a user can do in Desk works in Crema, verified against a live bench | `crema-frontend` (Next.js) + a local Frappe v16 bench |
| **2 — UI/UX** | Improve space use, navigation, density, inline editing once behaviour is pinned by e2e | same |
| **3 — Frappe app** | Ship Crema as a Frappe custom app that replaces `/desk` on any site | `crema` becomes an app (python package + built frontend) |

Rule for phase 1: never hard-code an app (ERPNext or any custom app). Behaviour comes from metadata, the site's own JS,
and whitelisted methods — so any Frappe app works.

### 0.1 Plan to finish phase 1

Phase 1 is "done" when a normal ERPNext user can do a full day's work (sell, buy, stock, pay, report) in Crema without
opening Desk, on a laptop and on a phone. Not every ❌ in § 2 is needed for that; the milestones below are, in order.
Each item names the Desk source to port from (in the bench: `apps/frappe/frappe/public/js/frappe/…`, or
github.com/frappe/frappe) and how to prove it (an e2e suite against the bench, then the same action in Desk).
"Cloud" = can be written in a claude.ai/code session (no bench there; type-check, lint and build only, e2e run locally).

| # | Milestone | Items (§) | Desk source | Proof | Cloud |
|---|---|---|---|---|---|
| M1 | **Form feels like Desk** | Save rules (2.17), timeline wording (2.17), visibility rules audit (2.15), previous / next doc, title editing, Jump to field verify (2.1), "Not permitted" + "shared with you" messages (2.1) | `form/save.js`, `form/form.js`, `form/toolbar.js`, `form/footer/version_timeline_content_builder.js` | `e2e/formsave.mjs`, `form.salesorder.mjs` | partly |
| M2 | **Workflow you can follow** | workflow stepper, "waiting on me", Workflow Action list, self-approval and condition messages (2.16) | `form/workflow.js`, `model/workflow.js`, `frappe/workflow/doctype/workflow_action` | `e2e/workflow.mjs` extended | yes |
| M3 | **Grid you can type in** | keyboard navigation, paste from a spreadsheet, column settings, Add Multiple, row hover menu (2.2) | `form/grid.js`, `grid_row.js`, `grid_row_form.js` | `e2e/grid*.mjs` | yes |
| M4 | **Controls verified** | every 🟡 control in 2.3 checked against Desk (Text Editor first: ERPNext uses it read-only for tax breakup, terms, notes), Link extras (title field, create new, advanced search) | `form/controls/*` | one suite per control family | yes |
| M5 | **Lists and reports for daily use** | saved filters (List Filter), row extras (comments, assignees, unread), `listview_settings` hooks, report view group-by, ERPNext finance report helpers (2.4–2.6) | `list/*`, `views/reports/*`, `erpnext/public/js/financial_statements.js` | `e2e/list*.mjs`, `report*.mjs` | partly |
| M6 | **Works on a phone** | responsive shell + forms (2.14, started), grid as cards under 640px, list as cards, sticky bottom action bar | Desk's own mobile CSS is a reference only (`frappe/public/scss/desk/mobile.scss`) | screenshots at 390 / 768 / 1280 px, no horizontal page scroll | yes |
| M7 | **Hardening** | React Doctor warnings, split DocForm / ListView, virtualised lists, run-all in CI on both benches (2.14) | — | `run-all.mjs` green twice in a row | yes |

Left for later (not needed to call phase 1 done): builders (2.9), workspace editing and the v16 dock (2.7), Map /
Kanban v2 (2.5), telephony, BOM configurator, Bank Reconciliation (2.11, via L4 meanwhile), translations / RTL (2.8).

---

## 1. How Frappe's JavaScript runs in Crema (compatibility architecture)

Frappe's frontend is four kinds of code; each gets a different strategy.

| Layer | What it is | Strategy | Status |
|---|---|---|---|
| **L1 Metadata UI** | DocType forms, lists, views, reports | Native React driven by meta; the site's JS (`__js`, `__list_js`, `__tree_js`, `__calendar_js`, report JS, Client Scripts) runs in the Desk runtime (`lib/desk-runtime`) against a `frappe` / `frm` / `cur_frm` compatibility API | ✅ core done |
| **L2 Script DOM** | Form scripts that write into the page: `frm.fields_dict.x.$wrapper.html()`, `$(frm.wrapper).find()`, `frm.dashboard.add_section()` | Load **real jQuery** into the runtime and give scripts real DOM nodes: each HTML field renders a container whose node is `fields_dict[f].wrapper` / `$wrapper`; `frm.dashboard`, `frm.page.body`, `frm.layout.wrapper` get containers too. Unknown members stay chainable no-ops (NOOP) | ✅ real jQuery + HTML-field containers (`e2e/scriptdom.mjs`); 🟡 `frm.dashboard` / `frm.page.body` still NOOP |
| **L3 Desk widgets** | jQuery widgets Desk mounts inside forms: RoleEditor, ModuleEditor, Permission Manager, form tour, dashboard heatmap/graph | Rebuild natively, keyed by DocType + HTML field (`components/form/widgets`), writing to the **same child tables** as Desk so saving is identical | ✅ RoleEditor + ModuleEditor |
| **L4 Whole pages** | Desk Pages built with jQuery/Vue: POS, Setup Wizard, Visual Plant Floor, BOM Comparison, Sales Funnel, any app's `/app/<page>` | **Legacy page host**: `/desk/page/<name>` mounts Frappe's own page (served at Crema's `/app/<path>`) in a same-origin frame; `/assets`, `/files`, `/api/method`, `/api/resource` proxied; Desk chrome hidden; title and Form/List/Report navigation bridged back to Crema. Replace page by page with native rebuilds where UX matters (POS first) | ✅ (`e2e/legacy.mjs` — ERPNext POS) |

Why not import Frappe's whole `desk.bundle.js` into React? It assumes it owns `document`, the router,
`frappe.boot`, global CSS and jQuery event delegation; mixing it with React rendering breaks both. L4 isolates it in
a frame instead — which is exactly how it will run in phase 3 (same origin, no proxy).

### User & roles (done)
- User form: `roles_html` / `modules_html` render native editors (filter, select all/none, counts). Checked roles ⇔
  `roles` rows (Has Role); unchecked modules ⇔ `block_modules` rows (Block Module), like `frappe.RoleEditor` /
  `frappe.ModuleEditor`. Disabled when Role Profiles / a Module Profile drive them.
- Role Profile and Module Profile use the same editors. Verified by `e2e/users.mjs`.
- ✅ Role Permissions Manager, native (`/desk/page/permission-manager/<doctype>?role=`, `e2e/permissions.mjs`): add rule,
  rights per level, Only if Creator, users of a role, remove, Restore Original Permissions — Desk's own methods.
- Still to do for users: User Permission flows, "Reset Password" / "Send Login Link"
  custom buttons (verify), impersonation banner, API key dialog.

### POS, Banking and other app pages (next step)
1. ✅ L4 host: `/desk/page/point-of-sale`, `/desk/page/<any page>`; sidebar/workspace Page links go there.
2. Native POS (phase 2 candidate): ERPNext POS is `erpnext.PointOfSale.Controller` (jQuery) over whitelisted APIs
   (`erpnext.selling.page.point_of_sale.point_of_sale.*`) — rebuildable on the same APIs.
3. Vue / frappe-ui apps with their own SPA at `/<app>` (Helpdesk, CRM, Banking) aren't Desk pages — link out.

---

## 2. Remaining features (phase 1 checklist)

Full inventory of Frappe v16's desk frontend (`frappe/public/js/frappe/**`, the `*.bundle.js` entry points, Desk
Pages) and ERPNext's scripted UIs (`erpnext/public/js/**`), audited 2026-10-18. Paths in `code` are Frappe/ERPNext
sources to transcribe from. Every ❌ is something a Desk user can do today that Crema can't.

Order of work: the milestones in § 0.1.

### 2.1 Forms (`form/form.js`, `toolbar.js`, `save.js`, `layout.js`, `script_manager.js`)
- ✅ Save / submit / cancel / amend / delete, Client Scripts + app `__js`, ERPNext transaction logic, quick entry,
  shortcuts (Ctrl+S/B/P…), workflow actions, realtime (doc_update, viewers), route_options, Get Items From
  (MultiSelectDialog), rename / links / remind / copy / customize / edit DocType in the menu, print, email.
- ✅ L2 script DOM: real jQuery; HTML fields are real nodes (`$wrapper.html()`, `.find().on()`, set_df_property options).
- ✅ `frm.dashboard` (`lib/form/dashboard.ts`, `components/form/FormDashboard.tsx`): headlines (`set_headline`,
  `set_headline_alert`, `add_comment` expiring after 10 s, `frm.set_intro` replacing its own, `layout.show_message`,
  colours, dismiss), `add_indicator`, `add_progress` / `show_progress` / `hide_progress`, `add_section` (a real node for
  jQuery), reset on every refresh, Desk's "Submit this document to confirm" — `e2e/dashboard.mjs`.
- ❌ Dashboard heatmap (`timeline_data` from `get_open_count`) and graph (`data.graph_method`).
- ❌ `frm.page.body`, `frm.layout.wrapper`, `frm.toolbar` containers for scripts (L2 for the rest of the page).
- ❌ Form toolbar extras (`toolbar.js`): previous / next document (`frappe.desk.form.utils.get_next`), indicator
  click actions, title editing for `title_field`, star/like in the header, "Jump to field" (Ctrl+J), `frm.page.add_menu_item`
  / `add_action_item` verification.
- ❌ Undo / redo (`form/undo_manager.js`, Ctrl+Z / Ctrl+Y on field changes).
- ❌ Form tour (`form_tour.js`, Form Tour doctype, `onboarding_tours.bundle.js`).
- ❌ Success action after submit/save (`success_action.js`, Success Action doctype).
- ❌ Info card (`form/info_card.js`) and side panel record preview (`ui/side_panel.js`) — v16.
- ❌ Header image / avatar from `image_field`, editable from the header (`form/sidebar/user_image.js`).
- ✅ Field permlevels (`lib/form/perm.ts`, Desk `model/perm.js`): a field at a level the user cannot read is hidden,
  one they cannot write is read-only; `frm.perm`, `frm.has_perm`, `frappe.perm.*` for scripts (`e2e/permlevel.mjs`).
- ❌ Permlevel extras: "Not permitted" banners, `read_only_depends_on` re-check after save.
- ❌ Doc-level permission messages: "You are viewing a document shared with you", restricted fields.
- ✅ Button fields fire the form event named after the field (Desk `script_manager.trigger(fieldname)`), in grid row
  forms with the child doctype + row (`trigger(fieldname, cdt, cdn)`).
- ✅ Field descriptions render as (sanitized) HTML.
- ✅ ERPNext forms load without script errors (probed: Sales/Purchase Order + Invoice, Delivery Note, Stock Entry,
  Material Request, Payment Entry, Journal Entry, Quotation, Item, Customer): `frm.events.<helper>` (Desk: last
  registered handler), lenient `frappe.ui.form.Controller` base (StockController helpers, `super.*`),
  `script_manager.make`, `grid.set_column_disp` + lenient grid, Desk `frm.call` semantics (doc method vs module
  method, reply applied to doc / child), `locals` keeps cached docs + boot `:Company` / `:Currency`, section
  `.wrapper` is a jQuery set, `frappe.require` runs its callback, deep-lenient namespaces no longer wrap class
  instances / DOM nodes.
- ✅ Runtime robustness: `frappe.ui/utils/db/defaults/model/meta/user/tools/datetime` and field objects return no-ops
  for helpers Crema hasn't shimmed; `new frappe.Unknown()` is a no-op object; `has_common`, `frappe.user.has_role`,
  `frappe.ui.show_change_password_dialog`, `frappe.db.get_single_value`, `frappe.defaults.is_enabled`,
  `frappe.tools.downloadify`, `frappe.utils.copy_to_clipboard`, `dialog.show_message`, `control.set_data`; Escape closes
  script dialogs; `set_route(..., {options})`.
- ✅ Singles open their form from the list route (Desk router); `/desk/system-health-report` → the single.
- 🟡 Virtual / Single DocTypes rendered read-only like Desk (System Health Report).
- ✅ `frappe.ui.Dialog` from scripts (`lib/desk-runtime/dialogs.ts`, `components/desk/DialogTable.tsx`): Table fields
  (`data` / `fields` / `get_data`, `grid.refresh / add_new_row / delete_rows / get_selected_children`, child `onchange`
  / `get_query`), `depends_on` / `mandatory_depends_on`, HTML `$wrapper` as a real node, `set_indicator`,
  `disable_primary_action`, `add_custom_action`, `set_secondary_action_label` — `e2e/dialogs.mjs` (agent-built, judged).
- ❌ Dialog grids: child-field `depends_on`, row form, pagination, drag-reorder; Table MultiSelect in dialogs.
- ❌ Translation of field values (`views/translation_manager.js`, `translatable` fields).
- ❌ Interaction composer: New Event / ToDo from a document (`views/interaction.js`).
- ❌ Print: raw / QZ Tray printing (`form/print_utils.js`), network printer selection, letter head preview in the composer.

### 2.2 Grid / child tables (`form/grid.js`, `grid_row.js`, `grid_row_form.js`, `grid_pagination.js`)
- ✅ Add/remove/duplicate rows, drag reorder, 50-row pages, CSV download/upload (allow_bulk_edit), row form.
- ✅ Insert Above / Below / Duplicate in the row editor, multi-row select + delete, select-all, idx renumbered;
  `before_<table>_remove` and `<table>_remove` fire per row with the child doctype like Desk's script_manager
  (child-doctype handlers such as ERPNext's `accounts_remove` now run; cscript once per row) — `e2e/gridrows.mjs`
  (agent-built, judged; judge removed a parent-level extra trigger).
- ✅ Move To (row number, clamped) and "Delete all N rows" (Desk `frappe.confirm`, then `<table>_delete` once) —
  `e2e/gridmove.mjs` (agent-built, judged). Duplicate copies `no_copy` fields exactly as Desk's grid duplicate does.
- ❌ Per-row hover menu, "Add Multiple" (Link selector).
- ❌ Per-user column settings (`Configure Columns` dialog, `in_list_view` override, column widths) — saved to user
  settings / `GridView`.
- ❌ Grid keyboard navigation (arrows between cells, Enter opens row, Ctrl+Shift+Up/Down).
- ❌ Paste multiple rows from a spreadsheet (TSV paste into grid).
- ❌ Grid row `form_render` events, `frm.fields_dict.items.grid.get_field().get_query`, `grid.update_docfield_property`,
  `grid.toggle_enable/display/reqd`, `cannot_add_rows`, `cannot_delete_rows` — verify each via ERPNext scripts.

### 2.3 Field controls (`form/controls/*`)
- ✅ Data, Int, Float, Currency, Percent, Check, Select, Link, Dynamic Link, Date, Datetime, Table, Attach,
  Attach Image, HTML, Code.
- ✅ Text Editor read-only values render as HTML (addresses, terms, tax breakup); editable is a rich-text box.
  🟡 still to match Quill: images, @mentions (`quill-mention`), tables, paste cleanup.
- 🟡 Exist but not verified against Desk:
  Markdown Editor, HTML Editor, JSON, Small/Long Text, Time, Duration, Rating, Color (`color_picker/`), Phone
  (`phone_picker/`, country codes), Password (strength meter), Signature, Barcode (+ camera scanner), Geolocation (map
  draw), Icon (`icon_picker/`), Autocomplete (method options), Table MultiSelect, MultiSelect / MultiSelect Pills /
  MultiSelect List, MultiCheck, Button, Heading, Date Range, Switch, Comment.
- ❌ Attachment Gallery (`attachment_gallery.js`, v16) and image lightbox (`photoswipe.bundle.js`).
- ✅ Data `options` validation (`lib/crema-form/validators.ts`, Desk `data.js` + `validate_type`): Email (comma lists),
  Phone, URL, Name — red field + message, `aria-invalid`; native email/tel/url inputs — `e2e/datavalidation.mjs`
  (agent-built, judged). IBAN: Desk has no client check either.
- ❌ Link: `show_title_field_in_link` (title shown instead of name), "Create a new X" + "Advanced search" in the
  dropdown (`link_selector`), link hover preview card (`ui/link_preview.js`, `components/hover_card.js`), filters
  description under the field, `ignore_user_permissions`.
- ❌ Camera capture for Attach (`ui/capture.js`) and barcode/QR scanner dialog (`scanner/`, `frappe.ui.Scanner`).
- ❌ Address autocomplete (`ui/address_autocomplete`, geocoder setting).
- ✅ Formatting from settings (`lib/frappe/format.ts` — transcribes `number_format.js`, `form/formatters.js`,
  `datetime.js`): System Settings / Currency `number_format` (`#,##,###.##` lakh/crore, `#.###,##`, …), currency
  symbol + `symbol_on_right` from boot `:Currency`, `get_field_currency` (incl. `Company:company:default_currency`),
  float/currency precision, the three rounding methods (`flt` in site scripts too), `date_format` / `time_format`,
  Datetime shown in the user's time zone and saved in the system one, typed numbers parsed with the site's format.
  Lists, reports, grid, kanban, number inputs, `frappe.format`, `format_currency`, `format_number`, `precision()`,
  `frappe.datetime.*` — `e2e/formats.mjs`.
- ❌ Number systems for words / `number_systems.js` short forms (lakh/crore abbreviations in charts), Time and
  Date inputs typed in the user's format (DatePicker shows it; free-typing in other orders), Duration input.

### 2.4 Lists (`list/list_view.js`, `base_list.js`, `bulk_operations.js`, `list_settings.js`, `list_filter/`)
- ✅ Filters, standard filters, group-by, sort, paging, count, bulk edit/delete/submit/cancel/print/assign/tags/export,
  indicators, realtime refresh, list settings record, Import/Export.
- ✅ List sidebar counts (`components/list/ListSidebar.tsx`, Desk `base_list.js` + `list_sidebar_group_by.js`): Assigned
  To / Created By / Tags / configured fields with counts (`get_group_by_count`, `get_sidebar_stats`), click-to-filter
  toggle, counts follow filters, "Customize" saved to user settings `group_by_fields` — `e2e/listsidebar.mjs`
  (agent-built, judged). Shown as dropdowns in the filter row (layout is a phase-2 call); always shows the standard
  three, Desk shows them per settings.
- ❌ Saved layouts / filters (v16 `list_filter/`: List Filter doctype — save, share globally, manage, duplicate,
  layout field selector).
- ✅ List Settings dialog (`components/list/ListSettingsDialog.tsx`, Desk `list_settings.js`): columns add / remove /
  reorder / width, Disable Count / Comment Count / Sidebar Stats / Auto Refresh via `save_listview_settings`, honoured
  by the list — `e2e/listsettings.mjs` (agent-built, judged). ❌ allow_edit, disable_scrolling, show_tags, recency filters.
- ❌ Row extras: comment counts, likes, assignee avatars, `_seen` bold for unread, "Edit" inline for Check fields,
  `has_indicator_for_draft`, `get_form_link` overrides from `listview_settings`.
- ❌ `listview_settings` hooks verification: `onload`, `refresh`, `button`, `formatters`, `get_indicator`,
  `add_fields`, `filters`, `hide_name_column`, `primary_action`, `selectable`, `right_column`.
- ❌ Restricted-by-user-permission banner (`list_view_permission_restrictions.html`).
- ✅ Per-user list state (`lib/list/useUserListState.ts`, Desk `model/user_settings.js`): filters + sort saved under
  `List` (+ `last_view`) and restored on a bare list URL; URL filters win — `e2e/listsettings.mjs`.
- ❌ `filter_conditions`, `load_last_view` redirect, report-view column state.
- ❌ Virtualized list for 2000+ rows (`list_view_virtualization.js`).
- ❌ Bulk actions: "Apply Assignment Rule", "Delete" progress via realtime for >500 docs, bulk rename (`bulk_rename`).

### 2.5 Views (`views/*`)
- ✅ Report view, Kanban, Calendar, Gantt, Tree, Image, Inbox, File manager, Dashboard view.
- ❌ Map view (`views/map`, `leaflet.bundle.js`): Geolocation / latitude+longitude doctypes.
- ❌ Kanban v2 (`views/kanban_v2`, v16): board settings, card fields, column colours/priority styles, swimlanes —
  Crema has the classic Kanban Board doctype flow only.
- ❌ Report view extras: group-by with aggregates, "Pick columns" from child tables, column resize/reorder persisted,
  Save As / Save report (Report doctype, `report_type: Report Builder`), print/PDF, link side panel (`link_side_panel.js`).
- ❌ Tree view extras: drag to move node, "Add Child" with quick entry fields, expand all, root filters per company.
- ❌ Calendar: Desk's calendar view settings per doctype (`calendar_settings`), quick create on date click with
  quick entry, filter sidebar.
- ❌ Communication view features in Inbox: reply / reply-all / forward, "Relink" to a document, assign, email
  thread grouping, attachments preview.

### 2.6 Reports (`views/reports/query_report.js`, `report_view.js`, `report_utils.js`)
- ✅ Query/Script reports (filters, formatter, tree, totals, chart, summary, prepared reports), Report Builder.
- ✅ Query Report "Save As" (`save_report` → Custom Report; saved filters/columns restored via `are_default_filters`
  + `custom_filters`; custom reports run their reference report's JS) and "PDF" (orientation / include filters /
  pick columns → print_grid HTML → `report_to_pdf`) — `e2e/reportsave.mjs` (agent-built, judged).
- ❌ Report PDF with Print Format / Letter Head, report `get_pdf_format` / `html_format`, print.bundle.css styling,
  Print (`frappe.render_grid`), print_tree.html, CSV/Excel export options dialog (with/without
  indentation), "Setup Auto Email" from the menu, "Add to Workspace", column reorder/resize persistence, "Pick
  columns" / custom columns from linked doctypes, report link side panel.
- ❌ ERPNext report helpers loaded by report JS: `erpnext.financial_statements` (formatter, tree, period selection),
  `dimension_tree_filter.js` (accounting dimensions added to every finance report), `sales_trends_filters.js`,
  `purchase_trends_filters.js`, `stock_analytics.js`, `stock_grid_report.js` — verify each family renders, and add
  shims where the runtime is missing them.

### 2.7 Workspaces, desktop, sidebar (`views/workspace`, `widgets/*`, `ui/sidebar/*`, `desktop_icons.bundle.js`)
- ✅ Workspace render: header, paragraph, spacer, shortcut (with stats filter count), card links, chart, number card,
  quick list; sidebar from boot; desktop page.
- ✅ Workspace onboarding block (`components/desk/OnboardingWidget.tsx`: `get_desktop_page` onboardings honouring
  `enable_onboarding`, steps, progress, skip, step actions via `update_onboarding_step`, 24 h dismiss) and Custom HTML
  Block (`CustomBlock.tsx`: shadow root, scoped style, script with `root_element`) — `e2e/workspaceblocks.mjs`
  (agent-built, judged). ❌ Form-tour / route_hooks auto-tick, quick entry and Import from a step.
- ❌ Workspace editing (`views/workspace/blocks`, Editor.js): add/move/resize blocks, new widget dialogs
  (`widget_dialog.js`, `new_widget.js`), create/duplicate/delete/hide workspace, public vs private, workspace restore.
- ❌ v16 sidebar: dock (`ui/sidebar/dock.js`, pinned/floating), sidebar arrangement editor
  (`arrangement_editor.js` — reorder/hide items per user), sidebar sections/cards (`card.js`), Workspace Sidebar doctype.
- ❌ v16 desktop icons: drag to arrange, folders, hide (`desktop_icons.bundle.js`, Desktop Icon doctype).
- ❌ Number card / chart widget menus: refresh, filters dialog, "Set Filters", "Edit", chart type switch, time span.

### 2.8 Shell, navigation, search (`ui/toolbar/*`, `ui/keyboard.js`, `router.js`)
- ✅ ⌘K awesomebar (doctypes, records, reports, pages), keyboard shortcuts dialog, notifications panel, breadcrumbs,
  `frappe.set_route` for Desk pages + route_options.
- ✅ Awesomebar extras (`lib/search/*`, Desk `awesome_bar.js` / `search_utils.js`): "new <DocType>" (can_create),
  calculator (safe parser, no eval; copies the result), "<text> in <DocType>" → list `?q=` (the list follows `?q=`
  while mounted) — `e2e/awesomebar.mjs` (agent-built, judged).
- ❌ Global search results page ("Search for '<text>'"), `#tag` search, help articles, recents ranking (`fuzzy_match.js`).
- ✅ Desk URLs resolved like Desk's router (`app/(desk)/desk/[slug]`, `resolveDeskPath`): shell prefix, workspace
  slug, DocType slug (list / `view/x` / `new` / record), standard routes (`List/User`), else Desk Page; query kept.
  Used by pasted Desk links, Navbar Settings routes and `frappe.set_route("/app/…")` (`e2e/usermenu.mjs`).
- ✅ User menu (`ui/sidebar/sidebar_header.js`): My Settings, Session Defaults dialog (saved via
  `set_session_default_values`, boot cache cleared), Reload (`clear_cache`), View Website, Apps, About (`about.js`),
  Navbar Settings rows (settings_dropdown / help_dropdown, conditions + actions run in the desk runtime via
  `frappe.utils.eval`), theme saved to `User.desk_theme` (`switch_theme`) — `e2e/usermenu.mjs`.
- ✅ Toggle Full Width (Desk `localStorage.container_fullwidth`; content capped at Desk's 1290px container otherwise)
  and the saved `User.desk_theme` applied on a browser with no stored choice — `e2e/fullwidth.mjs` (agent-built, judged).
- ❌ Apps switcher page (`/apps`), "Edit Sidebar" item.
- ❌ v16 user settings dialog (`user_settings_dialog.bundle.js`, `ui/settings_dialog.js`): Profile, Email signature +
  options, Appearance, Language, Notifications, API access.
- ✅ Site banners (`ui/site_banners.js`): read-only mode, impersonation ("Impersonating X — Stop") — `e2e/impersonation.mjs`.
- ❌ Alt-key accelerators (`alt_keyboard_shortcuts.js`), Ctrl+G go-to, `frappe.ui.keys.add_shortcut` from scripts.
- ❌ Language: `__()` with `lang_dict` from boot, RTL layout, user language switch.
- ❌ Notifications panel tabs (`ui/notifications/notifications.js`): Today's Events, Notification Settings link,
  energy-point / mention / assignment types with icons, open-in-place.
- ❌ Telemetry / billing banners (Frappe Cloud only) — out of scope.

### 2.9 Customization and builders
- ✅ DocType create + form builder, Client/Server Scripts, Customize Form opens with doc_type.
- 🟡 Customize Form: verify field edits save, Reset to defaults, "Customize Form" from list/form menus.
- ❌ v16 DocType Settings dialog (`form/doctype_settings/*`, `embedded_list.bundle.js`): tabs General, Naming,
  Workflow, Print Formats, Roles, User Permissions, Notifications, Email Templates, Global Search — from the list menu.
- ❌ DocType permission editor dialog (`ui/permission_dialog.js`, v16) used by the form builder / DocType form.
- ✅ Print Format editing (Jinja + CSS) from Crema's form: the new-form Name field for prompt-named DocTypes, Custom
  Format, the template in a Code field, then the format in the print view's picker — `e2e/printformat.mjs`.
- ❌ Print Format Builder (`print_format_builder/`, page + beta Vue builder): "Edit Format" opens Desk's builder page
  through L4; verify, then native later.
- ❌ Web Form builder (`web_form/`, field list editor), Workflow builder parity (`workflow_builder/` Vue flow),
  Custom Field from the form menu, Translation tool, Naming Series dialog (`ui/naming_series.js`, v16 Document
  Naming Settings), Letter Head builder, Email Template preview (`utils/preview_email.js`, `views/render_preview.js`).
- ❌ Onboarding: Module Onboarding steps (create/show/watch video), Onboarding Tours, What's New / changelog
  dialog, setup wizard native (`ui/slides.js`) — currently via L4.

### 2.10 Pages (Page doctype — 17 on this site)
| Page | Plan | Status |
|---|---|---|
| permission-manager | L3 native on `core.page.permission_manager.*` | ✅ native |
| print-format-builder (+ beta) | L3 native builder on Print Format `format_data` | ❌ (L4 works) |
| backups | L3 native (backup files, schedule files backup) | ❌ (redirects) |
| setup-wizard | L4 host, later native | ✅ via L4 |
| point-of-sale | L4 host now, native later | ✅ via L4 |
| sales-funnel, stock-balance, warehouse-capacity-summary, bom-comparison-tool, visual-plant-floor | L4 host | ✅ via L4 |
| workspace-restore, component-explorer | L4 host | ✅ via L4 |
| workflow-builder | 🟡 prototype — verify against the Workflow doc | 🟡 |
| desktop, dashboard-view, print | native | ✅ |

### 2.11 ERPNext scripted UIs inside forms (L3 candidates — today NOOP or broken)
Rebuild natively keyed by DocType + field, or host Desk's widget; each is daily-use ERPNext.
- ✅ Address & Contact cards for any doctype with `address_html` / `contact_html` (`components/form/widgets/
  AddressContact.tsx`, Desk `address_and_contact.js` + templates): cards from `__onload`, Edit, Primary badge, Set /
  Unset Primary, Unlink (`remove_link`), New Address / Contact pre-linked via the form prefill, hidden on new docs —
  `e2e/addresscontact.mjs` (agent-built, judged; judge replaced a Storage monkey-patch with `takePrefill`).
- ❌ Address autocompletion dialog, Contact quick-entry dialog (phone/email → child rows).
- ✅ Item stock levels (`lib/form/shims/itemDashboard.ts`, Desk `item_dashboard.js` + templates): per-warehouse qty bars
  from `item_dashboard.get_data`, More, Move / Add dialogs → prefilled Stock Entry (`make_stock_entry`) —
  `e2e/itemdashboard.mjs` (agent-built, judged). ❌ Putaway Rule edit, warehouse-capacity variant.
- ✅ Serial & Batch selector (`lib/form/shims/serialBatch.ts` + `SerialBatchDialog.tsx`, Desk
  `serial_no_batch_selector.js`): `erpnext.SerialBatchPackageSelector` / `show_serial_batch_selector` /
  `select_batch_and_serial_no`, opened by ERPNext's own row button; batch rows → `add_serial_batch_ledgers`,
  bundle on the row, submit + SLE verified — `e2e/serialbatch.mjs` (agent-built, judged; judge wired row-form
  Button fields to child events).
- ❌ Selector auto-open from the transaction controller on PR / PI / DN, serial-number + outward + CSV flows
  untested, DeskDialog Table fields (selector uses its own dialog), barcode scanning (`utils/barcode_scanner.js`).
- ✅ Accounting / Stock Ledger preview (`lib/form/shims/ledgerPreview.ts`, `utils/ledger_preview.js`): Preview ▸ buttons
  on drafts, same methods, rows in a dialog (static table, no datatable filters) — `e2e/ledgerpreview.mjs`
  (agent-built, judged; Sales Invoice + Purchase Receipt).
- ❌ Unreconcile dialog (`utils/unreconcile.js`), Payment Reconciliation allocation, Bank Reconciliation Tool
  (`bank-reconciliation-tool.bundle.js` — datatable + dialogs inside a Single doctype).
- ❌ Item selector / quick add (`utils/item_selector.js`), party quick entries (`customer_quick_entry.js`,
  `supplier_quick_entry.js`, `contact_address_quick_entry.js` — extended quick entry dialogs).
- ❌ BOM configurator (`bom_configurator/`, tree editor), Project / Task gantt in forms, CRM activities on Lead /
  Opportunity (`utils/crm_activities.js` — notes, events, todos tabs).
- ❌ Telephony / call popup (`call_popup/`, `telephony.js`), SMS manager (`sms_manager.js`).
- ❌ Stock reservation dialogs (`stock_reservation.js`), bulk transaction processing (`bulk_transaction_processing.js`).
- ❌ Plant floor visual (`plant_floor_visual/`) — via L4 page today.

### 2.12 Admin and integrations
- ✅ Users + role/module editors, Permission Manager, generic forms for settings, Data Import, Inbox.
- 🟡 System Console (verify), Data Import wizard parity (`data_import_wizard.bundle.js`, v16 wizard).
- ❌ User Permissions UX (add from the User form, "Show User Permissions" on a doctype, `Apply To All Doctypes`).
- ✅ User form buttons from Frappe's own user.js (`e2e/useractions.mjs`): Permissions ▾ (Set User Permissions, View
  Permitted Documents, View Doctype Permissions), Password ▾ (Change Password, Reset Password), Impersonate prompt,
  Generate Keys → API Keys dialog, Create User Email.
- ✅ Impersonation end-to-end (session switch + banner) — `e2e/impersonation.mjs`. ❌ Reset OTP Secret / LDAP reset (need 2FA / LDAP enabled).
- ❌ Backups page, scheduler / RQ job status (RQ Job, RQ Worker virtual doctypes), Recorder UI, Error Log viewer
  with traceback formatting, Log settings.
- ❌ OAuth / Connected Apps flows, Email Account setup messages (OAuth authorize buttons), Social Login Keys.
- ❌ Document Follow digest settings, Energy Point log/leaderboard, Auto Repeat dialog from the form menu.

### 2.13 Email and notifications
- ✅ Timeline email, composer, Inbox (read/unread, trash, close).
- ❌ Composer: Email Template picker, reply / reply-all / forward from a timeline email, attach existing files and
  uploads, print format + letter head attachment preview, signature, "Send After", read receipt, CC/BCC defaults.
- ❌ Auto Email Report setup, Notification (doctype) preview, Newsletter send/schedule dialogs.

### 2.14 Hardening
- ❌ React Doctor warnings (~110); split DocForm/ListView further.
- ❌ Virtualized lists and report grids for large data.
- ❌ `e2e/run-all.mjs` on both benches in CI (`SKIP_ERPNEXT=1` on the hub).
- 🟡 Mobile layouts (M6, started): fluid spacing tokens (`--space-*` with `clamp()`, Tailwind `p-gutter` / `gap-field` …), form
  columns by container width (`@container`), sidebar closed on phones, compact header — no horizontal scroll at
  390 / 768 / 1280 px on workspace, list, form, report. ❌ grid and list as cards on phones, bottom action bar.
- ❌ Keyboard-only pass, a11y labels everywhere (✅ dialogs are now named by their title). ✅ Pointer cursor on
  everything clickable (base CSS: buttons, `role=button/tab/menuitem/option`, labels, selects, checkboxes).
- ✅ No hydration mismatches on home / forms / reports: client-only values (stored theme icon, report-manager
  buttons, greeting + user name) render after hydration.
- ✅ Dialog width follows `max-w-*` on DialogContent (default max-w-lg).
- ✅ Error reporting parity: server tracebacks behind **Details** for System Managers — `e2e/errordetails.mjs`.

### 2.15 Field visibility rules (what decides if a field shows)
Desk combines six rules; a field shows only if all of them allow it. Crema has each, listed so they can be audited
together (source: `form/layout.js` `refresh_dependency`, `model/perm.js`, `form/controls/base_control.js`).

| Rule | Where it lives | When it is checked | Crema |
|---|---|---|---|
| `hidden` | DocField / Customize Form / Property Setter | static, from meta | ✅ |
| `depends_on` (`eval:doc.x == 1` or a fieldname) | DocField | on load and after every change | ✅ |
| `read_only_depends_on`, `mandatory_depends_on` | DocField | same | ✅ (❌ re-check after save, 2.1) |
| permlevel | DocPerm rows per level | per user and document | ✅ hidden if no read, read-only if no write |
| `frm.toggle_display / set_df_property` | form scripts | when the script runs | ✅ |
| empty read-only fields | Desk hides read-only fields with no value (`base_control.js` `refresh_input`, `df.read_only && is_null(value)`) | on refresh | 🟡 verify on Sales Order (e.g. Amended From) |
| sections / tabs | hidden when every field in them is hidden | after the above | ✅ |

**In the timeline** Desk does *not* evaluate `depends_on`: a change is listed when the field isn't `hidden` (or has
`show_on_timeline`) and the user can read its permlevel. So a computed field like Sales Order "Taxes and Charges
Calculation" (read-only Text Editor, rebuilt by ERPNext on submit) shows as text cut to 40 characters, and hidden
tables like Item Wise Tax Details don't show at all. Crema follows the same rule (2.17).
Possible improvement (phase 2): leave out fields whose `depends_on` is false for *this* document, and collapse
system-computed changes (totals, HTML breakups) under "and N calculated fields".

### 2.16 Workflow: show me what's mine
Today: the form shows the workflow state pill and an **Actions** menu with transitions from
`frappe.model.workflow.get_transitions` (server checks the role and `condition`), filtered for self-approval; the
action runs `apply_workflow`; read-only states lock the form.
To do:
- ❌ **Stepper** under the title: all states of the workflow in order, done / current / next, with who can move it on
  (`Workflow.transitions[].allowed`). The user sees at a glance whether the next step is theirs.
- ❌ **"Waiting on you"**: when the current user has a transition, a highlighted banner with the action buttons
  (Approve / Reject) instead of a menu; when nobody in your roles can act, say who can.
- ❌ **Workflow Action list** (`frappe/workflow/doctype/workflow_action`): Desk's "documents waiting for my action" list
  and the email action links; a workspace number card "Pending approvals".
- ❌ Messages Desk gives: transition blocked by `condition`, self-approval not allowed, "Workflow State not set".
- ❌ Workflow builder parity (`workflow_builder/`, 2.9).
Source: `frappe/public/js/frappe/form/workflow.js`, `frappe/model/workflow.py`. Proof: `e2e/workflow.mjs`.

### 2.17 Save, refresh and the timeline (`form/save.js`, `form/form.js`)
- ✅ Save of an unchanged saved doc sends no request and shows "No changes in document"
  (Desk: `save.js` only calls `savedocs` when `action !== "Save" || frm.is_dirty()`).
- ✅ After a real save the form refreshes in place from the `savedocs` response, which already carries `docinfo`
  (`save.py` `send_updated_docs`) — no second `getdoc`, no remount; `refresh` events run once (Desk `after_save` →
  `frm.refresh()`).
- ✅ Timeline wording ported from `version_timeline_content_builder.js`: "submitted / cancelled this document",
  "changed the value of A from x to y" (HTML turned into text, 40 characters), at most 3 changes per line, added /
  removed rows counted per table, hidden and unreadable fields left out — `e2e/formsave.mjs`.
- ❌ Desk's "click" sound and `route_hooks.after_save`; save via `frm.save("Update")` on submitted docs with
  `allow_on_submit` fields verified.

### 2.18 Data path: every call through the Next server
All data calls already go browser → `app/api/frappe/[...path]` / `app/api/*` → `lib/frappe/server.ts` → Frappe; the
browser never sends a request to Frappe directly (cookies, CSRF and the site header are added on the server).
Left:
- ❌ Realtime: socket.io connects from the browser to `NEXT_PUBLIC_SOCKETIO_URL`. Next route handlers can't proxy a
  WebSocket; options are a rewrite of `/socket.io/*` to the socket server in `next.config` (same origin, still
  direct underneath), a small custom Node server, or SSE from a route handler fed by the server's own socket
  client. Recommended: the rewrite now, SSE only if the socket port must stay private. Goes away in phase 3 (§ 4: same origin).
- ❌ `app/layout.tsx` preconnects to the Frappe URL — useless now that the browser never calls it; remove.
- ❌ `getFrappeBaseUrl()` in `lib/frappe/client.ts` (legacy) — remove once nothing imports it; "View Website" in the
  user menu is a link out and stays.
- ❌ Server Components for first paint: load meta + doc on the server for `/desk/doctype/X/Y` so the form renders
  without a client round trip (TanStack Query hydration).

### Out of scope (Frappe Cloud / dev-only)
`billing.bundle.js` (Frappe Cloud trial banners), `telemetry.bundle.js`, `sentry.bundle.js`, `build_events`
(bench dev rebuild toasts), `component-explorer` page (dev showcase, available via L4).

---

## 3. Phase 2 — reimagining the frontend (UI/UX plan)

Phase 1 copies Desk; phase 2 makes it pleasant for a **normal user** (sales clerk, storekeeper, accountant, approver)
rather than for an implementer. Behaviour stays Frappe's (same APIs, same scripts); only presentation changes, and
each change keeps the e2e suites green. Nothing here is built yet.

### 3.1 Principles
1. **One obvious next step.** Every screen answers "what do I do now?": one primary button, the rest in menus.
2. **Show less, reveal on demand.** Required + filled fields first; empty optional sections collapsed; "More fields"
   instead of 8 tabs.
3. **Stay in context.** Small tasks open in a popup or side panel; whole documents open as pages (3.3).
4. **Speak the user's words.** "Submit" → "Confirm order"-style labels from the workflow / doctype where Frappe
   allows (`button_label` overrides in a Crema setting, translations), statuses as plain words with colour + icon.
5. **Fast by default.** Optimistic UI for likes, tags, assignments; prefetch the next record; skeletons, not spinners.
6. **Same on every screen size.** Fluid spacing (`--space-*` with `clamp()`), container queries for layout, touch
   targets ≥ 40px on phones.
7. **Accessible.** Keyboard for everything, visible focus, colour never the only signal, WCAG AA contrast.

### 3.2 Design system
- Tokens: the fluid spacing scale (added 2026-10-28), type scale with `clamp()` for headings, radii, elevation, motion
  durations; one file (`app/globals.css`) so a theme is a token swap.
- Components: build every screen from `components/shadcn/*` + a few Crema primitives (PageHeader, Section, Field,
  DataTable, EmptyState, StatusPill, SidePanel, Stepper, BottomBar). Replace hand-written button / input classes
  (DocForm `btnCls`, ListView triggers) with them.
- Density setting: Comfortable / Compact (Desk-like) per user.
- Themes: light, dark, high-contrast; company accent colour from Website Settings / Navbar Settings.

### 3.3 Popup, side panel or page? (the rule)
| Use | When | Examples |
|---|---|---|
| **Popover** | one value, no navigation | assign, tag, share, filters, column picker, date range |
| **Dialog (popup)** | a short task of ≤ 6 fields that ends with one action | quick entry (new Customer from a Link), rename, cancel reason, workflow action with comment, email composer |
| **Side panel (drawer)** | look at or edit something *without losing the page* | open a list row's preview, linked document peek, timeline / comments, item stock levels, grid row form on desktop |
| **Full page** | a whole document, anything with tabs or tables, anything shareable by URL | Sales Order, Item, reports |
| **Bottom sheet** | phones: replaces dialogs and side panels | all of the above under 640px |
Never stack more than one dialog; a dialog that needs another dialog becomes a page or a panel.

### 3.4 Screens
- **Home**: "My work" instead of a module grid — documents waiting on me (workflow, assignments, ToDo), drafts I
  started, recent records, shortcuts the user pinned. Workspaces stay for implementers.
- **Lists**: saved views as tabs (My open orders, To deliver, Overdue); filters as chips; row preview in a side panel;
  inline edit for simple fields; bulk bar at the bottom; cards on phones; empty states that offer "Create" or
  "Import".
- **Forms**: sticky header with title, status, stepper (2.16) and one primary action; summary card (customer, totals,
  dates) at the top; sections as cards with fluid spacing; errors next to the field and listed at the top; autosave
  draft locally; "Unsaved changes" bar at the bottom instead of a tiny indicator.
- **Child tables**: spreadsheet-like on desktop (keyboard, paste), cards on phones; totals row; row details in a side
  panel.
- **Timeline**: filter (comments / changes / emails), grouped by day, calculated-field changes collapsed (2.15).
- **Reports**: filters in a side panel, saved filter sets, charts above the table, export menu.
- **Search**: one ⌘K for records, actions, settings and help; recent + frequent first.
- **Onboarding**: first-run checklist per role; contextual tips instead of tours.
- **Mobile**: bottom navigation (Home, Search, Create, Notifications, Me), scan barcode to find an item, camera for
  attachments, offline-tolerant draft entry for field sales.

### 3.5 Where to find the answers (research)
- **Frappe's own newer UIs**: `frappe-ui` (github.com/frappe/frappe-ui) and the apps built on it — Frappe CRM,
  Helpdesk, Gameplan, Insights. They already solved list/side-panel/quick-entry patterns on the same APIs.
- **Desk v16 source** for behaviour that must stay (`frappe/public/js/frappe/**`), and Frappe's GitHub issues /
  discuss.frappe.io threads tagged UX for what users complain about.
- **Users**: watch 3–5 real users (clerk, storekeeper, approver) do their daily tasks in Desk; time each task and
  count clicks; repeat in Crema. That list decides the order of 3.4.
- **Analytics** (opt-in, self-hosted): which buttons and fields are used, where people abandon a form.
- **Pattern references**: Linear / Notion (side panels, ⌘K), Stripe dashboard (lists, filters, detail drawers),
  Shopify Polaris and GOV.UK design system (plain language, forms, accessibility), Material 3 (mobile, bottom sheets).

### 3.6 How phase 2 is delivered
One screen at a time behind a per-user "New layout" switch, with before / after screenshots at 390 / 768 / 1280 px in
the PR, e2e suites unchanged, and a short usability check (task time, clicks) against Desk.

---

## 4. Phase 3 — Crema as a Frappe custom app

Target: `bench get-app crema && bench --site X install-app crema` → `/desk` is Crema.

1. **App skeleton**: `crema/` python package, `hooks.py` with `website_route_rules` mapping `/desk/<path:app_path>`
   to the built SPA shell; built assets in `crema/public/`.
2. **Build**: Next.js `output: "export"` served by Frappe (or a Node server behind nginx). Static export fits best:
   the BFF routes (`app/api/*`) go away because the SPA is same-origin with Frappe.
3. **Data layer**: every call already goes through `deskCall` / `lib/frappe/client`; switch the base from
   `/api/frappe/*` (proxy) to `/api/*` (direct) with one flag. CSRF token and boot come from the inlined
   `frappe.boot` instead of scraping `/desk`.
4. **Assets and files**: `/assets`, `/files`, `/private/files` served by Frappe/nginx — proxy routes removed.
5. **L4 pages** become same-origin frames of Frappe's own `/app/<page>`.
6. **Realtime**: socket.io on the same host (no `NEXT_PUBLIC_SOCKETIO_URL`).
7. **Rollout**: keep classic Desk at `/app` with a "Use classic Desk" link; a `Crema Settings` single DocType for
   feature flags.

Prep now (while repos stay separate): keep backend calls behind `deskCall` / `frappeServerFetch`, no Node-only
APIs in client components, BFF routes stay thin.
