"use client";

import { useQuery } from "@tanstack/react-query";

export interface ChartResult {
  chart_type: "line" | "bar" | "percentage" | "donut" | string;
  rows: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  datasetNames?: string[];
  title: string;
}

export interface NumberCardResult {
  card_name: string;
  label: string;
  value: number | string | null;
  doctype?: string;
  color?: string;
}

export function useDashboardChart(
  chartName: string | null | undefined,
  opts?: { timespan?: string; timegrain?: string },
) {
  return useQuery<ChartResult>({
    queryKey: ["dashboard-chart", chartName, opts?.timespan, opts?.timegrain],
    queryFn: async () => {
      const params = new URLSearchParams({ chart_name: chartName! });
      if (opts?.timespan) params.set("timespan", opts.timespan);
      if (opts?.timegrain) params.set("timegrain", opts.timegrain);
      const res = await fetch(`/api/doctype/Dashboard/chart?${params}`);
      if (!res.ok) throw new Error("Failed to fetch chart");
      return res.json();
    },
    enabled: !!chartName,
    staleTime: 60_000,
  });
}

export function useNumberCard(cardName: string | null | undefined) {
  return useQuery<NumberCardResult>({
    queryKey: ["number-card", cardName],
    queryFn: async () => {
      const res = await fetch(`/api/doctype/Dashboard/number-card?card_name=${encodeURIComponent(cardName!)}`);
      if (!res.ok) throw new Error("Failed to fetch number card");
      return res.json();
    },
    enabled: !!cardName,
    staleTime: 60_000,
    refetchInterval: 120_000, // auto-refresh every 2 min
  });
}
