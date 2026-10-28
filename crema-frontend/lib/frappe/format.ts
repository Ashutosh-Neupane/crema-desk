/**
 * Value formatting from the site's settings — a transcription of Desk's
 * frappe/public/js/frappe/utils/number_format.js, form/formatters.js and utils/datetime.js (no moment.js):
 * number formats (`#,##,###.##` Indian/Nepali grouping, `#.###,##`, …), rounding methods, currency symbol and
 * per-currency number format, float/currency precision, date/time formats and system → user time zone.
 *
 * Settings come from the desk boot (sysdefaults, time_zone, `:Currency` / `:Company` docs) via
 * setFormatSettings(), called when the desk context loads (lib/hooks/useDeskContext.ts).
 * Output is plain text (Desk's formatters return HTML; Crema renders the text itself).
 */

type Doc = Record<string, unknown>;
/** the DocField bits formatting reads */
export interface FieldLike {
  fieldtype?: string;
  options?: unknown;
  precision?: unknown;
  hide_days?: unknown;
  hide_seconds?: unknown;
}
export interface FormatSettings {
  sysdefaults: Record<string, unknown>;
  /** frappe.boot.time_zone */
  timeZone?: { system?: string; user?: string };
  /** user defaults (company, currency, …) for get_field_currency */
  defaults?: Record<string, unknown>;
  /** boot.docs keyed by doctype (with the leading ":" removed) then name — Currency, Company */
  docs?: Record<string, Record<string, Doc>>;
}

let settings: FormatSettings = { sysdefaults: {} };
export function setFormatSettings(s: FormatSettings) {
  settings = s;
}
export const getFormatSettings = () => settings;

const cstr = (v: unknown) => (v == null ? "" : String(v));
const cint = (v: unknown) => {
  const n = parseInt(cstr(v), 10);
  return Number.isFinite(n) ? n : 0;
};
const sys = (k: string) => settings.sysdefaults?.[k];
const userDefault = (k: string) => {
  const hit = Object.entries(settings.defaults ?? {}).find(([key]) => key.toLowerCase() === k.toLowerCase())?.[1];
  return Array.isArray(hit) ? hit[0] : hit;
};
const getDefault = (k: string) => userDefault(k) ?? sys(k);

/** frappe.model.get_value over boot docs (":Currency", "Company", …) */
export function bootValue(doctype: string, name: unknown, field: string): unknown {
  const dt = doctype.replace(/^:/, "");
  return settings.docs?.[dt]?.[cstr(name)]?.[field];
}

// ── numbers ──────────────────────────────────────────────────────────────────
const NUMBER_FORMAT_INFO: Record<string, { decimal_str: string; group_sep: string }> = {
  "#,###.##": { decimal_str: ".", group_sep: "," },
  "#.###,##": { decimal_str: ",", group_sep: "." },
  "# ###.##": { decimal_str: ".", group_sep: " " },
  "# ###,##": { decimal_str: ",", group_sep: " " },
  "#'###.##": { decimal_str: ".", group_sep: "'" },
  "#, ###.##": { decimal_str: ".", group_sep: ", " },
  "#,##,###.##": { decimal_str: ".", group_sep: "," },
  "#,###.###": { decimal_str: ".", group_sep: "," },
  "#.###": { decimal_str: "", group_sep: "." },
  "#,###": { decimal_str: "", group_sep: "," },
};

export function getNumberFormat(currency?: string): string {
  const fromCurrency = cint(getDefault("use_number_format_from_currency")) && currency ? cstr(bootValue("Currency", currency, "number_format")).replace(/\\/g, "") : "";
  return fromCurrency || cstr(sys("number_format")) || "#,###.##";
}

export function getNumberFormatInfo(format?: string) {
  const f = format || getNumberFormat();
  const info = { ...(NUMBER_FORMAT_INFO[f] ?? { decimal_str: ".", group_sep: "," }), precision: 0 };
  info.precision = info.decimal_str === "" ? 0 : (f.split(info.decimal_str).slice(1)[0] ?? "").length;
  return info;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function stripNumberGroups(v: string, format?: string): string {
  const info = getNumberFormatInfo(format);
  let s = v.replace(new RegExp(escapeRe(info.group_sep), "g"), "");
  if (info.decimal_str !== "." && info.decimal_str !== "") s = s.replace(new RegExp(escapeRe(info.decimal_str), "g"), ".");
  return s;
}

/** Desk's _round: Banker's Rounding (legacy) / Banker's Rounding / Commercial Rounding (System Settings) */
export function round(num: number, precision?: number | null, method?: string): number {
  const rm = method || cstr(sys("rounding_method")) || "Banker's Rounding (legacy)";
  const neg = num < 0;
  if (rm === "Banker's Rounding") {
    if (num === 0) return 0;
    const m = 10 ** cint(precision);
    const x = Math.abs(num) * m;
    const floor = Math.floor(x);
    const epsilon = 2 ** (Math.log2(Math.abs(x)) - 52);
    const tie = epsilon < 0.5 ? Math.abs(x - floor - 0.5) < epsilon : x - floor === 0.5;
    const r = (tie ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(x)) / m;
    return neg ? -r : r;
  }
  if (rm === "Commercial Rounding") {
    if (num === 0) return 0;
    const m = 10 ** cint(precision);
    const x = num * m;
    let epsilon = 2 ** (Math.log2(Math.abs(x)) - 52);
    if (epsilon >= 0.25) epsilon = 0;
    return (Math.sign(x) * Math.round(Math.abs(x) + epsilon)) / m;
  }
  // Banker's Rounding (legacy)
  const d = cint(precision);
  const m = 10 ** d;
  const n = +(d ? Math.abs(num) * m : Math.abs(num)).toFixed(8);
  const i = Math.floor(n);
  const f = n - i;
  let r = !precision && f === 0.5 ? (i % 2 === 0 ? i : i + 1) : Math.round(n);
  r = d ? r / m : r;
  return neg ? -r : r;
}

/** Desk's flt(v, decimals, number_format, rounding_method) */
export function flt(v: unknown, decimals?: number | null, numberFormat?: string, roundingMethod?: string): number {
  if (v == null || v === "") return 0;
  let n: number;
  if (typeof v === "number") n = v;
  else {
    let s = cstr(v);
    if (s.includes(" ")) {
      // strip a currency symbol ("₹ 1,000"); a space can also be a group separator
      const parts = s.split(" ");
      s = Number.isNaN(parseFloat(parts[0])) ? parts.slice(parts.length - 1).join(" ") : s;
    }
    n = parseFloat(stripNumberGroups(s, numberFormat));
    if (Number.isNaN(n)) n = 0;
  }
  if (!Number.isFinite(n)) n = 0;
  return decimals != null ? round(n, decimals, roundingMethod) : n;
}

/** Desk's window.format_number */
export function formatNumber(v: unknown, format?: string | null, decimals?: number | null): string {
  let fmt = format ?? "";
  let dec = decimals;
  if (!fmt) {
    fmt = getNumberFormat();
    if (dec == null) dec = cint(getDefault("float_precision")) || 3;
  }
  const info = getNumberFormatInfo(fmt);
  if (dec == null) dec = info.precision;
  let n = flt(v, dec, fmt);
  const neg = n < 0;
  n = Math.abs(n);
  const part = n.toFixed(dec).split(".");
  if (info.group_sep) {
    const int = part[0];
    let out = "";
    if (fmt === "#,##,###.##") {
      // last three digits, then groups of two (lakh / crore)
      const last = int.slice(-3);
      const rest = int.slice(0, -3);
      out = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, info.group_sep)}${info.group_sep}${last}` : last;
    } else out = int.replace(/\B(?=(\d{3})+(?!\d))/g, info.group_sep);
    part[0] = out;
  }
  if (part[0] === "") part[0] = "0";
  const decimal = part[1] && info.decimal_str ? info.decimal_str + part[1] : "";
  return (neg ? "-" : "") + part[0] + decimal;
}

export function getCurrencySymbol(currency?: string): string | null {
  if (["1", "Yes"].includes(cstr(sys("hide_currency_symbol")))) return null;
  const cur = currency || cstr(sys("currency"));
  return cstr(bootValue("Currency", cur, "symbol")) || cur || null;
}

/** Desk's format_currency */
export function formatCurrency(v: unknown, currency?: string, decimals?: number | null): string {
  const format = getNumberFormat(currency);
  const symbol = getCurrencySymbol(currency);
  let dec = decimals;
  if (dec === undefined) dec = cint(sys("currency_precision")) || null;
  const num = formatNumber(v, format, dec);
  if (!symbol) return num;
  return cint(bootValue("Currency", currency, "symbol_on_right")) ? `${num} ${symbol}` : `${symbol} ${num}`;
}

/** frappe.meta.get_field_currency: options "currency" (a field), "Company:company:default_currency", or default */
export function getFieldCurrency(df: FieldLike, doc?: Doc, fallback?: string): string {
  const opt = cstr(df?.options).trim();
  let currency = "";
  if (opt.includes(":")) {
    const [dt, linkField, valueField] = opt.split(":");
    if (valueField) {
      const docname = doc?.[linkField] || userDefault(linkField);
      currency = cstr(bootValue(dt, docname, valueField));
    }
  } else if (opt && doc?.[opt]) currency = cstr(doc[opt]);
  return currency || fallback || cstr(sys("currency")) || "USD";
}

/** frappe.meta.get_field_precision */
export function getFieldPrecision(df: FieldLike, doc?: Doc): number {
  if (df?.precision !== undefined && df?.precision !== null && cstr(df.precision) !== "") return cint(df.precision);
  if (df?.fieldtype === "Currency") {
    const cp = getDefault("currency_precision");
    if (cp !== null && cp !== undefined && cp !== "") return cint(cp);
    return getNumberFormatInfo(getNumberFormat(getFieldCurrency(df, doc))).precision;
  }
  return cint(getDefault("float_precision")) || 3;
}

// ── dates ────────────────────────────────────────────────────────────────────
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
interface Wall {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

function parseWall(v: string): Wall | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v.trim());
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
}

function wallIn(epoch: number, tz: string): Wall {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(epoch))
      .map((p) => [p.type, p.value]),
  );
  return { y: +parts.year, mo: +parts.month, d: +parts.day, h: +parts.hour % 24, mi: +parts.minute, s: +parts.second };
}

const wallUtc = (w: Wall) => Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
/** epoch of a wall-clock time in `tz` (moment.tz(str, tz)) */
function epochOf(w: Wall, tz: string): number {
  const guess = wallUtc(w);
  const off = wallUtc(wallIn(guess, tz)) - guess;
  let epoch = guess - off;
  const off2 = wallUtc(wallIn(epoch, tz)) - epoch;
  if (off2 !== off) epoch = guess - off2;
  return epoch;
}

const wallStr = (w: Wall) => `${w.y}-${pad(w.mo)}-${pad(w.d)} ${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}`;

function convertTz(v: unknown, from?: string, to?: string): string {
  const s = cstr(v);
  const w = parseWall(s);
  if (!w) return s;
  if (!from || !to || from === to) return wallStr(w);
  try {
    return wallStr(wallIn(epochOf(w, from), to));
  } catch {
    return wallStr(w);
  }
}

/** frappe.datetime.convert_to_user_tz: DB datetimes are in the system time zone */
export const convertToUserTz = (v: unknown) => convertTz(v, settings.timeZone?.system, settings.timeZone?.user);
/** frappe.datetime.convert_to_system_tz: what a user types is in their own time zone */
export const convertToSystemTz = (v: unknown) => convertTz(v, settings.timeZone?.user, settings.timeZone?.system);

export const userDateFormat = () => cstr(sys("date_format")) || "yyyy-mm-dd";
export const userTimeFormat = () => cstr(sys("time_format")) || "HH:mm:ss";

function fmtDate(w: Wall, format = userDateFormat()): string {
  return format.replace(/yyyy/i, String(w.y)).replace(/mm/i, pad(w.mo)).replace(/dd/i, pad(w.d));
}
function fmtTime(w: Wall, format = userTimeFormat()): string {
  const h12 = w.h % 12 || 12;
  return format
    .replace(/HH/g, pad(w.h))
    .replace(/hh/g, pad(h12))
    .replace(/mm/g, pad(w.mi))
    .replace(/ss/g, pad(w.s))
    .replace(/\bA\b/g, w.h < 12 ? "AM" : "PM")
    .replace(/\ba\b/g, w.h < 12 ? "am" : "pm");
}

/** frappe.datetime.str_to_user(val, only_time, only_date) */
export function strToUser(v: unknown, onlyTime = false, onlyDate = false): string {
  const s = cstr(v).trim();
  if (!s) return "";
  if (onlyTime) {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
    return m ? fmtTime({ y: 0, mo: 0, d: 0, h: +m[1], mi: +m[2], s: +(m[3] ?? 0) }) : s;
  }
  const w = parseWall(s);
  if (!w) return s;
  if (onlyDate || !s.includes(" ")) return fmtDate(w);
  const u = parseWall(convertToUserTz(s))!;
  return `${fmtDate(u)} ${fmtTime(u)}`;
}

/** frappe.datetime.user_to_str: the user's date (and time) format → yyyy-mm-dd[ HH:mm:ss] */
export function userToStr(v: unknown, onlyTime = false): string {
  const s = cstr(v).trim();
  if (!s) return "";
  if (onlyTime) {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?/i.exec(s);
    if (!m) return s;
    let h = +m[1];
    if (m[4]) h = (h % 12) + (/p/i.test(m[4]) ? 12 : 0);
    return `${pad(h)}:${m[2]}:${m[3] ?? "00"}`;
  }
  const [datePart, ...timeParts] = s.split(" ");
  const order = userDateFormat().toLowerCase().split(/[^a-z]+/);
  const nums = datePart.split(/[^0-9]+/);
  const get = (k: string) => nums[order.indexOf(k)] ?? "";
  let y = get("yyyy");
  if (y.length === 2) y = `20${y}`;
  const date = `${y}-${pad(+get("mm"))}-${pad(+get("dd"))}`;
  return timeParts.length ? `${date} ${userToStr(timeParts.join(" "), true)}` : date;
}

// ── frappe.form.formatters (plain text) ─────────────────────────────────────
export interface FormatOptions {
  /** fallback currency when the field doesn't name one (list default currency) */
  currency?: string;
  always_show_decimals?: boolean;
}

function formatDuration(v: unknown, df?: FieldLike): string {
  let secs = Math.round(flt(v));
  if (!secs) return "0s";
  const out: string[] = [];
  if (!df?.hide_days) {
    const d = Math.floor(secs / 86400);
    secs %= 86400;
    if (d) out.push(`${d}d`);
  }
  const h = Math.floor(secs / 3600);
  secs %= 3600;
  const m = Math.floor(secs / 60);
  secs %= 60;
  if (h) out.push(`${h}h`);
  if (m) out.push(`${m}m`);
  if (!df?.hide_seconds && secs) out.push(`${secs}s`);
  return out.join(" ") || "0s";
}

/** frappe.format(value, df, options, doc) as text */
export function formatValue(value: unknown, df: FieldLike, doc: Doc = {}, opts: FormatOptions = {}): string {
  if (value === null || value === undefined) return "";
  switch (df.fieldtype) {
    case "Currency": {
      if (value === "") return "";
      const currency = getFieldCurrency(df, doc, opts.currency);
      let precision = df.precision !== undefined && df.precision !== null && cstr(df.precision) !== "" ? cint(df.precision) : getFieldPrecision(df, doc);
      // Desk: precision > 2 keeps the DB's decimals unless the currency's fraction needs more
      if (precision > 2) {
        const decimals = cstr(value).split(".")[1] ?? "";
        if (decimals.length < 3 || decimals.length < precision) {
          const fraction = cstr(bootValue("Currency", currency, "fraction_units") || 100);
          if (decimals.length < fraction.length) precision = fraction.length - 1;
        }
      }
      return formatCurrency(value, currency, precision);
    }
    case "Float": {
      if (value === "") return "";
      let precision: number | null = cint(df.precision) || cint(sys("float_precision")) || null;
      if (cstr(df.options).trim()) return formatValue(value, { ...df, fieldtype: "Currency", precision: precision ?? undefined }, doc, opts);
      if (!opts.always_show_decimals && flt(value) % 1 === 0) precision = 0;
      return formatNumber(value, null, precision);
    }
    case "Int":
      return value === "" ? "" : String(cint(value));
    case "Percent": {
      if (value === "") return "";
      const [mantissa, exponent] = cstr(value).toLowerCase().split("e");
      const valuePrecision = Math.max((mantissa.split(".")[1]?.length ?? 0) - cint(exponent), 0);
      const precision = cint(df.precision) || cint(sys("float_precision")) || 2;
      return `${formatNumber(value, null, Math.min(precision, valuePrecision))}%`;
    }
    case "Check":
      return cint(value) ? "✓" : "";
    case "Date":
      return strToUser(value, false, true);
    case "Datetime": {
      if (!value) return "";
      const w = parseWall(convertToUserTz(value));
      return w ? `${fmtDate(w)} ${fmtTime(w)}` : cstr(value);
    }
    case "Time":
      return strToUser(value, true);
    case "Duration":
      return formatDuration(value, df);
    case "Rating":
      return "★".repeat(Math.round(flt(value) * cint(df.options || 5)));
    case "Text Editor":
    case "HTML Editor":
    case "Small Text":
    case "Text":
    case "Long Text":
      return cstr(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    default:
      return cstr(value);
  }
}
