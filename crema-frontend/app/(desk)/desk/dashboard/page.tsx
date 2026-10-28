"use client";

/** All dashboards the user can read, plus New Dashboard (Dashboard DocType form). */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Plus } from "lucide-react";

export default function DashboardsPage() {
  const { data, isLoading } = useQuery<Array<{ name: string; module?: string; is_default?: 0 | 1 }>>({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const params = new URLSearchParams({ fields: JSON.stringify(["name", "module", "is_default"]), limit_page_length: "200", order_by: "name asc" });
      const res = await fetch(`/api/frappe/api/resource/Dashboard?${params}`, { credentials: "include" });
      return res.ok ? ((await res.json()) as { data: [] }).data : [];
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Dashboards</h1>
        <Link href="/desk/doctype/Dashboard/new" className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
          <Plus className="h-4 w-4" /> New Dashboard
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? [0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />)
          : (data ?? []).map((d) => (
              <Link key={d.name} href={`/desk/dashboard/${encodeURIComponent(d.name)}`} className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <LayoutDashboard className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{d.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{d.module ?? "Custom"}{d.is_default ? " · default" : ""}</span>
                </span>
              </Link>
            ))}
      </div>
    </div>
  );
}
