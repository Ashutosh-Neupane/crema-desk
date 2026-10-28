"use client";

/** Dashboard / workspace widgets: chart card and number card (Desk's chart & number-card widgets). */
import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
import DeskChart from "@/components/desk/DeskChart";
import { useDashboardChart, useNumberCard } from "@/lib/hooks/useDashboardChart";
import { formatCompact, formatValue } from "@/lib/utils/formatNumber";

const TIMESPANS = ["Last Week", "Last Month", "Last Quarter", "Last Year"];

export function WidgetShell({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      <header className="mb-3 flex items-center gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</h3>
        <div className="ml-auto flex items-center gap-1">{action}</div>
      </header>
      {children}
    </section>
  );
}

export function ChartCard({ name, label, height = 240, className }: { name: string; label?: string; height?: number; className?: string }) {
  const [timespan, setTimespan] = useState<string | undefined>(undefined);
  const { data, isLoading, error } = useDashboardChart(name, { timespan });

  return (
    <WidgetShell
      title={label || name}
      className={className}
      action={
        data?.time_series ? (
          <select
            value={timespan ?? data.timespan ?? "Last Year"}
            onChange={(e) => setTimespan(e.target.value)}
            aria-label="Time span"
            className="rounded-md border border-zinc-200 bg-transparent px-1.5 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {[...new Set([...(data.timespan ? [data.timespan] : []), ...TIMESPANS])].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {isLoading ? (
        <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height }} />
      ) : error ? (
        <div className="flex items-center justify-center px-4 text-center text-sm text-zinc-500" style={{ height }}>
          {(error as Error).message}
        </div>
      ) : data ? (
        <DeskChart data={data} height={height} />
      ) : null}
    </WidgetShell>
  );
}

export function NumberCard({ name, label }: { name: string; label?: string }) {
  const { data, isLoading, error } = useNumberCard(name);
  const value = data?.value;
  const up = (data?.change ?? 0) >= 0;
  return (
    <section className="group relative min-w-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{data?.label ?? label ?? name}</h3>
        {data?.doctype && (
          <Link
            href={`/desk/doctype/${encodeURIComponent(data.doctype)}`}
            aria-label={`Open ${data.doctype} list`}
            className="text-zinc-300 opacity-0 transition-opacity hover:text-zinc-600 group-hover:opacity-100 dark:text-zinc-600 dark:hover:text-zinc-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {isLoading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : error ? (
        <p className="mt-2 text-xs text-zinc-500">{(error as Error).message}</p>
      ) : (
        <div className="mt-1.5 flex items-baseline gap-2">
          <span
            className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50"
            title={value != null ? formatValue(value, data?.fieldtype, data?.currency) : undefined}
          >
            {value == null
              ? "–"
              : data?.fieldtype === "Currency"
                ? `${data.currency ?? ""} ${formatCompact(value)}`.trim()
                : formatCompact(value)}
          </span>
          {data?.change != null && (
            <span className={`inline-flex items-center text-xs font-medium ${up ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(data.change).toFixed(1)}%
              <span className="ml-1 font-normal text-zinc-400">vs last {data.interval.toLowerCase().replace(/ly$/, "")}</span>
            </span>
          )}
        </div>
      )}
    </section>
  );
}
