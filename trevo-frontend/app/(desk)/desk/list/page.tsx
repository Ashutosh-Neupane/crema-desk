import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "List | Trevo",
    description: "Browse and manage records across all DocTypes",
  };
}

import Link from "next/link";
import { FileText, Users } from "lucide-react";

export default function ListPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">List View</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Browse and manage records across all DocTypes.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/desk/doctype"
          className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
              <FileText className="h-6 w-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">All DocTypes</h3>
              <p className="text-sm text-zinc-500">Browse records by DocType</p>
            </div>
          </div>
        </Link>

        <Link
          href="/desk/doctype/Sales%20Invoice"
          className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
              <FileText className="h-6 w-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Sales Invoices</h3>
              <p className="text-sm text-zinc-500">View invoices</p>
            </div>
          </div>
        </Link>

        <Link
          href="/desk/doctype/Task"
          className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
              <Users className="h-6 w-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Tasks</h3>
              <p className="text-sm text-zinc-500">Manage tasks</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
