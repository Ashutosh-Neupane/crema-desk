"use client";

/**
 * Frappe Workspace renderer (Desk: frappe/public/js/frappe/views/workspace/).
 * The Workspace doc's `content` is an ordered list of blocks with a 12-col
 * width; blocks reference child rows by name (shortcuts, links grouped by
 * "Card Break", charts, number_cards, quick_lists).
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FileText, BarChart3, LayoutGrid, Link2 } from "lucide-react";
import { ChartCard, NumberCard, WidgetShell } from "@/components/desk/Widgets";
import { SidebarIcon } from "@/components/DeskSidebar";
import { sidebarItemHref } from "@/lib/navigation";
import OnboardingWidget, { type OnboardingData } from "@/components/desk/OnboardingWidget";
import CustomBlock from "@/components/desk/CustomBlock";

interface Block {
  id?: string;
  type: "header" | "paragraph" | "spacer" | "shortcut" | "card" | "chart" | "number_card" | "quick_list" | "onboarding" | "custom_block" | string;
  data: Record<string, unknown> & { col?: number };
}

interface LinkRow {
  type: "Card Break" | "Link";
  label: string;
  link_type?: "DocType" | "Report" | "Page" | "URL";
  link_to?: string;
  url?: string;
  is_query_report?: 0 | 1;
  onboard?: 0 | 1;
  icon?: string;
  description?: string;
}

interface WorkspaceDoc {
  name: string;
  public?: 0 | 1;
  title?: string;
  label?: string;
  icon?: string;
  module?: string;
  content?: string;
  shortcuts?: Array<{ label: string; type: string; link_to?: string; url?: string; color?: string; icon?: string; stats_filter?: string; format?: string; doc_view?: string }>;
  links?: LinkRow[];
  charts?: Array<{ chart_name: string; label?: string }>;
  number_cards?: Array<{ number_card_name: string; label?: string }>;
  quick_lists?: Array<{ document_type: string; label?: string; quick_list_filter?: string }>;
}

const enc = encodeURIComponent;

/** Desk's col (1–12) → responsive grid span */
function span(col: unknown): string {
  const c = Number(col) || 12;
  if (c >= 12) return "col-span-12";
  if (c >= 8) return "col-span-12 lg:col-span-8";
  if (c >= 6) return "col-span-12 md:col-span-6";
  if (c >= 4) return "col-span-12 sm:col-span-6 lg:col-span-4";
  return "col-span-6 lg:col-span-3";
}

const stripHtml = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

function linkHref(l: { link_type?: string; type?: string; link_to?: string; url?: string; is_query_report?: 0 | 1; doc_view?: string }): string | null {
  const t = (l.link_type ?? l.type) as "DocType" | "Report" | "Page" | "URL" | "Dashboard";
  if (t === "DocType" && l.doc_view === "New") return `/desk/doctype/${enc(l.link_to ?? "")}/new`;
  return sidebarItemHref({ link_type: t, link_to: l.link_to ?? null, url: l.url ?? null });
}

function Shortcut({ s }: { s: NonNullable<WorkspaceDoc["shortcuts"]>[number] }) {
  const href = linkHref(s);
  const { data: count } = useQuery({
    queryKey: ["shortcut-count", s.link_to, s.stats_filter],
    enabled: s.type === "DocType" && !!s.stats_filter && s.stats_filter !== "[]",
    queryFn: async () => {
      const params = new URLSearchParams({ doctype: s.link_to ?? "", filters: s.stats_filter ?? "[]" });
      const res = await fetch(`/api/frappe/api/method/frappe.client.get_count?${params}`, { credentials: "include" });
      return res.ok ? Number(((await res.json()) as { message?: number }).message ?? 0) : null;
    },
    staleTime: 60_000,
  });
  const Icon = s.type === "Report" ? BarChart3 : s.type === "URL" ? Link2 : s.type === "Dashboard" ? LayoutGrid : FileText;
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {s.icon ? <SidebarIcon name={s.icon} /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{s.label}</span>
      {count != null && count > 0 && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {s.format ? s.format.replace("{}", String(count)) : count}
        </span>
      )}
      <ArrowUpRight className="h-3.5 w-3.5 text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600" />
    </>
  );
  const cls = "group flex h-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60";
  if (!href) return <div className={cls}>{body}</div>;
  return href.startsWith("http") ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>{body}</a>
  ) : (
    <Link href={href} className={cls}>{body}</Link>
  );
}

function LinkCard({ title, links }: { title: string; links: LinkRow[] }) {
  return (
    <WidgetShell title={title} className="h-full">
      <ul className="-mx-2 flex flex-col">
        {links.map((l) => {
          const href = linkHref(l);
          return (
            <li key={`${l.link_type}-${l.link_to}-${l.label}`}>
              {href ? (
                <Link href={href} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                  <span className={l.onboard ? "font-medium text-zinc-900 dark:text-zinc-100" : ""}>{l.label}</span>
                  {l.link_type === "Report" && <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400">report</span>}
                </Link>
              ) : (
                <span className="block px-2 py-1.5 text-[13px] text-zinc-400">{l.label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

function QuickList({ q }: { q: NonNullable<WorkspaceDoc["quick_lists"]>[number] }) {
  const { data } = useQuery<Array<{ name: string; modified?: string }>>({
    queryKey: ["quick-list", q.document_type, q.quick_list_filter],
    queryFn: async () => {
      const params = new URLSearchParams({
        fields: JSON.stringify(["name", "modified"]),
        filters: q.quick_list_filter || "[]",
        limit_page_length: "5",
        order_by: "modified desc",
      });
      const res = await fetch(`/api/frappe/api/resource/${enc(q.document_type)}?${params}`, { credentials: "include" });
      return res.ok ? ((await res.json()) as { data: [] }).data : [];
    },
    staleTime: 60_000,
  });
  return (
    <WidgetShell
      title={q.label || q.document_type}
      className="h-full"
      action={<Link href={`/desk/doctype/${enc(q.document_type)}`} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">View all</Link>}
    >
      {data?.length ? (
        <ul className="-mx-2">
          {data.map((d) => (
            <li key={d.name}>
              <Link href={`/desk/doctype/${enc(q.document_type)}/${enc(d.name)}`} className="flex items-center rounded-md px-2 py-1.5 text-[13px] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <span className="truncate">{d.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400">Nothing here yet</p>
      )}
    </WidgetShell>
  );
}

/** frappe.desk.desktop.get_desktop_page: what Desk's blocks read for onboardings (enabled, role-checked, not complete) and permitted custom blocks. */
interface DesktopPage {
  onboardings?: { items: OnboardingData[] };
  custom_blocks?: { items: Array<{ custom_block_name: string }> };
}

export default function WorkspaceView({ name }: { name: string }) {
  const { data: ws, isLoading, error } = useQuery<WorkspaceDoc>({
    queryKey: ["workspace", name],
    queryFn: async () => {
      const res = await fetch(`/api/frappe/api/resource/Workspace/${enc(name)}`, { credentials: "include" });
      if (!res.ok) throw new Error(res.status === 404 ? `Workspace "${name}" not found` : "Failed to load workspace");
      return ((await res.json()) as { data: WorkspaceDoc }).data;
    },
    staleTime: 60_000,
  });

  const hasDynamic = !!ws?.content && /"type":\s*"(onboarding|custom_block)"/.test(ws.content);
  const { data: page } = useQuery<DesktopPage>({
    queryKey: ["desktop-page", name],
    enabled: hasDynamic,
    queryFn: async () => {
      const res = await fetch("/api/frappe/api/method/frappe.desk.desktop.get_desktop_page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ page: JSON.stringify({ name, title: ws?.title ?? name, public: ws?.public ?? 1 }) }),
      });
      return res.ok ? ((await res.json()) as { message?: DesktopPage }).message ?? {} : {};
    },
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 h-8 w-56 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        {[0, 1, 2].map((i) => <div key={i} className="col-span-12 h-28 animate-pulse rounded-xl bg-zinc-100 sm:col-span-4 dark:bg-zinc-800" />)}
      </div>
    );
  }
  if (error || !ws) return <p className="p-6 text-sm text-red-600">{(error as Error)?.message}</p>;

  let blocks: Block[] = [];
  try {
    blocks = JSON.parse(ws.content || "[]");
  } catch {
    blocks = [];
  }

  // links come flat: a "Card Break" row followed by its Link rows
  const cards = new Map<string, LinkRow[]>();
  let current: LinkRow[] | null = null;
  for (const l of ws.links ?? []) {
    if (l.type === "Card Break") {
      current = [];
      cards.set(l.label, current);
    } else if (current) current.push(l);
  }

  const render = (b: Block, i: number) => {
    const key = b.id ?? `${b.type}-${i}`;
    const d = b.data ?? {};
    switch (b.type) {
      case "header":
        return (
          <h2 key={key} className="col-span-12 mt-2 text-base font-semibold text-zinc-900 first:mt-0 dark:text-zinc-100">
            {stripHtml(d.text)}
          </h2>
        );
      case "paragraph":
        return <p key={key} className={`${span(d.col)} text-sm text-zinc-600 dark:text-zinc-400`}>{stripHtml(d.text)}</p>;
      case "spacer":
        return <div key={key} className={`${span(d.col)} h-2`} />;
      case "shortcut": {
        const s = ws.shortcuts?.find((x) => x.label === d.shortcut_name);
        return s ? <div key={key} className={span(d.col ?? 3)}><Shortcut s={s} /></div> : null;
      }
      case "card": {
        const links = cards.get(String(d.card_name)) ?? [];
        return links.length ? <div key={key} className={span(d.col)}><LinkCard title={String(d.card_name)} links={links} /></div> : null;
      }
      case "chart": {
        const c = ws.charts?.find((x) => x.chart_name === d.chart_name);
        return <div key={key} className={span(d.col)}><ChartCard name={String(d.chart_name)} label={c?.label} /></div>;
      }
      case "number_card":
        return <div key={key} className={span(d.col ?? 4)}><NumberCard name={String(d.number_card_name)} /></div>;
      case "quick_list": {
        const q = ws.quick_lists?.find((x) => (x.label || x.document_type) === d.quick_list_name);
        return q ? <div key={key} className={span(d.col)}><QuickList q={q} /></div> : null;
      }
      case "onboarding": {
        const ob = page?.onboardings?.items.find((x) => x.label === d.onboarding_name);
        return ob ? <div key={key} className="col-span-12"><OnboardingWidget key={ob.items.map((x) => `${x.name}:${x.is_complete}${x.is_skipped}`).join()} data={ob} /></div> : null;
      }
      case "custom_block":
        return page?.custom_blocks?.items.some((x) => x.custom_block_name === d.custom_block_name) ? (
          <div key={key} className={span(d.col)}><CustomBlock name={String(d.custom_block_name)} /></div>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <SidebarIcon name={ws.icon} />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{ws.title || ws.label || ws.name}</h1>
          {ws.module && <p className="text-xs text-zinc-500">{ws.module}</p>}
        </div>
        <Link href={`/desk/doctype/Workspace/${enc(ws.name)}`} className="ml-auto rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          Edit
        </Link>
      </div>
      <div className="grid grid-cols-12 gap-4">{blocks.map(render)}</div>
      {!blocks.length && <p className="text-sm text-zinc-500">This workspace is empty.</p>}
    </div>
  );
}
