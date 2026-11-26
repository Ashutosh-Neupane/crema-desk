"use client";

/** __dashboard → Connections: related doctypes with counts (frappe.desk.notifications.get_open_count) */
import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { deskCall, isNewDoc, type Doc } from "@/lib/frappe/form";
import type { DocTypeMeta } from "@/lib/frappe/types";

const enc = encodeURIComponent;

type Dashboard = { fieldname?: string; non_standard_fieldnames?: Record<string, string>; transactions?: Array<{ label?: string; items: string[] }> };

export default function Connections({ meta, doc }: { meta: DocTypeMeta; doc: Doc }) {
  const dash = (meta as { __dashboard?: Dashboard }).__dashboard;
  const items = useMemo(() => (dash?.transactions ?? []).flatMap((t) => t.items), [dash]);
  const { data: counts } = useQuery({
    queryKey: ["open-count", meta.name, doc.name],
    enabled: !!items.length && !isNewDoc(doc),
    queryFn: async () => {
      const { env } = await deskCall("frappe.desk.notifications.get_open_count", { doctype: meta.name, name: doc.name, items: JSON.stringify(items) });
      const count = (env.message as { count?: Array<{ name: string; count: number }> } | undefined)?.count ?? [];
      return Object.fromEntries(count.map((c) => [c.name, c.count]));
    },
  });
  if (!dash?.transactions?.length || isNewDoc(doc)) return null;
  const fieldFor = (dt: string) => dash.non_standard_fieldnames?.[dt] ?? dash.fieldname ?? "";
  return (
    <div className="grid grid-cols-1 gap-x-column gap-y-field p-section sm:grid-cols-2 lg:grid-cols-3">
      {dash.transactions.map((t) => (
        <div key={t.label ?? t.items.join(",")}>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">{t.label}</h4>
          <ul className="space-y-1">
            {t.items.map((dt) => (
              <li key={dt} className="flex items-center gap-2">
                <Link href={`/desk/doctype/${enc(dt)}?${new URLSearchParams({ [fieldFor(dt)]: doc.name })}`} className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  <span className="flex-1 truncate">{dt}</span>
                  {!!counts?.[dt] && <span className="rounded-full bg-zinc-100 px-1.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{counts[dt]}</span>}
                </Link>
                <Link href={`/desk/doctype/${enc(dt)}/new`} aria-label={`New ${dt}`} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
