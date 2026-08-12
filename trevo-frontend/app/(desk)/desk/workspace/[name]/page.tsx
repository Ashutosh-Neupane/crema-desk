/**
 * Workspace page — Server Component with ISR (1-minute revalidation).
 *
 * Workspace config (shortcuts, links) is rarely edited, so we can pre-render
 * on the server and cache. Client islands handle:
 *   - Number Cards (live counts via React Query, auto-refresh)
 *   - Chart widgets (recharts, requires client-side canvas)
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchWorkspaceDataServer } from "@/lib/frappe/workspace";
import type { WorkspaceData } from "@/lib/frappe/types";
import { Card } from "@/components/shadcn/card";
import { BarChart3, LayoutDashboard, Plus } from "lucide-react";
import { WorkspaceNumberCardsClient } from "./WorkspaceNumberCardsClient";
import { WorkspaceChartsClient } from "./WorkspaceChartsClient";

export const revalidate = 60; // 1 minute

interface Props {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  return {
    title: `${decoded} | Trevo`,
    description: `${decoded} workspace`,
  };
}

const SHORTCUT_ICONS: Record<string, React.ElementType> = {
  DocType: LayoutDashboard,
  Page: LayoutDashboard,
  Report: BarChart3,
  Dashboard: LayoutDashboard,
  URL: BarChart3,
  Help: BarChart3,
};

export default async function WorkspacePage({ params }: Props) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);

  let workspace: WorkspaceData;
  try {
    workspace = await fetchWorkspaceDataServer(decoded);
  } catch {
    notFound();
  }

  const shortcuts = workspace.shortcuts ?? [];
  const links = workspace.links ?? [];
  const numberCards = workspace.number_cards ?? [];
  const charts = workspace.charts ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {workspace.title || decoded}
          </h1>
          {workspace.module && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Module: {workspace.module}</p>
          )}
        </div>
        <Link
          href={`/desk/doctype/${encodeURIComponent("Workspace")}/${encodeURIComponent(decoded)}`}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span className="flex items-center gap-1">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Shortcut
          </span>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: shortcuts + links + charts */}
        <div className="lg:col-span-2 space-y-6">
          {shortcuts.length > 0 && (
            <section aria-label="Shortcuts">
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Shortcuts
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {shortcuts.map((shortcut) => {
                  const Icon = SHORTCUT_ICONS[shortcut.type] ?? LayoutDashboard;
                  const href =
                    shortcut.type === "DocType"
                      ? `/desk/doctype/${encodeURIComponent(shortcut.link_to)}`
                      : shortcut.type === "Report"
                      ? `/desk/reports?report=${encodeURIComponent(shortcut.link_to)}`
                      : shortcut.link_to || "#";
                  return (
                    <Link
                      key={shortcut.label + shortcut.link_to}
                      href={href}
                      className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-center hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 transition-shadow"
                    >
                      <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-700">
                        <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-300" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
                        {shortcut.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {links.length > 0 && (
            <section aria-label="Links">
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Links</h2>
              <Card className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {links.filter((l) => !l.hidden).map((link) => {
                  const Icon = SHORTCUT_ICONS[link.type ?? "URL"] ?? BarChart3;
                  const href =
                    link.type === "DocType"
                      ? `/desk/doctype/${encodeURIComponent(link.link_to)}`
                      : link.type === "Report"
                      ? `/desk/reports?report=${encodeURIComponent(link.link_to)}`
                      : link.link_to || "#";
                  return (
                    <Link
                      key={link.label + link.link_to}
                      href={href}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {link.label}
                        </p>
                        {link.dependencies && (
                          <p className="text-xs text-zinc-500 truncate">{link.dependencies}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </Card>
            </section>
          )}

          {/* Charts — client island (recharts needs browser canvas) */}
          {charts.length > 0 && (
            <section aria-label="Charts">
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Charts</h2>
              <WorkspaceChartsClient charts={charts} />
            </section>
          )}

          {shortcuts.length === 0 && links.length === 0 && charts.length === 0 && (
            <Card className="p-8 text-center">
              <LayoutDashboard className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
              <p className="mt-2 text-sm text-zinc-500">This workspace is empty.</p>
              <p className="text-xs text-zinc-400">Add shortcuts, links, or number cards in Frappe.</p>
            </Card>
          )}
        </div>

        {/* Right: number cards (client island for live counts) */}
        {numberCards.length > 0 && (
          <div className="space-y-6">
            <section aria-label="Number Cards">
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Number Cards
              </h2>
              <WorkspaceNumberCardsClient numberCards={numberCards} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
