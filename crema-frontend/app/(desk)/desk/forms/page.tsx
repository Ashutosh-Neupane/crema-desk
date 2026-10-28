"use client";

import { useState } from "react";
import { useDoctypes } from "@/lib/hooks/useDoctypes";
import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FormsPage() {
  const { data: doctypes, isLoading } = useDoctypes();
  const [query, setQuery] = useState("");
  const router = useRouter();

  const filtered = (doctypes ?? []).filter((dt: { name: string; module?: string }) =>
    dt.name.toLowerCase().includes(query.toLowerCase()) ||
    (dt.module ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectDoctype = (name: string) => router.push(`/desk/doctype/${encodeURIComponent(name)}/new`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">New Document</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Select a DocType to create a new record
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input aria-label="Search DocTypes"
          type="text"
          placeholder="Search DocTypes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 pl-9 pr-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((dt: { name: string; module?: string }) => (
            <button
              key={dt.name}
              onClick={() => handleSelectDoctype(dt.name)}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 text-left"
            >
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
                <FileText className="h-6 w-6 text-zinc-600 dark:text-zinc-300" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{dt.name}</h3>
                {dt.module && (
                  <p className="text-xs text-zinc-500">{dt.module}</p>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500">No DocTypes found matching &quot;{query}&quot;</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

