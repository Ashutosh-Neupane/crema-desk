"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import type { DocTypeMeta } from "@/lib/frappe/types";

/** Fetch and cache DocType meta. Keyed by doctype name, cached 5 min. */
export function useDoctype(name: string) {
  return useQuery<DocTypeMeta>({
    queryKey: ["doctype", name],
    queryFn: () => fetchDoctypeMetaClient(name),
    staleTime: 5 * 60 * 1000,
    enabled: !!name,
  });
}
