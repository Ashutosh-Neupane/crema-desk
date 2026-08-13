"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frappeGet, frappePost } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/Skeleton";
import { Bell, Mail } from "lucide-react";

interface NotificationSettingsDoc {
  name: string;
  enabled: number;
  subject?: string;
}

export function NotificationSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<NotificationSettingsDoc>({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const res = await frappeGet<{ message: NotificationSettingsDoc }>(
        "api/resource/Notification Settings?limit=1",
      );
      return res.message ?? { name: "Notification Settings", enabled: 1 };
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await frappePost("api/resource/Notification Settings", {
        name: data?.name,
        enabled: enabled ? 1 : 0,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-settings"] }),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Notification Settings" description="Manage email notification preferences" />

      {isLoading ? (
        <Card className="p-6">
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Email Notifications
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleMutation.mutate(!(data?.enabled === 1))}
            >
              {data?.enabled === 1 ? "Enabled" : "Disabled"}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Send digest emails
              </span>
            </div>
            <Badge variant={data?.subject ? "default" : "secondary"}>
              {data?.subject ? "Configured" : "Not set"}
            </Badge>
          </div>
        </Card>
      )}
    </div>
  );
}
