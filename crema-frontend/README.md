# Crema Frontend

A modern React-based desk interface for the Frappe backend, built with Next.js (App Router). It talks to Frappe exclusively through a BFF (Backend-for-Frontend) API layer that proxies `frappe.client` / `frappe.method` calls and re-issues the session cookie on the Next.js domain.

## Tech Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS 4** + shadcn/ui-style components (`components/shadcn/`)
- **TanStack React Query** for server state, **Zustand** for client state
- **socket.io-client** for realtime updates, **frappe-gantt**, **dnd-kit**, **recharts**
- **Playwright** for end-to-end tests

## Getting Started

1. Copy the environment template and point it at your Frappe site:

   ```bash
   cp .env.example .env.local
   ```

   The required values are `NEXT_PUBLIC_FRAPPE_BASE_URL` and `FRAPPE_BACKEND_URL` (default `http://localhost:8000`).

2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) and log in with a user from your Frappe site.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint over the whole project |
| `npm test` | Playwright e2e tests (run `npm run test:install` once first) |

## Project Structure

```
app/
  (auth)/login/          Login page
  (desk)/desk/           All desk routes (lists, forms, views, admin tools)
  api/                   BFF routes that proxy to the Frappe backend
components/
  features/              Feature modules (kanban, gantt, files, inbox, …)
  shadcn/                Reusable UI primitives
lib/
  frappe/                Frappe client library, types, boot info, auth
  crema-form/            Form engine: renderer, controls, validation,
                         client-script sandbox, undo manager
  hooks/ stores/         React Query hooks and Zustand stores
  services/              Rate limiter, CSRF, realtime socket
proxy.ts                 Route-level auth guard (sid cookie check)
```

## Feature Overview

- **Core**: doctype lists with advanced filters, saved views, grouping, URL-persisted filter state; document forms with 24+ field controls, validation, autosave, undo/redo, and client-script execution in a sandbox
- **Views**: Kanban, Gantt, Calendar, Tree, Map, Image gallery, Reports, Dashboard
- **Files**: browser with folder navigation, upload, and preview
- **Builders**: Form Builder, Print Format Builder, Workflow Builder
- **Collaboration**: timeline with comments/emails, assign-to, share, document follow, tags, notifications
- **Admin**: users, roles & permission manager, server scripts, system console, translations, backups, web forms with public rendering, onboarding tours, module editor, list view settings
- **Infra**: session auth via `sid` cookie, CSRF tokens, login rate limiting, realtime updates via socket.io, global search (⌘K)

## Authentication Flow

`app/api/auth/login` proxies `POST /api/method/login` to Frappe, then re-issues the returned `sid` cookie on the Next.js domain. `proxy.ts` guards `/desk/*` and `/api/*` routes synchronously by checking that cookie, redirecting unauthenticated users to `/login`.
