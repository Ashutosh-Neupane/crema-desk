"use client";

import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/Skeleton";
import { FileText } from "lucide-react";
import { formatDateTime } from "@/lib/utils/formatNumber";

interface TemplateDoc {
  name: string;
  doctype: string;
  template: string;
  modified: string;
}

export function DocumentTemplateList() {
  const { data, isLoading, isError } = useQuery<TemplateDoc[]>({
    queryKey: ["document-templates"],
    queryFn: async () => {
      const res = await frappeMethod<{ message: TemplateDoc[] }>(
        "frappe.client.get_list",
        {
          doctype: "Document Template",
          fields: ["name", "doctype", "template", "modified"],
          order_by: "modified desc",
          limit_page_length: 100,
        },
      );
      return res.message ?? [];
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Document Templates"
        description="Manage document templates for standard forms"
        actions={
          <Badge variant="secondary">
            {data?.length ?? 0} templates
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
          Failed to load document templates.
        </Card>
      ) : data?.length === 0 ? (
        <Card className="p-10 text-center text-sm text-zinc-500">
          <FileText className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2">No document templates found.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((tmpl) => (
            <Card key={tmpl.name} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {tmpl.doctype}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                    {tmpl.template?.slice(0, 120) || "No content"}
                  </p>
                </div>
                <Badge variant="secondary" className="ml-2 shrink-0">
                  {tmpl.doctype}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Modified: {formatDateTime(tmpl.modified, false)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
