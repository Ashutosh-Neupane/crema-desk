"use client";

import { useDashboardChart } from "@/lib/hooks/useDashboardChart";
import { Card } from "@/components/shadcn/card";
import { BarChart3 } from "lucide-react";
import {
  BarChartComponent,
  LineChartComponent,
  PieChartComponent,
} from "@/components/charts";

interface ChartItem {
  chart_name: string;
  label?: string;
}

/**
 * Client island — workspace charts rendered with recharts (needs browser canvas).
 */
export function WorkspaceChartsClient({ charts }: { charts: ChartItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {charts.map((chart) => (
        <ChartLive key={chart.chart_name} chart={chart} />
      ))}
    </div>
  );
}

function ChartLive({ chart }: { chart: ChartItem }) {
  const { data, isLoading, error } = useDashboardChart(chart.chart_name);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-700">
          <BarChart3 className="h-5 w-5 text-zinc-600 dark:text-zinc-300" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {data?.title ?? chart.label ?? chart.chart_name}
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center" aria-label="Loading chart">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
        </div>
      ) : error || !data?.rows?.length ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700">
          <p className="text-xs text-zinc-500 italic">No chart data</p>
        </div>
      ) : data.chart_type === "line" ? (
        <LineChartComponent data={data.rows} xKey={data.xKey} yKey={data.yKey} />
      ) : data.chart_type === "donut" || data.chart_type === "percentage" ? (
        <PieChartComponent data={data.rows} nameKey={data.xKey} valueKey={data.yKey} />
      ) : (
        <BarChartComponent data={data.rows} xKey={data.xKey} yKey={data.yKey} />
      )}
    </Card>
  );
}
