# Crema product plan: what we build beyond Desk, and in what order

Written 2026-10-28. GAPS.md tracks Desk parity (what Crema must copy). This file is what Crema adds on top:
the things Frappe's own frontend can't do, and how Crema sits next to the other Frappe frontend projects.
MARKETING.md turns this into positioning and a launch plan.

---

## 1. Where Crema sits

| Project | What it is | Who it's for | Gap Crema fills |
|---|---|---|---|
| **Frappe Desk** (`/desk`) | The built-in admin UI, generated from DocType metadata | Every Frappe site | Dated look, hard on phones, navigation complaints in v16, jQuery-era code that's hard to restyle |
| **frappe-ui apps** (CRM, Helpdesk, …) | Hand-built Vue apps per product, on frappe-ui | One product each | Modern, but "less flexible than Desk": no layout control, conditional fields or Client Scripts; a new field means DocType + frontend + query changes |
| **[Doppio](https://github.com/NagariaHussain/doppio)** | `bench` CLI that scaffolds a Vue / React SPA or Desk page inside your app | Developers starting a custom UI | Gives you an empty app; every screen is still written by hand |
| **[frappe-react-sdk](https://github.com/The-Commit-Company/frappe-react-sdk)** | React hooks for auth, documents, lists, counts, method calls, file upload, search | Developers writing React screens | Data access only: no forms, no metadata-driven UI, no script runtime |
| **Desk themes** | CSS restyles of Desk | Sites wanting a fresh look | Same layout and behaviour underneath |
| **Crema** | A complete desk, driven by metadata, that runs the site's own scripts, plus an SDK of the same pieces | Users, partners and developers | Modern *and* as flexible as Desk, for every app, with no per-screen code |

**Positioning in one line:** Doppio and frappe-react-sdk help you *build* a frontend; Crema *is* the frontend, and
its engine can be reused in yours.

Rule: complement, don't compete with Frappe. Work alongside classic Desk (same data, same permissions), reuse
Espresso / frappe-ui design tokens, report upstream bugs, and stay compatible with frappe-react-sdk where it helps
(e.g. accept its `FrappeProvider` in the SDK).

---

## 2. What Crema does that Frappe's frontend can't

### 2.1 Many backends in one frontend (multi-site)
**The problem:** a company group with one site per company, a partner supporting 30 client sites, a franchise
with a site per branch. Today each site is a separate login, tab and inbox; Frappe Cloud's dashboard manages
*servers*, not daily work. A forum user asked for exactly this ("from one login I want to use multiple sites") and
got no supported answer.

**What Crema adds**
- **Site switcher** in the header; each site keeps its own session, boot, meta cache and realtime connection.
- **One inbox across sites:** approvals waiting on me (workflow), assignments, mentions, notifications — each row
  shows which site it came from.
- **Search across sites** in ⌘K ("SO-00231" finds it on whichever site has it).
- **Group dashboards:** the same number card or report run on several sites side by side (sales by company), read-only
  and computed per site, never mixing data on the server.
- **Per-site theme / logo**, so a partner can show each client their own brand.

**How (fits today's architecture)**
- The BFF already makes every Frappe call on the server (`lib/frappe/server.ts`). Extend it with a **site registry**
  (URL, site name, label, colour) and a **session vault**: one encrypted, httpOnly cookie per site (or a server-side
  store keyed by the Crema session). Routes become `/s/<site>/desk/...`; `deskCall` takes the site from the route.
- Caches (TanStack Query keys, meta cache, boot) are keyed by site; realtime opens one socket per active site.
- Auth: log in to each site separately at first; later SSO via Frappe's OAuth2 provider or a shared identity
  provider (Frappe supports social login / OAuth) so one login unlocks several sites.
- Security: a request can only reach the site in its route; no cross-site data on the server; per-site CSRF;
  sites are added by the person who runs Crema, never by URL parameters.

**Beyond Frappe (later, opt-in):** read-only panels from non-Frappe systems next to a document (shipping status,
bank feed, a government tax portal), through small server-side adapters. Data stays where it is; Crema only shows
it. Keep this out of scope until multi-site is solid.

### 2.2 AI that works inside the user's permissions
**Context:** ERPNext core ships no built-in AI in 2026. There are MCP servers (Frappe Assistant Core in beta,
community MCP servers for ERPNext) that let external chatbots call the API, and in-app add-ons. What's missing is
AI **inside the screen the user is working on**, using the same metadata Crema already reads.

**Features, in order of value and safety**
1. **Ask in ⌘K:** "unpaid invoices from Everest Foods last month" becomes the list with those filters (the user sees
   and can edit the filters; nothing runs that the user couldn't click).
2. **Explain:** "why can't I submit this?" reads the validation message, the workflow and the user's permissions and
   explains it in plain words; "what does this field do?" uses the DocField description and help.
3. **Summarise:** a document's timeline, a long email thread, a report's result.
4. **Draft from text or a file:** paste an email or drop a supplier PDF → a **draft** Purchase Invoice / Sales Order
   with fields filled, shown for review; the user saves. Never submits.
5. **Report assistant:** "sales by territory this quarter as a chart" → a Report Builder view the user can save.
6. **Fix-it suggestions** on errors (mandatory fields missing, link not found → "create Customer X?").

**How**
- Runs in the BFF: the model only gets what the user's session can read (calls go through `frappeServerFetch` with
  the user's cookie), plus the DocType metadata as context. Tools = the same whitelisted methods Desk uses
  (`reportview.get`, `getdoc`, `savedocs` for drafts only).
- **Propose → confirm:** every write is shown as a diff or a draft form; the user clicks Save. Each AI action leaves
  a timeline comment ("Drafted with AI from invoice.pdf").
- **Provider-agnostic, bring your own key**, configured per site by a System Manager (a "Crema Settings" DocType in
  phase 3): Anthropic Claude by default (e.g. `claude-sonnet-5-5` for speed, `claude-opus-5-5` for hard documents),
  or another provider / a self-hosted model. Off by default; usage limits per user.
- **MCP both ways:** Crema can use an installed Frappe Assistant Core as its tool server, and can expose its own
  MCP endpoint (through the BFF, with the user's session) so external assistants act with the same rules.
- Privacy: say which data leaves the site; allow excluding DocTypes (HR, salary) from AI context.

### 2.3 Other things Desk doesn't do
- **Works on a phone, installable (PWA):** bottom navigation, barcode scan to find an item, camera attachments,
  offline drafts for field sales that sync when back online.
- **White-label per partner / client:** logo, colours, login page, default home — the "win the demo" feature.
- **Accessibility:** keyboard everywhere, screen-reader labels, contrast; forum users report v16 accessibility gaps.
- **Embeddable SDK (`@crema/react`):** the metadata-driven `<DocForm doctype="Sales Order" />`, `<DocList />`,
  `<ReportView />` and the script runtime as packages, so a team building its own React portal (with Doppio or
  frappe-react-sdk) gets real ERPNext forms for free. This is where Crema helps developers, not only users.

---

## 3. Order of work

AI and multi-site are the headline, but first impressions come from forms that work. So:

| Step | What | Why now | Size |
|---|---|---|---|
| 1 | Finish phase 1 milestones **M1** (forms like Desk) and **M6** (works on a phone) from GAPS.md | A demo that breaks on a Sales Order kills every other message | weeks |
| 2 | **Demo site + docker-compose try-out** (MARKETING § 2) | Nobody can try Crema today | days |
| 3 | **AI v0:** "Ask in ⌘K" (natural language → list filters) and "Explain this error", behind a setting | Small, safe (read-only), and the best 30-second demo | 1–2 weeks |
| 4 | **Multi-site v0:** site registry, session vault, site switcher, per-site caches | The feature no other Frappe frontend has | 2–3 weeks |
| 5 | **Inbox across sites** (approvals, assignments, mentions) + workflow stepper (GAPS 2.16) | Turns multi-site into daily value | 1–2 weeks |
| 6 | **AI v1:** draft from PDF/email, timeline summaries, report assistant | Needs steps 1 and 3 to be solid | 2–3 weeks |
| 7 | **SDK alpha** (`@crema/react`: DocForm, DocList) + docs | Brings developers; pairs with Doppio / frappe-react-sdk users | 2–3 weeks |
| 8 | Phase 2 UI/UX (GAPS § 3) and phase 3 Frappe app (GAPS § 4), in parallel with feedback | Installs on any site with `bench get-app` | ongoing |

Each step ships as PRs with an e2e suite, a short demo GIF, and a changelog entry (that's also the marketing).

---

## 4. What we want from Frappe (company and community)

| Ask | Why | How |
|---|---|---|
| **Stable desk APIs** (`getdoctype`, `getdoc`, `savedocs`, `reportview`, boot) and early notice of breaking changes | Crema depends on them | Follow `develop`, run e2e against each v16.x release, open issues early |
| **Trademark clarity** for "a desk for Frappe & ERPNext" wording and the eventual Frappe app name | Policy needs written permission for names/domains with "Frappe"/"ERPNext" | Email legal@frappe.io before the public launch |
| **Marketplace listing** on Frappe Cloud once phase 3 (Frappe app) exists | Where ERPNext users look for apps | Follow marketplace guidelines; keep the GPL parts in their own module |
| **Feedback from the core team** on the approach (L1–L4 compatibility) | Avoid building on something they plan to change | Share the architecture post in the forum; ask, don't pitch |
| **Partners and community** as first users | Frappe says growth comes from the ecosystem | Early-access programme for partners (MARKETING § 5) |
| **A talk slot** (Frappeverse, FOSS United meetups) | Credibility and reach | Propose once the demo and one real user exist |

What we give back: bug reports and small upstream fixes found while porting Desk, docs of Desk behaviour (GAPS.md is
already a detailed map of Desk's frontend), and an MIT-licensed SDK others can build on.

---

## 5. Risks specific to this plan

| Risk | Mitigation |
|---|---|
| AI writes wrong data | Drafts only, user confirms, timeline note, off by default, per-DocType exclusions |
| AI cost / data leaving the site | Bring-your-own key, usage limits, self-hosted model option, clear notice |
| Multi-site session security | Server-side session vault, site locked by route, no cross-site server joins, security review before release |
| Scope creep (AI + multi-site + SDK + parity) | Follow § 3 order; each step must be demoable before the next starts |
| Frappe ships similar features | Stay complementary; multi-site and "Desk flexibility with a modern UI" are areas Frappe has said it won't cover soon |
