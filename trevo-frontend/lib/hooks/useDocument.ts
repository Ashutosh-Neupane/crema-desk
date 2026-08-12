"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDocument, savedocs, cancelDoc, discardDoc } from "@/lib/frappe/document";
import { useDeskStore } from "@/lib/stores/desk.store";
import type { FrappeDocument } from "@/lib/frappe/types";

export function useDocument<T extends FrappeDocument = FrappeDocument>(
  doctype: string,
  name: string,
  fields?: string[],
  pollMs?: number,
) {
  return useQuery<T>({
    queryKey: ["document", doctype, name],
    queryFn: () => fetchDocument<T>(doctype, name, fields),
    enabled: !!doctype && !!name && name !== "new",
    refetchInterval: pollMs && pollMs > 0 ? pollMs : undefined,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useSaveDocument(doctype: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      doc: Record<string, unknown>;
      action?: "Save" | "Submit" | "Update";
    }) => {
      const { doc, action = "Save" } = params;
      return savedocs({ ...doc, doctype }, action);
    },
    onSuccess: (_data, vars) => {
      // Invalidate document cache
      queryClient.invalidateQueries({ queryKey: ["document", doctype] });
      queryClient.invalidateQueries({ queryKey: ["doc", doctype] });
      queryClient.invalidateQueries({ queryKey: ["list", doctype] });
      // Track recent doc
      if (vars.doc.name) {
        useDeskStore.getState().addRecentDoc({
          doctype,
          name: String(vars.doc.name),
          title: String(vars.doc.name),
        });
      }
    },
  });
}

export function useCancelDocument(doctype: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => cancelDoc(doctype, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", doctype] });
      queryClient.invalidateQueries({ queryKey: ["doc", doctype] });
      queryClient.invalidateQueries({ queryKey: ["list", doctype] });
    },
  });
}

export function useDiscardDocument(doctype: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => discardDoc(doctype, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", doctype] });
      queryClient.invalidateQueries({ queryKey: ["doc", doctype] });
      queryClient.invalidateQueries({ queryKey: ["list", doctype] });
    },
  });
}
