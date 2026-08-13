"use client";

import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/Skeleton";
import { ScrollText, GitCommit } from "lucide-react";

interface ChangelogDoc {
  name: string;
  doctype: string;
  docname: string;
  modified: string;
  modified_by: string;
  data?: string;
}

export function ChangelogFeed() {
  const { data, isLoading, isError } = useQuery<ChangelogDoc[]>({
    queryKey: ["changelog-feed"],
    queryFn: async () => {
      const res = await frappeMethod<{ message: ChangelogDoc[] }>(
        "frappe.client.get_list",
        {
          doctype: "Changelog Feed",
          fields: ["name", "doctype", "docname", "modified", "modified_by"],
          order_by: "modified desc",
          limit_page_length: 50,
        },
      );
      return res.message ?? [];
    },
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Changelog Feed"
        description="Recent changes across your Frappe instance"
        actions={
          <Badge variant="secondary">
            {data?.length ?? 0} changes
          </Badge>
        }
      />

      {isLoading ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : isError ? (
        <Card className="p-6 text-center text-sm text-red-600">
          Failed to load changelog feed.
        </Card>
      ) : data?.length === 0 ? (
        <Card className="p-10 text-center text-sm text-zinc-500">
          <ScrollText className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2">No changes recorded yet.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {data?.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <div className="flex items-center gap-3">
                <GitCommit className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-300">
                  {item.doctype} / {item.docname}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{new Date(item.modified).toLocaleString()}</span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                  {item.modified_by}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
