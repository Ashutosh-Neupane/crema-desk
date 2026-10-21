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
import { MultiSelectDialog } from "./multiSelect";
import { makeLenientJQuery } from "./jquery";
import { deskRouteToUrl } from "@/lib/navigation/deskRoute";
import { DeskDialog, confirm as deskConfirm, prompt as deskPrompt } from "./dialogs";

export interface RuntimeContext {
  user: string;
  full_name?: string;
  roles?: string[];
  defaults?: Record<string, unknown>;
  sysdefaults?: Record<string, unknown>;
  /** extra frappe.boot keys (party_account_types, current_fiscal_year, …) */
  boot?: Record<string, unknown>;
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

/** Chainable no-op: callable, constructible, any property → itself */
export const NOOP: unknown = new Proxy(function () {}, {
  get: (_t, p) => (p === "prototype" ? {} : p === Symbol.toPrimitive ? () => "" : p === "then" || p === Symbol.iterator ? undefined : NOOP),
  apply: () => undefined,
  // `new frappe.RoleEditor(...)` → an object whose methods are no-ops too
  construct: () => NOOP as object,
});

/**
 * Namespace proxy: real members as-is, missing ones → NOOP. `deep` also wraps
 * nested namespaces (erpnext.utils.*); frappe is shallow so data maps like
 * frappe.listview_settings[dt] still return undefined for missing keys.
 */
export function lenient(obj: Record<string, unknown>, deep = true): Record<string, unknown> {
  return new Proxy(obj, {
    get(target, prop) {
      if (typeof prop === "symbol") return (target as Record<symbol, unknown>)[prop];
      if (!(prop in target)) return NOOP;
      const v = target[prop];
      return deep && v && typeof v === "object" && !Array.isArray(v) ? lenient(v as Record<string, unknown>) : v;
    },
  });
}

export interface Runtime {
  frappe: Record<string, unknown> & {
    listview_settings: Record<string, Record<string, unknown>>;
    ui: { form: { handlers: FormHandlers } };
  };
  globals: Record<string, unknown>;
  /** Evaluate app/client JS; errors are caught and reported, never thrown */
  evalScript: (code: string, label: string) => boolean;
  /** Evaluate a JS expression in the runtime scope (Desk: frappe.utils.eval); `eval:` prefix allowed. Errors → undefined */
  evalExpr: (expr: string, label?: string) => unknown;
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
    // registries app JS assigns into directly (Desk predefines them)
    listview_settings: {} as Record<string, Record<string, unknown>>,
    treeview_settings: {} as Record<string, Record<string, unknown>>,
    query_reports: {} as Record<string, Record<string, unknown>>,
    views: {} as Record<string, unknown>,
    flags: {} as Record<string, unknown>,
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
        MultiSelectDialog,
      },
      Dialog: DeskDialog,
      toolbar: {},
      // frappe/public/js/frappe/utils/user.js
      show_change_password_dialog(user: string, onSuccess?: () => unknown) {
        const d = new DeskDialog({
          title: __("Change Password"),
          fields: [
            { label: __("Set New Password"), fieldtype: "Password", fieldname: "new_password", reqd: 1 },
            { label: __("Logout From All Devices After Changing Password"), fieldtype: "Check", fieldname: "logout_all_sessions", default: 1 },
          ],
          primary_action_label: __("Change Password"),
          primary_action: async (values) => {
            await call({ method: "frappe.core.doctype.user.user.change_password", args: { user, new_password: values.new_password, logout_all_sessions: values.logout_all_sessions } });
            d.hide();
            toast.success(__("Password changed"));
            onSuccess?.();
          },
        });
        d.show();
        return d;
      },
    },
    provide,
    session: { user: ctx.user, user_fullname: ctx.full_name ?? ctx.user },
    user: {
      name: ctx.user,
      has_role: (r: string | string[]) => (Array.isArray(r) ? r : [r]).some((x) => ctx.roles?.includes(x)),
      is_report_manager: () => ["Administrator", "System Manager", "Report Manager"].some((x) => ctx.roles?.includes(x)),
      full_name: (u?: string) => (!u || u === ctx.user ? (ctx.full_name ?? ctx.user) : u),
    },
    user_roles: ctx.roles ?? [],
    boot: { ...(ctx.boot ?? {}), developer_mode: ctx.developer_mode ? 1 : 0, sysdefaults: ctx.sysdefaults ?? {}, user: { defaults: ctx.defaults ?? {}, roles: ctx.roles ?? [], in_create: [], can_create: [], can_read: [], ...(ctx.perms ?? {}) } },
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
      is_enabled: (k: string) => !!cint(frappe.defaults.get_default(k)),
    },
    tools: {
      /** CSV download of rows (Desk: frappe.tools.downloadify(data, roles, title)) */
      downloadify(data: unknown[][], _roles: unknown, title = "export") {
        const csv = (data ?? []).map((r) => r.map((c) => `"${cstr(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = `${title}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
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
      copy_to_clipboard: async (text: unknown) => {
        try {
          await navigator.clipboard.writeText(cstr(text));
          toast.success(__("Copied to clipboard."));
        } catch {
          toast.error(__("Could not copy to clipboard"));
        }
      },
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
      /** locals cache filled by with_doc (Desk: frappe.model.with_doc → locals[dt][dn]) */
      get_doc: (dt: string, dn: string) => ((globals.locals as Record<string, Record<string, unknown>> | undefined)?.[dt] ?? {})[dn],
      with_doc: async (dt: string, dn: string, cb?: (name: string, r: unknown) => unknown) => {
        const d = (await call({ method: "frappe.client.get", args: { doctype: dt, name: dn } })).message as Record<string, unknown>;
        const locals = (globals.locals ??= {}) as Record<string, Record<string, unknown>>;
        (locals[dt] ??= {})[dn] = d;
        cb?.(dn, d);
        return d;
      },
    },
    call,
    xcall: async (method: string, args?: Record<string, unknown>) => (await call({ method, args })).message,
    db: {
      get_single_value: async (doctype: string, field: string) =>
        (await call({ method: "frappe.client.get_single_value", args: { doctype, field } })).message,
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
      /** MultiSelectList options: [{ value, description }] */
      get_link_options: async (doctype: string, txt = "", filters: unknown = {}) =>
        (await call({ method: "frappe.desk.search.search_link", args: { doctype, txt, filters, page_length: 20 } })).message ?? [],
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
    get_meta: (dt: string) => metas[dt],
    get_doc: (dt: string, name: string) => ((globals.locals as Record<string, Record<string, unknown>>)?.[dt] ?? {})[name],
    get_list: (dt: string) => Object.values(((globals.locals as Record<string, Record<string, unknown>>)?.[dt] ?? {})),
    route_options: null as unknown,
    set_route: (...parts: unknown[]) => {
      // set_route("Form", dt, name) / ("List", dt, "Report") / ("query-report", r) / ("permission-manager", dt) /
      // ("/app/x/y"); pending frappe.route_options become ?field=value (list filters, new-form values)
      const last = parts[parts.length - 1];
      const trailing = last && typeof last === "object" && !Array.isArray(last) ? (last as Record<string, unknown>) : null;
      if (trailing) frappe.route_options = { ...((frappe.route_options as Record<string, unknown>) ?? {}), ...trailing };
      const flat = (trailing ? parts.slice(0, -1) : parts).flat().map(cstr);
      const p = flat.length === 1 && flat[0].includes("/") ? flat[0].replace(/^\/?(app|desk)\//, "").split("/").map(decodeURIComponent) : flat;
      const options = frappe.route_options as Record<string, unknown> | null;
      frappe.route_options = null;
      const url = deskRouteToUrl(p, options);
      if (url) ctx.navigate?.(url);
      return Promise.resolve();
    },
    new_doc: (dt: string) => ctx.navigate?.(`/desk/doctype/${encodeURIComponent(dt)}/new`),
    get_route: () => [],
    realtime: { on() {}, off() {} },
    require: () => Promise.resolve(),
    _: __,
  };

  // Desk namespaces are large: helpers Trevo hasn't shimmed are no-ops instead of TypeErrors that abort the
  // rest of a script (frappe.ui.form stays separate so its handlers Map is never proxied)
  const ns = frappe as unknown as Record<string, Record<string, unknown>>;
  ns.ui.form = lenient(ns.ui.form as Record<string, unknown>, false);
  for (const k of ["ui", "utils", "db", "defaults", "model", "meta", "user", "tools", "datetime"]) if (ns[k]) ns[k] = lenient(ns[k], false);

  Object.assign(globals, {
    // Desk's API is large: unknown frappe.* helpers become no-ops rather than aborting app scripts
    frappe: lenient(frappe as unknown as Record<string, unknown>, false),
    __,
    flt,
    cint,
    cstr,
    in_list,
    has_common: (a: unknown[], b: unknown[]) => (a ?? []).some((x) => (b ?? []).includes(x)),
    locals: {} as Record<string, unknown>,
    cur_frm: undefined,
    // Desk globals some scripts still call
    refresh_field: () => {},
    refresh_many: () => {},
    msgprint: (m: unknown) => (frappe.msgprint as (m: unknown) => void)(m),
    show_alert: (m: unknown) => (frappe.show_alert as (m: unknown) => void)(m),
    $: makeLenientJQuery(makeJQueryStub, NOOP),
    jQuery: undefined,
    format_currency: (v: unknown, currency?: string) => `${currency ?? ""} ${flt(v, 2).toLocaleString()}`.trim(),
  });
  globals.jQuery = globals.$;
  // App scripts call ERPNext bundle helpers (erpnext.utils.get_tree_options, …) we don't ship:
  // a lenient namespace turns missing ones into no-ops instead of aborting the script
  const erpnextUtils = provide("erpnext.utils");
  // erpnext.utils.get_fiscal_year from boot (Desk falls back to a sync ajax call we can't make)
  erpnextUtils.get_fiscal_year = (date?: string, withDates = false) => {
    const fy = ctx.boot?.current_fiscal_year as [string, string, string] | undefined;
    const d = date || datetime.get_today();
    if (!fy || d < fy[1] || d > fy[2]) return withDates ? ["", "", ""] : "";
    return withDates ? fy : fy[0];
  };
  globals.erpnext = lenient(provide("erpnext") as Record<string, unknown>);

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

  const evalExpr = (expr: string, label = "expression") => {
    const code = String(expr ?? "").replace(/^\s*eval:\s*/, "").trim();
    if (!code) return undefined;
    try {
      // eslint-disable-next-line no-new-func
      return new Function("__scope", `with (__scope) { return (${code}\n); }`)(scope); // react-doctor-disable-line no-eval
    } catch (err) {
      console.warn(`[desk-runtime] ${label} failed:`, err);
      return undefined;
    }
  };
  (frappe.utils as Record<string, unknown>).eval = (code: string) => evalExpr(code, "frappe.utils.eval");

  return { frappe: globals.frappe as Runtime["frappe"], globals, evalScript, evalExpr };
}
