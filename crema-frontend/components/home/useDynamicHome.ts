"use client";

/**
 * The dynamic home's card list (docs/PHASE2_DESIGN.md § 4.1): signals → ranked DocTypes (lib/home/rank.ts) →
 * cards. Nothing is configured: which cards appear, and in what order, comes from the user's permissions and what
 * they actually do. "Needs you" always comes first; Workspaces always last.
 */
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { rankDoctypes, type Ranked, type UsageEvent } from "@/lib/home/rank";
import { fetchCharts, fetchEvents, fetchNumberCards, fetchStatusCounts, type CardRef, type EventItem, type StatusCount } from "./homeApi";
import { useMyWork } from "./useMyWork";
import type { Shortcut, WorkItem } from "./data";

export type CardSize = 2 | 4 | 6 | 12;

export type HomeCard =
  | { id: "needs-you"; type: "needs-you"; title: string; size: CardSize; score: number; items: WorkItem[] }
  | { id: "quick-create"; type: "quick-create"; title: string; size: CardSize; score: number; doctypes: string[] }
  | { id: "continue"; type: "continue"; title: string; size: CardSize; score: number; items: WorkItem[] }
  | { id: string; type: "kpi"; title: string; size: CardSize; score: number; card: CardRef }
  | { id: string; type: "status"; title: string; size: CardSize; score: number; doctype: string; counts: StatusCount[] }
  | { id: string; type: "chart"; title: string; size: CardSize; score: number; card: CardRef }
  | { id: "today"; type: "today"; title: string; size: CardSize; score: number; events: EventItem[] }
  | { id: "recent"; type: "recent"; title: string; size: CardSize; score: number; items: WorkItem[] };

/** stored in user_settings "Crema Home" (§ 4.1.8) */
export interface HomeLayout {
  pinned: string[];
  hidden: string[];
}
const LAYOUT_KEY = "Crema Home";
const EMPTY_LAYOUT: HomeLayout = { pinned: [], hidden: [] };

const WEEK = 7 * 86_400_000;
const MAX_KPIS = 4;
const MAX_CHARTS = 2;
const MAX_STATUS = 2;

function usageEvents(waiting: WorkItem[], drafts: WorkItem[], recent: WorkItem[], visited: Array<{ doctype?: string; count?: number }>): UsageEvent[] {
  const events: UsageEvent[] = [];
  for (const w of waiting) events.push({ doctype: w.doctype, kind: "workflow", at: w.at });
  for (const d of drafts) events.push({ doctype: d.doctype, kind: "created", at: d.at });
  for (const r of recent) events.push({ doctype: r.doctype, kind: r.kind === "edited" ? "edited" : "opened", at: r.at });
  // Desk's route history: one event per visit, capped so one busy list doesn't drown the rest
  for (const v of visited) for (let i = 0; i < Math.min(5, v.count ?? 1); i++) if (v.doctype) events.push({ doctype: v.doctype, kind: "visited" });
  return events;
}

/** creatable DocTypes for Quick create: by score, then workspace "New" shortcuts, then submittable ones */
function quickCreate(ranked: Ranked[], canCreate: ReadonlySet<string>, shortcuts: Shortcut[], canSubmit: ReadonlySet<string>, max = 6): string[] {
  const out: string[] = [];
  const add = (dt?: string) => dt && canCreate.has(dt) && !out.includes(dt) && out.length < max && out.push(dt);
  ranked.forEach((r) => add(r.doctype));
  shortcuts.forEach((s) => add(s.doctype));
  [...canSubmit].sort().forEach(add);
  return out;
}

export function useHomeLayout(user: string) {
  const qc = useQueryClient();
  const key = useMemo(() => ["home-layout", user], [user]);
  const { data } = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async (): Promise<HomeLayout> => {
      const raw = await frappeMethod<unknown>("frappe.model.utils.user_settings.get", { doctype: LAYOUT_KEY });
      try {
        const p = typeof raw === "string" ? (JSON.parse(raw) as Partial<HomeLayout>) : ((raw ?? {}) as Partial<HomeLayout>);
        return { pinned: Array.isArray(p.pinned) ? p.pinned : [], hidden: Array.isArray(p.hidden) ? p.hidden : [] };
      } catch {
        return EMPTY_LAYOUT;
      }
    },
  });
  const layout = data ?? EMPTY_LAYOUT;
  const save = useCallback(
    (next: HomeLayout) => {
      qc.setQueryData(key, next);
      void frappeMethod("frappe.model.utils.user_settings.save", { doctype: LAYOUT_KEY, user_settings: JSON.stringify(next) }).catch(() => undefined);
    },
    [qc, key],
  );
  return {
    layout,
    togglePin: (id: string) => save({ ...layout, pinned: layout.pinned.includes(id) ? layout.pinned.filter((x) => x !== id) : [...layout.pinned, id] }),
    hide: (id: string) => save({ pinned: layout.pinned.filter((x) => x !== id), hidden: [...new Set([...layout.hidden, id])] }),
    restore: (id: string) => save({ ...layout, hidden: layout.hidden.filter((x) => x !== id) }),
    reset: () => save(EMPTY_LAYOUT),
  };
}

export function useDynamicHome() {
  const work = useMyWork();
  const { session, waiting, drafts, recent, shortcuts } = work;
  const { user, canRead, canCreate, canSubmit, visited } = session;
  const [now] = useState(() => Date.now());

  const ranked = useMemo(() => {
    if (!user || waiting.isPending) return null;
    return rankDoctypes({
      events: usageEvents(waiting.data ?? [], drafts, recent, visited),
      canRead,
      canSubmit,
      shortcuts: (shortcuts.data?.shortcuts ?? []).map((s) => s.doctype ?? ""),
      now,
    });
  }, [user, waiting.isPending, waiting.data, drafts, recent, visited, canRead, canSubmit, shortcuts.data, now]);

  const top = useMemo(() => (ranked ?? []).slice(0, 8).map((r) => r.doctype), [ranked]);
  const scoreOf = useMemo(() => new Map((ranked ?? []).map((r) => [r.doctype, r.score])), [ranked]);

  const kpis = useQuery({ queryKey: ["home", "kpis", user, top], enabled: !!ranked, staleTime: 60_000, queryFn: () => fetchNumberCards(user, top) });
  const charts = useQuery({ queryKey: ["home", "charts", user, top], enabled: !!ranked, staleTime: 60_000, queryFn: () => fetchCharts(user, top) });
  // status counts for the top DocTypes that have no Number Card of their own
  const statusDoctypes = useMemo(() => {
    if (!kpis.data) return null;
    const withCard = new Set(kpis.data.map((k) => k.doctype));
    return top.slice(0, 4).filter((d) => !withCard.has(d));
  }, [kpis.data, top]);
  const status = useQuery({
    queryKey: ["home", "status", user, statusDoctypes],
    enabled: !!statusDoctypes,
    staleTime: 60_000,
    queryFn: async () => {
      const all = await Promise.all((statusDoctypes ?? []).map(async (doctype) => ({ doctype, counts: await fetchStatusCounts(doctype).catch(() => null) })));
      return all.filter((s): s is { doctype: string; counts: StatusCount[] } => !!s.counts?.length).slice(0, MAX_STATUS);
    },
  });
  const events = useQuery({ queryKey: ["home", "events", user], enabled: !!user && canRead.has("Event"), staleTime: 60_000, queryFn: () => fetchEvents() });

  const cards = useMemo<HomeCard[]>(() => {
    const out: HomeCard[] = [];
    const dtScore = (dt: string) => 0.3 + 0.6 * (scoreOf.get(dt) ?? 0);
    const qc = ranked ? quickCreate(ranked, canCreate, shortcuts.data?.shortcuts ?? [], canSubmit) : [];
    if (qc.length) out.push({ id: "quick-create", type: "quick-create", title: "Quick create", size: 4, score: 0.95, doctypes: qc });
    const cont = [...drafts, ...recent.filter((r) => r.kind === "edited" && (r.at ?? 0) > now - WEEK)];
    const seen = new Set<string>();
    const contItems = cont.filter((i) => !seen.has(`${i.doctype}/${i.name}`) && seen.add(`${i.doctype}/${i.name}`)).slice(0, 6);
    if (contItems.length) out.push({ id: "continue", type: "continue", title: "Continue", size: 4, score: 0.9, items: contItems });
    for (const k of (kpis.data ?? []).slice(0, MAX_KPIS)) out.push({ id: `kpi:${k.name}`, type: "kpi", title: k.label, size: 2, score: dtScore(k.doctype), card: k });
    for (const s of status.data ?? []) out.push({ id: `status:${s.doctype}`, type: "status", title: s.doctype, size: 2, score: dtScore(s.doctype), doctype: s.doctype, counts: s.counts });
    for (const c of (charts.data ?? []).slice(0, MAX_CHARTS)) out.push({ id: `chart:${c.name}`, type: "chart", title: c.label, size: 6, score: dtScore(c.doctype) - 0.05, card: c });
    const ev = events.data ?? [];
    if (ev.length) {
      out.push({ id: "today", type: "today", title: "Today and this week", size: 4, score: ev.some((e) => e.isToday) ? 0.88 : 0.4, events: ev });
    }
    const rec = recent.slice(0, 8);
    if (rec.length) out.push({ id: "recent", type: "recent", title: "Recent", size: 4, score: 0.5, items: rec });
    out.sort((a, b) => b.score - a.score);
    // obligations before habits: Needs you is always first, even when empty ("All clear")
    out.unshift({ id: "needs-you", type: "needs-you", title: "Needs you", size: 4, score: 1, items: waiting.data ?? [] });
    return out;
  }, [ranked, canCreate, canSubmit, shortcuts.data, drafts, recent, now, kpis.data, status.data, charts.data, events.data, scoreOf, waiting.data]);

  const loading = !ranked;
  return { work, cards, ranked, loading };
}
