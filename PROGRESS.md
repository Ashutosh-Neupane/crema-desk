# Trevo — progress log

Newest entries on top. Each session: append what was done, what's verified, what's next.

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
- Desk context now carries the rest of `frappe.boot` (party_account_types, current_fiscal_year, …) into every
  runtime; shims: `erpnext.utils.get_fiscal_year`, `frappe.model.with_doc`, `frappe.db.get_link_options`

Next
1. Kanban, bulk edit, data import/export (rebuild properly); workflow bulk actions in list
2. Repeat the suites against the hub hub (`docker start sm-hub`, FRAPPE_SITE_NAME=hub.localhost)
3. Remaining React Doctor warnings

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
