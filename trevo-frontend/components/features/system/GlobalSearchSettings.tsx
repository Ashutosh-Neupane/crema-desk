"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frappeGet, frappePost } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Skeleton } from "@/components/Skeleton";
import { Search } from "lucide-react";

interface GlobalSearchDoc {
  name: string;
  enabled: number;
  search_fields?: string;
}

export function GlobalSearchSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<GlobalSearchDoc>({
    queryKey: ["global-search-settings"],
    queryFn: async () => {
      const res = await frappeGet<{ message: GlobalSearchDoc }>(
        "api/resource/Global Search Settings?limit=1",
      );
      return res.message ?? { name: "Global Search Settings", enabled: 1, search_fields: "" };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<GlobalSearchDoc>) => {
      await frappePost("api/resource/Global Search Settings", {
        name: data?.name,
        ...payload,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["global-search-settings"] }),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Global Search Settings" description="Configure global search behavior" />

      {isLoading ? (
        <Card className="p-6">
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Enable Global Search
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate({ enabled: data?.enabled === 1 ? 0 : 1 })}
            >
              {data?.enabled === 1 ? "Enabled" : "Disabled"}
            </Button>
          </div>
          <div>
            <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Search Fields
            </Label>
            <Input
              defaultValue={data?.search_fields ?? ""}
              onBlur={(e) =>
                saveMutation.mutate({ search_fields: e.target.value })
              }
              placeholder="e.g. name, email, phone"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Comma-separated fields to include in global search.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
