"use client";

/**
 * Phone (Desk: form/controls/phone.js + phone_picker): stored as "<isd>-<number>", e.g. "+977-9800000000"; countries
 * from frappe.geo.country_info.get_country_timezone_info (all of them, with flags); an empty field preselects the
 * site's country (System Settings → country, Desk set_default_country). A value without "-" is shown as typed.
 */
import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import type { FieldControlProps } from "./index";

type CountryInfo = Record<string, { code: string; isd?: string }>;

const flag = (code: string) => code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

export function splitPhone(value: string): { isd: string; number: string } {
  const parts = value.split("-");
  return parts.length === 2 && parts[0].startsWith("+") ? { isd: parts[0], number: parts[1] } : { isd: "", number: value };
}

export default function PhoneField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const str = typeof value === "string" ? value : value == null ? "" : String(value);
  const { data: countries } = useQuery({
    queryKey: ["country-info"],
    queryFn: async () => (await frappeMethod<{ country_info: CountryInfo }>("frappe.geo.country_info.get_country_timezone_info", {})).country_info ?? {},
    staleTime: Infinity,
  });
  const { data: ctx } = useDeskContext();
  const parsed = splitPhone(str);
  const defaultIsd = countries?.[String(ctx?.sysdefaults?.country ?? "")]?.isd ?? "";
  // an empty field starts on the site's country; a stored value keeps its own code (or none)
  const isd = str ? parsed.isd : defaultIsd;
  const readOnly = disabled || !!field.read_only;
  const options = Object.entries(countries ?? {})
    .filter(([, c]) => c.isd)
    .sort(([a], [b]) => a.localeCompare(b));

  const emit = (code: string, number: string) => onChange(number.trim() ? (code ? `${code}-${number.trim()}` : number.trim()) : "");

  if (readOnly) {
    return <div className="min-h-[38px] rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-200">{str ? (parsed.isd ? `${parsed.isd} ${parsed.number}` : str) : "—"}</div>;
  }
  const cls = `rounded-lg border bg-white px-2 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700"}`;

  return (
    <div className="flex gap-2">
      <select aria-label={`${field.label || field.fieldname} country code`} value={isd} onChange={(e) => emit(e.target.value, parsed.number)} className={`w-36 shrink-0 ${cls}`}>
        <option value="">—</option>
        {/* a stored code no country has (or before the list loads) stays selectable */}
        {isd && !options.some(([, c]) => c.isd === isd) && <option value={isd}>{isd}</option>}
        {options.map(([name, c]) => (
          <option key={name} value={c.isd}>
            {flag(c.code)} {name} {c.isd}
          </option>
        ))}
      </select>
      <input
        type="tel"
        id={inputId ?? field.fieldname}
        aria-label={field.label || field.fieldname}
        aria-required={!!field.reqd}
        aria-invalid={!!error}
        value={parsed.number}
        placeholder={String(field.placeholder ?? "")}
        onChange={(e) => emit(isd, e.target.value)}
        className={`min-w-0 flex-1 px-3 ${cls}`}
      />
    </div>
  );
}
