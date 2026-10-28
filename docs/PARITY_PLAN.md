# Crema ↔ Frappe Desk parity plan

Target: Frappe **v16** Desk behaviour, verified against a live bench (vendor1.localhost:
Frappe + ERPNext + a custom app). Every item is tested by doing the same thing in
Desk (`vendor1.localhost:8001/app`) and in Crema (`localhost:3001/desk`).

Status legend: ✅ works · 🟡 partial · ❌ missing

---

## 1. Field types (all 44 v16 fieldtypes, from `docfield.json`)

### 1a. Data-entry fields
| Fieldtype | Desk behaviour to match | Crema today | Work |
|---|---|---|---|
| Data | `options` = Email / Name / Phone / URL / Barcode / IBAN → validation + mailto/tel/link affordance; `length` (default 140) | 🟡 plain text input, options ignored | Per-option validation + input type; length default 140 |
| Small Text / Text / Long Text | textarea, Long Text no length cap | 🟡 textarea via fallback | Auto-grow; Desk row heights |
| Text Editor | Quill rich text, stored as HTML | 🟡 | Check toolbar, images, `<p>` wrapping |
| Markdown Editor / HTML Editor / Code | Ace editor; Code `options` = language | 🟡 | Language from options; read-only render |
| Int / Float / Currency / Percent | Locale number format, `precision`, `non_negative`; Currency `options` = currency field or `currency` | 🟡 Currency hard-coded USD in formatter | Use System Settings number_format/currency; options → linked currency field; precision |
| Check | 0/1 | ✅ | — |
| Select | `options` newline list, first may be blank | ✅ | Verify blank first option |
| Autocomplete | options list or whitelisted method | 🟡 | Method-backed options |
| Link | search via `frappe.desk.search.search_link`, `set_query` filters, "Create a new X" quick entry, `fetch_from` on change, title field display (`show_title_field_in_link`) | 🟡 | set_query wiring, fetch_from, quick-entry create, title display |
| Dynamic Link | `options` = fieldname holding the target DocType | ❌ routed to LinkField (DynamicLinkField exists but unused) | Route to DynamicLinkField |
| Table | child grid: add/remove/move rows, inline edit for `in_list_view` columns, row form dialog, `columns` widths, `cannot_add_rows`, `cannot_delete_rows` | 🟡 | Row-form editor, child meta from getdoctype, child events |
| Table MultiSelect | child table with one Link column rendered as pills | 🟡 | Verify save shape (list of child rows) |
| Date / Datetime / Time / Duration | System date format, timezone, `now` default | 🟡 | System Settings date_format; Duration `hide_days/hide_seconds` |
| Attach / Attach Image | upload via `upload_file`, private/public, Attach Image drives `image_field` | 🟡 | Private flag, preview |
| Attachment Gallery | v16: multiple attachments | ❌ | New control |
| Password | masked; stored as `*****` on read | 🟡 | Don't resend `*****` |
| Read Only | display only, often with `fetch_from` | 🟡 | — |
| Rating | stars, value 0–1 in v14+ | 🟡 | Verify 0–1 scaling |
| Color / Icon / Signature / Barcode / Geolocation / JSON / Phone | special widgets | 🟡 | Smoke-test each |

### 1b. Layout / display fields
| Fieldtype | Desk behaviour | Crema today | Work |
|---|---|---|---|
| Tab Break | top tab bar, first tab default "Details" | ❌ flattened into stacked sections | Real tabs |
| Section Break | titled, `collapsible`, `collapsible_depends_on` | 🟡 every section collapsible, no depends_on | Respect collapsible flag + depends_on |
| Column Break | splits a section into true columns (fields flow top→bottom per column) | ❌ treated as N-column grid (fields interleave) | Build column arrays |
| Fold | everything after is hidden behind "Show more" | 🟡 | — |
| Heading | in-form heading | 🟡 dropped by parser | Render |
| HTML | static `options` HTML, or set via script | 🟡 | `frm.set_df_property(f,'options',html)` |
| Button | triggers `frappe.ui.form.on(dt, {<fieldname>(frm){}})` | 🟡 | Wire click → change event |

### 1c. Field-level properties to honour everywhere
`reqd`, `read_only`, `hidden`, `depends_on`, `mandatory_depends_on`, `read_only_depends_on`,
`collapsible_depends_on`, `default` (incl. `Today`, `now`, `__user`), `fetch_from`,
`fetch_if_empty`, `allow_on_submit`, `set_only_once`, `in_list_view`, `bold`,
`translatable`, `ignore_user_permissions`, `permlevel` (hide/readonly by user perms),
`description`, `placeholder`, `non_negative`, `precision`, `length`, `unique`.
`depends_on` expressions must get `doc` (with `name`, `docstatus`, `__islocal`),
`parent` (child rows) and a `frappe` subset (`frappe.user`, `frappe.session`,
`frappe.datetime`, `in_list`, `cint`, `flt`).

---

## 2. DocType as a whole

### 2a. Loading
- ❌ **Meta**: use `frappe.desk.form.load.getdoctype` (not `api/resource/DocType`). It returns
  the merged meta (Custom Fields + Property Setters), all child DocType metas,
  `__js`, `__custom_js`, `__list_js`, `__workflow_docs`, `__dashboard`, `__print_formats`,
  and works for non-admin users.
- ❌ **Document**: use `frappe.desk.form.load.getdoc` (returns doc + `docinfo`:
  comments, attachments, assignments, versions, shared, `__onload`, permissions).
- New doc: apply defaults (`frappe.model.get_new_doc` rules: field default, user
  defaults, `Today`, link filters), `__islocal=1`, name `new-<slug>-<n>`.

### 2b. Saving and lifecycle (server hooks)
Server controller hooks (`before_insert`, `before_validate`, `validate`, `before_save`,
`on_update`, `before_submit`, `on_submit`, `before_cancel`, `on_cancel`, `on_trash`,
`after_insert`, …) plus **Server Scripts** (DocType Event) run *inside Frappe* when we call
the same endpoints Desk calls. Crema's responsibilities:
| Action | Endpoint | Status |
|---|---|---|
| Save / Submit / Update after submit | `frappe.desk.form.save.savedocs` `action=Save/Submit/Update` | ✅ endpoint, 🟡 handling |
| Cancel | `frappe.desk.form.save.cancel` | ❌ |
| Amend | new doc with `amended_from` | ❌ |
| Delete | `frappe.client.delete` | 🟡 |
| `frm.call('method')` | `run_doc_method` (sends doc, returns updated doc) | ❌ |
- Send the *whole* doc incl. child rows, `name`, `modified` (timestamp check), `__islocal`.
- After save: replace local state with the **returned doc** (server hooks change values).
- Show `_server_messages` (msgprint from `validate`), and `exc`/`exception` text for
  `ValidationError`, `MandatoryError`, `TimestampMismatchError`, `LinkValidationError`.
- docstatus UI: Draft / Submitted / Cancelled indicator, read-only after submit except
  `allow_on_submit` fields, Submit/Cancel/Amend buttons by permission.

### 2c. Client scripts (the `frm` runtime)
Sources, loaded in Desk order: app DocType JS (`__js`) → Client Scripts (`__custom_js`).
Events to support (Desk order):
`setup` → `onload` → `refresh` → `onload_post_render`; field `<fieldname>` change;
`validate` → `before_save` → (server) → `after_save`; `before_submit` → `on_submit`;
`before_cancel` → `after_cancel`; `timeline_refresh`; child table:
`<fieldname>(frm, cdt, cdn)` on child DocType, `<table>_add`, `<table>_remove`,
`<table>_move`, `form_render`.
Semantics: handlers may return Promises (await them, Desk does); `frappe.throw` or
`frappe.validated = false` inside `validate`/`before_save` **aborts** the save.
Today: 🟡 only parent events, sync only, `frappe.throw` is swallowed (save continues),
`add_custom_button` is a no-op, `frappe.session.user` hard-coded "Administrator".

API surface (priority order):
1. `frm.doc`, `frm.set_value` (Promise), `frm.refresh_field(s)`, `frm.is_new()`,
   `frm.is_dirty()`, `frm.save()`, `frm.savesubmit()`, `frm.set_df_property`,
   `frm.toggle_display/reqd/enable`, `frm.set_query` (parent + child `fieldname, table`),
   `frm.add_custom_button(label, fn, group)`, `frm.remove_custom_button`,
   `frm.clear_custom_buttons`, `frm.set_intro`, `frm.add_child`, `frm.fields_dict`,
   `frm.call`, `frm.reload_doc`, `frm.disable_save`, `frm.page.set_primary_action`
2. `frappe.call` (Promise + callback, `freeze`), `frappe.xcall`, `frappe.db.get_value/
   get_list/get_doc/exists/count`, `frappe.model.set_value(cdt, cdn, f, v)`,
   `frappe.model.get_value`, `frappe.model.with_doc`, `locals[cdt][cdn]`,
   `frappe.msgprint`, `frappe.throw`, `frappe.show_alert`, `frappe.confirm`,
   `frappe.prompt`, `frappe.ui.Dialog` (fields rendered with Crema controls),
   `frappe.set_route`, `frappe.new_doc`, `frappe.session.user`, `frappe.user.has_role`,
   `frappe.datetime.*`, `frappe.format`, `__()`, `flt`, `cint`, `cstr`, `in_list`.
3. Desk-internal class APIs used by ERPNext's own form JS (`frappe.ui.form.Controller`,
   `extend_cscript`, `erpnext.TransactionController`, jQuery `$`). Running ERPNext's
   transaction JS 1:1 needs a large part of Desk's JS runtime; plan is a compat layer
   evaluated per DocType, with **server-side logic still authoritative** (totals, taxes
   and pricing are recomputed by ERPNext's `validate` on save, so data stays correct
   even before the JS layer is complete).

### 2d. Workflow
`__workflow_docs` from getdoctype → state field indicator, read-only per state
(`doc_status`, `allow_edit` role), action buttons from
`frappe.model.workflow.get_transitions`, apply via `frappe.model.workflow.apply_workflow`,
optional comment. Workflow Builder writes `Workflow` doc.

### 2e. Other form chrome
Timeline (docinfo comments/versions/communications), assign, share, attachments, tags,
follow, like, print (`/printview`), email, links/dashboard (`__dashboard` →
`frappe.desk.notifications.get_open_count`), "Connections" tab, prev/next, duplicate,
copy-to-clipboard, rename (`frappe.model.rename_doc.update_document_title`),
keyboard shortcuts (Ctrl+S, Ctrl+B new).

---

## 3. List / report / views
List settings from meta (`in_list_view`, `title_field`, `image_field`, `__list_js`
indicators `get_indicator`, `list_view_settings`), filters + saved filters
(`List Filter`), sidebar group-by counts (`frappe.desk.listview.get_group_by_count`),
Report view (`frappe.desk.reportview.get`), Query/Script reports
(`frappe.desk.query_report.run` + filters from report JS), Kanban, Calendar, Gantt,
Tree (`get_children` from tree JS), Dashboard view, Map, Image.

## 4. Routing (Desk → Crema)
| Desk | Crema |
|---|---|
| `/app` | `/desk` |
| `/app/<workspace-slug>` | `/desk/workspace/<name>` |
| `/app/<doctype-slug>` | `/desk/doctype/<DocType>` |
| `/app/<doctype-slug>/new` | `/desk/doctype/<DocType>/new` |
| `/app/<doctype-slug>/<name>` | `/desk/doctype/<DocType>/<name>` |
| `/app/<doctype-slug>/view/<report\|kanban\|calendar\|…>` | `/desk/doctype/<DocType>/view/<view>` |
| `/app/query-report/<name>` | `/desk/reports/…` |
| `/app/print/<dt>/<name>` | print route |
Add an `/app/[...slug]` catch-all that resolves slugs → DocType/workspace and redirects, so
links generated by Frappe (`frappe.utils.get_url_to_form`, emails, notifications) work.

---

## 5. Execution order (each step: implement → test vs Desk → commit → push)
1. **Meta & doc loading** via getdoctype/getdoc (unblocks custom fields, child metas, scripts, workflow)
2. **Save pipeline**: returned-doc refresh, server message/exception display, Cancel/Amend
3. **Layout**: tabs, true columns, collapsible rules, headings
4. **Field controls**: Dynamic Link, Data options, number/currency/date formats, Attachment Gallery, Table row editor
5. **Client-script runtime**: async events, abort semantics, child events, custom buttons, Dialog, full API tier 1–2
6. **Workflow** actions/states
7. **Routing** `/app/*` compatibility + workspace slugs
8. **List/report views** parity
9. **ERPNext form JS** compat layer (tier 3) — Sales Order / Sales Invoice / Item as targets
10. Second site (no ERPNext) pass with the same checklist
