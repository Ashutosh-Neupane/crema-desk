"use client";

/**
 * Image view (Desk: frappe/public/js/frappe/views/image/image_view.js) for DocTypes with an image_field:
 * a card grid of the image and title, with search, filters and paging like the list.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useDoctype } from "@/lib/hooks/useDoctype";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { fetchCount, fetchRows, type Filter } from "@/lib/list/api";
import { fieldLabel } from "@/components/list/filters";
import { FilterButton, FilterPills } from "./parts/FilterBar";
import { doctypeUrl } from "@/lib/navigation/deskUrl";
import { ViewMenu } from "@/components/views/ViewMenu";

const enc = encodeURIComponent;
const PAGE = 40;
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

type Row = Awaited<ReturnType<typeof fetchRows>>[number];

/** rows (paged like the list) + total count for the image grid */
function useImageRows(doctype: string, meta: DocTypeMeta | undefined, imageField: string, titleField: string, filters: Filter[], q: string) {
  const [limit, setLimit] = useState(PAGE);
  const all = useMemo<Filter[]>(() => [...filters, ...(q.trim() ? [[doctype, titleField, "like", `%${q.trim()}%`] as Filter] : [])], [filters, q, doctype, titleField]);
  const rowsQ = useQuery({
    queryKey: ["image-view", doctype, all, limit],
    enabled: !!meta && !!imageField,
    placeholderData: keepPreviousData,
    queryFn: () => fetchRows({ doctype, fields: [...new Set(["name", "modified", imageField, titleField])], filters: all, orderBy: `\`tab${doctype}\`.\`modified\` desc`, start: 0, pageLength: limit }),
  });
  const countQ = useQuery({ queryKey: ["image-view-count", doctype, all], enabled: !!meta, queryFn: () => fetchCount(doctype, all) });
  return { rows: rowsQ.data ?? [], loading: rowsQ.isLoading, total: countQ.data ?? 0, more: () => setLimit((l) => l + PAGE) };
}

export default function ImageView({ doctype }: { doctype: string }) {
  const { data: meta, error } = useDoctype(doctype);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [q, setQ] = useState("");
  const imageField = typeof meta?.image_field === "string" ? meta.image_field : "";
  const titleField = typeof meta?.title_field === "string" && meta.title_field ? meta.title_field : "name";
  const { rows, loading, total, more } = useImageRows(doctype, meta, imageField, titleField, filters, q);

  if (error) return <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>;
  if (!meta) return <div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  if (!imageField) return <p className="p-6 text-sm text-zinc-500">{doctype} has no image field.</p>;

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-500">
            <Link href={`${doctypeUrl(doctype)}`} className="hover:underline">
              {doctype}
            </Link>
            {" / Images"}
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{doctype}</h1>
        </div>
        <ViewMenu meta={meta} doctype={doctype} current="image" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${fieldLabel(meta, titleField)}`} aria-label="Search" className="h-8 w-52 rounded-md border border-zinc-200 bg-white pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <FilterButton meta={meta} filters={filters} setFilters={setFilters} className={btn} />
      </div>

      <FilterPills meta={meta} filters={filters} setFilters={setFilters} />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" aria-label={`${doctype} images`}>
        {rows.map((r) => (
          <ImageCard key={r.name} row={r} doctype={doctype} imageField={imageField} titleField={titleField} />
        ))}
      </ul>
      {!loading && !rows.length && <p className="py-10 text-center text-sm text-zinc-500">No {doctype} found</p>}
      {rows.length < total && (
        <div className="text-center">
          <button type="button" onClick={more} className={btn}>
            Load more ({total - rows.length} left)
          </button>
        </div>
      )}
    </div>
  );
}

function ImageCard({ row, doctype, imageField, titleField }: { row: Row; doctype: string; imageField: string; titleField: string }) {
  const img = typeof row[imageField] === "string" ? (row[imageField] as string) : "";
  const title = String(row[titleField] || row.name);
  return (
    <li>
      <Link href={`${doctypeUrl(doctype)}/${enc(row.name)}`} className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
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
}
