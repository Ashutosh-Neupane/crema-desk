"use client";

/**
 * The desk home an installed app supplies (useProviderHome): a greeting with what waits today and Create buttons,
 * "At a glance" (the KPI cards, chart and busiest lists of each module the user works in, as tabs), Recent, and
 * "Needs your attention" beside them (AttentionPanel).
 */
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, FileText, LayoutGrid, Plus, RefreshCw } from "lucide-react";
import { ChartCard, NumberCard } from "@/components/desk/Widgets";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { useNavigation } from "@/lib/hooks/useNavigation";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { dashboardUrl, newDocUrl, workspaceUrl } from "@/lib/navigation/deskUrl";
import { timeAgo } from "@/lib/list/format";
import { useRouter } from "next/navigation";
import { AttentionPanel } from "./AttentionPanel";
import { createList, headline, orderedGroups, quickLinks, recentHref } from "./homeModel";
import { useProviderHome, type HomeApi, type HomeData, type KpiGroup } from "./useProviderHome";

const noSubscribe = () => () => {};
const CARD = "rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)]";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function CreateButtons({ own, other }: { own: string[]; other: string[] }) {
  const router = useRouter();
  const inline = [...own, ...other].slice(0, 2);
  if (!inline.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {inline.map((dt) => (
        <Link key={dt} href={newDocUrl(dt)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--outline-default)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--ink-default)] hover:bg-[var(--surface-hover)]">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {dt}
        </Link>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white hover:opacity-90">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[60vh] w-56 overflow-y-auto">
          {own.length > 0 && <DropdownMenuLabel>This module</DropdownMenuLabel>}
          {own.map((dt) => (
            <DropdownMenuItem key={dt} onClick={() => router.push(newDocUrl(dt))}>
              {dt}
            </DropdownMenuItem>
          ))}
          {own.length > 0 && other.length > 0 && <DropdownMenuSeparator />}
          {other.map((dt) => (
            <DropdownMenuItem key={dt} onClick={() => router.push(newDocUrl(dt))}>
              {dt}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Greeting({ data, group }: { data: HomeData; group?: KpiGroup }) {
  const { data: ctx } = useDeskContext();
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const canCreate = new Set(ctx?.perms?.can_create ?? []);
  const { own, other } = createList(data, group, canCreate);
  const first = ctx?.full_name?.split(" ")[0];
  return (
    <header className="flex flex-wrap items-end gap-4 pt-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--accent)]" suppressHydrationWarning>
          {hydrated ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : " "}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink-default)] sm:text-3xl">
          {hydrated ? greeting() : "Welcome"}
          {hydrated && first ? `, ${first}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">{headline(data)}</p>
      </div>
      <CreateButtons own={own} other={other} />
    </header>
  );
}

function GroupLinks({ group, data }: { group: KpiGroup; data: HomeData }) {
  const { data: nav } = useNavigation();
  const links = quickLinks(nav?.sections ?? [], group, data.cues?.items ?? []);
  const tile = "flex items-center gap-3 rounded-lg border border-[var(--outline-default)] bg-[var(--surface-raised)] px-3 py-2.5 hover:bg-[var(--surface-hover)]";
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {group.workspace && (
        <Link href={workspaceUrl(group.workspace)} className={tile}>
          <LayoutGrid className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-[var(--ink-default)]">Open {group.workspace}</span>
            <span className="block text-xs text-[var(--ink-muted)]">Workspace</span>
          </span>
        </Link>
      )}
      {group.dashboard && (
        <Link href={dashboardUrl(group.dashboard)} className={tile}>
          <ExternalLink className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-[var(--ink-default)]">Full dashboard</span>
            <span className="block text-xs text-[var(--ink-muted)]">Every card and chart</span>
          </span>
        </Link>
      )}
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={tile} title={l.hint}>
          <FileText className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink-default)]">{l.label}</span>
          {l.count ? <span className={`tabular rounded-full px-2 py-0.5 text-xs font-medium ${l.tone === "danger" ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]" : "bg-[var(--surface-sunken)] text-[var(--ink-default)]"}`}>{l.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

function AtAGlance({ groups, data, active, setActive }: { groups: KpiGroup[]; data: HomeData; active: number; setActive: (i: number) => void }) {
  const group = groups[active];
  if (!group) return null;
  return (
    <section aria-label="At a glance" className="space-y-3">
      <h2 className="text-sm font-medium text-[var(--ink-muted)]">At a glance</h2>
      <div role="tablist" aria-label="Modules" className="flex gap-1 overflow-x-auto rounded-lg border border-[var(--outline-default)] bg-[var(--surface-sunken)] p-1">
        {groups.map((g, i) => (
          <button
            key={g.module}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${i === active ? "bg-[var(--surface-raised)] font-medium text-[var(--ink-default)] shadow-sm" : "text-[var(--ink-muted)] hover:text-[var(--ink-default)]"}`}
          >
            {g.module}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={group.module} className="crema-fade space-y-3" key={group.module}>
        {group.cards.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] gap-3">
            {group.cards.slice(0, 4).map((c) => (
              <NumberCard key={c.name} name={c.name} label={c.label} />
            ))}
          </div>
        )}
        {group.chart && <ChartCard name={group.chart.name} label={group.chart.label} height={220} />}
        <GroupLinks group={group} data={data} />
      </div>
    </section>
  );
}

function Recent({ data }: { data: HomeData }) {
  const rows = (data.recent ?? []).map((r) => ({ r, href: recentHref(r) })).filter((x) => x.href);
  if (!rows.length) return null;
  return (
    <section aria-label="Recent" className="space-y-3">
      <h2 className="text-sm font-medium text-[var(--ink-muted)]">Recent</h2>
      <ul className={`${CARD} divide-y divide-[var(--outline-default)]`}>
        {rows.map(({ r, href }) => (
          <li key={r.key}>
            <Link href={href!} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)]">
              <FileText className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--ink-default)]">{r.title}</span>
                <span className="block truncate text-xs text-[var(--ink-muted)]">
                  {r.action && <span className={r.action === "Cancelled" ? "text-[var(--status-danger-fg)]" : r.action === "Submitted" ? "text-[var(--status-success-fg)]" : ""}>{r.action}</span>}
                  {r.action && " · "}
                  {r.subtitle}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[var(--ink-muted)]">{timeAgo(r.when)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading home">
      <div className="h-20 w-2/3 animate-pulse rounded-xl bg-[var(--surface-sunken)]" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-96 animate-pulse rounded-xl bg-[var(--surface-sunken)]" />
        <div className="h-96 animate-pulse rounded-xl bg-[var(--surface-sunken)]" />
      </div>
    </div>
  );
}

export default function ProviderHome({ api, fallback }: { api: HomeApi; fallback: React.ReactNode }) {
  const { data, isLoading, error, refresh } = useProviderHome(api);
  const [active, setActive] = useState(0);
  if (error) return <>{fallback}</>;
  if (isLoading || !data) return <Skeleton />;
  const groups = orderedGroups(data);
  return (
    <div className="mx-auto max-w-[110rem] space-y-6 pb-12">
      <Greeting data={data} group={groups[active]} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-8">
          <AtAGlance groups={groups} data={data} active={Math.min(active, groups.length - 1)} setActive={setActive} />
          <Recent data={data} />
        </div>
        <div className="lg:sticky lg:top-16">
          <AttentionPanel data={data} onChanged={refresh} />
          <button type="button" onClick={refresh} className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--ink-default)]">
            <RefreshCw className="h-3 w-3" aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
