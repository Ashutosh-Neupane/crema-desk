"use client";

/**
 * Dashboard chart (Desk frappe-charts): recharts is loaded on demand, so pages without a chart don't ship it.
 * The placeholder keeps the chart's height while it loads, so the card doesn't jump.
 */
import dynamic from "next/dynamic";
import type { ChartResult } from "@/lib/hooks/useDashboardChart";

interface DeskChartProps {
  data: ChartResult;
  height?: number;
  currency?: string | null;
}

const DeskChartView = dynamic(() => import("@/components/desk/DeskChartView"), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />,
});

export default function DeskChart(props: DeskChartProps) {
  return <DeskChartView {...props} />;
}
