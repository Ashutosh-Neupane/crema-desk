"use client";

import { useState } from "react";
import { useBootInfo } from "@/lib/hooks/useBootInfo";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frappePost } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Skeleton } from "@/components/Skeleton";
import { toast } from "sonner";
import { Mail, User as UserIcon, Globe, Shield, ImageIcon } from "lucide-react";

export function SettingsClient() {
  const { data: bootInfo, isLoading } = useBootInfo();
  const qc = useQueryClient();
  const user = bootInfo?.user;

  const [language, setLanguage] = useState(bootInfo?.lang ?? "");
  const [timezone, setTimezone] = useState("");

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await frappePost("api/resource/User", {
        name: user?.name,
        ...payload,
      });
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["boot-info"] });
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const handleSaveLanguage = () => {
    saveMutation.mutate({ language });
  };

  const handleSaveTimezone = () => {
    saveMutation.mutate({ timezone });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account preferences" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Profile</h2>
            <p className="mt-1 text-sm text-zinc-500">Your account information from Frappe.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium text-zinc-500">Full Name</Label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  {user?.full_name || user?.first_name || "—"}
                </p>
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-500">Email</Label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{user?.email || "—"}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-500">Username</Label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{user?.name || "—"}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-500">Language</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="e.g. en, es, fr"
                  />
                  <Button size="sm" onClick={handleSaveLanguage} disabled={saveMutation.isPending}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">System</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium text-zinc-500">Theme</Label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  {bootInfo?.desk_theme || "System"}
                </p>
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-500">Timezone</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g. Asia/Kathmandu"
                  />
                  <Button size="sm" onClick={handleSaveTimezone} disabled={saveMutation.isPending}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Preferences</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Dark Mode</span>
                <span className="text-xs text-zinc-500">Use theme toggle in header</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Notifications</span>
                <span className="text-xs text-zinc-500">{bootInfo?.notification_count ?? 0} unread</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
