"use client";

/**
 * The apps signed in to the user's account with OAuth (Claude and others), with Revoke: Frappe's /third_party_apps,
 * plus when each was last used. Needs the crema app (crema.ai.connect.my_apps).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Plug } from "lucide-react";
import { timeAgo } from "@/lib/list/format";
import { useConnectAction, useMyApps, type MyApp } from "./useConnectClaude";

function AppRow({ app }: { app: MyApp }) {
  const [asking, setAsking] = useState(false);
  const revoke = useConnectAction<{ client: string }, number>("revoke_my_app", ["crema-my-apps", "crema-claude-connections"], `Couldn't revoke ${app.app_name}`);
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Plug className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--ink-default)]">{app.app_name}</span>
        <span className="block text-xs text-[var(--ink-muted)]">
          Connected {timeAgo(app.connected)} · last used {timeAgo(app.last_used)}
        </span>
      </span>
      {asking ? (
        <span className="flex items-center gap-2 text-xs" role="group" aria-label={`Revoke ${app.app_name}`}>
          <span className="text-[var(--ink-default)]">Sign {app.app_name} out of your account?</span>
          <button
            type="button"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate({ client: app.client }, { onSuccess: () => toast.success(`${app.app_name} revoked`) })}
            className="rounded-md bg-[var(--status-danger-fg)] px-2.5 py-1 font-medium text-[var(--surface-raised)] disabled:opacity-50"
          >
            Revoke
          </button>
          <button type="button" onClick={() => setAsking(false)} className="rounded-md px-2 py-1 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]">
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="rounded-md border border-[var(--outline-default)] px-3 py-1 text-xs text-[var(--ink-default)] hover:bg-[var(--surface-hover)]">
          Revoke
        </button>
      )}
    </li>
  );
}

export function ConnectedApps({ enabled = true }: { enabled?: boolean }) {
  const { data, isLoading } = useMyApps(enabled);
  return (
    <section aria-label="Connected apps" className="rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)]">
      <div className="border-b border-[var(--outline-default)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--ink-default)]">Connected apps</h2>
        <p className="text-xs text-[var(--ink-muted)]">Apps that act as you after you signed in to them. Revoke signs an app out.</p>
      </div>
      {isLoading ? (
        <p className="px-4 py-4 text-sm text-[var(--ink-muted)]">Loading…</p>
      ) : data?.length ? (
        <ul className="divide-y divide-[var(--outline-default)]">
          {data.map((app) => (
            <AppRow key={app.client} app={app} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-[var(--ink-muted)]">No apps are connected to your account.</p>
      )}
    </section>
  );
}
