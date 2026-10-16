# Trevo — progress log

Newest entries on top. Each session: append what was done, what's verified, what's next.

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
