"use client";

/**
 * Data for Connect Claude (docs/PHASE2_DESIGN.md § 5.14), from the crema Frappe app's crema.ai.connect methods.
 * The app is optional: `installed` is false when the site doesn't have it (boot.versions has no "crema").
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { toastError } from "@/lib/frappe/errors";

const M = "crema.ai.connect";

export interface Check {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  fixable: boolean;
}
export interface ClaudeClient {
  name: string;
  client_id: string;
  app_name: string;
  roles: string[];
  redirect_ok: boolean;
}
export interface ConnectStatus {
  mcp_url: string;
  callback: string;
  checks: Check[];
  client: ClaudeClient | null;
  agent_instructions: string;
}
export interface NewClient {
  client_id: string;
  client_secret: string;
  mcp_url: string;
  callback: string;
}
export interface Connection {
  name: string;
  user: string;
  creation: string;
  modified: string;
  expiration_time: string;
  status: string;
}
export interface MyApp {
  client: string;
  app_name: string;
  connected: string;
  last_used: string;
  tokens: number;
}
export interface MyKey {
  mcp_url: string;
  allowed: boolean;
  api_key: string | null;
  has_secret: boolean;
}
export interface NewKey {
  api_key: string;
  api_secret: string;
  header: string;
  mcp_url: string;
}

/** the crema app is on the site, and whether the user may manage the site's Claude setup */
export function useCremaApp() {
  const { data: ctx, isSuccess } = useDeskContext();
  const versions = (ctx?.boot?.versions ?? {}) as Record<string, unknown>;
  return { ready: isSuccess, installed: "crema" in versions, isManager: (ctx?.roles ?? []).includes("System Manager") };
}

export function useClaudeStatus(enabled: boolean) {
  return useQuery({ queryKey: ["crema-claude-status"], queryFn: () => frappeMethod<ConnectStatus>(`${M}.status`), enabled });
}

export function useConnections(enabled: boolean) {
  return useQuery({ queryKey: ["crema-claude-connections"], queryFn: () => frappeMethod<Connection[]>(`${M}.connections`), enabled });
}

export function useMyApps(enabled: boolean) {
  return useQuery({ queryKey: ["crema-my-apps"], queryFn: () => frappeMethod<MyApp[]>(`${M}.my_apps`), enabled });
}

export function useMyKey(enabled: boolean) {
  return useQuery({ queryKey: ["crema-my-key"], queryFn: () => frappeMethod<MyKey>(`${M}.my_key`), enabled });
}

/** a crema.ai.connect write; refreshes what it changes */
export function useConnectAction<A extends Record<string, unknown>, R>(method: string, refresh: string[], failure: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => frappeMethod<R>(`${M}.${method}`, args),
    onSuccess: () => {
      for (const key of refresh) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e) => toastError(e, failure),
  });
}
