# Trevo ↔ Frappe Desk: what's left, and how we get there

Last audit: 2026-10-18 (Frappe v16 + ERPNext v16 on vendor1.localhost, hub hub).
Legend: ✅ done + e2e · 🟡 partial / exists but unverified · ❌ missing.
Order inside each section = impact on daily use. `node e2e/run-all.mjs` runs every suite (33 today, all passing).

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
| **L2 Script DOM** | Form scripts that write into the page: `frm.fields_dict.x.$wrapper.html()`, `$(frm.wrapper).find()`, `frm.dashboard.add_section()` | Load **real jQuery** into the runtime and give scripts real DOM nodes: each HTML field renders a container whose node is `fields_dict[f].wrapper` / `$wrapper`; `frm.dashboard`, `frm.page.body`, `frm.layout.wrapper` get containers too. Unknown members stay chainable no-ops (NOOP) | ✅ real jQuery + HTML-field containers (`e2e/scriptdom.mjs`); 🟡 `frm.dashboard` / `frm.page.body` still NOOP |
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
sources to transcribe from. Every ❌ is something a Desk user can do today that Trevo can't.

**Order of work (impact on daily use):**
1. Users track: User Permissions UX (2.12), impersonation banner (2.8).
3. `frm.dashboard` / `set_intro` / headline (2.1) and the ERPNext form widgets (2.11: address & contact, stock
   levels, serial/batch selector, ledger preview).
4. Lists: sidebar counts, saved layouts, list settings dialog, persisted user settings (2.4).
5. Grid: insert above/below, column settings, keyboard, paste (2.2); field control verification (2.3).
6. Shell: user menu + theme, user settings dialog, banners, awesomebar extras, language (2.8).
7. Reports and views extras (2.5, 2.6), Map, Kanban v2; workspace editing + v16 sidebar/desktop (2.7).
8. Builders: DocType Settings, Print Format Builder, Web Form, Naming Series (2.9); native POS (phase 2).

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
- ❌ Permlevel: sections and fields above the user's permlevel read-only/hidden, "Not permitted" banners,
  `frm.perm` checks in custom buttons, `read_only_depends_on` re-check after save.
- ❌ Doc-level permission messages: "You are viewing a document shared with you", restricted fields.
- ✅ Button fields fire the form event named after the field (Desk `script_manager.trigger(fieldname)`).
- ✅ Field descriptions render as (sanitized) HTML.
- ✅ Runtime robustness: `frappe.ui/utils/db/defaults/model/meta/user/tools/datetime` and field objects return no-ops
  for helpers Trevo hasn't shimmed; `new frappe.Unknown()` is a no-op object; `has_common`, `frappe.user.has_role`,
  `frappe.ui.show_change_password_dialog`, `frappe.db.get_single_value`, `frappe.defaults.is_enabled`,
  `frappe.tools.downloadify`, `frappe.utils.copy_to_clipboard`, `dialog.show_message`, `control.set_data`; Escape closes
  script dialogs; `set_route(..., {options})`.
- ✅ Singles open their form from the list route (Desk router); `/desk/system-health-report` → the single.
- 🟡 Virtual / Single DocTypes rendered read-only like Desk (System Health Report).
- 🟡 `frappe.ui.Dialog` from scripts (`ui/dialog.js`, `ui/field_group.js`): fields render through FormBody — verify
  Table fields with `data` / `get_data`, HTML fields with `$wrapper`, `fields_dict.x.grid`, `set_query` / `get_query`,
  `onchange`, `depends_on`, size, `disable_primary_action`, `frappe.ui.form.MultiSelect`, `frappe.prompt` with field list,
  `frappe.msgprint({ primary_action })`, `frappe.show_progress`, `frappe.ui.form.LinkSelector` (`link_selector.js`).
- ❌ Translation of field values (`views/translation_manager.js`, `translatable` fields).
- ❌ Interaction composer: New Event / ToDo from a document (`views/interaction.js`).
- ❌ Print: raw / QZ Tray printing (`form/print_utils.js`), network printer selection, letter head preview in the composer.

### 2.2 Grid / child tables (`form/grid.js`, `grid_row.js`, `grid_row_form.js`, `grid_pagination.js`)
- ✅ Add/remove/duplicate rows, drag reorder, 50-row pages, CSV download/upload (allow_bulk_edit), row form.
- ✅ Insert Above / Below / Duplicate in the row editor, multi-row select + delete, select-all, idx renumbered;
  `before_<table>_remove` and `<table>_remove` fire per row with the child doctype like Desk's script_manager
  (child-doctype handlers such as ERPNext's `accounts_remove` now run; cscript once per row) — `e2e/gridrows.mjs`
  (agent-built, judged; judge removed a parent-level extra trigger).
- ❌ "Move to row #" prompt, per-row hover menu, "Delete all N rows", "Add Multiple" (Link selector), Duplicate
  honouring `no_copy`.
- ❌ Per-user column settings (`Configure Columns` dialog, `in_list_view` override, column widths) — saved to user
  settings / `GridView`.
- ❌ Grid keyboard navigation (arrows between cells, Enter opens row, Ctrl+Shift+Up/Down).
- ❌ Paste multiple rows from a spreadsheet (TSV paste into grid).
- ❌ Grid row `form_render` events, `frm.fields_dict.items.grid.get_field().get_query`, `grid.update_docfield_property`,
  `grid.toggle_enable/display/reqd`, `cannot_add_rows`, `cannot_delete_rows` — verify each via ERPNext scripts.

### 2.3 Field controls (`form/controls/*`)
- ✅ Data, Int, Float, Currency, Percent, Check, Select, Link, Dynamic Link, Date, Datetime, Table, Attach,
  Attach Image, HTML, Code.
- 🟡 Exist but not verified against Desk: Text Editor (Quill: images, @mentions via `quill-mention`, tables),
  Markdown Editor, HTML Editor, JSON, Small/Long Text, Time, Duration, Rating, Color (`color_picker/`), Phone
  (`phone_picker/`, country codes), Password (strength meter), Signature, Barcode (+ camera scanner), Geolocation (map
  draw), Icon (`icon_picker/`), Autocomplete (method options), Table MultiSelect, MultiSelect / MultiSelect Pills /
  MultiSelect List, MultiCheck, Button, Heading, Date Range, Switch, Comment.
- ❌ Attachment Gallery (`attachment_gallery.js`, v16) and image lightbox (`photoswipe.bundle.js`).
- ✅ Data `options` validation (`lib/trevo-form/validators.ts`, Desk `data.js` + `validate_type`): Email (comma lists),
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
- ❌ List sidebar (`list_sidebar_group_by.js`, `list_sidebar_stat.html`): Assigned To / Created By / Tags / group-by
  field counts (`frappe.desk.listview.get_group_by_count`), "Assigned to me", "Created by me".
- ❌ Saved layouts / filters (v16 `list_filter/`: List Filter doctype — save, share globally, manage, duplicate,
  layout field selector).
- ❌ List Settings dialog (`list_settings.js`): fields shown, disable count / comment count / sidebar stats / auto
  refresh — saved to List View Settings.
- ❌ Row extras: comment counts, likes, assignee avatars, `_seen` bold for unread, "Edit" inline for Check fields,
  `has_indicator_for_draft`, `get_form_link` overrides from `listview_settings`.
- ❌ `listview_settings` hooks verification: `onload`, `refresh`, `button`, `formatters`, `get_indicator`,
  `add_fields`, `filters`, `hide_name_column`, `primary_action`, `selectable`, `right_column`.
- ❌ Restricted-by-user-permission banner (`list_view_permission_restrictions.html`).
- ❌ Per-user persisted list state (`model/user_settings.js`): last filters, sort, page length, view, report columns.
- ❌ Virtualized list for 2000+ rows (`list_view_virtualization.js`).
- ❌ Bulk actions: "Apply Assignment Rule", "Delete" progress via realtime for >500 docs, bulk rename (`bulk_rename`).

### 2.5 Views (`views/*`)
- ✅ Report view, Kanban, Calendar, Gantt, Tree, Image, Inbox, File manager, Dashboard view.
- ❌ Map view (`views/map`, `leaflet.bundle.js`): Geolocation / latitude+longitude doctypes.
- ❌ Kanban v2 (`views/kanban_v2`, v16): board settings, card fields, column colours/priority styles, swimlanes —
  Trevo has the classic Kanban Board doctype flow only.
- ❌ Report view extras: group-by with aggregates, "Pick columns" from child tables, column resize/reorder persisted,
  Save As / Save report (Report doctype, `report_type: Report Builder`), print/PDF, link side panel (`link_side_panel.js`).
- ❌ Tree view extras: drag to move node, "Add Child" with quick entry fields, expand all, root filters per company.
- ❌ Calendar: Desk's calendar view settings per doctype (`calendar_settings`), quick create on date click with
  quick entry, filter sidebar.
- ❌ Communication view features in Inbox: reply / reply-all / forward, "Relink" to a document, assign, email
  thread grouping, attachments preview.

### 2.6 Reports (`views/reports/query_report.js`, `report_view.js`, `report_utils.js`)
- ✅ Query/Script reports (filters, formatter, tree, totals, chart, summary, prepared reports), Report Builder.
- ❌ Save a Query Report as a custom report (`save_report`), report PDF (`frappe.utils.print_format.report_to_pdf`),
  print grid templates (`print_grid.html`, `print_tree.html`), CSV/Excel export options dialog (with/without
  indentation), "Setup Auto Email" from the menu, "Add to Workspace", column reorder/resize persistence, "Pick
  columns" / custom columns from linked doctypes, report link side panel.
- ❌ ERPNext report helpers loaded by report JS: `erpnext.financial_statements` (formatter, tree, period selection),
  `dimension_tree_filter.js` (accounting dimensions added to every finance report), `sales_trends_filters.js`,
  `purchase_trends_filters.js`, `stock_analytics.js`, `stock_grid_report.js` — verify each family renders, and add
  shims where the runtime is missing them.

### 2.7 Workspaces, desktop, sidebar (`views/workspace`, `widgets/*`, `ui/sidebar/*`, `desktop_icons.bundle.js`)
- ✅ Workspace render: header, paragraph, spacer, shortcut (with stats filter count), card links, chart, number card,
  quick list; sidebar from boot; desktop page.
- ❌ Workspace blocks: onboarding widget (`onboarding_widget.js`, Module Onboarding steps), custom HTML block
  (`custom_block_widget.js`, Custom HTML Block doctype with its own JS/CSS).
- ❌ Workspace editing (`views/workspace/blocks`, Editor.js): add/move/resize blocks, new widget dialogs
  (`widget_dialog.js`, `new_widget.js`), create/duplicate/delete/hide workspace, public vs private, workspace restore.
- ❌ v16 sidebar: dock (`ui/sidebar/dock.js`, pinned/floating), sidebar arrangement editor
  (`arrangement_editor.js` — reorder/hide items per user), sidebar sections/cards (`card.js`), Workspace Sidebar doctype.
- ❌ v16 desktop icons: drag to arrange, folders, hide (`desktop_icons.bundle.js`, Desktop Icon doctype).
- ❌ Number card / chart widget menus: refresh, filters dialog, "Set Filters", "Edit", chart type switch, time span.

### 2.8 Shell, navigation, search (`ui/toolbar/*`, `ui/keyboard.js`, `router.js`)
- ✅ ⌘K awesomebar (doctypes, records, reports, pages), keyboard shortcuts dialog, notifications panel, breadcrumbs,
  `frappe.set_route` for Desk pages + route_options.
- ❌ Awesomebar extras (`awesome_bar.js`, `search_utils.js`): calculator, "New X", "Search for X in DocType", tag
  search (`#tag`), help articles, recent items ranking (`fuzzy_match.js`), global search results page
  (`frappe.utils.global_search.search`).
- ✅ Desk URLs resolved like Desk's router (`app/(desk)/desk/[slug]`, `resolveDeskPath`): shell prefix, workspace
  slug, DocType slug (list / `view/x` / `new` / record), standard routes (`List/User`), else Desk Page; query kept.
  Used by pasted Desk links, Navbar Settings routes and `frappe.set_route("/app/…")` (`e2e/usermenu.mjs`).
- ✅ User menu (`ui/sidebar/sidebar_header.js`): My Settings, Session Defaults dialog (saved via
  `set_session_default_values`, boot cache cleared), Reload (`clear_cache`), View Website, Apps, About (`about.js`),
  Navbar Settings rows (settings_dropdown / help_dropdown, conditions + actions run in the desk runtime via
  `frappe.utils.eval`), theme saved to `User.desk_theme` (`switch_theme`) — `e2e/usermenu.mjs`.
- ❌ Toggle Full Width, Apps switcher page (`/apps`), initial theme from `boot.user.desk_theme` on a new device,
  "Edit Sidebar" item.
- ❌ v16 user settings dialog (`user_settings_dialog.bundle.js`, `ui/settings_dialog.js`): Profile, Email signature +
  options, Appearance, Language, Notifications, API access.
- ❌ Site banners (`ui/site_banners.js`): read-only mode, impersonation ("Impersonating X — Stop").
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
- ❌ Print Format Builder (`print_format_builder/`, page + beta Vue builder) and Print Format editing (Jinja + CSS).
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
- ❌ Address & Contact cards on Customer, Supplier, Lead, Company, Sales Partner, Shareholder…
  (`address_html` / `contact_html`, `frappe.contacts.render_address_and_contact`, `utils/address_and_contact.js`).
- ❌ Item stock levels dashboard (`erpnext.stock.ItemDashboard`, `item-dashboard.bundle.js`) on Item / Warehouse.
- ❌ Serial & Batch selector dialog (`utils/serial_no_batch_selector.js` — SerialBatchPackageSelector) on stock
  transactions; barcode scanning into items (`utils/barcode_scanner.js`, `scan_barcode` field).
- ❌ Accounting / stock ledger preview (`utils/ledger_preview.js`) on draft invoices / stock entries.
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
- ❌ Impersonation end-to-end (session switch + banner, 2.8), Reset OTP Secret / LDAP reset (need 2FA / LDAP enabled).
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
- ❌ Mobile layouts, keyboard-only pass, a11y labels everywhere (✅ dialogs are now named by their title).
- ❌ Shared `Dialog` caps every dialog at max-w-lg (DialogContent's `max-w-*` is stripped) — wide dialogs
  (email composer, report pickers) need the panel width to follow the content.
- ❌ Error reporting parity: server tracebacks in a collapsible dialog for System Managers (Desk shows them).

### Out of scope (Frappe Cloud / dev-only)
`billing.bundle.js` (Frappe Cloud trial banners), `telemetry.bundle.js`, `sentry.bundle.js`, `build_events`
(bench dev rebuild toasts), `component-explorer` page (dev showcase, available via L4).

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
