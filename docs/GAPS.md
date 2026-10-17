# What's left for 1:1 Frappe Desk parity (audit 2026-10-17)

Method: Frappe v16 Desk source (`frappe/public/js/frappe/{views,form,list,ui}`, `desk/page`, `core/page`)
compared module by module with Trevo, plus a smoke run of every `/desk/*` route against vendor1.localhost.
Order = impact on daily use. Phase 2 (UI/UX redesign) starts after phase 1 is green.

Done and covered by e2e: DocType CRUD + two-step New DocType + form builder, Desk form engine (client/server
scripts, ERPNext transaction logic, grid, quick entry, shortcuts), list (filters, group-by, sort, bulk actions),
report view, query/script reports, tree, kanban, workflow, data import/export, workspaces, dashboards.

## Phase 1 — transcription

### Tier 1: broken or missing in everyday flows
1. ✅ **Attach / Attach Image fields don't save** — `AttachmentField` uploads but never calls `onChange`.
   Image preview, private/public, `image_field` header avatar.
2. ✅ **Form sidebar is read-only** — Desk lets you add/remove assignments (assign_to.add/remove), attach files,
   add/remove tags, share (docshare), follow, like. Trevo only lists them.
3. ✅ **Timeline / activity** — comment edit/delete and @mentions, version diffs ("changed X from A to B"),
   communications (emails), assignment/attachment/like/share events, "New Email" composer
   (`frappe.core.doctype.communication.email.make`).
4. 🟡 **Print** (view/PDF ✅, Print Format Builder ❌) — print view with format selection, letterhead, PDF download (`frappe.utils.print_format.download_pdf`),
   "Print" in form menu; Print Format Builder.
5. ✅ **ERPNext "Get Items From"** — `frappe.ui.form.MultiSelectDialog` / `erpnext.utils.map_current_doc` (e.g. Sales
   Invoice ← Sales Order, Delivery Note ← Sales Order) and grid "Add Multiple" (link_selector) aren't available to scripts.
6. ✅ **Realtime** — list auto-refresh on `list_update`, form "This document has been modified" notice on `doc_update`,
   form viewers.
7. ✅ **Broken prototype routes** (smoke): /desk/notes, /desk/assignments, /desk/roles, /desk/users crash (functions passed
   to client components); /desk/permissions, /desk/web-forms, /desk/website-builder, /desk/server-scripts,
   /desk/notification-settings call `/api/resource/api/resource/...`; /desk/follow, /desk/backups, /desk/system-health,
   /desk/tags, /desk/map use removed or invented endpoints. Desk has no custom pages for most of these — they are
   DocType lists/forms. → Redirect to the generic list/form; rebuild only real Desk pages (below).
8. ✅ **Form menu** (undo/redo still ❌) — Rename (title/name, `frappe.model.rename_doc.update_document_title`), Links (linked_with),
   Customize, Copy to Clipboard, Remind Me, Undo/Redo, Email, "Set User Permissions".
9. ✅ **Grid** (multi-row edit ❌) — drag to reorder rows, pagination over 50 rows, download/upload rows as CSV, multi-row edit.

### Tier 2: Desk views and pages not yet rebuilt
10. ✅ Calendar view per DocType (`/view/calendar`, `__calendar_js` field map, drag to reschedule).
11. ✅ Gantt view (Task, Project, Production Plan).
12. Image view ✅, Map view (Geolocation), Inbox ✅, File manager ✅ (folders, upload, move).
13. List sidebar: "Assigned To / Created By / Tags" counts, saved filters (List Filter), "Assigned to me".
14. List settings: choose columns, count/likes/comments in list, per-user list settings.
15. Awesomebar extras: calculator, "New X", search in reports, help results.
16. Permission Manager page, Role Permissions for Page and Report, backups page (routes redirect for now).
16b. Virtual/single DocTypes (System Health Report) render read-only like Desk — no "Not Saved"/Save.
17. Workspace editing (blocks, shortcuts, cards, charts) and Dashboard editing.
18. User language / translations (`__` with lang_dict), user settings dialog, setup wizard on fresh sites.
19. Form tour, success action, form dashboard heatmap, reminders.

### Tier 3: polish and hardening
20. React Doctor warnings (112), complexity of DocForm/ListView.
21. Print/report/list virtualization for large data.
22. Run every suite on both benches in CI.

## Phase 2 — UI/UX improvements (after phase 1)
Space usage, navigation, dark/light consistency, density modes, inline editing everywhere, faster search.
