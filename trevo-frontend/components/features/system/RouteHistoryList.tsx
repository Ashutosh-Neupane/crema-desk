"use client";

import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/Skeleton";
import { History } from "lucide-react";

interface RouteHistoryDoc {
  name: string;
  route: string;
  creation: string;
  user: string;
}

export function RouteHistoryList() {
  const { data, isLoading, isError } = useQuery<RouteHistoryDoc[]>({
    queryKey: ["route-history"],
    queryFn: async () => {
      const res = await frappeMethod<{ message: RouteHistoryDoc[] }>(
        "frappe.client.get_list",
        {
          doctype: "Route History",
          fields: ["name", "route", "creation", "user"],
          order_by: "creation desc",
          limit_page_length: 50,
        },
      );
      return res.message ?? [];
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Route History"
        description="Recent pages you visited"
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
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : isError ? (
        <Card className="p-6 text-center text-sm text-red-600">
          Failed to load route history.
        </Card>
      ) : data?.length === 0 ? (
        <Card className="p-10 text-center text-sm text-zinc-500">
          <History className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2">No route history yet.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {data?.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <div className="flex items-center gap-3">
                <History className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-300">{item.route}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{new Date(item.creation).toLocaleString()}</span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                  {item.user}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
