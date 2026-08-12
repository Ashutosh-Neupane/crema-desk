"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  FileText, ShoppingCart, Users, DollarSign,
  Clock, ArrowUpRight, ArrowDownRight, Activity,
} from "lucide-react";
import { useBootInfo } from "@/lib/hooks/useBootInfo";
import { useListCount } from "@/lib/hooks/useList";
import { useWorkspaces } from "@/lib/hooks/useWorkspaces";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/shadcn/card";
import dynamic from "next/dynamic";

// Lazy-load DashboardView — only rendered when a default dashboard exists
const DashboardView = dynamic(
  () => import("@/components/features/dashboard/DashboardView").then((m) => m.DashboardView),
  { ssr: false },
);

const COLOR_MAP = {
  blue:   "bg-blue-50   text-blue-700   dark:bg-blue-900/20   dark:text-blue-400",
  green:  "bg-green-50  text-green-700  dark:bg-green-900/20  dark:text-green-400",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  yellow: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
};

export default function DeskHomePage() {
  const { data: bootInfo } = useBootInfo();
  const { data: workspaces } = useWorkspaces();

  // Check whether a default Dashboard document exists for this user's home module
  const { data: defaultDashboard } = useQuery<{ name: string } | null>({
    queryKey: ["default-dashboard"],
    queryFn: async () => {
      try {
        const res = await fetch(
          "/api/frappe/api/resource/Dashboard?filters=" +
            encodeURIComponent(JSON.stringify([["is_default", "=", 1]])) +
            "&limit=1&fields=" +
            encodeURIComponent(JSON.stringify(["name"])),
        );
        if (!res.ok) return null;
        const json = await res.json() as { data?: Array<{ name: string }> };
        return json.data?.[0] ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 300_000, // 5 min
    retry: false,
  });

  // Live counts for stat cards (always fetched, used as fallback or alongside dashboard)
  const salesOrderCount = useListCount("Sales Order");
  const customerCount = useListCount("Customer");
  const invoiceCount = useListCount("Sales Invoice");
  const paymentCount = useListCount("Payment Entry");

  const stats = useMemo(
    () => [
      {
        doctype: "Sales Order", label: "Sales Orders",
        count: salesOrderCount.data ?? 0,
        href: "/desk/doctype/Sales%20Order",
        icon: ShoppingCart, color: "blue" as const, trend: "+12%", trendUp: true,
      },
      {
        doctype: "Customer", label: "Customers",
        count: customerCount.data ?? 0,
        href: "/desk/doctype/Customer",
        icon: Users, color: "green" as const, trend: "+5%", trendUp: true,
      },
      {
        doctype: "Sales Invoice", label: "Invoices",
        count: invoiceCount.data ?? 0,
        href: "/desk/doctype/Sales%20Invoice",
        icon: FileText, color: "purple" as const, trend: "-2%", trendUp: false,
      },
      {
        doctype: "Payment Entry", label: "Payments",
        count: paymentCount.data ?? 0,
        href: "/desk/doctype/Payment%20Entry",
        icon: DollarSign, color: "yellow" as const, trend: "+8%", trendUp: true,
      },
    ],
    [salesOrderCount.data, customerCount.data, invoiceCount.data, paymentCount.data],
  );

  const recentWorkspaces = useMemo(() => workspaces?.slice(0, 3) ?? [], [workspaces]);

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Welcome back, {bootInfo?.user?.first_name || "User"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <time dateTime={new Date().toISOString()}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </time>
        </div>
      </div>

      {/* Live stat cards — always shown at the top */}
      <section aria-label="Key metrics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.doctype} href={stat.href}>
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className={["rounded-lg p-2", COLOR_MAP[stat.color]].join(" ")}>
                    <stat.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className={[
                    "flex items-center gap-0.5 text-xs font-medium",
                    stat.trendUp ? "text-green-600" : "text-red-600",
                  ].join(" ")} aria-label={`Trend: ${stat.trend}`}>
                    {stat.trendUp
                      ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
                    {stat.trend}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {stat.count.toLocaleString()}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Default Dashboard — shown when Frappe has a default Dashboard doc */}
      {defaultDashboard ? (
        <section aria-label="Default dashboard">
          <DashboardView dashboardName={defaultDashboard.name} />
        </section>
      ) : (
        /* Fallback: workspace cards */
        <section aria-label="Your workspaces">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Your Workspaces
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentWorkspaces.length > 0 ? (
              recentWorkspaces.map((ws) => (
                <Link key={ws.name} href={`/desk/workspace/${encodeURIComponent(ws.name)}`}>
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
                        <FileText className="h-5 w-5 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{ws.title}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{ws.name}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
                <Activity className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
                <p className="mt-2 text-sm text-zinc-500">No workspaces yet</p>
                <p className="text-xs text-zinc-400">Create your first workspace to get started</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
