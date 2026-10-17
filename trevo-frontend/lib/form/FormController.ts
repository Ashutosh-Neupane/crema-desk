/**
 * FormController — Trevo's frappe.ui.form.Form: holds the live document
 * (children included) and runs everything that reacts to it, so the React
 * view is a pure render of `snapshot()`.
 *
 *  - set_value / child set_value → `fetch_from` (frappe.client.validate_link),
 *    client-script events (`fieldname`, child `fieldname(frm, cdt, cdn)`),
 *    registered field watchers (ERPNext transaction adapter, …)
 *  - add_child / remove → `<table>_add` / `<table>_remove`
 *  - trigger(event): awaits async handlers; frappe.throw or
 *    frappe.validated = false inside validate/before_save aborts the save
 *  - df overrides (set_df_property / toggle_*), set_query, custom buttons,
 *    intro, dashboard indicators — read by the view
 *  - mandatory validation incl. child rows ("Row #2: Item Code")
 *  - `frm` object handed to scripts (Desk's API surface)
 */
import { toast } from "sonner";
import { createRuntime, flt, type Runtime, type RuntimeContext, NOOP } from "@/lib/desk-runtime";
import { deskCall, isNewDoc, type Doc } from "@/lib/frappe/form";
import { getNewDoc } from "@/lib/trevo-form/newDoc";
import { evalDependsOn } from "@/lib/trevo-form/dependsOn";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { installFormCompat } from "./compat";

export type Row = Record<string, unknown> & { name: string; doctype: string; idx: number; parentfield?: string };
export interface CustomButton {
  label: string;
  group?: string;
  action: () => unknown;
  primary?: boolean;
}
export type QueryFn = (doc: Record<string, unknown>, cdt?: string, cdn?: string) => { filters?: unknown; query?: string; params?: Record<string, unknown> } | undefined;
export type Watcher = (ctx: { fieldname: string; value: unknown; cdt?: string; cdn?: string; table?: string }) => unknown;

export interface FormSnapshot {
  doc: Doc;
  dirty: boolean;
  overrides: Record<string, Record<string, unknown>>;
  buttons: CustomButton[];
  intro: { message: string; color: string } | null;
  errors: Record<string, string>;
  version: number;
}

const TABLE_TYPES = new Set(["Table", "Table MultiSelect"]);
const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Button", "Heading", "Image"]);
let rowSeq = 0;

/** Object whose missing members are no-op functions (Desk UI APIs we don't model) */
function lenientObject<T extends object>(o: T): T {
  return new Proxy(o, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol" || prop in target) return Reflect.get(target, prop, receiver);
      return () => undefined;
    },
  });
}

export class FormController {
  meta: DocTypeMeta;
  metas: Record<string, DocTypeMeta>;
  runtime: Runtime;
  private ctx: RuntimeContext;
  private doc: Doc;
  private dirty = false;
  private overrides: Record<string, Record<string, unknown>> = {};
  private buttons: CustomButton[] = [];
  private intro: FormSnapshot["intro"] = null;
  private errors: Record<string, string> = {};
  private version = 0;
  private listeners = new Set<() => void>();
  private snap: FormSnapshot | null = null;
  private queries: Record<string, QueryFn> = {};
  /** frm.add_fetch(link, source, target[, table]) mappings */
  private extraFetch: Array<{ link: string; source: string; target: string; table?: string }> = [];
  private watchers: Watcher[] = [];
  private depth = 0;
  frm: Record<string, unknown>;

  constructor(meta: DocTypeMeta, childMetas: DocTypeMeta[], doc: Doc, ctx: RuntimeContext) {
    this.meta = meta;
    this.metas = Object.fromEntries([meta, ...childMetas].map((m) => [m.name, m]));
    this.ctx = { ...ctx, metas: this.metas };
    this.doc = this.normalize(doc);
    this.runtime = createRuntime(this.ctx);
    // Desk create_mandatory_children: a new doc gets one empty row in each mandatory table
    if (isNewDoc(this.doc) && !this.meta.istable) {
      for (const t of this.tableFields()) {
        if (t.reqd && !((this.doc[t.fieldname] as Row[]) ?? []).length) {
          this.doc = { ...this.doc, [t.fieldname]: [{ ...this.makeRow(t.fieldname), idx: 1 }] };
        }
      }
    }
    this.frm = this.buildFrm();
    installFormCompat(this.runtime, { frm: this.frm, navigate: ctx.navigate });
    this.syncLocals();
  }

  // ── store ───────────────────────────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = (): FormSnapshot => {
    if (!this.snap) {
      this.snap = { doc: this.doc, dirty: this.dirty, overrides: this.overrides, buttons: this.buttons, intro: this.intro, errors: this.errors, version: this.version };
    }
    return this.snap;
  };
  private emit() {
    this.version++;
    this.snap = null;
    this.syncLocals();
    this.listeners.forEach((l) => l());
  }

  get docname() {
    return this.doc.name;
  }
  getDoc(): Doc {
    return this.doc;
  }
  isDirty() {
    return this.dirty;
  }

  /** Replace the document (after load/save) — clears dirty and errors */
  load(doc: Doc) {
    this.doc = this.normalize(doc);
    this.dirty = false;
    this.errors = {};
    this.emit();
  }

  private normalize(doc: Doc): Doc {
    const d: Doc = { ...doc };
    for (const f of this.meta.fields ?? []) {
      if (TABLE_TYPES.has(f.fieldtype)) {
        const rows = Array.isArray(d[f.fieldname]) ? (d[f.fieldname] as Row[]) : [];
        d[f.fieldname] = rows.map((r, i) => {
          // rows copied by Duplicate/Amend/mapping arrive without a name: give them a local one
          const cdt = r.doctype ?? String(f.options);
          const named = r.name ? r : { ...r, name: `new-${cdt.toLowerCase().replace(/\s+/g, "-")}-${++rowSeq}${Date.now().toString(36)}`, __islocal: 1 };
          return { ...named, idx: i + 1, parentfield: f.fieldname, doctype: cdt };
        });
      }
    }
    return d;
  }

  /** locals[doctype][name] like Desk, so scripts can do locals[cdt][cdn] */
  private syncLocals() {
    const locals: Record<string, Record<string, unknown>> = {};
    locals[this.meta.name] = { [this.doc.name]: this.doc };
    for (const f of this.tableFields()) {
      for (const r of (this.doc[f.fieldname] as Row[]) ?? []) {
        (locals[r.doctype] ??= {})[r.name] = r;
      }
    }
    this.runtime.globals.locals = locals;
  }

  tableFields(): DocField[] {
    return (this.meta.fields ?? []).filter((f) => TABLE_TYPES.has(f.fieldtype));
  }
  field(fieldname: string, doctype = this.meta.name): DocField | undefined {
    return this.metas[doctype]?.fields?.find((f) => f.fieldname === fieldname);
  }
  private tableFor(cdt: string): DocField | undefined {
    return this.tableFields().find((f) => f.options === cdt);
  }
  findRow(cdn: string): { table: string; row: Row; index: number } | null {
    for (const f of this.tableFields()) {
      const rows = (this.doc[f.fieldname] as Row[]) ?? [];
      const index = rows.findIndex((r) => r.name === cdn);
      if (index >= 0) return { table: f.fieldname, row: rows[index], index };
    }
    return null;
  }

  // ── values ──────────────────────────────────────────────────────────────
  async set_value(fieldname: string | Record<string, unknown>, value?: unknown): Promise<void> {
    if (typeof fieldname === "object") {
      // in order on purpose: each change may trigger events that depend on the previous one (Desk semantics)
      // react-doctor-disable-next-line async-await-in-loop
      for (const [k, v] of Object.entries(fieldname)) await this.set_value(k, v);
      return;
    }
    const df = this.field(fieldname);
    if (TABLE_TYPES.has(df?.fieldtype ?? "")) {
      this.setRows(fieldname, ((value as Row[]) ?? []).map((r) => this.makeRow(fieldname, r)));
      return;
    }
    const v = this.coerce(df, value);
    if (this.same(this.doc[fieldname], v)) return;
    this.doc = { ...this.doc, [fieldname]: v };
    this.dirty = true;
    delete this.errors[fieldname];
    this.emit();
    await this.afterChange({ fieldname, value: v });
  }

  async set_child_value(cdt: string, cdn: string, fieldname: string | Record<string, unknown>, value?: unknown): Promise<void> {
    if (typeof fieldname === "object") {
      // in order on purpose: each change may trigger events that depend on the previous one (Desk semantics)
      // react-doctor-disable-next-line async-await-in-loop
      for (const [k, v] of Object.entries(fieldname)) await this.set_child_value(cdt, cdn, k, v);
      return;
    }
    const hit = this.findRow(cdn);
    if (!hit) return;
    const df = this.field(fieldname, hit.row.doctype);
    const v = this.coerce(df, value);
    if (this.same(hit.row[fieldname], v)) return;
    const rows = [...((this.doc[hit.table] as Row[]) ?? [])];
    rows[hit.index] = { ...hit.row, [fieldname]: v };
    this.doc = { ...this.doc, [hit.table]: rows };
    this.dirty = true;
    delete this.errors[`${hit.table}.${hit.index}.${fieldname}`];
    this.emit();
    await this.afterChange({ fieldname, value: v, cdt: hit.row.doctype, cdn, table: hit.table });
  }

  private coerce(df: DocField | undefined, v: unknown): unknown {
    if (!df) return v;
    if (["Int", "Check"].includes(df.fieldtype)) return v === "" || v == null ? (df.fieldtype === "Check" ? 0 : null) : Math.trunc(flt(v));
    if (["Float", "Currency", "Percent"].includes(df.fieldtype)) return v === "" || v == null ? null : flt(v);
    return v === "" ? null : v;
  }
  private same(a: unknown, b: unknown) {
    return (a ?? null) === (b ?? null) || (typeof a === "object" && JSON.stringify(a) === JSON.stringify(b));
  }

  /** Desk Link control: a value that isn't an existing record is rejected (cleared with a message) */
  private async validateLink(c: { fieldname: string; value: unknown; cdt?: string; cdn?: string }): Promise<boolean> {
    const df = this.field(c.fieldname, c.cdt ?? this.meta.name);
    if (!df || df.fieldtype !== "Link" || !c.value || typeof c.value !== "string") return true;
    try {
      const { env } = await deskCall("frappe.client.validate_link_and_fetch", { doctype: df.options, docname: c.value, fields_to_fetch: "[]" });
      const found = (env.message as { name?: string } | undefined)?.name;
      if (found) {
        // server may correct case ("rice-25" → "RICE-25")
        if (found !== c.value) await this.setFor(c, c.fieldname, found);
        return true;
      }
    } catch {
      return true; // older benches without validate_link_and_fetch: let the server validate on save
    }
    toast.error(`${df.label ?? c.fieldname}: ${c.value} does not exist`);
    await this.setFor(c, c.fieldname, null);
    return false;
  }

  private async afterChange(c: { fieldname: string; value: unknown; cdt?: string; cdn?: string; table?: string }) {
    if (this.depth > 20) return; // runaway script guard
    this.depth++;
    try {
      if (!(await this.validateLink(c))) return;
      await this.fetchFrom(c);
      // in order on purpose: each change may trigger events that depend on the previous one (Desk semantics)
      // react-doctor-disable-next-line async-await-in-loop
      for (const w of this.watchers) await w(c);
      if (c.cdt && c.cdn) await this.trigger(c.fieldname, c.cdt, c.cdn);
      else await this.trigger(c.fieldname);
    } finally {
      this.depth--;
    }
  }

  /** Link changed → fill dependent `fetch_from` fields (Desk: frappe.client.validate_link) */
  private async fetchFrom(c: { fieldname: string; value: unknown; cdt?: string; cdn?: string }) {
    const doctype = c.cdt ?? this.meta.name;
    const df = this.field(c.fieldname, doctype);
    if (!df || df.fieldtype !== "Link") return;
    const table = c.cdn ? this.findRow(c.cdn)?.table : undefined;
    const added = this.extraFetch
      .filter((x) => x.link === c.fieldname && (x.table ?? undefined) === table)
      .map((x) => ({ fieldname: x.target, fetch_from: `${x.link}.${x.source}` }) as DocField);
    const dependents = [
      ...(this.metas[doctype]?.fields ?? []).filter((f) => typeof f.fetch_from === "string" && f.fetch_from.split(".")[0] === c.fieldname),
      ...added,
    ];
    if (!dependents.length) return;
    const current: Record<string, unknown> = c.cdn ? this.findRow(c.cdn)?.row ?? {} : this.doc;
    const targets = dependents.filter((f) => !f.fetch_if_empty || !current[f.fieldname]);
    if (!c.value) {
      // in order on purpose: each change may trigger events that depend on the previous one (Desk semantics)
      // react-doctor-disable-next-line async-await-in-loop
      for (const f of targets) await this.setFor(c, f.fieldname, null);
      return;
    }
    const fields = targets.map((f) => String(f.fetch_from).split(".")[1]);
    let msg: Record<string, unknown> = {};
    try {
      // v16: validate_link_and_fetch; v15: validate_link
      const { env } = await deskCall("frappe.client.validate_link_and_fetch", { doctype: df.options, docname: c.value, fields_to_fetch: JSON.stringify(fields) });
      msg = (env.message ?? {}) as Record<string, unknown>;
    } catch {
      try {
        const { env } = await deskCall("frappe.client.validate_link", { doctype: df.options, docname: c.value, fields: JSON.stringify(fields) });
        msg = (env.message ?? {}) as Record<string, unknown>;
      } catch {
        return; // invalid link — server rejects on save
      }
    }
    for (const f of targets) {
      const src = String(f.fetch_from).split(".")[1];
      // react-doctor-disable-next-line async-await-in-loop
      if (src in msg) await this.setFor(c, f.fieldname, msg[src]);
    }
  }
  private setFor(c: { cdt?: string; cdn?: string }, fieldname: string, v: unknown) {
    return c.cdt && c.cdn ? this.set_child_value(c.cdt, c.cdn, fieldname, v) : this.set_value(fieldname, v);
  }

  /**
   * Write computed values (totals, server-fetched details) in one go without
   * firing change events — like Desk assigning to locals then refresh_fields.
   * `rows` maps table → row name → partial row.
   */
  applyComputed(parent: Record<string, unknown>, rows: Record<string, Record<string, Record<string, unknown>>> = {}) {
    const next: Doc = { ...this.doc };
    let changed = false;
    for (const [k, v] of Object.entries(parent)) {
      if (!this.same(next[k], v)) {
        next[k] = v;
        changed = true;
      }
    }
    for (const [table, patches] of Object.entries(rows)) {
      const list = ((next[table] as Row[]) ?? []).map((r) => {
        const p = patches[r.name];
        if (!p) return r;
        const merged = { ...r };
        for (const [k, v] of Object.entries(p)) {
          if (!this.same(merged[k], v)) {
            merged[k] = v;
            changed = true;
          }
        }
        return merged;
      });
      next[table] = list;
    }
    if (!changed) return;
    this.doc = next;
    this.dirty = true;
    this.emit();
  }

  // ── child rows ──────────────────────────────────────────────────────────
  makeRow(table: string, values: Record<string, unknown> = {}): Row {
    const df = this.field(table);
    const cdt = String(df?.options ?? "");
    const cmeta = this.metas[cdt];
    const base = cmeta ? getNewDoc(cmeta, { user: this.ctx.user, full_name: this.ctx.full_name, defaults: this.ctx.defaults }) : {};
    delete base.owner;
    return {
      ...base,
      ...values,
      doctype: cdt,
      name: typeof values.name === "string" && values.name ? values.name : `new-${cdt.toLowerCase().replace(/\s+/g, "-")}-${++rowSeq}${Date.now().toString(36)}`,
      __islocal: values.name ? values.__islocal : 1,
      parentfield: table,
      parenttype: this.meta.name,
      idx: 0,
    } as Row;
  }

  private setRows(table: string, rows: Row[]) {
    this.doc = { ...this.doc, [table]: rows.map((r, i) => ({ ...r, idx: i + 1 })) };
    this.dirty = true;
    this.emit();
  }

  async add_child(table: string, values: Record<string, unknown> = {}, at?: number): Promise<Row> {
    const row = this.makeRow(table, values);
    const rows = [...((this.doc[table] as Row[]) ?? [])];
    rows.splice(at ?? rows.length, 0, row);
    this.setRows(table, rows);
    await this.trigger(`${table}_add`, row.doctype, row.name);
    return (this.doc[table] as Row[]).find((r) => r.name === row.name)!;
  }

  async remove_rows(table: string, names: string[]) {
    const drop = new Set(names);
    const rows = ((this.doc[table] as Row[]) ?? []).filter((r) => !drop.has(r.name));
    this.setRows(table, rows);
    await this.trigger(`${table}_remove`);
    // in order on purpose: each change may trigger events that depend on the previous one (Desk semantics)
    // react-doctor-disable-next-line async-await-in-loop
    for (const w of this.watchers) await w({ fieldname: table, value: rows, table });
  }

  move_row(table: string, name: string, delta: number) {
    const rows = [...((this.doc[table] as Row[]) ?? [])];
    const i = rows.findIndex((r) => r.name === name);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    this.setRows(table, rows);
    void this.trigger(`${table}_move`);
  }

  /** Drag-and-drop reorder (Desk: grid sortable → idx renumbered, `<table>_move` fired) */
  reorder_row(table: string, name: string, toIndex: number) {
    const rows = [...((this.doc[table] as Row[]) ?? [])];
    const i = rows.findIndex((r) => r.name === name);
    if (i < 0 || toIndex < 0 || toIndex >= rows.length || i === toIndex) return;
    const [row] = rows.splice(i, 1);
    rows.splice(toIndex, 0, row);
    this.setRows(table, rows);
    void this.trigger(`${table}_move`);
  }

  // ── events ──────────────────────────────────────────────────────────────
  watch(w: Watcher) {
    this.watchers.push(w);
  }

  /**
   * Run handlers for `event` registered via frappe.ui.form.on. Parent events get
   * (frm); child events (registered on the child doctype) get (frm, cdt, cdn).
   * Returns false if a handler aborted (frappe.throw / validated = false).
   */
  async trigger(event: string, cdt?: string, cdn?: string): Promise<boolean> {
    const doctype = cdt ?? this.meta.name;
    const handlers = this.runtime.frappe.ui.form.handlers.get(doctype)?.get(event) ?? [];
    const f = this.runtime.frappe as unknown as { validated?: boolean };
    for (const h of handlers) {
      try {
        f.validated = true;
        // handlers run in registration order and may depend on each other (Desk semantics)
        // react-doctor-disable-next-line async-await-in-loop
        await h(this.frm, cdt ?? this.meta.name, cdn ?? this.doc.name);
        // a handler may set frappe.validated = false to abort (Desk semantics)
        if ((f.validated as boolean | undefined) === false) return false;
      } catch (err) {
        if (["validate", "before_save", "before_submit", "before_cancel"].includes(event)) return false;
        console.warn(`[form] ${doctype}.${event} handler failed:`, err);
      }
    }
    // Desk also calls frm.cscript[event] (controller classes via extend_cscript)
    const cs = this.frm.cscript as Record<string, unknown>;
    if (typeof cs[event] === "function") {
      try {
        f.validated = true;
        await (cs[event] as (...a: unknown[]) => unknown).call(cs, this.doc, cdt ?? this.meta.name, cdn ?? this.doc.name);
        if ((f.validated as boolean | undefined) === false) return false;
      } catch (err) {
        if (["validate", "before_save", "before_submit", "before_cancel"].includes(event)) return false;
        console.warn(`[form] cscript.${event} failed:`, err);
      }
    }
    return true;
  }

  // ── validation ──────────────────────────────────────────────────────────
  /** Desk's mandatory check (frappe.ui.form.save → check_mandatory) */
  validateMandatory(): string[] {
    const errors: Record<string, string> = {};
    const missing: string[] = [];
    const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    const reqd = (df: DocField, doc: Record<string, unknown>, key: string) => {
      const o = this.overrides[key] ?? {};
      if (o.hidden || df.hidden) return false;
      if (df.depends_on && !evalDependsOn(String(df.depends_on), doc)) return false;
      return !!(o.reqd ?? df.reqd) || (!!df.mandatory_depends_on && evalDependsOn(String(df.mandatory_depends_on), doc));
    };
    for (const df of this.meta.fields ?? []) {
      if (NO_VALUE.has(df.fieldtype) || !reqd(df, this.doc, df.fieldname)) continue;
      if (isEmpty(this.doc[df.fieldname])) {
        errors[df.fieldname] = "Required";
        missing.push(df.label ?? df.fieldname);
      }
    }
    for (const t of this.tableFields()) {
      const cmeta = this.metas[String(t.options)];
      ((this.doc[t.fieldname] as Row[]) ?? []).forEach((row, i) => {
        for (const df of cmeta?.fields ?? []) {
          if (NO_VALUE.has(df.fieldtype) || !reqd(df, { ...row, parent: this.doc }, `${t.fieldname}.${df.fieldname}`)) continue;
          if (isEmpty(row[df.fieldname])) {
            errors[`${t.fieldname}.${i}.${df.fieldname}`] = "Required";
            missing.push(`${t.label ?? t.fieldname} Row #${i + 1}: ${df.label ?? df.fieldname}`);
          }
        }
      });
    }
    this.errors = errors;
    this.emit();
    return missing;
  }

  // ── script-facing overrides ─────────────────────────────────────────────
  setDf(key: string, prop: string, value: unknown) {
    this.overrides = { ...this.overrides, [key]: { ...(this.overrides[key] ?? {}), [prop]: value } };
    this.emit();
  }
  getQuery(fieldname: string, table?: string): QueryFn | undefined {
    return this.queries[table ? `${table}.${fieldname}` : fieldname];
  }
  clearButtons() {
    this.buttons = [];
    this.emit();
  }

  // ── frm (what scripts see) ──────────────────────────────────────────────
  private buildFrm(): Record<string, unknown> {
    // getters on frm must read the controller's current doc, not a snapshot
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const fieldsDict: Record<string, unknown> = {};
    for (const f of this.meta.fields ?? []) {
      fieldsDict[f.fieldname] = {
        df: f,
        get value() {
          return self.doc[f.fieldname];
        },
        set_value: (v: unknown) => self.set_value(f.fieldname, v),
        refresh: () => {},
        toggle: (show: boolean) => self.setDf(f.fieldname, "hidden", show ? 0 : 1),
        set_query: (fn: QueryFn) => (self.queries[f.fieldname] = fn),
        // jQuery handles Desk scripts poke at ($wrapper.toggle(), $input.on(), …) — chainable no-ops
        $wrapper: (self.runtime.globals.$ as () => unknown)(),
        $input: (self.runtime.globals.$ as () => unknown)(),
        wrapper: {},
        set_description: () => {},
        set_focus: () => {},
        get_query: undefined as unknown,
        // grid API for tables
        grid: TABLE_TYPES.has(f.fieldtype)
          ? {
              get_field: (child: string) => ({
                set get_query(fn: QueryFn) {
                  self.queries[`${f.fieldname}.${child}`] = fn;
                },
              }),
              toggle_enable: (child: string, enable: boolean) => self.setDf(`${f.fieldname}.${child}`, "read_only", enable ? 0 : 1),
              toggle_reqd: (child: string, reqd: boolean) => self.setDf(`${f.fieldname}.${child}`, "reqd", reqd ? 1 : 0),
              toggle_display: (child: string, show: boolean) => self.setDf(`${f.fieldname}.${child}`, "hidden", show ? 0 : 1),
              update_docfield_property: (child: string, prop: string, value: unknown) => self.setDf(`${f.fieldname}.${child}`, prop, value),
              add_custom_button: () => {},
              refresh: () => {},
              cannot_add_rows: false,
            }
          : undefined,
      };
      Object.defineProperty(fieldsDict[f.fieldname], "get_query", {
        set(fn: QueryFn) {
          self.queries[f.fieldname] = fn;
        },
        get() {
          return self.queries[f.fieldname];
        },
      });
    }

    const frm: Record<string, unknown> = {
      get doc() {
        return self.doc;
      },
      doctype: this.meta.name,
      get docname() {
        return self.doc.name;
      },
      meta: this.meta,
      fields_dict: fieldsDict,
      cscript: {},
      page: lenientObject({
        set_primary_action: () => {},
        set_secondary_action: () => {},
        add_menu_item: (label: string, action: () => unknown) => self.addButton({ label, action, group: "Menu" }),
        add_inner_button: () => {},
        clear_primary_action: () => {},
        set_indicator: () => {},
        btn_primary: { removeClass() {}, addClass() {}, html() {} },
        wrapper: { find: () => ({ length: 0 }) },
      }),
      dashboard: {
        add_indicator: () => {},
        set_headline: (html: string) => self.setIntro(html, "blue"),
        set_headline_alert: (html: string) => self.setIntro(html, "blue"),
        clear_headline: () => self.setIntro("", ""),
        add_comment: () => {},
        refresh: () => {},
        add_section: () => {},
        stats_area: { removeClass() {}, addClass() {} },
      },
      timeline: { insert_comment() {} },
      sidebar: { add_user_action() {} },
      set_value: (f: string | Record<string, unknown>, v?: unknown) => self.set_value(f, v),
      get_value: (f: string) => self.doc[f],
      refresh_field: () => {},
      refresh_fields: () => {},
      refresh: () => self.emit(),
      reload_doc: () => (self.onReload?.() ?? Promise.resolve()),
      save: (action?: string) => self.onSave?.(action),
      savesubmit: () => self.onSave?.("Submit"),
      savecancel: () => self.onSave?.("Cancel"),
      is_new: () => isNewDoc(self.doc),
      is_dirty: () => self.dirty,
      dirty: () => {
        self.dirty = true;
        self.emit();
      },
      /** frappe.model.sync of a server-mapped copy of this doc (map_docs) — keeps it unsaved */
      __sync: (doc: Doc) => {
        self.doc = self.normalize({ ...doc, __islocal: self.doc.__islocal, __unsaved: 1 });
        self.dirty = true;
        self.emit();
      },
      set_df_property: (f: string, prop: string, v: unknown, _docname?: string, table?: string) =>
        self.setDf(table ? `${table}.${f}` : f, prop, v),
      toggle_display: (f: string | string[], show: boolean) => (Array.isArray(f) ? f : [f]).forEach((x) => self.setDf(x, "hidden", show ? 0 : 1)),
      toggle_reqd: (f: string | string[], reqd: boolean) => (Array.isArray(f) ? f : [f]).forEach((x) => self.setDf(x, "reqd", reqd ? 1 : 0)),
      toggle_enable: (f: string | string[], enable: boolean) => (Array.isArray(f) ? f : [f]).forEach((x) => self.setDf(x, "read_only", enable ? 0 : 1)),
      set_query: (f: string, tableOrFn: string | QueryFn, fn?: QueryFn) => {
        if (typeof tableOrFn === "function") self.queries[f] = tableOrFn;
        else if (fn) self.queries[`${tableOrFn}.${f}`] = fn;
      },
      add_custom_button: (label: string, action: () => unknown, group?: string) => self.addButton({ label, action, group }),
      remove_custom_button: (label: string, group?: string) => {
        self.buttons = self.buttons.filter((b) => !(b.label === label && (b.group ?? "") === (group ?? "")));
        self.emit();
      },
      clear_custom_buttons: () => self.clearButtons(),
      change_custom_button_type: () => {},
      set_intro: (msg: string, color?: string) => self.setIntro(msg, color ?? "blue"),
      add_child: (table: string, values?: Record<string, unknown>) => {
        const row = self.makeRow(table, values);
        const rows = [...((self.doc[table] as Row[]) ?? []), row];
        self.setRows(table, rows);
        return row;
      },
      clear_table: (table: string) => self.setRows(table, []),
      call: async (method: string | { method: string; args?: Record<string, unknown>; callback?: (r: unknown) => void }, args?: Record<string, unknown>) => {
        const o = typeof method === "string" ? { method, args } : method;
        const { env } = await deskCall("frappe.handler.run_doc_method", {
          docs: JSON.stringify(self.doc),
          method: o.method,
          args: JSON.stringify(o.args ?? {}),
        });
        const updated = (env.docs as Doc[] | undefined)?.[0];
        if (updated) self.load(updated);
        o.callback?.(env);
        return env;
      },
      trigger: (event: string, cdt?: string, cdn?: string) => self.trigger(event, cdt, cdn),
      script_manager: {
        trigger: (event: string, cdt?: string, cdn?: string) => self.trigger(event, cdt, cdn),
        /** copy fields from the table's first row into `row` when empty (Desk grid helper) */
        copy_from_first_row: (table: string, row: Row, fields: string[]) => {
          const first = ((self.doc[table] as Row[]) ?? [])[0];
          if (!first || !row || first.name === row.name) return;
          const patch: Record<string, unknown> = {};
          for (const f of fields ?? []) if (!row[f] && first[f]) patch[f] = first[f];
          self.applyComputed({}, { [table]: { [row.name]: patch } });
        },
      },
      add_fetch: (link: string, source: string, target: string, table?: string) => self.extraFetch.push({ link, source, target, table }),
      enable_save: () => {},
      disable_save: () => self.setDf("__form", "disable_save", 1),
      disable_form: () => self.setDf("__form", "read_only", 1),
      set_currency_labels: () => {},
      get_field: (f: string) => fieldsDict[f],
      get_docfield: (table: string, f?: string) => (f ? self.field(f, String(self.field(table)?.options)) : self.field(table)),
      has_perm: () => true,
      email_doc: () => {},
      print_doc: () => {},
      layout: { refresh_sections() {} },
      perm: [{ read: 1, write: 1, create: 1, submit: 1, cancel: 1, delete: 1 }],
      toolbar: { refresh() {} },
      events: {},
    };
    // frappe.model.set_value(cdt, cdn, field, value) is the child-row setter scripts use most
    const model = this.runtime.frappe.model as Record<string, unknown>;
    model.set_value = (cdt: string, cdn: string, f: string | Record<string, unknown>, v?: unknown) =>
      cdt === self.meta.name ? self.set_value(f, v) : self.set_child_value(cdt, cdn, f, v);
    model.get_value = (cdt: string, cdn: string, f: string) => (cdt === self.meta.name ? self.doc[f] : self.findRow(cdn)?.row[f]);
    model.get_doc = (cdt: string, cdn: string) => (cdt === self.meta.name ? self.doc : self.findRow(cdn)?.row);
    model.add_child = (doc: unknown, cdtOrTable: string, table?: string) => {
      const t = table ?? this.tableFor(cdtOrTable)?.fieldname ?? cdtOrTable;
      return (frm.add_child as (t: string) => Row)(t);
    };
    model.clear_table = (_doc: unknown, table: string) => self.setRows(table, []);
    model.with_doc = async (dt: string, dn: string, cb?: (name: string, r: unknown) => unknown) => {
      const { env } = await deskCall("frappe.desk.form.load.getdoc", { doctype: dt, name: dn }, { get: true });
      const d = (env.docs as Doc[] | undefined)?.[0];
      cb?.(dn, d);
      return d;
    };
    model.round_floats_in = (doc: Record<string, unknown>, fields?: string[]) => {
      for (const f of fields ?? Object.keys(doc)) if (typeof doc[f] === "number") doc[f] = flt(doc[f], 9);
    };
    model.get_new_doc = (dt: string) => (this.metas[dt] ? getNewDoc(this.metas[dt], { user: this.ctx.user }) : { doctype: dt });
    (this.runtime.frappe as Record<string, unknown>).validated = true;
    // Desk UI-only frm APIs we don't model (set_indicator_formatter, …) resolve to no-ops
    return new Proxy(frm, {
      get(target, prop, receiver) {
        if (typeof prop === "symbol" || prop in target) return Reflect.get(target, prop, receiver);
        // Desk UI members we don't model (frm.msgbox.$wrapper.is(...), frm.timeline.refresh()) resolve to
        // a chainable no-op instead of throwing
        return NOOP;
      },
    });
  }

  onSave?: (action?: string) => Promise<unknown>;
  onReload?: () => Promise<unknown>;

  private addButton(b: CustomButton) {
    if (this.buttons.some((x) => x.label === b.label && (x.group ?? "") === (b.group ?? ""))) return;
    const action = b.action;
    this.buttons = [
      ...this.buttons,
      {
        ...b,
        action: () => {
          try {
            return action?.();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        },
      },
    ];
    this.emit();
  }
  private setIntro(message: string, color: string) {
    this.intro = message ? { message, color } : null;
    this.emit();
  }

  /** Evaluate the DocType's app JS + Client Scripts so their handlers register */
  loadScripts() {
    const meta = this.meta as DocTypeMeta & { __js?: string; __custom_js?: string };
    this.runtime.evalScript(String(meta.__js ?? ""), `${meta.name} form js`);
    for (const m of Object.values(this.metas)) {
      if (m === this.meta) continue;
      this.runtime.evalScript(String((m as { __js?: string }).__js ?? ""), `${m.name} child js`);
    }
    this.runtime.evalScript(String(meta.__custom_js ?? ""), `${meta.name} client scripts`);
  }

  /** Desk's load sequence: setup → onload → refresh → onload_post_render */
  async runLoadEvents(first: boolean) {
    this.buttons = [];
    if (first) {
      await this.trigger("setup");
      await this.trigger("onload");
    }
    await this.trigger("refresh");
    if (first) await this.trigger("onload_post_render");
    this.emit();
  }
}

/** New document for a meta, with child tables made into rows */
export function newFormDoc(meta: DocTypeMeta, ctx: RuntimeContext, prefill: Record<string, unknown> = {}): Doc {
  return { ...getNewDoc(meta, { user: ctx.user, full_name: ctx.full_name, defaults: ctx.defaults }), ...prefill } as Doc;
}
