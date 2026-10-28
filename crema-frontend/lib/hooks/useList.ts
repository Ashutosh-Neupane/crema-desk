"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchListClient, fetchCountClient } from "@/lib/frappe/list";
import type { FilterCondition, ListParams, FrappeDocument } from "@/lib/frappe/types";

export function useList<T = FrappeDocument>(doctype: string, params: ListParams) {
  return useQuery({
    queryKey: ["list", doctype, params],
    queryFn: async () => {
      const { data } = await fetchListClient<T>(doctype, params);
      return data;
    },
  });
}

export function useListCount(doctype: string, filters?: FilterCondition[]) {
  return useQuery({
    queryKey: ["count", doctype, filters],
    queryFn: () => fetchCountClient(doctype, filters),
  });
}
