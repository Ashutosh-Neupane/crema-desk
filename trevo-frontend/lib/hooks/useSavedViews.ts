"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SavedView {
  name: string;
  reference_doctype: string;
  fields?: string;
  filters?: string;
  sort_by?: string;
  sort_order?: string;
  group_by?: string;
}

export function useSavedViews(doctype: string) {
  return useQuery<SavedView[]>({
    queryKey: ["saved-views", doctype],
    queryFn: async () => {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/views`);
      const json = await res.json();
      return json.views ?? [];
    },
    staleTime: 60_000,
  });
}

export function useCreateSavedView(doctype: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (view: Omit<SavedView, "reference_doctype">) => {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(view),
      });
      if (!res.ok) throw new Error("Failed to save view");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-views", doctype] }),
  });
}

export function useDeleteSavedView(doctype: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (viewName: string) => {
      const res = await fetch(
        `/api/doctype/${encodeURIComponent(doctype)}/views?name=${encodeURIComponent(viewName)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete view");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-views", doctype] }),
  });
}
