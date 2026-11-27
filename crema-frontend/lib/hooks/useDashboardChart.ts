"use client";

import { useQuery } from "@tanstack/react-query";

export interface ChartResult {
  name: string;
  /** visual: line | bar | donut | pie | percentage | heatmap */
  type: string;
  chart_type: string;
  labels: string[];
  datasets: Array<{ name: string; values: number[] }>;
  timespan?: string;
  time_interval?: string;
  time_series?: boolean;
  fieldtype?: string;
}

export interface NumberCardResult {
  name: string;
  label: string;
  value: number | null;
  fieldtype: string;
  currency: string | null;
  color: string | null;
  /** % change vs previous interval (show_percentage_stats) */
  change: number | null;
  interval: string;
  doctype: string | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Request failed");
  }
  return (await res.json()) as T;
}

/** query options, shared by the hooks and by pages that prefetch (the dynamic home) */
export const dashboardChartQuery = (chartName: string, opts?: { timespan?: string; timegrain?: string }) => ({
  queryKey: ["dashboard-chart", chartName, opts?.timespan, opts?.timegrain],
  queryFn: () => {
    const params = new URLSearchParams({ name: chartName });
    if (opts?.timespan) params.set("timespan", opts.timespan);
    if (opts?.timegrain) params.set("time_interval", opts.timegrain);
    return getJson<ChartResult>(`/api/desk/chart?${params}`);
  },
  staleTime: 60_000,
  retry: false,
});

export const numberCardQuery = (cardName: string) => ({
  queryKey: ["number-card", cardName],
  queryFn: () => getJson<NumberCardResult>(`/api/desk/number-card?name=${encodeURIComponent(cardName)}`),
  staleTime: 60_000,
  retry: false,
});

/** a chart with nothing to draw (no labels, no series, or every value 0) */
export const chartIsEmpty = (data: ChartResult) => !data.labels.length || !data.datasets.length || data.datasets.every((d) => d.values.every((v) => !v));

export function useDashboardChart(
  chartName: string | null | undefined,
  opts?: { timespan?: string; timegrain?: string },
) {
  return useQuery<ChartResult>({ ...dashboardChartQuery(chartName ?? "", opts), enabled: !!chartName });
}

export function useNumberCard(cardName: string | null | undefined) {
  return useQuery<NumberCardResult>({ ...numberCardQuery(cardName ?? ""), enabled: !!cardName, refetchInterval: 120_000 });
}
