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

## Backend for testing
Vendor stack from `~/Desktop/School_saas/docker-compose.bench.yml` (service `vendor` only):
- Frappe v16 + ERPNext v16 + `custom_vendor` app, site `vendor1.localhost`, http://localhost:8001
- Login: Administrator / admin
- Frappe picks the site from the Host header; the container sets `default_site` so `localhost:8001` works.
- `.env.local` → `FRAPPE_BACKEND_URL=http://localhost:8001`, `NEXT_PUBLIC_FRAPPE_BASE_URL=http://localhost:8001`
- Shell: `docker exec -it sm-vendor bash` then `cd /home/frappe/bench && bench --site vendor1.localhost console`

## Commands (from `trevo-frontend/`)
- `npm run dev` (port 3000) · `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm test` (Playwright)

## Testing approach
Verify parity by doing the same action in Frappe Desk (`localhost:8001/app`) and in Trevo,
then confirm the result in the DB/API. Key loops: create DocType → appears in list/form;
create Report (Report Builder / Script / Query) → runs in `/desk/reports`; create Workflow →
state/actions show on the form and transitions work; create Workspace → renders in sidebar.
