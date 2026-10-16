"use client";

/**
 * Renders a Frappe Dashboard Chart result ({ type, labels, datasets }) with
 * recharts — line / bar / donut / pie / percentage (heatmap falls back to bar).
 * Colors come from the --series-N tokens (validated light/dark steps); text uses
 * text tokens, never series colors; grid and axes stay recessive.
 */
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartResult } from "@/lib/hooks/useDashboardChart";
import { formatCompact, formatValue } from "@/lib/utils/formatNumber";

export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

const axisProps = {
  stroke: "var(--chart-grid)",
  tick: { fill: "var(--chart-axis)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({
  active,
  payload,
  label,
  fieldtype,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
  fieldtype?: string;
  currency?: string | null;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {label != null && <div className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-4 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatValue(p.value ?? 0, fieldtype, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DeskChart({
  data,
  height = 260,
  currency,
}: {
  data: ChartResult;
  height?: number;
  currency?: string | null;
}) {
  const rows = useMemo(
    () =>
      data.labels.map((label, i) => {
        const row: Record<string, string | number> = { label };
        data.datasets.forEach((d, j) => (row[`s${j}`] = d.values[i] ?? 0));
        return row;
      }),
    [data],
  );

  const empty = !data.labels.length || !data.datasets.length || data.datasets.every((d) => d.values.every((v) => !v));
  if (empty) {
    return (
      <div className="flex items-center justify-center text-sm text-zinc-400" style={{ height }}>
        No data for this period
      </div>
    );
  }

  const multi = data.datasets.length > 1;
  const type = data.type;

  if (type === "donut" || type === "pie" || type === "percentage") {
    const values = data.datasets[0].values;
    const slices = data.labels.map((l, i) => ({ name: l, value: values[i] ?? 0 })).filter((s) => s.value);
    const total = slices.reduce((a, s) => a + s.value, 0);
    if (type === "percentage") {
      return (
        <div className="flex flex-col justify-center gap-3" style={{ minHeight: height / 2 }}>
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
            {slices.map((s, i) => (
              <div key={s.name} title={`${s.name}: ${formatValue(s.value, data.fieldtype, currency)}`} style={{ width: `${(s.value / total) * 100}%`, background: SERIES[i % 8] }} />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
            {slices.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SERIES[i % 8] }} />
                <span className="truncate">{s.name}</span>
                <span className="ml-auto tabular-nums text-zinc-900 dark:text-zinc-100">{Math.round((s.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-6" style={{ height }}>
        <ResponsiveContainer width="55%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={type === "donut" ? "58%" : 0} outerRadius="88%" paddingAngle={slices.length > 1 ? 1.5 : 0} stroke="var(--chart-surface)" strokeWidth={2}>
              {slices.map((s, i) => (
                <Cell key={s.name} fill={SERIES[i % 8]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip fieldtype={data.fieldtype} currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
          {slices.slice(0, 8).map((s, i) => (
            <li key={s.name} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SERIES[i % 8] }} />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto pl-2 tabular-nums text-zinc-900 dark:text-zinc-100">{formatCompact(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" {...axisProps} minTickGap={24} tickMargin={8} />
      <YAxis {...axisProps} width={48} tickFormatter={(v: number) => formatCompact(v)} />
      <Tooltip cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3", fill: "transparent" }} content={<ChartTooltip fieldtype={data.fieldtype} currency={currency} />} />
      {multi && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--chart-text)" }} />}
    </>
  );

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {data.datasets.map((_, j) => (
              <linearGradient key={j} id={`fill-${j}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES[j % 8]} stopOpacity={multi ? 0 : 0.18} />
                <stop offset="100%" stopColor={SERIES[j % 8]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {common}
          {data.datasets.map((d, j) => (
            <Area key={j} type="monotone" dataKey={`s${j}`} name={d.name} stroke={SERIES[j % 8]} strokeWidth={2} fill={`url(#fill-${j})`} dot={rows.length <= 12 ? { r: 3, strokeWidth: 2, fill: "var(--chart-surface)" } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--chart-surface)" }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
        {common}
        {data.datasets.map((d, j) => (
          <Bar key={j} dataKey={`s${j}`} name={d.name} fill={SERIES[j % 8]} radius={[4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
