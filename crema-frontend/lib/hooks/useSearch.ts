"use client";

import { useQuery } from "@tanstack/react-query";
import { searchLink, globalSearch } from "@/lib/frappe/search";
import type { SearchLinkResult } from "@/lib/frappe/types";

export function useSearchLink(
  doctype: string,
  txt: string,
  opts?: { filters?: unknown; reference_doctype?: string },
) {
  return useQuery<SearchLinkResult[]>({
    queryKey: ["search_link", doctype, txt, opts?.filters],
    queryFn: () => searchLink(doctype, txt, opts),
    enabled: txt.length >= 1,
    staleTime: 30 * 1000, // 30 sec for autocomplete
  });
}

export function useGlobalSearch(txt: string) {
  return useQuery({
    queryKey: ["global_search", txt],
    queryFn: () => globalSearch(txt),
    enabled: txt.length >= 2,
    staleTime: 30 * 1000,
  });
}
