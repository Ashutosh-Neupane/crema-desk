"use client";

/**
 * frappe.listview_settings[doctype] — from the DocType's __list_js (+ custom
 * list scripts), evaluated in the desk runtime exactly as Desk loads them.
 * Gives add_fields, get_indicator, formatters, hide_name_column, filters, …
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createRuntime } from "@/lib/desk-runtime";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import type { DocTypeMeta } from "@/lib/frappe/types";

export function useListSettings(meta: DocTypeMeta | undefined): Record<string, unknown> | undefined {
  const { data: ctx } = useDeskContext();
  const router = useRouter();
  return useMemo(() => {
    if (!meta || !ctx) return undefined;
    const rt = createRuntime({
      user: ctx.user,
      full_name: ctx.full_name,
      roles: ctx.roles,
      defaults: ctx.defaults,
      sysdefaults: ctx.sysdefaults,
      metas: { [meta.name]: meta },
      navigate: (href) => router.push(href),
    });
    rt.evalScript(String(meta.__list_js ?? ""), `${meta.name} list js`);
    rt.evalScript(String(meta.__custom_list_js ?? ""), `${meta.name} custom list js`);
    return rt.frappe.listview_settings[meta.name] ?? {};
  }, [meta, ctx, router]);
}
