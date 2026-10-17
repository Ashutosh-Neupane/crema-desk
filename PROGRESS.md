# Trevo — progress log

Newest entries on top. Each session: append what was done, what's verified, what's next.

## 2026-10-17 — session 2 (cont.): gap audit, Tier 1
- `docs/GAPS.md`: audit of what's left for 1:1 Desk parity (Tier 1 everyday gaps, Tier 2 views/pages, Tier 3
  polish), then phase 2 UI/UX. Work through it top-down.
- Tier 1 #1 done: Attach / Attach Image save their value (upload_file attached to the doc; loose upload on new
  docs, Frappe attaches on save), image preview, link mode, clear. `/files/*` and `/private/files/*` are served
  from Trevo's origin (`lib/frappe/fileProxy.ts`; public files need Host = site). Verified by `e2e/attach.mjs`.
- Tier 1 #2 done: form sidebar is editable (`components/form/FormSidebar.tsx`): assign/unassign, attach/remove
  files, add/remove tags, share/unshare, like; Follow shown only where Frappe allows it (track_changes, not
  Administrator, not ToDo/Communication/…). Verified by `e2e/sidebar.mjs`.
- Tier 1 #3 done: timeline (`components/form/Timeline.tsx`): comments with @mentions (Frappe mention spans),
  edit/delete own comments, version diffs with field labels (incl. child rows), emails, assignment/attachment/
  like/info/workflow logs; New Email composer (`EmailComposer.tsx` → communication.email.make, contacts, CC/BCC,
  print attachment). Docinfo reloads after save/workflow. Verified by `e2e/timeline.mjs` (this site has no outgoing
  email account, so the test checks Desk's error path; with an account it checks the Communication).
- Tier 1 #4 (print view) done: `/desk/print/<dt>/<dn>` (`components/views/PrintView.tsx`): format + letterhead
  pickers, server HTML (`printview.get_html_and_style`) in a sandboxed same-origin iframe, Print, PDF
  (`download_pdf`, server errors shown). Form toolbar printer button, menu item, ⌘P. `/assets/*` proxied like /files.
  Bench: vendor needs `GUNICORN_CMD_ARGS="--workers 3 --timeout 120"` (docker-compose, uncommitted in School_saas) —
  wkhtmltopdf fetches /assets from the same single gunicorn worker and deadlocked; `host_name` set to
  http://localhost:8000 for the site. ERPNext "Classic/Modern" formats need Chromium (not in the image) → PDF error,
  same as Desk. Verified by `e2e/print.mjs`. Print Format Builder still to do.
- Tier 1 #5 done: `frappe.ui.form.MultiSelectDialog` for scripts (`lib/desk-runtime/multiSelect.ts` +
  `components/desk/MultiSelectHost.tsx`, search_widget like Desk) and `erpnext.utils.map_current_doc` shim
  (`lib/form/compat.ts` → mapper.map_docs → `frm.__sync`, doc stays unsaved). Unknown `frm.*` members now return the
  chainable NOOP, which unblocked Sales Invoice's refresh (`frm.msgbox.$wrapper.is`) and its "Get Items From" menu.
  Verified by `e2e/getitems.mjs` (SI ← SO, saved rows keep sales_order).
- Tier 1 #6 done: realtime rooms (`useListRealtime`, `useDocRealtime` in `lib/services/realtime.ts`):
  lists refresh on list_update; a clean form reloads on doc_update, a dirty one shows a conflict banner; avatars of
  other viewers (doc_viewers) in the form header. Verified by `e2e/realtime.mjs`.
- Tier 1 #7 done: 29 prototype routes that are plain DocType lists/forms in Desk (users, roles, notes, server-scripts,
  web-forms, console-log, list-view-settings, system-health, …) are HTTP redirects in `next.config.ts` to the generic
  views; routes that weren't Frappe at all (changelog-feed, document-template) go to /desk; ~30 orphaned prototype
  components deleted. Backups, Permission Manager, Map and Image views redirect for now (Tier 2 rebuilds).
  Note: virtual singles (System Health Report) show "Not Saved" + Save — Desk renders them read-only.
- Tier 1 #8 done: form menu (`components/form/FormDialogs.tsx`): click title / Rename (update_document_title: title,
  name, merge), Links (linked_with.get), Remind Me (Reminder), Copy to Clipboard (JSON), Customize, Edit DocType (dev
  mode). URL query values apply to fields after load like Desk route_options (Customize Form ?doc_type=X).
  Verified by `e2e/formmenu.mjs`. Undo/redo still missing.
- Dev machine: `.next` had grown to 19 GB and Turbopack's cache flush stalled everything (15 GB swap) →
  `experimental.turbopackFileSystemCacheForDev: false`. Smoke script survives redirecting routes.

## 2026-10-17 — session 2: Tree view, Query reports
Verified (all suites ALL PASSED): `e2e/tree.mjs`, `e2e/report.mjs`, plus form/scripts regressions.
- Tree view `/desk/doctype/X/view/tree` driven by the DocType's `__tree_js` (Account, Item Group)
- Query/Script report page `/desk/query-report/<name>` (`components/views/QueryReport.tsx`, `lib/report/columns.ts`):
  report JS via `query_report.get_script` → `frappe.query_reports[name]` (filters + defaults, on_change, get_data,
  formatter, onload inner buttons, get_chart_data); `frappe.query_report` API bridged to page state;
  auto-run on filter change; table with sort/search/column picker, tree reports (indent, collapse, initial_depth),
  server total row as footer, report_summary cards, chart, CSV export; prepared reports (Generate/poll);
  Report Builder reports redirect to the list (`?view=report` — report view still to build)
- Report view `/desk/doctype/X/view/report` and saved Report Builder reports `/view/report/<name>`
  (`components/views/ReportView.tsx`): pick columns incl. child-table fields (rows fan out like Desk), inline edit
  of drafts (`frappe.client.set_value`, child rows via `<cdt>:name`), column menu (sort/move/remove), filters,
  group by with count/sum/avg, totals, page size, CSV; settings remembered in user_settings "Report";
  Save / Save As → `frappe.desk.reportview.save_report`. Verified by `e2e/reportview.mjs`.
  Filter editor / group-by / URL filters moved to `components/list/filters.tsx` (shared by list + report)
- Workflow on forms (`lib/form/workflow.ts`, DocForm): default state on new docs, Actions menu from
  `get_transitions` (role + self-approval) replacing Save/Submit/Cancel, `before/after_workflow_action` hooks,
  `apply_workflow`, action confirmation, state indicator coloured by Workflow State style, read-only when the
  user's roles can't edit the state. Verified by `e2e/workflow.mjs` (custom submittable DocType + workflow)
- Kanban `/desk/doctype/X/view/kanban[/<board>]` (`components/views/KanbanView.tsx`) on the v16 board APIs:
  board picker + New board (quick_kanban_board on a Select field), get_kanban_board_data, saved column order,
  drag between/within columns (dnd-kit, pointer-first collision, keyboard) → update_order_for_single_card,
  "Move to" card menu, per-column load more, + card prefilled with the column value, add/archive/restore column,
  card fields/assignees/footer date from the board. Verified by `e2e/kanban.mjs` (ToDo board)
- List bulk actions (`components/list/BulkActions.tsx`): Edit (submit_cancel_or_update_docs "update"),
  Assign To (assign_to.add_multiple), Add Tags, Export CSV, workflow actions common to the selection
  (get_common_transition_actions → bulk_workflow_approval), Submit/Cancel, Delete. Verified by `e2e/bulk.mjs`.
  LinkInput now has combobox/listbox ARIA; list view links don't prefetch (dev compile stalls router.replace)
- Data export + import: list menu Export (`components/list/ExportDialog.tsx` → data_import.download_template;
  fields incl. child tables, all/filtered/5/blank, CSV/Excel) and Import (`/desk/data-import`,
  `components/views/DataImport.tsx`: Data Import doc + upload_file → preview with mapping/warnings →
  form_start_import → polled get_import_status → failed-row log). Verified by `e2e/dataimport.mjs`.
  BFF proxy now passes response bytes + Content-Disposition (Excel/PDF downloads were re-encoded as text)
- Desk context now carries the rest of `frappe.boot` (party_account_types, current_fiscal_year, …) into every
  runtime; shims: `erpnext.utils.get_fiscal_year`, `frappe.model.with_doc`, `frappe.db.get_link_options`

- Hub hub run (frappe + hub, no ERPNext): crud.todo, workflow, kanban, bulk, doctype.create
  (`TREVO_MODULE=Hub`) all pass; smoke of /desk, hub workspace, Vendor Listing list/form, report
  view, Script Reports, data-import → 0 errors. Run it with env overrides (no .env edit):
  `docker start sm-hub` then `FRAPPE_BACKEND_URL=http://localhost:8000 NEXT_PUBLIC_FRAPPE_BASE_URL=http://localhost:8000
  FRAPPE_SITE_NAME=hub.localhost NEXT_PUBLIC_FRAPPE_SITE_NAME=hub.localhost PORT=3001 npm run dev`

Next
1. Remaining React Doctor warnings
2. Gantt view, Inbox compose, print view/format builder parity

## 2026-10-16 — session 1 (cont. 2): Desk engine, Sales Order parity, React Doctor
Verified (Playwright vs vendor1.localhost, all suites ALL PASSED):
- `e2e/form.salesorder.mjs` — new SO: customer → party details, item → rate (get_item_details), live totals,
  Link validation, delivery date to rows, save (server totals), submit, cancel, amend, delete
- `e2e/scripts.salesorder.mjs` — Client Script (refresh intro/button, customer, child qty, validate throw) and
  Server Scripts (Before Validate sets po_date, Before Save throws) all behave like Desk
- `e2e/list.salesorder.mjs`, `e2e/crud.todo.mjs`, `e2e/doctype.create.mjs` (Frappe's Create New DocType dialog →
  form builder → record)
Built: desk runtime (runs app __js/__list_js/Client Scripts), FormController, Grid, FormBody, ERPNext transaction
adapter, frappe.ui.Dialog host, Form Builder, calendar picker, Desk shortcuts, dashboards/workspaces/home.
React Doctor: 0 errors (from 10), score 33 → 65; 70 dead files removed.
Bench config: developer_mode, server_script_enabled, socketio (:9001) — see bench-vendor/docker/init.sh.

Next
1. Tree view route (/desk/doctype/X/view/tree) — list already offers it for tree DocTypes
2. /desk/query-report/<name> (Script/Query reports with filters + chart) — sidebar/⌘K link there
3. Report view (editable grid of a DocType) and saved list settings
4. Rebuild removed prototypes properly when needed: Kanban, Gantt, workflow actions on forms, bulk edit,
   data import/export, Inbox compose (currently not wired)
5. Remaining React Doctor warnings (112): component complexity, positional keys
6. Repeat the suites against the hub hub (`docker start sm-hub`, FRAPPE_SITE_NAME=hub.localhost)

## 2026-10-16 — session 1 (cont.): v16 compatibility + Desk-style forms
Verified in browser (Playwright) against vendor1.localhost
- Login (username or email), sidebar = Desk v16 module tree, ⌘K awesomebar (lists/new/reports/workspaces/docs)
- ToDo CRUD end-to-end: `e2e/crud.todo.mjs` ALL PASSED (create, mandatory error, edit, reload, comment, delete)
- Zero console/HTTP errors on /desk, lists, new doc, workspace (`e2e/smoke.desk.mjs`)
Fixed: CSRF on all POSTs, v16 removed APIs, meta via getdoctype, hydration errors, nav never loading
(initialData), Check fields, layout (tabs/columns), save response shape, FormStore Set crash.

Next
1. Seed demo data on vendor1 (Customer, Item, Sales Order) and run CRUD on submittable docs (Submit/Cancel/Amend)
2. Child tables (TableField) with child meta from getdoctype; Sales Order form
3. List view parity (columns from in_list_view, indicators from __list_js, filters, sidebar counts); remove duplicate Filters button
4. Workspace page rendering from `content` blocks (shortcuts, cards, charts) like Desk
5. Client-script runtime (async events, frappe.throw abort, child events, add_custom_button)
6. /desk/query-report/<name> page (sidebar/⌘K already link there)
7. ColorField shows #000000 for empty; date display in System Settings format
8. Point Trevo at the hub (localhost:8000, hub.localhost) and repeat checks

## 2026-10-16 — session 1: setup
Done
- Cloned github.com/Ashutosh-Neupane/trevo → `~/Desktop/School_saas/trevo-frontend`
- Fixed root `.gitignore` (`frappe/` → `/frappe/`); restored `lib/frappe/*` (19 files),
  `app/api/frappe/[...path]` BFF proxy, `MultiselectField` from the local copy at `~/Desktop/trevo`
  (they were never pushed). `tsc --noEmit`: 225 errors → 0. **Not yet committed/pushed.**
- `npm run build` passes; lint 28 errors → 0 (5 hook-deps warnings left). Real bug fixed:
  `DateRangeField` ignored its saved value (always rendered empty on reopen)
- graphify installed (`uv tool install graphifyy`), graph at `trevo-frontend/graphify-out/`, git hooks installed
- Vendor backend stack started (see CLAUDE.md → Backend)

Next (parity test loop)
1. Login + boot + sidebar/workspaces against vendor1.localhost
2. DocType list/form/new/edit for ERPNext + custom_vendor doctypes (Vendor Config single, Vendor Order, Product Mapping)
3. Custom DocType created in Desk → shows in Trevo; DocType created in Trevo builder → works in Desk
4. Reports: Report Builder, Query Report, Script Report
5. Workflow: create in Desk → states/actions on Trevo form; Vendor Order whitelisted methods as buttons
6. New page(s) as needed
