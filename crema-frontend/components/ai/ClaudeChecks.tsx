"use client";

/** What the site needs before Claude can connect (crema.ai.connect.checks), each with a one-click fix where possible. */
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConnectAction, type Check, type ConnectStatus } from "./useConnectClaude";

function CheckRow({ check }: { check: Check }) {
  const fix = useConnectAction<{ check: string; value?: string }, ConnectStatus>("fix", ["crema-claude-status"], `Couldn't fix "${check.label}"`);
  const Icon = check.ok ? CircleCheck : CircleX;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${check.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-danger-fg)]"}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-[var(--ink-default)]">
          {check.label}
          <span className="sr-only">{check.ok ? ": done" : ": needs attention"}</span>
        </span>
        <span className="block break-all text-xs text-[var(--ink-muted)]">{check.detail}</span>
      </span>
      {check.fixable && (
        <button
          type="button"
          disabled={fix.isPending}
          // Crema's address is where this page is open
          onClick={() => fix.mutate({ check: check.key, ...(check.key === "crema_url" ? { value: window.location.origin } : {}) }, { onSuccess: () => toast.success(`${check.label}: fixed`) })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--outline-default)] px-3 py-1 text-xs text-[var(--ink-default)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          {fix.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          {check.key === "crema_url" ? "Use this address" : "Fix"}
        </button>
      )}
    </li>
  );
}

export function ClaudeChecks({ checks }: { checks: Check[] }) {
  const open = checks.filter((c) => !c.ok).length;
  const publicSite = checks.find((c) => c.key === "public_https")?.ok;
  return (
    <section aria-label="Checks" className="rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)]">
      <div className="border-b border-[var(--outline-default)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--ink-default)]">Site checks</h2>
        <p className="text-xs text-[var(--ink-muted)]">{open ? `${open} of ${checks.length} need attention.` : "Everything Claude needs is in place."}</p>
      </div>
      <ul className="divide-y divide-[var(--outline-default)]">
        {checks.map((c) => (
          <CheckRow key={c.key} check={c} />
        ))}
      </ul>
      {publicSite === false && (
        <p className="border-t border-[var(--outline-default)] px-4 py-3 text-xs text-[var(--ink-muted)]">
          Claude connects from Anthropic&apos;s cloud, so it needs the site at a public HTTPS address (a hosted site, or a tunnel such as Cloudflare Tunnel). Until then, use Claude on this computer
          (next tab), which connects from your machine.
        </p>
      )}
    </section>
  );
}
