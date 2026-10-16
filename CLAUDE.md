# Trevo — Next.js desk frontend for Frappe

Goal: a 1:1 replacement for Frappe Desk (`/app`) built in Next.js 16 + React 19 + Tailwind 4.
Anything a user can do in Frappe Desk (DocType CRUD, reports, workflows, workspaces,
builders) should work here against any Frappe v16 site — no per-app hardcoding.

**Start here:** read `PROGRESS.md` (where we left off), then query the code graph:
`trevo-frontend/graphify-out/GRAPH_REPORT.md` (or `/graphify` queries). Graph auto-refreshes on commit.

## Layout
- `trevo-frontend/` — the Next.js app (all code lives here; run npm commands from here)
- `/frappe/` at repo root — optional local backend checkout, gitignored (note the leading `/`:
  a bare `frappe/` pattern once hid `lib/frappe/` from git and broke the published repo)

## Architecture (data flow)
Browser → `app/api/frappe/[...path]` (generic BFF proxy) or typed BFF routes in `app/api/*`
→ `lib/frappe/server.ts` (`frappeServerFetch`, forwards `sid` cookie) → Frappe `FRAPPE_BACKEND_URL`.
- `lib/frappe/client.ts` — browser-side client (calls go through `/api/frappe/*`, never directly to Frappe)
- `lib/frappe/types.ts` — DocType meta / DocField / API envelope types
- `lib/trevo-form/` — metadata-driven form engine (controls per fieldtype, client-script bridge)
- `proxy.ts` — Next 16 "middleware": redirects to `/login` if no `sid` cookie
- Routes: `/desk/doctype/[doctype]` list, `/[name]` form, `/new`, `/builder`; `/desk/workspace/[name]`; `/desk/reports`

## Backend for testing (Frappe **v16** — Trevo was originally written against v15)
Stack: `~/Desktop/School_saas/docker-compose.bench.yml` (services `vendor`, `hub`). Login Administrator / admin.
| Bench | URL | Site | Apps |
|---|---|---|---|
| sm-vendor | localhost:8001 | vendor1.localhost | frappe, erpnext, custom_vendor |
| sm-hub | localhost:8000 | hub.localhost | frappe, hub |
- `.env.local`: `FRAPPE_BACKEND_URL` + `NEXT_PUBLIC_FRAPPE_BASE_URL` = bench URL, `FRAPPE_SITE_NAME` = site
  (sent as `X-Frappe-Site-Name`; gunicorn ignores `default_site`, so this is required).
- Desk to compare against: http://vendor1.localhost:8001/desk (v16 Desk lives at `/desk`, not `/app`).
- Trevo dev server runs on **:3001** (another app holds :3000).
- Shell: `docker exec -it sm-vendor bash` → `cd /home/frappe/bench && bench --site vendor1.localhost console`
- Frappe source for reference: `docker exec sm-vendor ls /home/frappe/bench/apps/frappe/frappe/public/js/frappe`

## v16 facts the code depends on
- Desk boot (`module_sidebars`, `app_data`, `workspaces`, `user.can_read`, `user.defaults`, csrf token) is only
  inlined in the `/desk` HTML → `lib/frappe/deskBoot.ts` parses it (cached per sid).
- CSRF is enforced for cookie-auth POST/PUT/DELETE → `backendFetch()` adds the session token. Always use
  `backendFetch` / `frappeServerFetch` in BFF routes, never bare `fetch`.
- Removed in v16: `frappe.desk.desktop.get_workspace_sidebar_items`, `frappe.desk.notifications.get_notification_log`,
  Module Def `color`/`icon`.

## Git
Push with `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push` — the macOS keychain
helper blocks on a GUI prompt. Work branch: `feat/frappe-desk-parity`.

## Commands (from `trevo-frontend/`)
- `npm run dev` · `npx tsc --noEmit` · `npm run lint` · `npm run build`
- Browser checks against the live bench: `node e2e/smoke.desk.mjs /desk "/desk#k=sales order" …` (console/HTTP
  errors + screenshots) and `node e2e/crud.todo.mjs` (full CRUD, verified via API). Set `OUT=` for screenshots.

## Testing approach
Verify parity by doing the same action in Frappe Desk (`localhost:8001/app`) and in Trevo,
then confirm the result in the DB/API. Key loops: create DocType → appears in list/form;
create Report (Report Builder / Script / Query) → runs in `/desk/reports`; create Workflow →
state/actions show on the form and transitions work; create Workspace → renders in sidebar.
