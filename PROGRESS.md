# Trevo — progress log

Newest entries on top. Each session: append what was done, what's verified, what's next.

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
