"use client";

/**
 * Image view (Desk: frappe/public/js/frappe/views/image/image_view.js) for DocTypes with an image_field:
 * a card grid of the image and title, with search, filters and paging like the list.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Filter as FilterIcon, ListFilter, Search, X } from "lucide-react";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { fetchCount, fetchRows, type Filter } from "@/lib/list/api";
import { FilterEditor, OPERATORS, describeValue, fieldLabel } from "@/components/list/filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";

const enc = encodeURIComponent;
const PAGE = 40;
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export default function ImageView({ doctype }: { doctype: string }) {
  const { data: meta, error } = useDoctype(doctype);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const imageField = typeof meta?.image_field === "string" ? meta.image_field : "";
  const titleField = typeof meta?.title_field === "string" && meta.title_field ? meta.title_field : "name";
  const all = useMemo<Filter[]>(() => [...filters, ...(q.trim() ? [[doctype, titleField, "like", `%${q.trim()}%`] as Filter] : [])], [filters, q, doctype, titleField]);

  const rowsQ = useQuery({
    queryKey: ["image-view", doctype, all, limit],
    enabled: !!meta && !!imageField,
    placeholderData: keepPreviousData,
    queryFn: () => fetchRows({ doctype, fields: [...new Set(["name", "modified", imageField, titleField])], filters: all, orderBy: `\`tab${doctype}\`.\`modified\` desc`, start: 0, pageLength: limit }),
  });
  const countQ = useQuery({ queryKey: ["image-view-count", doctype, all], enabled: !!meta, queryFn: () => fetchCount(doctype, all) });
  const rows = rowsQ.data ?? [];

  if (error) return <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>;
  if (!meta) return <div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  if (!imageField) return <p className="p-6 text-sm text-zinc-500">{doctype} has no image field.</p>;

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-500">
            <Link href={`/desk/doctype/${enc(doctype)}`} className="hover:underline">
              {doctype}
            </Link>
            {" / Images"}
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{doctype}</h1>
        </div>
        <nav aria-label="Views" className="flex rounded-md border border-zinc-200 p-0.5 text-sm dark:border-zinc-700">
          <Link href={`/desk/doctype/${enc(doctype)}${meta.is_tree ? "?view=list" : ""}`} prefetch={false} className="rounded px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            List
          </Link>
          <span aria-current="page" className="rounded bg-zinc-100 px-2.5 py-1 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            Image
          </span>
        </nav>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${fieldLabel(meta, titleField)}`} aria-label="Search" className="h-8 w-52 rounded-md border border-zinc-200 bg-white pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <Popover>
          <PopoverTrigger className={btn}>
            <FilterIcon className="h-3.5 w-3.5" aria-hidden /> Filter
            {filters.length > 0 && <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">{filters.length}</span>}
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <FilterEditor meta={meta} onAdd={(f) => setFilters((fs) => [...fs.filter((x) => !(x[1] === f[1] && x[2] === f[2])), f])} />
          </PopoverContent>
        </Popover>
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f, i) => (
            <span key={`${f[1]}|${f[2]}|${JSON.stringify(f[3])}`} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <ListFilter className="h-3 w-3 text-zinc-400" aria-hidden />
              <span className="font-medium">{fieldLabel(meta, f[1])}</span>
              <span className="text-zinc-400">{OPERATORS.find((o) => o.op === f[2])?.label ?? f[2]}</span>
              <span>{describeValue(f[3]).replace(/^%|%$/g, "")}</span>
              <button type="button" onClick={() => setFilters(filters.filter((_, j) => j !== i))} aria-label={`Remove ${fieldLabel(meta, f[1])} filter`} className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" aria-label={`${doctype} images`}>
        {rows.map((r) => {
          const img = typeof r[imageField] === "string" ? (r[imageField] as string) : "";
          const title = String(r[titleField] || r.name);
          return (
            <li key={r.name}>
              <Link href={`/desk/doctype/${enc(doctype)}/${enc(r.name)}`} className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
                <div className="flex aspect-square items-center justify-center bg-zinc-50 dark:bg-zinc-800/60">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served by the Frappe file proxy at runtime
                    <img src={img} alt={title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-semibold uppercase text-zinc-300 dark:text-zinc-600" aria-hidden>
                      {title.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="truncate px-3 py-2 text-sm font-medium text-zinc-800 group-hover:underline dark:text-zinc-200">{title}</div>
              </Link>
            </li>
          );
        })}
      </ul>
      {!rowsQ.isLoading && !rows.length && <p className="py-10 text-center text-sm text-zinc-500">No {doctype} found</p>}
      {rows.length < (countQ.data ?? 0) && (
        <div className="text-center">
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className={btn}>
            Load more ({(countQ.data ?? 0) - rows.length} left)
          </button>
        </div>
      )}
    </div>
  );
}
