"use client";

/** Every module the user may open, grouped by app (the classic desk home's "Apps" grid; also the dynamic home's Workspaces card). */
import Link from "next/link";
import { SidebarIcon } from "@/components/DeskSidebar";
import type { NavSection } from "@/lib/navigation";

const APP_TITLES: Record<string, string> = { frappe: "Framework", erpnext: "ERPNext" };

function countLinks(s: NavSection): number {
  return s.items.reduce((n, i) => n + (i.type === "link" ? 1 : countLinks(i)), 0);
}

export function ModuleGrid({ sections, filter = "" }: { sections: NavSection[]; filter?: string }) {
  const q = filter.trim().toLowerCase();
  const modules = sections.filter((s) => s.id.startsWith("module:") && (!q || s.label.toLowerCase().includes(q)));
  const byApp = new Map<string, NavSection[]>();
  for (const m of modules) {
    const app = m.app ?? "";
    if (!byApp.has(app)) byApp.set(app, []);
    byApp.get(app)!.push(m);
  }
  return (
    <>
      {[...byApp.entries()].map(([app, mods]) => (
        <section key={app || "modules"}>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">{APP_TITLES[app] ?? (app || "Modules")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {mods.map((m) => {
              const firstLink = m.href ?? m.items.find((i) => i.type === "link")?.href ?? "/desk";
              return (
                <Link
                  key={m.id}
                  href={firstLink}
                  className="group flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:bg-zinc-800 dark:text-zinc-200 dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900">
                    <SidebarIcon name={m.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{m.label}</span>
                    <span className="block text-xs text-zinc-400">{countLinks(m)} items</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
