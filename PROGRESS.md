# Crema — progress log

Newest entries on top. Each session: append what was done, what's verified, what's next.

## 2026-11-18 — M5 started: saved list layouts
- Saved layouts (Desk v16 List Filter) on every list: menu next to the view switcher, create / edit / duplicate /
  delete, global or personal, applied filters + sort + columns, remembered per user, picked from URL filters by
  route signature, stored in Desk's format so Desk and Crema share them.
- e2e: listlayouts (new). listsettings, formsave green. React Doctor 0 errors, score 57.
- Commits go back to the repo's Conventional Commits style (`feat(list): …`, `test(e2e): …`, `docs: …`).
- Next in M5: row extras (comment counts, assignees, likes, unread), listview_settings hooks, report view
  group-by, ERPNext financial statements.

## 2026-11-18 — M4: dialog controls like Desk; React Doctor back to 0 errors
- MultiSelect, MultiSelect Pills, MultiSelect List, MultiCheck, Date Range return Desk's values from a dialog
  (string / arrays / [from, to]); options as lines, JSON, {label, value, checked} items or get_data(txt).
- React Doctor (run with `npx react-doctor@0.9.23 . -y --no-supply-chain`): 7 errors → 0, score 35 → 57. Fixed a
  hydration branch (Barcode), a side effect inside a state updater (Print Builder prefs), a ref written during render
  (Gantt drag); marked the intended ones (Desk `eval:` filters, Custom HTML Block scripts, listeners owned by the
  Leaflet / Quill instance). It will be run before every PR from now on.
- e2e: controls3 (new); report.mjs made data-agnostic (searched a Sales Order name from the old bench). dialogs,
  controls2, formsave, report, gantt, pfbuilder green.
- M4 left: Small/Long Text, Button, Heading, Comment (render-only; low risk). Next: performance pass, then M5.

## 2026-11-18 — M4: Table MultiSelect, Autocomplete, Password, Color, Icon like Desk
- Table MultiSelect was wrong in forms (a grid) and as a control (checkboxes over a DocType name): now Desk's pill
  picker over the child table's Link field, in forms (row events fire) and dialogs. Autocomplete now refuses text
  that isn't an option (Desk's validate) and supports label/value options, JSON lists, Installed Applications and
  set_query methods. Password has the strength meter; Color Desk's swatches and no fake #000000; Icon lists Desk's
  real icon sprites. LinkField gained `exclude` / `clearOnPick` for multi-value pickers.
- e2e: controls2 (new). linkfield, dialogs, formsave, form.salesorder, controls green.
- Left in M4: the dialog-only controls (MultiSelect family, MultiCheck, Date Range, Switch), Small/Long Text,
  Button, Heading, Comment. Next: those, then M5.

## 2026-11-18 — M4: Rating, Duration, Phone, Barcode, Geolocation store Desk's values
- Five controls wrote values Desk can't read; each is now ported from its Desk control: Rating a fraction with half
  stars (was the star count), Duration seconds with Desk's "1d 2h 3m 4s" text and picker (was "HH:MM:SS"), Phone
  "+977-98…" with all countries and the site's country preselected (was "+977 98…", 14 countries), Barcode the SVG
  Desk prints (was the raw value; EAN now validated), Geolocation GeoJSON on Leaflet / OpenStreetMap with drawing
  tools (was {lat, lng} on Google Maps). Lists and reports already formatted Desk's values.
- e2e: controls (new — a document written in Desk's format opens clean, Crema's edits are saved in Desk's format).
  formsave, dialogs, form.salesorder green.
- Next: the remaining 🟡 controls (Color, Password, Signature, Icon, Autocomplete, Table MultiSelect, dialog-only).

## 2026-11-18 — M4: code editors like Desk; phase-1 plan for today
- Code / HTML Editor / Markdown Editor / JSON are one CodeMirror control ported from Desk's `code.js` family. Fixed
  on the way: HTML Editor was a WYSIWYG box (Desk edits HTML as code with a preview); Markdown preview used a regex
  renderer (now showdown 2.1.0 + Desk's sanitizer, as `frappe.markdown`, which app scripts can now call); a Code
  field without options was highlighted as JavaScript (Desk: plain text); JSON saved a parsed object (Desk: the text).
- e2e: editors (new); print made data-agnostic (any Sales Order / format / letter head; a format whose PDF
  generator the site lacks shows the server's reason). pfbuilder, pfnative, printformat, formsave, dialogs,
  texteditor green.
- Plan to close phase 1 (definition in GAPS § 0.1): rest of M4 → M5 (saved filters, row extras, listview hooks,
  group-by, ERPNext financial statements) → a "day of work" suite (sell, buy, stock, pay, report) → M7 minimum.

## 2026-11-18 — M4: Text Editor is Quill, like Desk
- The contentEditable box (execCommand, `window.prompt` for links) is replaced by Quill 2.0.3, set up from Desk's
  `text_editor.js` (`lib/crema-form/quill.ts`), so HTML written in Crema and in Desk is the same. Loaded on demand.
- Tables, images (Frappe turns the inline image into a File on save), checklist, colours, sizes, alignment, code
  blocks; paste cleaned; pasted scripts dropped (Crema; Quill alone keeps their text).
- e2e: texteditor (new); form.salesorder, formsave, formnav, mobile, timeline, formmenu, linkfield, dialogs green.
- Dev note: after adding rules to `app/globals.css` the running dev server kept serving the old stylesheet
  (Turbopack); restarting `npm run dev` picked them up. `next build` had them all along.

Next: the 🟡 controls in GAPS § 2.3, one family at a time (Markdown / HTML / JSON / Code editors first).

## 2026-11-18 — M4 started: Link field like Desk; e2e suites own their data; #13–#16 merged
- Merged CI (#13), M2 workflow (#14), M3 grid (#15) and the e2e data fixes (#16); each branch updated with `main`
  and green in CI before merging. Dependabot opened #17 / #18 (actions/checkout and setup-node 4 → 7): left open.
- Link control: titles for "Show Title in Link Fields" DocTypes, `link_filters` applied (a real bug: Customize
  Form filters on a Link were ignored), "Filtered by: …", Create only with permission, Advanced Search (the Add
  Multiple dialog in single mode, title first).
- e2e: linkfield (new); form.salesorder, formmenu, sidebar, timeline now find their own data — every suite run
  this session passes on a fresh v16 + ERPNext site.

Next: rest of M4 — Text Editor (images, mentions, tables, paste cleanup), then the 🟡 controls one family at a time.

## 2026-11-18 — M3: a grid you can type in
- Keyboard and spreadsheet paste like Desk; Add Multiple (also on ERPNext transactions: Sales Order line gets its rate
  from ERPNext's own item events); per-user column settings in Desk's GridView format; a ⋯ row menu.
- Fixes found on the way: ⌘S while still in a grid cell lost that edit (now blurred and committed first); a cell
  wrote its old value back on blur when a paste / script changed it meanwhile; the shared Dialog re-ran its focus
  effect on every render when given an inline onOpenChange — focus jumped on each keystroke and an input with onBlur
  state looped ("Maximum update depth exceeded"); dropdown triggers now expose aria-expanded.
- e2e: gridkeys, gridmulti, gridcols (new, key-by-key typing in dialogs); grid, gridrows, gridmove, formsave, mobile,
  formnav green. On this bench formmenu, sidebar, timeline fail the same way on `main` (bench data / no email
  account): follow-up, like form.salesorder's hard-coded customer.

Next: M4 controls (Text Editor first, then Link extras), then M5.

## 2026-11-18 — M2: workflow you can follow; CI; repo protection
- Workflow bar under the form title (`components/form/WorkflowBar.tsx`, `lib/form/workflow.ts`): stepper from
  `workflow_logs` (who, when), "Waiting on you" with the actions as buttons, "Waiting on <roles>", self-approval and
  `condition` explanations, "Workflow State not set" fix, Desk's Help dialog (Actions → Help).
- Lists honour `listview_settings.get_form_link` (Workflow Action rows open the waiting document); `frappe.router.slug` shim.
- Fix: `ErrorDetailsHost` (mounted app-wide) loaded the desk context on /login → a 401 on every visit; now /desk only.
- e2e: workflow extended (second user without every role); bulk and listsettings no longer depend on bench data
  (a second "Administrator"-named user; a site with no ToDo). `PW_CHANNEL=chrome` runs suites on the installed Chrome.
  Verified green: workflow, bulk, listsettings, formnav, mobile. bulk/listsettings failed the same way on `main`
  before the fix (test data, not the app).
- CI (`.github/workflows/ci.yml`, PR #13): npm ci, tsc, lint, build, `node --check` e2e — required on `main` by the
  "Protect main" ruleset (no force-push / deletion, PR required, admin bypass; fork PRs need approval to run Actions).
  Pushing workflow files needs the `workflow` token scope: push over SSH (`git@github.com:…`) or `gh auth refresh -s workflow`.
- Bench: the old stack is gone; suites now run against another local v16 + ERPNext bench (see CLAUDE.local.md).
  `npm ci` on a slow link can silently skip `@next/swc-darwin-arm64` (optional dep) → install it explicitly.

Next: M3 grid (keyboard navigation, paste from a spreadsheet, Add Multiple, column settings, row menu).

## 2026-10-28 — Print Format Builder, step B2
- Table blocks: pick, order and size their columns. Duplicate a field (⌘D). Preview bar: sample record, letter head,
  paper (A4 / A5 / Letter / Legal / 80 mm receipt; the edit sheet follows), Download PDF of the unsaved draft.
- Bench note: the vendor container lacks `libnss3`, so Frappe's Chromium PDF renderer can't start ("Chromium took
  too long to start", Desk too); wkhtmltopdf works. The builder's error now suggests switching renderer.
- e2e/pfnative extended to 35 checks (duplicate, table columns, paper, letter head; the PDF download runs with `PDF=1`
  on a bench whose Chromium works — here the request holds a worker for minutes).

## 2026-10-28 — Print Format Builder, step B1 (Crema's own builder)
- "Edit Format" now opens Crema's builder (`components/print-builder/`, `lib/print-builder/`) on Desk's layout JSON
  and server draft: Fields / Blocks panel, canvas with sample values, inspector, Delete removes a block and its
  emptied section (Undo in the toast), ⌘Z / ⇧⌘Z, autosave → draft, Save & Apply, server-rendered preview of the draft,
  white sheet in dark mode. Desk's builder stays at `?ui=desk`.
- e2e/pfnative (new, 25 checks); pfbuilder now opens `?ui=desk`; print, printformat, formats green.
- Gotcha: the preview iframe needs `sandbox="allow-scripts"` (opaque origin) — the print HTML runs its barcode script.

Next: B2 / C items in GAPS § 2.19, then M2 workflow.

## 2026-10-28 — Print Format Builder, step A (framed, usable)
- "Edit Format" → `/desk/print-format-builder/<name>`: Desk's v16 builder full screen (no breadcrumb row, no width
  cap, sidebar folded), one header with Back and Open in Desk; framed Desk pages follow Crema's light / dark theme.
- Why blocks "couldn't be removed": deleting a field leaves its section, and in preview mode Desk hides every section
  toolbar (`.section--preview .section-toolbar`), so the section's × is gone; the letter head zone is not deletable
  at all (Letter head → None). Injected CSS keeps the toolbar on the selected section and explains the letter head.
- e2e/pfbuilder (new): edit format, theme, delete block + section, letter head hint, Save & Apply → format_data.
- Plan for the native builder (B) and beyond Desk (C): GAPS § 2.19.

## 2026-10-28 — M6: works on a phone
- Below 640px: list as cards (+ select all, count), filters folded behind "More filters", child tables as row cards
  opening the row form (Add row opens it too), form actions in a bottom bar, toasts above it.
- List Date filter and Date Range field use DatePicker: no native date / time inputs remain.
- e2e/mobile (new); list.salesorder no longer depends on the saved sort. 17/17 related suites.
- Gotcha: a `fixed` child of a `space-y-*` parent gets its margin (Tailwind 4 `:where()`), so the bar needs `mb-0`.

Next: Print Format Builder (user request), then M2 workflow.

## 2026-10-28 — M1: form toolbar like Desk
- Previous / next document buttons + Shift+Ctrl+< / > (`get_next` with the list's saved filters and sort,
  "No further records"); "Not permitted" / "Not found" pages for doc and DocType errors; empty read-only fields follow
  System Settings `hide_empty_read_only_fields`; a renamable title no longer cuts to "Mid…" (negative margin).
- e2e/formnav (new). Form suites 9/9.
- Dev server note: after switching branches, Turbopack can serve a stale globals.css (gutter tokens missing);
  restart `next dev` if spacing looks wrong.

Next: M6 (phone: grid / list as cards, bottom action bar), then M2 workflow.

## 2026-10-28 — save like Desk, responsive layout, print formats, plans
- Save: an unchanged Save sends no request ("No changes in document"); a real save refreshes in place from the
  savedocs response (docinfo included), no second getdoc. Timeline versions read like Desk
  (version_timeline_content_builder.js): "submitted this document", HTML as text, hidden fields left out. e2e/formsave.
- Responsive: fluid `--space-*` tokens with clamp() (Tailwind `p-gutter`, `gap-field`, …), form columns by container
  width, sidebar closed on phones, compact header; no horizontal scroll at 390/768/1280. Pointer cursor on clickables.
- Print formats from Crema: new-form Name field for prompt-named DocTypes (`lib/form/newName.ts`), depends_on/eval with
  a trailing `;` (Desk's `let out = …; return out`), Text Editor rendered as rich text. e2e/printformat.
- Test hygiene: attach uses a unique image (Frappe dedupes uploads by content), reportsave writes under OUT,
  run-all skips readme-shots. Full run 49/52 before those fixes; the three pass after.
- Docs: GAPS.md phase-1 finish plan (M1–M7), visibility rules, workflow plan, data path, phase 2 UI/UX plan;
  PLAN.md (multi-site, AI, SDK, what we want from Frappe); MARKETING.md (forum research, positioning, launch).
- PRs #3 (responsive), #4 (save + timeline), #5 (print formats) merged.

Next: GAPS M1 (forms like Desk: prev/next, title editing, "Not permitted") and M6 (phone: grid/list as cards), then the
demo site (MARKETING § 2).

## 2026-10-28 — Crema, public
- Renamed Trevo → Crema: `crema-frontend/`, `lib/crema-form`, `CremaShell`, `CREMA_*` env vars, storage keys.
- Field permlevels (`lib/form/perm.ts`), site banners + impersonation, server traceback behind a toast's Details action,
  dialog width from DialogContent's `max-w-*`. e2e: permlevel, impersonation, errordetails.
- Login survives slow hydration (uncontrolled inputs, Sign in disabled until hydrated); Log out goes to /login.
- Test fixes found on the way: Server Script uses `disabled` (no `enabled`), DocPerm.write defaults to 1,
  `waitForFunction` with an async predicate returns at once, `get_value` answers `{}` for a missing record.
- ERPNext suites read the site's default company (`defaultCompany` in e2e/lib.mjs, or `CREMA_COMPANY`).
- README (what works / next / why), LICENSE (MIT) and THIRD_PARTY_NOTICES (Frappe MIT, ERPNext-derived files GPL-3.0),
  screenshots via `e2e/readme-shots.mjs`.
- Published as github.com/Ashutosh-Neupane/crema-desk with the history scrubbed of client names; the old private repo
  is kept as a fetch-only `trevo-archive` remote.

Next: Tier 1 form gaps in docs/GAPS.md (undo/redo, prev/next document, "Not permitted" banners), then the grid extras.

## 2026-10-17 — session 2 (cont.): gap audit, Tier 1
- `docs/GAPS.md`: audit of what's left for 1:1 Desk parity (Tier 1 everyday gaps, Tier 2 views/pages, Tier 3
  polish), then phase 2 UI/UX. Work through it top-down.
- Tier 1 #1 done: Attach / Attach Image save their value (upload_file attached to the doc; loose upload on new
  docs, Frappe attaches on save), image preview, link mode, clear. `/files/*` and `/private/files/*` are served
  from Crema's origin (`lib/frappe/fileProxy.ts`; public files need Host = site). Verified by `e2e/attach.mjs`.
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
  Bench: vendor needs `GUNICORN_CMD_ARGS="--workers 3 --timeout 120"` (in the bench's docker-compose) —
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
- Tier 1 #9 done: grid drag-to-reorder (dnd-kit handle on the No. column, `ctl.reorder_row`), 50-row pagination,
  CSV Download/Upload when the Table field has allow_bulk_edit (like Desk). Layout parser now keeps every raw docfield
  property (it dropped allow_bulk_edit, cannot_add_rows, …). Verified by `e2e/grid.mjs`.
- Tier 2 #10 done: Calendar view `/desk/doctype/X/view/calendar` (`components/views/CalendarView.tsx`) from the DocType's
  calendar JS (field_map, get_events_method, style_map; fallback first Date field): month/week, drag to reschedule
  (update_event, duration kept), + on a day creates a prefilled doc, filters. Offered in the list view switcher when
  `__calendar_js` exists; `/desk/calendar` redirects to the Event calendar. Verified by `e2e/calendar.mjs`.
- Tier 2 #11 done: Gantt `/desk/doctype/X/view/gantt` (`components/views/GanttView.tsx`) for DocTypes whose calendar JS
  enables gantt (Task, ToDo, Work Order, …): Day/Week/Month scales, progress, today line, drag to move / edge to
  extend → frappe.desk.gantt.update_task. Calendar settings loader shared (`lib/views/calendarSettings.ts`).
  Verified by `e2e/gantt.mjs`.
- Tier 2 #12 (part): Image view `/desk/doctype/X/view/image` (`components/views/ImageView.tsx`) — the list already linked
  there; cards via reportview + /files proxy, search, filters, load more. Verified by `e2e/image.mjs`.
- Tier 2 #12 (part): File manager `/desk/files` rebuilt on frappe.core.api.file (folders, breadcrumbs, new folder,
  upload into folder, search, move, delete); "Home" view on the File list. Verified by `e2e/files.mjs`.
- Tier 2 #12 (part): Inbox `/desk/inbox` rebuilt (`components/views/InboxView.tsx`): account folders (boot.email_accounts,
  else site accounts) + Sent/Spam/Trash with Desk's filters, unread bold, mark read/unread (email.inbox flag queue —
  Frappe only flags IMAP mail with a uid), trash, close, compose (EmailComposer without a doc). `e2e/inbox.mjs`.
- User & roles: native RoleEditor / ModuleEditor (`components/form/widgets`) for User.roles_html/modules_html,
  Role Profile, Module Profile — writes Has Role / Block Module rows like Desk. `e2e/users.mjs`.
- `docs/GAPS.md` rewritten: compatibility architecture for Frappe JS (L1 metadata UI, L2 real jQuery + DOM
  containers, L3 native widgets, L4 legacy page host for POS/Vue/jQuery pages), full remaining checklist, phase 3
  (Crema as a Frappe custom app) plan. `e2e/run-all.mjs` runs every suite (26/26 passing).
- Breadcrumbs show DocType/document names verbatim; form.salesorder deletes its cancelled order.
- L4 legacy page host done: `/desk/page/<name>` frames Frappe's own Desk page served at Crema's `/app/<path>`
  (`app/app/[[...path]]/route.ts`: fetches bench `/desk/<path>` HTML, rewrites the frame URL to /desk before the
  router runs, hides navbar/sidebar/dock, points socket.io at the published port, bridges title + Form/List/Report
  navigation back to Crema). `/api/method/*` and `/api/resource/*` proxied on Crema's origin
  (`lib/frappe/proxy.ts`, shared with /api/frappe — now forwards the caller's CSRF token and original content
  type). ERPNext POS runs unmodified. Sidebar/workspace Page links go there. Verified by `e2e/legacy.mjs`.
- Dev machine: `.next` had grown to 19 GB and Turbopack's cache flush stalled everything (15 GB swap) →
  `experimental.turbopackFileSystemCacheForDev: false`. Smoke script survives redirecting routes.
- L2 script DOM done: the runtime's `$` is real jQuery 3.7.1 (`lib/desk-runtime/jquery.ts`), wrapped so missing
  plugins (`.select2()`, `.datepicker()`…) are chainable no-ops; server render keeps the stub. HTML fields render
  `HtmlHost`, which mounts the controller's own node — `frm.fields_dict.x.wrapper` / `$wrapper` are that node, so
  `$wrapper.html()`, `.find().on("click")`, `.css()` work; `set_df_property(f, "options", html)` refills it.
  Verified by `e2e/scriptdom.mjs`; full suite (28) green with real jQuery. users.mjs uses a unique Role Profile
  name (a queued Role Profile job locks the doc between runs).
- Role Permissions Manager rebuilt natively (`components/views/PermissionManager.tsx`, route
  `/desk/page/permission-manager/[[...doctype]]`, ahead of the legacy host's catch-all): doctype/role pickers, rule
  table with Desk's right filtering (submit/cancel/amend only when submittable, levels > 0 read/write/mask, Report
  hidden with Only if Creator), optimistic toggles, add rule, users of a role, remove, Restore Original Permissions.
  `/desk/permissions` and the nav link point there. `frappe.set_route` now maps any Desk route (pages too) and turns
  `frappe.route_options` into `?field=value` (`lib/navigation/deskRoute.ts`, shared with the legacy host).
  Verified by `e2e/permissions.mjs` (custom DocType; Custom DocPerm rows outlive a deleted DocType → cleanup).
- `docs/GAPS.md` section 2 rewritten as a full inventory of Frappe v16's desk frontend + ERPNext scripted UIs
  (2.1–2.14, with source paths and an order of work).
- User form actions: Frappe's user.js aborted at `has_common` (undefined global) so only Impersonate showed. Fixed
  generally — Desk namespaces and field objects are lenient, unknown constructors return no-op objects — plus real
  shims (change-password dialog, get_single_value, defaults.is_enabled, downloadify, copy_to_clipboard,
  dialog.show_message, set_data). Button fields now trigger their form event (Generate Keys); Escape closes script
  dialogs; descriptions render HTML. `e2e/useractions.mjs`; full suite 30/30.

## 2026-10-21 — session 3: user menu, Desk URLs (audit of uncommitted work + completion)
- Picked up uncommitted user-menu work (Session Defaults + About dialogs, /api/desk/shell, boot cache clear) and
  finished it: menu moved to `components/desk/UserMenu.tsx`; Navbar Settings conditions/actions now run in the desk
  runtime (new `runtime.evalExpr` = `frappe.utils.eval`; `frappe.ui.toolbar.show_about/setup_session_defaults/
  clear_cache/show_shortcuts` wired); duplicate About removed; internal routes use the router; View Website goes
  to the bench; dialogs load through react-query (lint); theme saved to `User.desk_theme`.
- Desk URL resolver: `resolveDeskPath` + `app/(desk)/desk/[slug]/[[...rest]]` (shell → workspace → DocType slug
  → standard route → Desk Page, from boot can_read / workspaces / module_sidebars). `frappe.set_route` sends unknown
  routes there.
- Singles redirect from list to form; the shared Dialog is named by its title (aria-labelledby/-describedby) —
  bulk.mjs locator scoped accordingly.
- `e2e/usermenu.mjs`; full suite 31/31.
- Formatting from the site's settings: `lib/frappe/format.ts` (number formats incl. `#,##,###.##`, rounding
  methods, currency symbol / per-currency format / field currency, precision, date & time formats, system ↔ user
  time zone without moment). Fed from the desk context (`docs` = boot `:Currency` / `:Company`, `time_zone`) via
  `setFormatSettings` in useDeskContext. `formatCell` (lists, reports, grid, kanban, number inputs) and the
  runtime (`flt`, `format_currency`, `format_number`, `frappe.format`, `precision`, `frappe.datetime.*`,
  `frappe.meta.get_field_precision/currency`) use it; Datetime control converts zones; NumberField parses with
  the site's format. Found + fixed: `/api/desk/context` and `/api/desk/shell` were browser-cached 30–60 s, so a
  settings change (or Reload) showed stale formats → `no-store`. System Settings can't be saved with an empty
  language (test sets "en"). `e2e/formats.mjs`; full suite 32/32.
- Form dashboard: `lib/form/dashboard.ts` models Desk's dashboard.js + layout.show_message (headlines with colour /
  permanent / dismiss, add_comment 10 s expiry, set_intro replacing its own, indicators, progress, add_section with
  a real DOM node), reset + headlines cleared at the start of every refresh (FormController.runLoadEvents).
  `components/form/FormDashboard.tsx` renders it (headline HTML sanitized); DocForm adds Desk's submit message.
  `e2e/dashboard.mjs`; usermenu's menu-open helper retries once (hydration timing late in a full run); 33 suites.

## 2026-10-21 — multi-agent round 1 (Opus judge; Sonnet ×3, Haiku ×1)
Agents shared the one dev server and worked on disjoint files without committing; the judge reviewed each diff
against Desk's source, re-ran its test, fixed problems, and committed separately.
- Haiku — Data options validation (`validators.ts`): accepted as-is.
- Sonnet — Grid Insert Above/Below/Duplicate + per-row `_remove`: judge removed an extra parent-level trigger Desk
  doesn't fire (cscript ran N+1 times). Child-doctype `_remove` handlers (ERPNext) now run.
- Sonnet — List sidebar counts: accepted (dropdowns in the filter row).
- Sonnet — Address & Contact cards: judge replaced a `Storage.prototype.getItem` monkey-patch with
  `takePrefill()` (lib/form/prefill.ts) — the new-form prefill was consumed by StrictMode's first initializer run,
  which also made Duplicate / Quick Entry → full form / mapped docs flaky.
- Full suite 35/37; the 2 failures (calendar setup insert under load, useractions compile timeout) pass alone.

## 2026-10-21 — multi-agent round 2 + runtime fixes from agent findings
- Sonnet — query report Save As + PDF (accepted). Haiku — Toggle Full Width + desk_theme seeding (accepted); judge
  fixed hydration mismatches (theme icon, report Save As button, home greeting) — none left on home/forms/reports.
- Sonnet — ledger preview (accepted). Sonnet — Item stock levels (accepted; its frappe.require override removed in
  favour of the runtime fix).
- Agents' reports exposed runtime gaps that broke whole ERPNext forms; fixed by the judge in the runtime:
  frm.events, lenient Controller base, script_manager.make, grid.set_column_disp + lenient grid, Desk frm.call,
  locals (kept + boot docs), section wrapper as jQuery, frappe.require callback, deep-lenient only for plain objects.
  Probe of 13 ERPNext forms: no script errors. Dev server was OOM-killed once mid-round (restarted); a run while the
  Mac slept timed out and passed on re-run. Full suite 41/41.

## 2026-10-21 — multi-agent round 3
- Haiku — grid Move To + Delete all N rows: agent corrected the brief (Desk's grid Duplicate keeps no_copy fields);
  judge replaced window.confirm with Desk's in-app confirm and fired `<table>_delete` once like Desk.
- Sonnet — List Settings dialog + per-user list state: accepted; judge made fetchRows honour disable_comment_count.
  Note: saved list filters persist across visits (Desk behaviour), so tests that open bare lists reset `List` first.
- Sonnet — Serial & Batch selector: standalone dialog (DeskDialog can't host Table fields yet); judge wired row-form
  Button fields → child events, so ERPNext's own "Add Serial / Batch No" button opens it.
- Full suite 43/44 → listsettings fixed (polluted ToDo list state from bulk) → 45 suites.

## 2026-10-21 — multi-agent round 4
- Sonnet — frappe.ui.Dialog parity (Table fields, depends_on, $wrapper, set_indicator, primary disable, custom
  actions): accepted. Sonnet — workspace onboarding + Custom HTML Block: accepted; judge made its test wait for the
  block's separate load. Haiku — awesomebar "new X", calculator (no eval), "<text> in <DocType>": accepted; judge
  fixed ListView ignoring `?q=` changes while mounted.
- Three agents testing on one dev server made /desk compile for ~20 min; idle server answers in ~3 s. Full suite
  46/47 (awesomebar compile timing, passes twice alone) → 48 suites.

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

- Second-site run (Frappe + a custom app, no ERPNext): crud.todo, workflow, kanban, bulk, doctype.create
  (`CREMA_MODULE=<app module>`) all pass; smoke of /desk, the app's workspace and its list/form views, report
  view, Script Reports, data-import → 0 errors. Run it with env overrides (no .env edit):
  `docker start sm-hub` then `FRAPPE_BACKEND_URL=http://localhost:8000 NEXT_PUBLIC_FRAPPE_BASE_URL=http://localhost:8000
  FRAPPE_SITE_NAME=<site> NEXT_PUBLIC_FRAPPE_SITE_NAME=<site> PORT=3001 npm run dev`

Next (see docs/GAPS.md)
1. ERPNext form widgets: Address & Contact cards, Item stock levels, serial/batch selector, ledger preview
2. User Permissions UX, impersonation banner
2. `frm.dashboard` / `frm.page.body` containers (indicators, progress, heatmap), Map view, list sidebar + saved filters

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
Bench config: developer_mode, server_script_enabled, socketio (:9001), set by the bench's init script.

Next
1. Tree view route (/desk/doctype/X/view/tree) — list already offers it for tree DocTypes
2. /desk/query-report/<name> (Script/Query reports with filters + chart) — sidebar/⌘K link there
3. Report view (editable grid of a DocType) and saved list settings
4. Rebuild removed prototypes properly when needed: Kanban, Gantt, workflow actions on forms, bulk edit,
   data import/export, Inbox compose (currently not wired)
5. Remaining React Doctor warnings (112): component complexity, positional keys
6. Repeat the suites against the second site (no ERPNext)

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
8. Point Crema at the hub (localhost:8000) and repeat checks

## 2026-10-16 — session 1: setup
Done
- Cloned github.com/Ashutosh-Neupane/crema-desk
- Fixed root `.gitignore` (`frappe/` → `/frappe/`); restored `lib/frappe/*` (19 files),
  `app/api/frappe/[...path]` BFF proxy, `MultiselectField` from the local copy at `~/Desktop/crema`
  (they were never pushed). `tsc --noEmit`: 225 errors → 0. **Not yet committed/pushed.**
- `npm run build` passes; lint 28 errors → 0 (5 hook-deps warnings left). Real bug fixed:
  `DateRangeField` ignored its saved value (always rendered empty on reopen)
- graphify installed (`uv tool install graphifyy`), graph at `crema-frontend/graphify-out/`, git hooks installed
- Vendor backend stack started (see CLAUDE.md → Backend)

Next (parity test loop)
1. Login + boot + sidebar/workspaces against vendor1.localhost
2. DocType list/form/new/edit for ERPNext + custom-app doctypes (a single, transactions, mappings)
3. Custom DocType created in Desk → shows in Crema; DocType created in Crema builder → works in Desk
4. Reports: Report Builder, Query Report, Script Report
5. Workflow: create in Desk → states/actions on Crema form; Vendor Order whitelisted methods as buttons
6. New page(s) as needed
