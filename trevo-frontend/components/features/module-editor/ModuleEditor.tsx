"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frappeGet, frappePost } from "@/lib/frappe/client";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Puzzle, RefreshCw } from "lucide-react";

interface ModuleDoc {
  name: string;
  module_name: string;
  app_name?: string;
  is_core?: number;
}

export function ModuleEditor() {
  const queryClient = useQueryClient();

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const res = await frappeGet<{ message: ModuleDoc[] }>("api/resource/Module Def?fields=[\"name\",\"module_name\",\"app_name\",\"is_core\"]&limit_page_length=100");
      return res.message ?? [];
    },
  });

  const enabledModules = useMemo(() => {
    return new Set(modules.filter((m) => !m.is_core).map((m) => m.name));
  }, [modules]);

  const [pendingToggle, setPendingToggle] = useState<{ moduleName: string; enabled: boolean } | null>(null);

  const effectiveEnabled = useMemo(() => {
    if (!pendingToggle) return enabledModules;
    const next = new Set(enabledModules);
    if (pendingToggle.enabled) {
      next.add(pendingToggle.moduleName);
    } else {
      next.delete(pendingToggle.moduleName);
    }
    return next;
  }, [enabledModules, pendingToggle]);

  const updateMutation = useMutation({
    mutationFn: async ({ moduleName, enabled }: { moduleName: string; enabled: boolean }) => {
      const res = await frappePost("api/method/trevo.module_editor.update", {
        module: moduleName,
        enabled,
      });
      return res;
    },
    onSuccess: () => {
      setPendingToggle(null);
      queryClient.invalidateQueries({ queryKey: ["modules"] });
    },
  });

  const handleToggle = (moduleName: string) => {
    const nextEnabled = !effectiveEnabled.has(moduleName);
    setPendingToggle({ moduleName, enabled: nextEnabled });
    updateMutation.mutate({ moduleName, enabled: nextEnabled });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  const coreModules = modules.filter((m) => m.is_core);
  const customModules = modules.filter((m) => !m.is_core);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Module Manager</h2>
          <p className="text-sm text-zinc-500">Enable or disable modules in your Frappe installation</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["modules"] })}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Custom Modules</h3>
        {customModules.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No custom modules installed</p>
        ) : (
          <div className="space-y-2">
            {customModules.map((mod) => (
              <div
                key={mod.name}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <Puzzle className="h-5 w-5 text-zinc-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{mod.module_name}</p>
                    <p className="text-xs text-zinc-500">{mod.app_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={enabledModules.has(mod.name) ? "default" : "secondary"}>
                    {enabledModules.has(mod.name) ? "Enabled" : "Disabled"}
                  </Badge>
                  <Checkbox
                    checked={enabledModules.has(mod.name)}
                    onChange={() => handleToggle(mod.name)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Core Modules</h3>
        {coreModules.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No core modules found</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {coreModules.map((mod) => (
              <div
                key={mod.name}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <Puzzle className="h-5 w-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{mod.module_name}</p>
                  <p className="text-xs text-zinc-500">{mod.app_name}</p>
                </div>
                <Badge variant="secondary" className="ml-auto">Core</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
