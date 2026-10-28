/**
 * DocType browser — Server Component with ISR.
 *
 * This page is almost entirely static (the DocType list changes very rarely)
 * so we use ISR with a 5-minute revalidation window. The search box is a
 * client-side island (`DoctypeSearch`) that filters the already-rendered list
 * without a network call.
 *
 * revalidate = 300s (5 min) — ISR: Next.js serves the cached HTML and
 * regenerates in the background when a request comes in after the window expires.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";
import { DoctypeSearchClient } from "./DoctypeSearchClient";

// ── ISR revalidation window ────────────────────────────────────────────────
export const revalidate = 300; // 5 minutes

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "DocTypes | Crema",
    description: "Browse and manage DocType definitions",
  };
}

// ── Data fetching (Server Component) ──────────────────────────────────────

interface DoctypeRow {
  name: string;
  module?: string;
  issingle?: number;
  istable?: number;
}

async function getDoctypes(): Promise<DoctypeRow[]> {
  try {
    const cookie = await getCookieHeader();
    const { data } = await frappeServerFetch<DoctypeRow[]>(
      cookie,
      "api/resource/DocType",
      {
        params: {
          fields: JSON.stringify(["name", "module", "istable", "issingle"]),
          filters: JSON.stringify([["istable", "=", 0], ["issingle", "=", 0]]),
          order_by: "name asc",
          limit_page_length: 500,
        },
      },
    );
    return (data as unknown as DoctypeRow[]) ?? [];
  } catch {
    return [];
  }
}

// ── Server Component ────────────────────────────────────────────────────────

export default async function DoctypesPage() {
  const doctypes = await getDoctypes();

  // Group by module for the sidebar
  const modules = [...new Set(doctypes.map((d) => d.module ?? "Other").filter(Boolean))].sort();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            DocTypes
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {doctypes.length} doctypes across {modules.length} modules
          </p>
        </div>
        <Link
          href="/desk/doctype/new"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          New DocType
        </Link>
      </div>

      {/* Client island: search + filtered table */}
      <Suspense
        fallback={
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        }
      >
        <DoctypeSearchClient doctypes={doctypes} />
      </Suspense>
    </div>
  );
}
