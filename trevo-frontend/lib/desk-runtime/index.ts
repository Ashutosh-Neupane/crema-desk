/**
 * Desk runtime — a `frappe` compatibility layer for running the apps' own
 * client JavaScript (DocType __list_js / __js, Client Scripts) in Trevo, the
 * same code Desk runs. Scripts are evaluated inside a scope that provides
 * `frappe`, `__`, `flt`, `cint`, `cstr`, `locals`, `erpnext.*` (via
 * frappe.provide) and a no-op jQuery; unknown globals resolve to the real
 * global or `undefined`, so one bad script can't take the page down.
 *
 * What's covered grows as views need it; anything DOM-specific is a no-op.
 */
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";
import type { DocTypeMeta, DocField } from "@/lib/frappe/types";
import { DeskDialog, confirm as deskConfirm, prompt as deskPrompt } from "./dialogs";

export interface RuntimeContext {
  user: string;
  full_name?: string;
  roles?: string[];
  defaults?: Record<string, unknown>;
  sysdefaults?: Record<string, unknown>;
  /** boot.user permission lists (can_create, in_create, …) */
  perms?: Record<string, string[]>;
  developer_mode?: boolean;
  /** metas known to the page (parent + children) for frappe.meta.* */
  metas?: Record<string, DocTypeMeta>;
  navigate?: (href: string) => void;
}

type Handler = (...args: unknown[]) => unknown;
export type FormHandlers = Map<string, Map<string, Handler[]>>;

// ── numbers / strings (frappe/public/js/frappe/utils/number_format.js) ──────
export function flt(v: unknown, precision?: number | null): number {
  let n: number;
  if (typeof v === "number") n = v;
  else {
    const s = String(v ?? "").replace(/,/g, "").trim();
    n = s === "" ? 0 : parseFloat(s);
  }
  if (!Number.isFinite(n)) n = 0;
  if (precision != null) {
    const m = 10 ** precision;
    n = Math.round((n + Number.EPSILON) * m) / m;
  }
  return n;
}
export const cint = (v: unknown) => Math.trunc(flt(v)) || 0;
export const cstr = (v: unknown) => (v == null ? "" : String(v));
export const in_list = (list: unknown[], item: unknown) => Array.isArray(list) && list.includes(item);

export function __(text: unknown, replace?: unknown[]): string {
  let s = cstr(text);
  if (Array.isArray(replace)) replace.forEach((r, i) => (s = s.replaceAll(`{${i}}`, cstr(r))));
  return s;
}

// ── dates (frappe.datetime) ─────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (v: unknown) => (v instanceof Date ? v : new Date(String(v ?? "").replace(" ", "T").slice(0, 19) || Date.now()));

function makeDatetime(ctx: RuntimeContext) {
  const fmt = String(ctx.sysdefaults?.date_format ?? "yyyy-mm-dd");
  const dt = {
    get_today: () => ymd(new Date()),
    nowdate: () => ymd(new Date()),
    now_date: () => ymd(new Date()),
    now_time: () => new Date().toTimeString().slice(0, 8),
    now_datetime: () => `${ymd(new Date())} ${new Date().toTimeString().slice(0, 8)}`,
    system_datetime: () => `${ymd(new Date())} ${new Date().toTimeString().slice(0, 8)}`,
    str_to_obj: (s: unknown) => toDate(s),
    obj_to_str: (d: unknown) => ymd(toDate(d)),
    get_datetime_as_string: (d: unknown) => `${ymd(toDate(d))} ${toDate(d).toTimeString().slice(0, 8)}`,
    /** days between d1 and d2 (default today) — frappe.datetime.get_diff */
    get_diff: (d1: unknown, d2?: unknown) => {
      const a = new Date(ymd(toDate(d1)));
      const b = new Date(ymd(d2 ? toDate(d2) : new Date()));
      return Math.round((a.getTime() - b.getTime()) / 86400000);
    },
    get_day_diff: (d1: unknown, d2: unknown) => dt.get_diff(d1, d2),
    add_days: (d: unknown, n: number) => {
      const x = toDate(d);
      x.setDate(x.getDate() + cint(n));
      return ymd(x);
    },
    add_months: (d: unknown, n: number) => {
      const x = toDate(d);
      x.setMonth(x.getMonth() + cint(n));
      return ymd(x);
    },
    month_start: () => ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    month_end: () => ymd(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
    year_start: () => `${new Date().getFullYear()}-01-01`,
    year_end: () => `${new Date().getFullYear()}-12-31`,
    str_to_user: (s: unknown) => {
      if (!s) return "";
      const d = toDate(s);
      return fmt.replace("yyyy", String(d.getFullYear())).replace("mm", pad(d.getMonth() + 1)).replace("dd", pad(d.getDate()));
    },
    user_to_str: (s: unknown) => cstr(s),
    comment_when: (s: unknown) => cstr(s),
  };
  return dt;
}

// ── guess_style (frappe.utils.guess_style) ──────────────────────────────────
const hasWord = (words: string[], text: string) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));
export function guessColour(text: unknown): string {
  const t = cstr(text);
  if (!t) return "gray";
  if (hasWord(["Pending", "Review", "Medium", "Not Approved"], t)) return "amber";
  if (hasWord(["Open", "Urgent", "High", "Failed", "Rejected", "Error"], t)) return "red";
  if (hasWord(["Closed", "Finished", "Converted", "Completed", "Complete", "Confirmed", "Approved", "Yes", "Active", "Available", "Paid", "Success"], t)) return "green";
  if (hasWord(["Submitted"], t)) return "blue";
  return "gray";
}

/** Chainable no-op stand-in for jQuery so DOM-oriented scripts don't throw. */
function makeJQueryStub(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, p) => {
      if (p === "length") return 0;
      if (p === Symbol.iterator) return function* () {};
      if (p === "then") return undefined;
      return chain;
    },
    apply: () => chain,
  });
  const $ = Object.assign((..._args: unknown[]) => chain, {
    extend: (...objs: Record<string, unknown>[]) => {
      const deep = typeof objs[0] === "boolean";
      const list = (deep ? objs.slice(1) : objs) as Record<string, unknown>[];
      return Object.assign(list[0] ?? {}, ...list.slice(1));
    },
    each: (obj: unknown, fn: (k: unknown, v: unknown) => unknown) => {
      if (Array.isArray(obj)) obj.forEach((v, i) => fn(i, v));
      else if (obj && typeof obj === "object") Object.entries(obj).forEach(([k, v]) => fn(k, v));
    },
    map: (arr: unknown[], fn: (v: unknown, i: number) => unknown) => (arr ?? []).map(fn).filter((x) => x != null),
    isEmptyObject: (o: unknown) => !o || Object.keys(o as object).length === 0,
    isArray: Array.isArray,
    isPlainObject: (o: unknown) => !!o && typeof o === "object" && !Array.isArray(o),
    inArray: (v: unknown, arr: unknown[]) => (arr ?? []).indexOf(v),
    trim: (s: unknown) => cstr(s).trim(),
    when: (...p: unknown[]) => Promise.all(p),
    Deferred: () => {
      let resolve!: (v?: unknown) => void;
      const promise = new Promise((r) => (resolve = r));
      return Object.assign(promise, { resolve, promise: () => promise });
    },
  });
  return $;
}

export interface Runtime {
  frappe: Record<string, unknown> & {
    listview_settings: Record<string, Record<string, unknown>>;
    ui: { form: { handlers: FormHandlers } };
  };
  globals: Record<string, unknown>;
  /** Evaluate app/client JS; errors are caught and reported, never thrown */
  evalScript: (code: string, label: string) => boolean;
}

export function createRuntime(ctx: RuntimeContext): Runtime {
  const handlers: FormHandlers = new Map();
  const globals: Record<string, unknown> = {};
  const datetime = makeDatetime(ctx);
  const metas = ctx.metas ?? {};
  const getField = (dt: string, fn: string): DocField | undefined => metas[dt]?.fields?.find((f) => f.fieldname === fn);

  const provide = (ns: string) => {
    let obj = globals;
    for (const part of ns.split(".")) {
      if (!(part in obj) || obj[part] == null) obj[part] = {};
      obj = obj[part] as Record<string, unknown>;
    }
    return obj;
  };

  const call = async (opts: string | { method: string; args?: Record<string, unknown>; callback?: (r: unknown) => void; freeze?: boolean }, args?: Record<string, unknown>) => {
    const o = typeof opts === "string" ? { method: opts, args } : opts;
    try {
      const { env } = await deskCall(o.method, o.args ?? {});
      o.callback?.(env);
      return env;
    } catch (err) {
      // Desk's frappe.call shows the server message and the chain simply stops
      // (a failed jQuery deferred) — never an unhandled rejection that crashes the page
      toast.error(err instanceof Error ? err.message : String(err), { duration: 8000 });
      return new Promise<never>(() => {});
    }
  };

  const frappe = {
    listview_settings: {} as Record<string, Record<string, unknown>>,
    ui: {
      form: {
        handlers,
        on(doctype: string, eventsOrField: string | Record<string, Handler>, fn?: Handler) {
          if (!handlers.has(doctype)) handlers.set(doctype, new Map());
          const m = handlers.get(doctype)!;
          const add = (event: string, h: Handler) => {
            if (!m.has(event)) m.set(event, []);
            m.get(event)!.push(h);
          };
          if (typeof eventsOrField === "string" && typeof fn === "function") add(eventsOrField, fn);
          else if (eventsOrField && typeof eventsOrField === "object") {
            for (const [ev, h] of Object.entries(eventsOrField)) if (typeof h === "function") add(ev, h);
          }
        },
        // class bases some app scripts extend; behaviour comes from Trevo's own form
        Controller: class {},
      },
      Dialog: DeskDialog,
      toolbar: {},
    },
    provide,
    session: { user: ctx.user, user_fullname: ctx.full_name ?? ctx.user },
    user: { name: ctx.user, has_role: (r: string | string[]) => (Array.isArray(r) ? r : [r]).some((x) => ctx.roles?.includes(x)) },
    user_roles: ctx.roles ?? [],
    boot: { developer_mode: ctx.developer_mode ? 1 : 0, sysdefaults: ctx.sysdefaults ?? {}, user: { defaults: ctx.defaults ?? {}, roles: ctx.roles ?? [], in_create: [], can_create: [], can_read: [], ...(ctx.perms ?? {}) } },
    sys_defaults: ctx.sysdefaults ?? {},
    defaults: {
      get_user_default: (k: string) => {
        const hit = Object.entries(ctx.defaults ?? {}).find(([key]) => key.toLowerCase() === String(k).toLowerCase());
        return Array.isArray(hit?.[1]) ? (hit![1] as unknown[])[0] : hit?.[1];
      },
      get_default: (k: string) => frappe.defaults.get_user_default(k) ?? ctx.sysdefaults?.[k],
      get_global_default: (k: string) => ctx.sysdefaults?.[k],
      get_user_defaults: (k: string) => {
        const v = frappe.defaults.get_user_default(k);
        return v == null ? [] : [v];
      },
    },
    datetime,
    utils: {
      guess_colour: guessColour,
      guess_style: (t: unknown) => ({ green: "success", red: "danger", amber: "warning", blue: "info" })[guessColour(t)] ?? "default",
      escape_html: (s: unknown) => cstr(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),
      is_url: (s: unknown) => /^https?:\/\//.test(cstr(s)),
      get_random: (n = 8) => Math.random().toString(36).slice(2, 2 + n),
      sum: (arr: unknown[]) => (arr ?? []).reduce<number>((a, b) => a + flt(b), 0),
      unique: (arr: unknown[]) => [...new Set(arr ?? [])],
      icon: () => "",
    },
    meta: {
      get_docfield: (dt: string, fn: string) => getField(dt, fn),
      has_field: (dt: string, fn: string) => !!getField(dt, fn),
      get_field_precision: (df?: DocField) => (df?.precision ? cint(df.precision) : df?.fieldtype === "Currency" ? 2 : 3),
      get_label: (dt: string, fn: string) => getField(dt, fn)?.label ?? fn,
    },
    model: {
      round_floats_in: () => {},
      is_submittable: (dt: string) => !!metas[dt]?.is_submittable,
      get_value: () => undefined,
    },
    call,
    xcall: async (method: string, args?: Record<string, unknown>) => (await call({ method, args })).message,
    db: {
      get_value: (doctype: string, filters: unknown, fieldname: unknown) =>
        call({ method: "frappe.client.get_value", args: { doctype, filters, fieldname } }),
      get_list: async (doctype: string, args: Record<string, unknown> = {}) =>
        (await call({ method: "frappe.client.get_list", args: { doctype, ...args } })).message,
      exists: async (doctype: string, name: string) =>
        !!(await call({ method: "frappe.client.get_value", args: { doctype, filters: { name }, fieldname: "name" } })).message,
      count: async (doctype: string, args: { filters?: unknown } = {}) =>
        (await call({ method: "frappe.client.get_count", args: { doctype, filters: args.filters } })).message,
      insert: async (doc: Record<string, unknown>) => (await call({ method: "frappe.client.insert", args: { doc } })).message,
      set_value: async (doctype: string, name: string, fieldname: unknown, value?: unknown) =>
        (await call({ method: "frappe.client.set_value", args: { doctype, name, fieldname, value } })).message,
      get_doc: async (doctype: string, name: string) => (await call({ method: "frappe.client.get", args: { doctype, name } })).message,
    },
    prompt: deskPrompt,
    confirm: deskConfirm,
    msgprint: (m: unknown) => {
      const text = typeof m === "object" && m ? cstr((m as { message?: unknown }).message) : cstr(m);
      toast.info(text.replace(/<[^>]+>/g, ""));
    },
    show_alert: (m: unknown) => {
      const text = typeof m === "object" && m ? cstr((m as { message?: unknown }).message) : cstr(m);
      toast(text.replace(/<[^>]+>/g, ""));
    },
    throw: (m: unknown) => {
      const text = typeof m === "object" && m ? cstr((m as { message?: unknown }).message) : cstr(m);
      toast.error(text.replace(/<[^>]+>/g, ""));
      throw new Error(text);
    },
    format: (v: unknown) => cstr(v),
    route_options: null as unknown,
    set_route: (...parts: unknown[]) => {
      const p = parts.flat().map(cstr);
      if (p[0] === "Form" && p[1]) ctx.navigate?.(`/desk/doctype/${encodeURIComponent(p[1])}/${encodeURIComponent(p[2] ?? "new")}`);
      else if (p[0] === "List" && p[1]) ctx.navigate?.(`/desk/doctype/${encodeURIComponent(p[1])}`);
    },
    new_doc: (dt: string) => ctx.navigate?.(`/desk/doctype/${encodeURIComponent(dt)}/new`),
    get_route: () => [],
    realtime: { on() {}, off() {} },
    require: () => Promise.resolve(),
    _: __,
  };

  Object.assign(globals, {
    frappe,
    __,
    flt,
    cint,
    cstr,
    in_list,
    locals: {} as Record<string, unknown>,
    cur_frm: undefined,
    // Desk globals some scripts still call
    refresh_field: () => {},
    refresh_many: () => {},
    msgprint: (m: unknown) => (frappe.msgprint as (m: unknown) => void)(m),
    show_alert: (m: unknown) => (frappe.show_alert as (m: unknown) => void)(m),
    $: makeJQueryStub(),
    jQuery: undefined,
    format_currency: (v: unknown, currency?: string) => `${currency ?? ""} ${flt(v, 2).toLocaleString()}`.trim(),
  });
  globals.jQuery = globals.$;

  const scope = new Proxy(globals, {
    has: () => true,
    get(target, prop) {
      if (prop === Symbol.unscopables) return undefined;
      if (prop in target) return target[prop as string];
      return (globalThis as Record<string | symbol, unknown>)[prop];
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  });

  const evalScript = (code: string, label: string) => {
    if (!code?.trim()) return true;
    try {
      // `with` resolves every free identifier through the scope proxy (sloppy-mode Function body).
      // Running the site's own app/client JS is the point here — Desk evals the same code.
      // eslint-disable-next-line no-new-func
      const fn = new Function("__scope", `with (__scope) {\n${code}\n}`); // react-doctor-disable-line no-eval
      fn(scope);
      return true;
    } catch (err) {
      console.warn(`[desk-runtime] ${label} failed:`, err);
      return false;
    }
  };

  return { frappe: frappe as Runtime["frappe"], globals, evalScript };
}
