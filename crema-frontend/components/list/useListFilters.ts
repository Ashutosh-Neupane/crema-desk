"use client";

/** The list's filters (kept in the URL: ?status=Draft or ?filters=[…]) and its ID / title search box. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Filter } from "@/lib/list/api";
import { filtersFromParams } from "@/components/list/filterModel";
import { listUrl } from "@/components/list/listModel";

export function useListFilters(doctype: string, titleField: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(
    () => filtersFromParams(doctype, new URLSearchParams(params.toString())),
    [doctype, params]
  );

  const urlQ = params.get("q") ?? "";
  const [search, setSearch] = useState(urlQ);
  // ?q= can change while this list stays mounted (awesomebar "<text> in <DocType>"): follow the URL
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (prevUrlQ !== urlQ) {
    setPrevUrlQ(urlQ);
    setSearch(urlQ);
  }
  const [debounced, setDebounced] = useState(() => urlQ.trim());
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const view = params.get("view");
  const setFilters = useCallback(
    (next: Filter[]) => router.replace(listUrl(pathname, next, search, view), { scroll: false }),
    [pathname, router, search, view]
  );
  const addFilter = useCallback(
    (f: Filter) => setFilters([...filters.filter((x) => !(x[1] === f[1] && x[2] === f[2])), f]),
    [filters, setFilters]
  );

  const searchFilter = useMemo<Filter[]>(
    () => (debounced ? [[doctype, titleField || "name", "like", `%${debounced}%`]] : []),
    [debounced, doctype, titleField]
  );
  const allFilters = useMemo(() => [...filters, ...searchFilter], [filters, searchFilter]);

  return {
    filters,
    setFilters,
    addFilter,
    allFilters,
    search,
    setSearch,
    debounced,
    view,
    wantNew: params.get("new") === "1",
  };
}
