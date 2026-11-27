"use client";

/**
 * A home supplied by an app on the site. An app that draws its own Desk home can name the whitelisted methods behind
 * it in the boot (`frappe.boot.home_api = {data, attention}`); Crema then draws that data with its own components
 * instead of its built-in home. Every list and count comes from the app, so it carries the app's permission rules.
 *
 * `data` is called with `opened` (documents opened in this browser, newest first: [{doctype, name, when}]) and
 * returns the shape below; `attention` returns only the parts that change during the day and is polled.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { getRecentDocs } from "@/lib/utils/recentDocs";

export interface HomeApi {
  data: string;
  attention?: string;
}

export interface Approval {
  doctype: string;
  name: string;
  title: string;
  state: string;
  actions: string[];
  owner?: string;
  waiting_since?: string;
  amount?: string;
}
export interface Assigned {
  todo: string;
  description?: string;
  date?: string;
  priority?: string;
  doctype?: string;
  name?: string;
  title?: string;
}
export interface Cue {
  key: string;
  module: string;
  doctype: string;
  label: string;
  tone?: "danger" | "warning" | "info" | "success" | string;
  count: number;
  more?: boolean;
  filters?: unknown[][];
  amount?: number;
  scope?: string;
}
export interface HomeEvent {
  name: string;
  subject: string;
  starts_on: string;
  ends_on?: string;
  all_day?: number;
}
export interface CardRef {
  name: string;
  label: string;
  doctype?: string | null;
}
export interface KpiGroup {
  module: string;
  workspace?: string | null;
  cards: CardRef[];
  chart?: CardRef | null;
  dashboard?: string | null;
  doctypes?: string[];
}
export interface RecentRow {
  key: string;
  type: string;
  doctype?: string;
  name?: string;
  title: string;
  subtitle?: string;
  action?: string;
  when: string;
  route?: string;
}
export interface Attention {
  approvals?: { items: Approval[]; total?: number; mine_total?: number };
  assigned?: { items: Assigned[]; total?: number };
  cues?: { items: Cue[]; currency?: string; modules?: string[] };
  events?: HomeEvent[];
}
export interface HomeData extends Attention {
  usage?: { doctypes?: Record<string, number>; modules?: Record<string, number> };
  kpis?: KpiGroup[];
  recent?: RecentRow[];
  modules?: string[];
  custom?: Array<{ doctype: string; label: string; module: string; can_create?: boolean }>;
  create_config?: Array<{ doctype: string; module?: string }>;
}

const ATTENTION_MS = 5 * 60 * 1000;

const opened = () =>
  getRecentDocs().map((d) => ({ doctype: d.doctype, name: d.name, when: new Date(d.at).toISOString().replace("T", " ").slice(0, 19) }));

/** the site's home API, when an installed app provides one */
export function useHomeApi(): { api: HomeApi | null; ready: boolean } {
  const { data: ctx, isSuccess, isError } = useDeskContext();
  const raw = ctx?.boot?.home_api as Partial<HomeApi> | undefined;
  return { api: raw && typeof raw.data === "string" ? (raw as HomeApi) : null, ready: isSuccess || isError };
}

export function useProviderHome(api: HomeApi) {
  const qc = useQueryClient();
  const home = useQuery({
    queryKey: ["provider-home", api.data],
    queryFn: () => frappeMethod<HomeData>(api.data, { opened: JSON.stringify(opened()) }),
    staleTime: 60_000,
  });
  // approvals, tasks and counts change during the day: refreshed on their own while the page is visible
  const attention = useQuery({
    queryKey: ["provider-home-attention", api.attention],
    queryFn: () => frappeMethod<Attention>(api.attention!, {}),
    enabled: !!api.attention && home.isSuccess,
    refetchInterval: ATTENTION_MS,
    refetchIntervalInBackground: false,
    staleTime: ATTENTION_MS,
  });
  const data: HomeData | undefined = home.data && { ...home.data, ...(attention.data ?? {}) };
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["provider-home"] });
    void qc.invalidateQueries({ queryKey: ["provider-home-attention"] });
  };
  return { data, isLoading: home.isLoading, error: home.error, refresh };
}

/** Frappe's own workflow API, the call Desk's list bulk action makes (checks the transition, roles and conditions) */
export const applyWorkflowAction = (doctype: string, name: string, action: string) =>
  frappeMethod("frappe.model.workflow.bulk_workflow_approval", { docnames: JSON.stringify([name]), doctype, action });
