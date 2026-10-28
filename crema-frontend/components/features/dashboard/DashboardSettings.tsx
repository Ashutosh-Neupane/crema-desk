"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frappeGet, frappePost } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Skeleton } from "@/components/Skeleton";
import { LayoutDashboard } from "lucide-react";

interface DashboardSettingsDoc {
  name: string;
  is_default?: number;
  dashboard_name?: string;
}

export function DashboardSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<DashboardSettingsDoc>({
    queryKey: ["dashboard-settings"],
    queryFn: async () => {
      const res = await frappeGet<{ message: DashboardSettingsDoc[] }>(
        "api/resource/Dashboard Settings?limit=1",
      );
      return res.message?.[0] ?? { name: "Dashboard Settings" };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<DashboardSettingsDoc>) => {
      await frappePost("api/resource/Dashboard Settings", {
        name: data?.name,
        ...payload,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard-settings"] }),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard Settings" description="Configure dashboard defaults" />

      {isLoading ? (
        <Card className="p-6">
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Default Dashboard
              </span>
            </div>
            <Input
              defaultValue={data?.dashboard_name ?? ""}
              onBlur={(e) => saveMutation.mutate({ dashboard_name: e.target.value })}
              placeholder="Default dashboard name"
              className="w-64"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Set as Default
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate({ is_default: data?.is_default ? 0 : 1 })}
            >
              {data?.is_default ? "Default" : "Set Default"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
