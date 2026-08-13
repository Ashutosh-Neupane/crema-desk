"use client";

import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/Skeleton";
import { Terminal } from "lucide-react";

interface ConsoleLogDoc {
  name: string;
  log_type: string;
  message: string;
  creation: string;
  user: string;
}

export function ConsoleLogList() {
  const { data, isLoading, isError } = useQuery<ConsoleLogDoc[]>({
    queryKey: ["console-log"],
    queryFn: async () => {
      const res = await frappeMethod<{ message: ConsoleLogDoc[] }>(
        "frappe.client.get_list",
        {
          doctype: "Console Log",
          fields: ["name", "log_type", "message", "creation", "user"],
          order_by: "creation desc",
          limit_page_length: 100,
        },
      );
      return res.message ?? [];
    },
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Console Logs"
        description="Recent console log entries"
        actions={
          <Badge variant="secondary">
            {data?.length ?? 0} entries
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
          Failed to load console logs.
        </Card>
      ) : data?.length === 0 ? (
        <Card className="p-10 text-center text-sm text-zinc-500">
          <Terminal className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2">No console logs found.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {data?.map((log) => (
            <div key={log.name} className="px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500">{log.log_type}</span>
                <span className="text-xs text-zinc-400">
                  {new Date(log.creation).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300 line-clamp-2">
                {log.message}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
