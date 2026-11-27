"use client";

/**
 * The one "Claude" OAuth client (crema.ai.connect.create_claude_client): which roles may connect, then the three values
 * to paste into Claude's "Add custom connector" (connector URL, client id, client secret).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { frappeGet } from "@/lib/frappe/client";
import { CopyField } from "./CopyField";
import { useConnectAction, type ConnectStatus, type NewClient } from "./useConnectClaude";

const CLAUDE_CONNECTORS = "https://claude.ai/settings/connectors";

function useDeskRoles() {
  return useQuery({
    queryKey: ["crema-desk-roles"],
    queryFn: async () => (await frappeGet<{ data: { name: string }[] }>("Role", { filters: JSON.stringify([["disabled", "=", 0], ["desk_access", "=", 1]]), fields: JSON.stringify(["name"]), limit_page_length: 0, order_by: "name asc" })).data.map((r) => r.name),
    staleTime: 5 * 60 * 1000,
  });
}

function RolePicker({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const { data: roles = [] } = useDeskRoles();
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => roles.filter((r) => r.toLowerCase().includes(filter.trim().toLowerCase())), [roles, filter]);
  const flip = (role: string) => {
    const next = new Set(selected);
    if (!next.delete(role)) next.add(role);
    onChange(next);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-[var(--ink-muted)]">Roles that may connect Claude ({selected.size} chosen; none chosen: every desk user)</legend>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter roles" aria-label="Filter roles" className="w-full rounded-md border border-[var(--outline-default)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm" />
      <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-[var(--outline-default)] p-2 sm:grid-cols-2">
        {shown.map((role) => (
          <label key={role} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-[var(--ink-default)] hover:bg-[var(--surface-hover)]">
            <input type="checkbox" checked={selected.has(role)} onChange={() => flip(role)} className="h-3.5 w-3.5" />
            {role}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ConnectorValues({ client }: { client: NewClient }) {
  return (
    <div className="space-y-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4">
      <p className="text-sm font-medium text-[var(--ink-default)]">Paste these into Claude: Settings → Connectors → Add custom connector → Advanced settings.</p>
      <CopyField label="Connector URL" value={client.mcp_url} />
      <CopyField label="OAuth client ID" value={client.client_id} />
      <CopyField label="OAuth client secret (keep it private)" value={client.client_secret} />
      <a href={CLAUDE_CONNECTORS} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-link)] hover:underline">
        Open Claude&apos;s connector settings <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
      <p className="text-xs text-[var(--ink-muted)]">Then each person opens the connector in Claude, selects Connect and signs in to this site.</p>
    </div>
  );
}

export function ClaudeClientCard({ status }: { status: ConnectStatus }) {
  const existing = status.client;
  const [roles, setRoles] = useState<Set<string>>(() => new Set(existing?.roles ?? ["System Manager"]));
  const save = useConnectAction<{ roles: string[] }, NewClient>("create_claude_client", ["crema-claude-status"], "Couldn't save the Claude client");
  return (
    <section aria-label="Claude client" className="space-y-4 rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)] p-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--ink-default)]">Claude client</h2>
        <p className="text-xs text-[var(--ink-muted)]">
          {existing ? `Created (${existing.client_id}). Change who may connect, or show the values again.` : "One OAuth client for Claude. Creating it turns dynamic client registration off."}
        </p>
      </div>
      <RolePicker selected={roles} onChange={setRoles} />
      <button
        type="button"
        disabled={save.isPending}
        onClick={() => save.mutate({ roles: [...roles] })}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {existing ? "Save and show the connector values" : "Create Claude client"}
      </button>
      {save.data && <ConnectorValues client={save.data} />}
    </section>
  );
}
