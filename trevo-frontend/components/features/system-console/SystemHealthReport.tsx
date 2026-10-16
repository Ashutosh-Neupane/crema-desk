"use client";

import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/Skeleton";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

interface HealthCheck {
  status: "healthy" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
}

interface SystemHealthData {
  overall: string;
  checks: HealthCheck[];
}

export function SystemHealthReport() {
  const { data, isLoading, isError } = useQuery<SystemHealthData>({
    queryKey: ["system-health"],
    queryFn: async () => {
      return frappeMethod<SystemHealthData>("frappe.utils.system_health.get_system_health");
    },
    staleTime: 60_000,
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "warning":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "error":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    }
  };

  const Icon = ({ status }: { status: string }) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Health"
        description="System health report and diagnostics"
        actions={
          <Badge variant={data?.overall === "healthy" ? "default" : "destructive"}>
            {data?.overall ?? "Loading..."}
          </Badge>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="p-6 text-center text-sm text-red-600">
          Failed to load system health. Please try again.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.checks?.map((check, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-2">
                <Icon status={check.status} />
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {check.message}
                </h3>
              </div>
              {check.details && (
                <div className="mt-2 space-y-1">
                  {Object.entries(check.details).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-zinc-500">{key}</span>
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Badge className={`mt-2 ${statusColor(check.status)}`}>
                {check.status}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
