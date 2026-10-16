"use client";

/** Parent + child-table metas for a form (child metas come from the same getdoctype call, cached). */
import { useQuery } from "@tanstack/react-query";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import type { DocTypeMeta } from "@/lib/frappe/types";

export function useFormMetas(doctype: string) {
  return useQuery<{ meta: DocTypeMeta; children: DocTypeMeta[] }>({
    queryKey: ["form-metas", doctype],
    queryFn: async () => {
      const meta = await fetchDoctypeMetaClient(doctype);
      const tables = [...new Set((meta.fields ?? []).filter((f) => f.fieldtype === "Table" || f.fieldtype === "Table MultiSelect").map((f) => String(f.options)))];
      const children = await Promise.all(tables.map((t) => fetchDoctypeMetaClient(t)));
      return { meta, children };
    },
    staleTime: 60_000,
  });
}
