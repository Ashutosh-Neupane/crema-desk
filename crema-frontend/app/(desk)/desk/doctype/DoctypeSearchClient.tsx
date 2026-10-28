"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

interface DoctypeRow {
  name: string;
  module?: string;
  issingle?: number;
  istable?: number;
}

/**
 * Client island — search/filter the pre-rendered doctype list.
 * The parent Server Component passes the full list as a prop (already server-rendered).
 * This component adds interactivity without extra network calls.
 */
export function DoctypeSearchClient({ doctypes }: { doctypes: DoctypeRow[] }) {
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  const modules = useMemo(
    () => [...new Set(doctypes.map((d) => d.module ?? "").filter(Boolean))].sort(),
    [doctypes],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return doctypes.filter((d) => {
      const matchesQuery = !q || d.name.toLowerCase().includes(q) || (d.module ?? "").toLowerCase().includes(q);
      const matchesModule = !moduleFilter || d.module === moduleFilter;
      return matchesQuery && matchesModule;
    });
  }, [doctypes, query, moduleFilter]);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search doctypes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search doctypes"
            className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          aria-label="Filter by module"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none"
        >
          <option value="">All Modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span className="text-sm text-zinc-500">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            No doctypes match your search.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Module
                </th>
                <th className="w-20 px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {filtered.map((dt) => (
                <tr
                  key={dt.name}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/desk/doctype/${encodeURIComponent(dt.name)}`}
                      className="font-medium text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
                    >
                      {dt.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {dt.module || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/desk/doctype/${encodeURIComponent(dt.name)}`}
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
