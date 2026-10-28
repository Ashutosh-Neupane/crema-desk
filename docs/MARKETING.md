# Crema: positioning and launch plan

Product plan (what Crema builds beyond Desk: multi-site, AI, SDK): [PLAN.md](PLAN.md).

Goal: make Crema a credible open-source project that Frappe users try, contributors join, and employers read as
serious engineering work, not a hobby repo. Written 2026-10-28; revisit after each launch step.

---

## 0. What the Frappe community is saying (research, 2026-10-28)

Read before writing any post: Crema's message should answer these, in the community's own words.

| What people say | Where | What it means for Crema |
|---|---|---|
| Partners lose deals at the demo: buyers coming from SAP / Odoo find ERPNext "too plain"; one seller says prospects go quiet in "almost 50%" of demos | [We lost a big deal today because of the Frappe UI](https://discuss.frappe.io/t/we-lost-a-big-deal-today-because-of-the-frappe-ui/154886) (Sep 2025), [ERPNext UI intimidating to new users](https://discuss.frappe.io/t/erpnext-ui-intimidating-to-new-users-what-can-we-do-about-it/39536) | **Partners are the first audience.** Pitch: "win the demo without rebuilding the product" |
| Frappe's new apps (CRM, Helpdesk) look modern but are "less flexible than Desk": no layout control, conditional fields, scripts; adding a field means DocType + frontend + query changes. Partners ask what they should sell. Frappe: Desk and the new apps are "evolving separately" for the next 2–3 years | [Frappe CRM UI v/s Desk UI?](https://discuss.frappe.io/t/frappe-crm-ui-v-s-desk-ui/156477) (Nov–Dec 2025) | **This is Crema's exact gap:** a modern UI that keeps Desk's flexibility, because it's metadata-driven and runs Customize Form, Client Scripts and app JS |
| v16 navigation called a "UX disaster": dock changes per app, settings scattered, duplicate entries, accessibility (WCAG, screen reader) problems. Frappe replied with fixes, says the UX overhaul has "just started" and is hiring UX designers | [Overcomplicated Navigation in v16](https://discuss.frappe.io/t/overcomplicated-navigation-in-v16-and-a-user-experience-ux-disaster/165094) (Oct 2026) | Stable, simple navigation and an accessibility pass are visible differentiators; but Frappe is moving, so Crema must stay **complementary, not adversarial** |
| "Why isn't Desk improving faster?"; worries about the ecosystem splitting into separate apps; Frappe: Desk "needs an upgrade too", growth will come from "the ecosystem and the community" | [Concerns about the future direction](https://discuss.frappe.io/t/concerns-questions-about-the-future-direction-of-erpnext-and-the-frappe-ecosystem/148057) (Jun 2025) | Frappe itself invites ecosystem projects; position Crema as one |
| Teams build their own per-module SPAs on ERPNext because "the desk styled UI is not very intuitive for our users"; others ask how to put React in front of Frappe | [Custom front-end for ERPNext](https://discuss.frappe.io/t/i-have-created-custom-front-end-for-erpnext-and-frappe-framework-and-so-far-it-is-working-well/164894), [Building custom frontends using React](https://discuss.frappe.io/t/building-custom-frontends-on-frappe-using-react-or-other-framework-instead-of-desk-ui/164118) (Sep 2026) | Demand exists; each team rebuilds per module. Crema's pitch: "don't rebuild per module" |
| Mobile: drawers covering the screen, the v16 module switcher missing on phones, lists hiding the document name | [Access modules in sidebar on mobile](https://discuss.frappe.io/t/access-modules-of-erpnext-in-sidebar-on-mobile/165239) and older threads | "Works on a phone" is a headline feature (GAPS M6) |
| Onboarding / deployment is confusing for new users | [Onboarding & deployment experience](https://discuss.frappe.io/t/the-onboarding-deployment-experience-of-frappe-erpnext-is-unnecessarily-confusing-for-new-users/161474) (Mar 2026) | Crema's install must be one command, or it inherits the same complaint |

**Where Frappe is heading** (so Crema doesn't collide with it):
- v16.50 (no v17 yet): App → Module → sidebar navigation, a dock, consolidated DocType Settings, list layouts,
  Kanban v2, Espresso components that match frappe-ui; module revamps (Customer, Supplier, Item, Projects) and
  Insights dashboards in Desk in Nov–Dec 2026 ([announcement](https://frappe.io/blog/product-updates/announcing-framework-erpnext-and-hrms-v1650)).
- Frappe UI v1, Studio, Builder AI and a "Frappe Suite" targeted for end of 2026, per a third-party
  [Frappeverse 2026 recap](https://www.cratorlabs.ai/blog/frappeverse-mumbai-2026-recap) (unconfirmed by Frappe).
- Consequence: compete on what Frappe has said it won't do soon (one modern UI with Desk's full flexibility, for
  every app), track v16.x releases closely, and reuse Espresso / frappe-ui design tokens so Crema looks at home.

**Alternatives today:** Desk themes (restyle only), Frappe's own frappe-ui apps (modern, per product, less
flexible), custom per-module SPAs (built by each team), and a community "Modern Desk UI for v14/v15" in Vue
mentioned in the deal thread. None is a metadata-driven replacement for Desk that runs existing app scripts.

---

## 1. Positioning

**One line:** Crema is a modern, mobile-friendly desk for Frappe and ERPNext that works with your existing site,
apps and scripts.

**For partners (first audience):** "Win the demo. Crema gives your ERPNext clients a modern, phone-ready interface
on the site you already deliver: same DocTypes, customizations and Client Scripts, no per-module rebuild."

**Against frappe-ui apps:** "Modern like Frappe CRM, flexible like Desk." Not "better than Frappe": Crema fills the
gap Frappe has named, and works alongside classic Desk.

**Against Doppio / frappe-react-sdk:** "They help you build a frontend; Crema is the frontend — and its forms are a
React package you can drop into yours." Friendly, not competitive: both are good tools, and the SDK should work
with frappe-react-sdk.

**Headline features beyond Desk** (PLAN § 2), in the order they ship:
1. *Works on a phone* — "ERPNext in your pocket, the same site, no app store".
2. *AI inside the screen, inside your permissions* — "Ask for 'unpaid invoices from Everest last month' and get the
   list; drop a supplier PDF and get a draft invoice to review". Always drafts, never auto-submits.
3. *Many sites, one desk* — "One login, one inbox, every company / client site" for groups and partners.
4. *White-label* — each partner or client sees their own brand.

**Who it is for**

| Audience | Their pain today | What Crema gives them |
|---|---|---|
| ERPNext implementers / partners | Clients find Desk dated and hard on phones; custom UIs are rebuilt per project | One frontend that every client site gets, no per-app code |
| Companies running ERPNext | Staff training cost, slow daily screens, poor mobile use | Cleaner forms and lists, works on a phone, same data and rules |
| Frappe app developers | Building a modern UI means a separate frappe-ui app per product | Their DocTypes, scripts and reports get a modern UI for free |
| Frontend developers | Want a real-world, large React codebase to contribute to | Next.js 16 / React 19 / Tailwind 4, e2e-tested, clear gaps list |

**Why it is different** (say these in every post, in this order)
1. **Drop-in, not a rewrite.** It reads DocType metadata and runs the site's own form, list and report JavaScript.
   ERPNext's Sales Order, Invoice and Stock Entry scripts run unchanged.
2. **Same server, same rules.** Every action goes through Frappe's own APIs: no new backend, no data migration.
3. **Verified against Desk.** 50+ browser suites do the same action in Crema and check the result on the server.
4. **Built for the next decade.** React 19, Tailwind 4, responsive layout, themable, accessible.

**What it is not (say it plainly):** not a fork of Frappe, not affiliated with Frappe Technologies, not a hosted
service.

**Naming and trademark** ([Frappe's policy](https://docs.frappe.io/legal/others/license-and-trademark)): "Frappe"
and "ERPNext" may be used to *truthfully describe* compatibility ("a desk for Frappe and ERPNext sites"), but a
product name, company name or **domain** containing them needs Frappe's written permission, as does using their
logos or implying endorsement. So: the product is **Crema**; tagline "a modern desk for Frappe & ERPNext";
domain like `crema-desk.dev`, never `frappe-…`/`erpnext-…`; own logo; "not affiliated" line in README and site.

**Honest status line** for the README and posts: "Phase 1 (Desk parity) — daily ERPNext selling, buying and stock
flows work; see GAPS.md for what doesn't yet."

---

## 2. Make it launch-ready first (before any marketing)

People try a project once. Each item below removes a reason to leave in the first five minutes.

| # | Item | Why | Done when |
|---|---|---|---|
| 1 | **Public demo site** with fake data (a fresh ERPNext site, demo company "Demo Company", nightly reset) | Nobody installs a desk to look at it | `demo.<domain>` opens Crema logged in as a demo user; never the office bench or client data |
| 2 | **One-command try-out**: `docker compose up` with Frappe + ERPNext + Crema and seed data | Implementers want to see it on their machine | Fresh laptop → working demo in < 10 minutes, documented |
| 3 | **Install on an existing site**: phase 3 Frappe app (`bench get-app crema`), or the Node proxy documented with nginx | That's the real adoption path | Guide tested on a clean bench |
| 4 | **60–90 s demo video + GIFs** in the README: open a Sales Order, add items, submit, print, same on a phone | Shows "drop-in" faster than words | Video on YouTube, GIFs in README |
| 5 | **Docs site** (Docusaurus or Starlight on GitHub Pages): what works, install, architecture (L1–L4), FAQ, roadmap | README can't hold it all | Site linked from the repo "Website" field |
| 6 | **Contributor kit**: CONTRIBUTING.md, issue + PR templates, `good first issue` labels from GAPS.md, Discussions on, CODE_OF_CONDUCT, SECURITY.md | Strangers need a way in | 10 labelled starter issues |
| 7 | **Licence clarity**: MIT core, GPL-3.0 ERPNext-ported files listed (already in THIRD_PARTY_NOTICES.md); decide whether to move those into a separate GPL package | Companies check this before trying | Short "Licensing" section in docs |
| 8 | **Releases**: semantic versions, CHANGELOG.md, GitHub Releases with notes and screenshots | Shows the project is alive and stable | v0.1.0 tagged |
| 9 | **CI**: type-check, lint, build on every PR; e2e against a throwaway bench in GitHub Actions | Badges + trust; protects contributors | Green badges in README |
| 10 | **Privacy check**: no client names, no bench URLs, no real data in code, docs, screenshots, or history | Office work must stay private | `git log -p` grep clean before launch |

---

## 3. Launch plan (12 weeks, after section 2 is done)

| Week | Step | Channel |
|---|---|---|
| 0 | Soft launch: ask 5–10 Frappe developers you know to try the demo and file issues; fix the top 5 | direct messages |
| 1 | **"Introducing Crema"** post: problem, demo GIF, how it runs Desk's JS, honest status, link to demo; reply (helpfully, once) in the threads in § 0 where it answers the question asked | discuss.frappe.io (Show and Tell), Frappe Telegram/Discord groups, LinkedIn |
| 1 | Add to lists | `awesome-frappe` PR, GitHub topics (done), dev.to tag `frappe` |
| 2 | **Technical deep-dive post**: "Running ERPNext's jQuery form scripts inside React" (L1–L4 architecture) — this is the one engineers share | dev.to / Hashnode / your blog, cross-post to LinkedIn |
| 3 | **Show HN**: "Show HN: Crema – a modern frontend for ERPNext that runs its existing scripts" — only once the demo is solid | Hacker News |
| 3 | r/ERPNext, r/selfhosted, r/reactjs (architecture angle), r/opensource | Reddit (read each sub's self-promo rules) |
| 4–8 | One short post every 2 weeks: a feature (mobile forms, print, workflow stepper), with a before/after GIF vs Desk | LinkedIn, X, forum thread updates |
| 6 | Talk proposal: Frappe Conference / FOSS United meetup / a local Kathmandu dev meetup ("How we made ERPNext usable on a phone") | conferences, meetups |
| 8 | Product Hunt (developer tools), once the docs site, video and install path are polished | Product Hunt |
| 12 | Retrospective post: numbers, what users asked for, what's next (phase 2 UI) | all of the above |

Rules: post only what is true and working today; answer every comment within a day; never buy stars, never ask for
stars in exchange for anything, never post in the same place more than once a month.

---

## 4. As a portfolio project

What hiring managers look for, and where Crema shows it:

| Signal | Where it shows | To add |
|---|---|---|
| Hard problem, clear thinking | L1–L4 compatibility architecture | `docs/architecture.md` with diagrams, and the deep-dive post |
| Quality discipline | 50+ e2e suites verified against a live backend | CI badges, a "How we test parity" page |
| Product sense | GAPS.md phases, the phase 2 UX plan, popup-vs-page rule | Before/after screenshots vs Desk |
| Shipping | Releases, changelog, demo | v0.1 → v0.2 cadence every 4–6 weeks |
| Communication | README, posts, talk | Case study page on the portfolio site |

Portfolio site: a Crema case study page (problem → approach → architecture → results → what I learned), linking
the demo, repo, video and the deep-dive post. Profile README: Crema first, with the one-liner and demo link.
CV line: "Built Crema, an open-source React/Next.js frontend for Frappe/ERPNext that runs existing app scripts
unchanged; 50+ parity e2e suites."

---

## 5. Community and growth

- **Roadmap in public**: GAPS.md milestones as a GitHub Project board; label issues by milestone (M1–M7).
- **Good first issues**: field controls to verify (GAPS 2.3), list extras (2.4) — small, testable, well-scoped.
- **Recognise contributors**: all-contributors table in the README, thanks in every release note.
- **Discussions**: "Show your setup", "Q&A", "Ideas"; turn repeated questions into docs.
- **Partners**: offer ERPNext implementers early access and a feedback call; one partner using Crema with a real
  client (with permission) is worth more than any post.
- **Sponsorship later**: GitHub Sponsors / Open Collective once there are users; paid support or hosting only after
  the project is clearly useful.

---

## 6. Metrics (check monthly)

| Metric | 3 months | 6 months |
|---|---|---|
| GitHub stars | 100 | 400 |
| Demo visitors / week | 50 | 200 |
| External issues opened | 15 | 50 |
| External contributors with merged PRs | 3 | 10 |
| Sites running Crema (self-reported) | 3 | 15 |
| Forum thread replies | 20 | — |

Stars are a side effect; the real goal is people using it and contributing.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| "Desk parity is never finished" | Lead with what works; phase 1 is "a day's work in ERPNext", not every Desk screen |
| Frappe changes Desk / APIs (v17) | Pin to v16, track `develop`, e2e catches breaks; document supported versions |
| Name / trademark confusion with Frappe | Product name Crema only, descriptive tagline, no Frappe/ERPNext in domain or logo, "not affiliated" line; ask legal@frappe.io before anything closer |
| Frappe's own UX overhaul catches up | Stay complementary (works with classic Desk, same data), reuse Espresso tokens, report bugs upstream, lead on flexibility + mobile + accessibility, ship fast |
| GPL parts scare companies | Keep ERPNext-derived code in a clearly separated GPL module |
| Office client data leaking | Demo uses only generated data; privacy check before every release |
| Burnout from support load | Discussions + docs first, issue templates, say no to out-of-scope requests |

---

## 8. Next three actions

0. Read the § 0 threads in full and note the exact phrases people use; reuse them in the README and posts.

1. Finish phase 1 milestones M1 and M6 from GAPS.md (forms like Desk, works on a phone): they decide first impressions.
2. Set up the public demo site and the docker-compose try-out (section 2, items 1–2).
3. Record the 90-second video and write the "Introducing Crema" forum post (draft first, publish when 1–2 are live).
