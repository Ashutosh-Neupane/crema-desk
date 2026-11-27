"use client";

/** Everyone signed in to the Claude client (System Manager): who, when, last used, with Revoke and Revoke all. */
import { useState } from "react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/list/format";
import { useConnectAction, useConnections, type Connection } from "./useConnectClaude";

const REFRESH = ["crema-claude-connections", "crema-my-apps"];

function Row({ c }: { c: Connection }) {
  const revoke = useConnectAction<{ name: string }, number>("revoke_connection", REFRESH, `Couldn't revoke ${c.user}'s connection`);
  return (
    <tr className="border-t border-[var(--outline-default)]">
      <td className="px-4 py-2 text-sm text-[var(--ink-default)]">{c.user}</td>
      <td className="px-4 py-2 text-xs text-[var(--ink-muted)]">{timeAgo(c.creation)}</td>
      <td className="px-4 py-2 text-xs text-[var(--ink-muted)]">{timeAgo(c.modified)}</td>
      <td className="px-4 py-2 text-xs text-[var(--ink-muted)]">{c.status}</td>
      <td className="px-4 py-2 text-right">
        <button type="button" disabled={revoke.isPending} onClick={() => revoke.mutate({ name: c.name }, { onSuccess: () => toast.success(`${c.user} signed out of Claude`) })} className="rounded-md border border-[var(--outline-default)] px-2.5 py-1 text-xs text-[var(--ink-default)] hover:bg-[var(--surface-hover)] disabled:opacity-50">
          Revoke
        </button>
      </td>
    </tr>
  );
}

function RevokeAll({ count }: { count: number }) {
  const [asking, setAsking] = useState(false);
  const revoke = useConnectAction<{ all: 1 }, number>("revoke_connection", REFRESH, "Couldn't revoke the connections");
  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className="rounded-md border border-[var(--outline-default)] px-3 py-1 text-xs text-[var(--ink-default)] hover:bg-[var(--surface-hover)]">
        Revoke all
      </button>
    );
  return (
    <span className="flex items-center gap-2 text-xs" role="group" aria-label="Revoke all">
      <span className="text-[var(--ink-default)]">Sign all {count} out of Claude?</span>
      <button type="button" disabled={revoke.isPending} onClick={() => revoke.mutate({ all: 1 }, { onSuccess: (n) => toast.success(`${n} connections revoked`), onSettled: () => setAsking(false) })} className="rounded-md bg-[var(--status-danger-fg)] px-2.5 py-1 font-medium text-[var(--surface-raised)] disabled:opacity-50">
        Revoke all
      </button>
      <button type="button" onClick={() => setAsking(false)} className="rounded-md px-2 py-1 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]">
        Cancel
      </button>
    </span>
  );
}

export function ClaudeConnections() {
  const { data = [], isLoading } = useConnections(true);
  return (
    <section aria-label="Claude connections" className="overflow-hidden rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--ink-default)]">Connections</h2>
          <p className="text-xs text-[var(--ink-muted)]">People signed in to Claude on this site. What Claude does is in AI activity (Crema AI Log).</p>
        </div>
        {data.length > 1 && <RevokeAll count={data.length} />}
      </div>
      {isLoading ? (
        <p className="border-t border-[var(--outline-default)] px-4 py-4 text-sm text-[var(--ink-muted)]">Loading…</p>
      ) : data.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--surface-sunken)] text-xs text-[var(--ink-muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Connected</th>
                <th className="px-4 py-2 font-medium">Last used</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <Row key={c.name} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-t border-[var(--outline-default)] px-4 py-4 text-sm text-[var(--ink-muted)]">Nobody has connected Claude yet.</p>
      )}
    </section>
  );
}
