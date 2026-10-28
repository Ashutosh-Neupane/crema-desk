"use client";

/** Dashboard page — like Desk's /desk/dashboard-view/<name>: number cards, then charts by width. */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RefreshCw } from "lucide-react";
import { ChartCard, NumberCard } from "@/components/desk/Widgets";
import { safeDecode } from "@/lib/utils/safeDecode";

interface DashboardDoc {
  name: string;
  dashboard_name?: string;
  module?: string;
  charts?: Array<{ chart: string; width?: "Full" | "Half" }>;
  cards?: Array<{ card: string }>;
}

export default function DashboardPage() {
  const { name: raw } = useParams<{ name: string }>();
  const name = safeDecode(raw);
  const qc = useQueryClient();
  const { data: doc, isLoading, error } = useQuery<DashboardDoc>({
    queryKey: ["dashboard-doc", name],
    queryFn: async () => {
      const res = await fetch(`/api/frappe/api/resource/Dashboard/${encodeURIComponent(name)}`, { credentials: "include" });
      if (!res.ok) throw new Error(res.status === 404 ? `Dashboard "${name}" not found` : "Failed to load dashboard");
      return ((await res.json()) as { data: DashboardDoc }).data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />)}</div>
      </div>
    );
  }
  if (error || !doc) return <p className="p-6 text-sm text-red-600">{(error as Error)?.message}</p>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["dashboard-chart"] });
    qc.invalidateQueries({ queryKey: ["number-card"] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{doc.dashboard_name ?? doc.name}</h1>
          {doc.module && <p className="text-xs text-zinc-500">{doc.module} dashboard</p>}
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={refresh} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <Link href={`/desk/doctype/Dashboard/${encodeURIComponent(doc.name)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>
      </div>

      {!!doc.cards?.length && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {doc.cards.map((c) => <NumberCard key={c.card} name={c.card} />)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(doc.charts ?? []).map((c) => (
          <ChartCard key={c.chart} name={c.chart} className={c.width === "Full" ? "lg:col-span-2" : ""} />
        ))}
      </div>

      {!doc.cards?.length && !doc.charts?.length && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          This dashboard has no charts or number cards yet.{" "}
          <Link href={`/desk/doctype/Dashboard/${encodeURIComponent(doc.name)}`} className="font-medium text-zinc-900 underline dark:text-zinc-100">Add some</Link>
        </div>
      )}
    </div>
  );
}
