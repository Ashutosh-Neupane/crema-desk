"use client";

/**
 * Renders frappe.ui.form.MultiSelectDialog opened by scripts (e.g. ERPNext "Get Items From").
 * Same search as Desk: frappe.desk.search.search_widget with setters as filters and filter_fields.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { multiSelectStore, type MultiSelectDialog } from "@/lib/desk-runtime/multiSelect";
import { deskCall } from "@/lib/frappe/form";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { formatCell } from "@/lib/list/format";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import LinkInput from "@/components/list/LinkInput";
import type { DocField } from "@/lib/frappe/types";

const input = "h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default function MultiSelectHost() {
  const d = useSyncExternalStore(multiSelectStore.subscribe, multiSelectStore.get, () => null);
  const pathname = usePathname();
  // a dialog belongs to the form that opened it — close it when the route changes
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    d?.dialog.hide();
  }
  return d ? <MultiSelect key={d.id} d={d} /> : null;
}

function MultiSelect({ d }: { d: MultiSelectDialog }) {
  const { opts } = d;
  const { data: meta } = useDoctype(opts.doctype);

  // setters: { fieldname: default } or [{ fieldname, ... }] → filter controls with their DocField
  const setters = useMemo(() => {
    const list = Array.isArray(opts.setters)
      ? opts.setters.map((s) => ({ fieldname: s.fieldname, default: s.default, df: s as Partial<DocField> }))
      : Object.entries(opts.setters ?? {}).map(([fieldname, def]) => ({ fieldname, default: def, df: undefined as Partial<DocField> | undefined }));
    return list.map((s) => ({ ...s, df: { ...(meta?.fields?.find((f) => f.fieldname === s.fieldname) ?? {}), ...(s.df ?? {}) } as DocField }));
  }, [opts.setters, meta]);

  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(setters.map((s) => [s.fieldname, s.default ?? ""])));
  const [txt, setTxt] = useState("");
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterFields = setters.map((s) => s.fieldname);
  const columns = opts.columns ?? ["name", ...filterFields, ...(opts.date_field ? [opts.date_field] : [])];

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const q = opts.get_query?.() ?? {};
        const filters: unknown[][] = Object.entries(q.filters ?? {}).map(([k, v]) => (Array.isArray(v) ? [opts.doctype, k, v[0], v[1]] : [opts.doctype, k, "=", v]));
        for (const s of setters) {
          const v = values[s.fieldname];
          if (v === "" || v == null) continue;
          filters.push(s.df.fieldtype === "Data" ? [opts.doctype, s.fieldname, "like", `%${v}%`] : [opts.doctype, s.fieldname, "=", v]);
        }
        const { env } = await deskCall(
          "frappe.desk.search.search_widget",
          {
            doctype: opts.doctype,
            txt,
            filters: JSON.stringify(filters),
            filter_fields: JSON.stringify([...filterFields, ...(opts.date_field ? [opts.date_field] : [])]),
            page_length: 30,
            query: q.query ?? "",
            query_filters_as_dict: 1,
            as_dict: 1,
          },
          { get: true },
        );
        if (!cancelled) {
          setResults(((env.message as Array<Record<string, unknown>>) ?? []).filter((r) => r && r.name));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- values/txt drive searches; setters derive from opts
  }, [values, txt, meta]);

  const label = (fn: string) => (fn === "name" ? opts.doctype : (meta?.fields?.find((f) => f.fieldname === fn)?.label ?? fn));
  const toggle = (n: string) =>
    setSelected((s) => {
      const x = new Set(s);
      if (x.has(n)) x.delete(n);
      else x.add(n);
      return x;
    });
  const allOn = results.length > 0 && results.every((r) => selected.has(String(r.name)));

  return (
    <Dialog open onOpenChange={(o) => !o && d.dialog.hide()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select {opts.doctype}</DialogTitle>
          <DialogDescription>Pick one or more {opts.doctype} records to fetch items from.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input aria-label="Search" placeholder="Search" value={txt} onChange={(e) => setTxt(e.target.value)} className={`${input} pl-7`} />
          </div>
          {setters.map((s) => {
            const ro = opts.read_only_setters?.includes(s.fieldname);
            const v = String(values[s.fieldname] ?? "");
            const set = (nv: string) => setValues((x) => ({ ...x, [s.fieldname]: nv }));
            return s.df.fieldtype === "Link" && !ro ? (
              <LinkInput key={s.fieldname} doctype={String(s.df.options)} value={v} onChange={set} placeholder={s.df.label ?? s.fieldname} className="[&_input]:h-8 [&_input]:w-full" />
            ) : s.df.fieldtype === "Select" && !ro ? (
              <select key={s.fieldname} aria-label={s.df.label ?? s.fieldname} value={v} onChange={(e) => set(e.target.value)} className={input}>
                <option value="">{s.df.label ?? s.fieldname}</option>
                {String(s.df.options ?? "").split("\n").filter(Boolean).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input key={s.fieldname} aria-label={s.df.label ?? s.fieldname} placeholder={s.df.label ?? s.fieldname} value={v} readOnly={ro} onChange={(e) => set(e.target.value)} className={input} />
            );
          })}
        </div>
        <div className="max-h-[50vh] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm" aria-label={`${opts.doctype} results`}>
            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="w-8 px-2 py-2">
                  <input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(results.map((r) => String(r.name))))} />
                </th>
                {columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 text-left text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {label(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const n = String(r.name);
                return (
                  <tr key={n} onClick={() => toggle(n)} className={`cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40 ${selected.has(n) ? "bg-blue-50/60 dark:bg-blue-950/30" : ""}`}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" aria-label={`Select ${n}`} checked={selected.has(n)} onChange={() => toggle(n)} onClick={(e) => e.stopPropagation()} />
                    </td>
                    {columns.map((c) => {
                      const df = meta?.fields?.find((f) => f.fieldname === c);
                      return (
                        <td key={c} className="whitespace-nowrap px-3 py-1.5 text-zinc-800 dark:text-zinc-200">
                          {df ? formatCell(r[c], df, r) : String(r[c] ?? "")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!loading && !results.length && (
                <tr>
                  <td colSpan={columns.length + 1} className="p-6 text-center text-sm text-zinc-500">
                    {error ?? `No ${opts.doctype} found`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          {loading && <Loader2 className="mr-auto h-4 w-4 animate-spin text-zinc-400" aria-hidden />}
          <button type="button" onClick={() => d.dialog.hide()} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200">
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected.size}
            onClick={() => {
              d.setValues({ ...values });
              opts.action([...selected], { ...values });
            }}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {opts.primary_action_label ?? "Get Items"}
            {selected.size ? ` (${selected.size})` : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
