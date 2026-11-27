"use client";

/**
 * Desk home. Classic: Frappe v16 opens an "Apps" grid; Crema keeps that (every module,
 * grouped by app) and adds what you usually come back for: search, your open
 * assignments and recently opened documents — no placeholder KPIs.
 */
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Search } from "lucide-react";
import { useNavigation } from "@/lib/hooks/useNavigation";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { ModuleGrid } from "@/components/desk/ModuleGrid";
import DynamicHome from "@/components/phase2/home/DynamicHome";
import { useNewLayout } from "@/lib/ui/newLayout";
import { getRecentDocs, type RecentDoc } from "@/lib/utils/recentDocs";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

const enc = encodeURIComponent;

const noopSubscribe = () => () => {};

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const EMPTY: RecentDoc[] = [];
let recentCache: { raw: string; list: RecentDoc[] } = { raw: "", list: EMPTY };
function readRecent(): RecentDoc[] {
  const list = getRecentDocs();
  const raw = JSON.stringify(list);
  if (raw !== recentCache.raw) recentCache = { raw, list };
  return recentCache.list;
}

/** New layout: the dynamic, role-based home (docs/PHASE2_DESIGN.md § 4.1); classic: the apps grid below */
export default function DeskHomePage() {
  return useNewLayout() ? <DynamicHome /> : <ClassicHome />;
}

function ClassicHome() {
  const { data: nav } = useNavigation();
  const { data: ctx } = useDeskContext();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const recent = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    readRecent,
    () => EMPTY,
  );

  const { data: todos } = useQuery<Array<{ name: string; description?: string; reference_type?: string; reference_name?: string; date?: string; priority?: string }>>({
    queryKey: ["home-todos", ctx?.user],
    enabled: !!ctx?.user,
    queryFn: async () => {
      const params = new URLSearchParams({
        fields: JSON.stringify(["name", "description", "reference_type", "reference_name", "date", "priority"]),
        filters: JSON.stringify([["allocated_to", "=", ctx!.user], ["status", "=", "Open"]]),
        order_by: "date asc, modified desc",
        limit_page_length: "6",
      });
      const res = await fetch(`/api/frappe/api/resource/ToDo?${params}`, { credentials: "include" });
      return res.ok ? ((await res.json()) as { data: [] }).data : [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {/* time of day and the user's name are client-only: shown after hydration so server and client match */}
          {hydrated ? greeting() : "Welcome"}
          {hydrated && ctx?.full_name ? `, ${ctx.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-zinc-500" suppressHydrationWarning>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <button
          type="button"
          onClick={() => document.dispatchEvent(new CustomEvent("crema:command-palette"))}
          className="mt-5 flex w-full max-w-xl items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-500 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <Search className="h-4 w-4" />
          Search documents, lists, reports or create something new
          <kbd className="ml-auto rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium dark:border-zinc-700">⌘K</kbd>
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Assigned to me</h2>
            <Link href="/desk/todo" className="ml-auto text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">All ToDos</Link>
          </div>
          {todos?.length ? (
            <ul className="-mx-2">
              {todos.map((t) => (
                <li key={t.name}>
                  <Link
                    href={t.reference_type && t.reference_name ? `${doctypeUrl(t.reference_type)}/${enc(t.reference_name)}` : `/desk/todo/${enc(t.name)}`}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.priority === "High" ? "bg-red-500" : t.priority === "Low" ? "bg-zinc-300" : "bg-amber-500"}`} />
                    <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{(t.description ?? "").replace(/<[^>]+>/g, "") || t.name}</span>
                    {t.reference_type && <span className="shrink-0 text-xs text-zinc-400">{t.reference_type}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-zinc-400">Nothing assigned to you. Nice.</p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Recently viewed</h2>
          </div>
          {recent.length ? (
            <ul className="-mx-2">
              {recent.slice(0, 6).map((r) => (
                <li key={`${r.doctype}/${r.name}`}>
                  <Link href={`${doctypeUrl(r.doctype)}/${enc(r.name)}`} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{r.title || r.name}</span>
                    <span className="shrink-0 text-xs text-zinc-400">{r.doctype} · {timeAgo(r.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-zinc-400">Documents you open will show up here.</p>
          )}
        </section>
      </div>

      <ModuleGrid sections={nav?.sections ?? []} />
    </div>
  );
}
