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

export function useDashboardChart(
  chartName: string | null | undefined,
  opts?: { timespan?: string; timegrain?: string },
) {
  return useQuery<ChartResult>({
    queryKey: ["dashboard-chart", chartName, opts?.timespan, opts?.timegrain],
    queryFn: () => {
      const params = new URLSearchParams({ name: chartName! });
      if (opts?.timespan) params.set("timespan", opts.timespan);
      if (opts?.timegrain) params.set("time_interval", opts.timegrain);
      return getJson<ChartResult>(`/api/desk/chart?${params}`);
    },
    enabled: !!chartName,
    staleTime: 60_000,
    retry: false,
  });
}

export function useNumberCard(cardName: string | null | undefined) {
  return useQuery<NumberCardResult>({
    queryKey: ["number-card", cardName],
    queryFn: () => getJson<NumberCardResult>(`/api/desk/number-card?name=${encodeURIComponent(cardName!)}`),
    enabled: !!cardName,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
}
