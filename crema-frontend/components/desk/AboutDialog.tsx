"use client";

/**
 * About dialog (Desk: frappe.ui.misc.about in ui/toolbar/about.js): installed apps and versions from
 * frappe.utils.change_log.get_versions.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { deskCall } from "@/lib/frappe/form";

interface AppVersion {
  title: string;
  version: string;
  branch?: string;
}

export default function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["app-versions"],
    enabled: open,
    staleTime: 10 * 60_000,
    queryFn: async () => ((await deskCall("frappe.utils.change_log.get_versions")).env.message as Record<string, AppVersion>) ?? {},
  });
  const apps = Object.entries(data ?? {});

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>About</DialogTitle>
          <DialogDescription>Open Source applications for the web.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2" aria-label="Installed Apps">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Installed Apps</div>
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-400" aria-label="Loading" />
          ) : error ? (
            <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Could not load versions"}</p>
          ) : (
            apps.map(([name, app]) => (
              <div key={name} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-700 dark:text-zinc-200">{app.title || name}</span>
                <span className="text-zinc-500">
                  v{app.version}
                  {app.branch ? <span className="ml-2 text-xs text-zinc-400">({app.branch})</span> : null}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
