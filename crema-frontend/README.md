# crema-frontend

The Next.js app behind Crema. What Crema is, what works and what's next: see the [root README](../README.md).

## Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**
- **Tailwind CSS 4** with shadcn-style primitives (`components/shadcn/`)
- **TanStack Query** for server state, **Zustand** for client state
- **socket.io-client** for realtime, **dnd-kit**, **frappe-gantt**, **recharts**
- **Playwright** for the end-to-end suites in `e2e/`

## Development

```bash
cp .env.example .env.local   # FRAPPE_BACKEND_URL, NEXT_PUBLIC_FRAPPE_BASE_URL, FRAPPE_SITE_NAME
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` · `npx tsc --noEmit` | Lint and type-check |
| `BASE=http://localhost:3000 node e2e/run-all.mjs` | All browser suites against a live Frappe site |
| `BASE=… OUT=… REDACT=… node e2e/readme-shots.mjs` | README screenshots |

## How requests flow

Browser → `app/api/frappe/[...path]` (generic proxy) or a typed route in `app/api/*` → `lib/frappe/server.ts`
(forwards the `sid` cookie and adds the CSRF token) → Frappe.

`app/api/auth/login` proxies Frappe's `/api/method/login` and re-issues the `sid` cookie on Crema's domain.
`proxy.ts` sends requests without a session to `/login`.
