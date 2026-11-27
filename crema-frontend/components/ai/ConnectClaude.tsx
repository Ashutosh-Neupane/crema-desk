"use client";

/**
 * Connect Claude (docs/PHASE2_DESIGN.md § 5.14). "Claude on the web": the site checks, the Claude OAuth client and
 * everyone's connections (System Manager), and your connected apps. "On this computer": your own API key for Claude
 * Code / Claude Desktop. Needs the crema Frappe app on the site.
 */
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/crema-ui";
import { ClaudeChecks } from "./ClaudeChecks";
import { ClaudeClientCard } from "./ClaudeClientCard";
import { ClaudeConnections } from "./ClaudeConnections";
import { ClaudeLocalSetup } from "./ClaudeLocalSetup";
import { ConnectedApps } from "./ConnectedApps";
import { useClaudeStatus, useCremaApp } from "./useConnectClaude";

const TABS = [
  { key: "web", label: "Claude on the web" },
  { key: "local", label: "On this computer" },
] as const;

function WebSetup({ isManager }: { isManager: boolean }) {
  const { data: status, error } = useClaudeStatus(isManager);
  if (!isManager)
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--ink-muted)]">
          A System Manager adds this site to Claude once. Then open the connector in Claude (claude.ai, Claude Desktop or the mobile app), select Connect and sign in here. Claude works with your permissions and only makes drafts.
        </p>
        <ConnectedApps />
      </div>
    );
  if (error) return <p className="text-sm text-[var(--status-danger-fg)]">{error.message}</p>;
  if (!status) return <p className="text-sm text-[var(--ink-muted)]">Checking the site…</p>;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <ClaudeChecks checks={status.checks} />
        <ConnectedApps />
      </div>
      <div className="space-y-4">
        <ClaudeClientCard status={status} />
        <ClaudeConnections />
      </div>
    </div>
  );
}

export default function ConnectClaude() {
  const { ready, installed, isManager } = useCremaApp();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("web");
  if (!ready) return null;
  return (
    <div className="mx-auto max-w-[96rem] space-y-5 pb-12">
      <header className="pt-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--ink-default)]">
          <Sparkles className="h-5 w-5 text-[var(--ink-muted)]" aria-hidden="true" /> Connect Claude
        </h1>
        <p className="mt-1 max-w-prose text-sm text-[var(--ink-muted)]">Work with this site from Claude: ask about your data, and have Claude draft orders and documents for you to check and submit in Crema.</p>
      </header>
      {!installed ? (
        <EmptyState
          icon={Sparkles}
          title="The Crema app isn't on this site"
          description="Connect Claude needs the crema Frappe app (bench get-app, then bench --site <site> install-app crema). It adds the site checks, the Claude client, the drafts-only rule and AI activity."
        />
      ) : (
        <>
          <div role="tablist" aria-label="Where Claude runs" className="flex gap-1 border-b border-[var(--outline-default)]">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`relative px-3 py-2.5 text-sm ${tab === t.key ? "font-medium text-[var(--ink-default)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--ink-default)]" : "text-[var(--ink-muted)] hover:text-[var(--ink-default)]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)?.label}>
            {tab === "web" ? <WebSetup isManager={isManager} /> : <ClaudeLocalSetup />}
          </div>
        </>
      )}
    </div>
  );
}
