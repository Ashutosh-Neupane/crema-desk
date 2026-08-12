"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, ArrowUpDown } from "lucide-react";
import { frappeGet } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/shadcn/input";
import { Badge } from "@/components/shadcn/badge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeleton";

export interface SystemColumn {
  fieldname: string;
  label: string;
  render?: (row: Record<string, unknown>) => React.ReactNode;
}

export interface SystemDoctypeListProps {
  doctype: string;
  title: string;
  description?: string;
  columns?: SystemColumn[];
  newHref?: string;
  viewHref?: (name: string) => string;
  emptyMessage?: string;
  filters?: Record<string, unknown>;
}

/**
 * Generic thin system-page wrapper.
 * Reuses Frappe's /api/resource/:doctype list endpoint via the BFF proxy and
 * renders a consistent table — used for Users, Roles, Notes, ToDo, etc.
 */
export function SystemDoctypeList({
  doctype,
  title,
  description,
  columns,
  newHref,
  viewHref,
  emptyMessage = "No records found.",
  filters,
}: SystemDoctypeListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const defaultColumns: SystemColumn[] = [
    { fieldname: "name", label: "Name" },
    { fieldname: "owner", label: "Owner" },
    { fieldname: "creation", label: "Created", render: (r) => formatDate(r.creation) },
    { fieldname: "modified", label: "Modified", render: (r) => formatDate(r.modified) },
  ];

  const cols = columns ?? defaultColumns;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["system-list", doctype, filters],
    queryFn: async () => {
      const url = `api/resource/${encodeURIComponent(doctype)}?fields=["*"]&limit_page_length=100${
        filters ? `&filters=${encodeURIComponent(JSON.stringify(Object.entries(filters).map(([k, v]) => [doctype, k, "=", v])))}` : ""
      }`;
      const res = await frappeGet<{ data?: unknown[] }>(url);
      return (res as { data?: unknown[] } | null)?.data ?? ((res as unknown as unknown[] | null) ?? []);
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      Object.values(r as Record<string, unknown>)
        .filter((v) => v !== null && v !== undefined)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const resolved = useMemo(
    () => (filtered as Array<Record<string, unknown>>) ?? [],
    [filtered],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          newHref ? (
            <Link
              href={newHref}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" />
              New
            </Link>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="pl-8"
          />
        </div>
        <span className="text-xs text-zinc-500">{resolved.length} records</span>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} cols={cols.length} />
        ) : resolved.length === 0 ? (
          <EmptyState title="No records" description={emptyMessage} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                  {cols.map((col) => (
                    <th
                      key={col.fieldname}
                      className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className="h-3 w-3 text-zinc-300" />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {resolved.map((row, i) => {
                  const name = String(row.name ?? "");
                  const href = viewHref?.(name);
                  return (
                    <tr
                      key={name || i}
                      onClick={() => {
                        if (href) router.push(href);
                      }}
                      className={href ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors" : ""}
                    >
                      {cols.map((col) => (
                        <td key={col.fieldname} className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">
                          {col.render ? (
                            col.render(row)
                          ) : col.fieldname === "name" ? (
                            <span className="inline-flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono">{name}</Badge>
                            </span>
                          ) : (
                            String(row[col.fieldname] ?? "-")
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(v: unknown): string {
  if (!v) return "-";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

