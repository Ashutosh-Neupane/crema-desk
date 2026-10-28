"use client";

import { useQuery } from "@tanstack/react-query";
import { frappeGet } from "@/lib/frappe/client";

export function useDoctypes() {
  return useQuery({
    queryKey: ["doctypes-list"],
    queryFn: async () => {
      const data = await frappeGet<Array<{ name: string; module?: string }>>("DocType", {
        fields: JSON.stringify(["name", "module", "istable", "issingle"]),
        filters: JSON.stringify([["istable", "=", 0], ["issingle", "=", 0]]),
        order_by: "name asc",
        limit_page_length: 500,
      });
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
