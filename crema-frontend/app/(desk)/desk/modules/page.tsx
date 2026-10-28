/**
 * Modules page — Server Component with ISR (10-minute revalidation).
 *
 * Module structure is static per-installation (changes only when apps are installed).
 * Fetch on the server, render HTML — zero client JS needed for the list itself.
 * Client island: module color selector (decorative) remains interactive.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";
import { Card } from "@/components/shadcn/card";
import { Layers, ArrowRight } from "lucide-react";

export const revalidate = 600; // 10 minutes

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Modules | Crema",
    description: "Browse installed Frappe modules",
  };
}

interface ModuleDef {
  name: string;
  app_name?: string;
  color?: string;
  icon?: string;
}

const colorClasses: Record<string, string> = {
  blue:   "bg-blue-50   text-blue-600   dark:bg-blue-900/20   dark:text-blue-400",
  green:  "bg-green-50  text-green-600  dark:bg-green-900/20  dark:text-green-400",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
  red:    "bg-red-50    text-red-600    dark:bg-red-900/20    dark:text-red-400",
  cyan:   "bg-cyan-50   text-cyan-600   dark:bg-cyan-900/20   dark:text-cyan-400",
  gray:   "bg-zinc-100  text-zinc-600   dark:bg-zinc-800      dark:text-zinc-400",
};

async function getModules(): Promise<ModuleDef[]> {
  try {
    const cookie = await getCookieHeader();
    const { data } = await frappeServerFetch<ModuleDef[]>(
      cookie,
      'api/resource/Module Def?fields=["name","app_name","color","icon"]&limit=200',
    );
    return (data as unknown as ModuleDef[]) ?? [];
  } catch {
    return [];
  }
}

export default async function ModulesPage() {
  const modules = await getModules();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Modules</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Browse module definitions from your Frappe installation.
          Each module groups doctypes, reports, pages and workspaces.
        </p>
      </div>

      {modules.length === 0 ? (
        <Card className="p-12 text-center text-sm text-zinc-500">
          No modules found. Install an app such as ERPNext to add modules.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const cls = colorClasses[m.color ?? "blue"] ?? colorClasses.blue;
            return (
              <Link key={m.name} href={`/desk/modules/${encodeURIComponent(m.name)}`}>
                <Card className="group p-5 transition-shadow hover:shadow-md cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${cls}`}
                      aria-hidden="true"
                    >
                      <Layers className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                        {m.name}
                      </p>
                      {m.app_name && (
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {m.app_name}
                        </p>
                      )}
                    </div>
                    <ArrowRight
                      className="ml-auto h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
