"use client";

/**
 * Claude on one computer (docs/PHASE2_DESIGN.md § 5.14, "Tier 0-local"): Claude Code and Claude Desktop connect from
 * the user's machine, so the site needn't be public. Authentication is the user's own API key (crema.ai.connect
 * generate_my_key), sent as `Authorization: token key:secret`; the secret is shown once.
 */
import { useState } from "react";
import { Download, KeyRound, Loader2 } from "lucide-react";
import { CopyField } from "./CopyField";
import { useConnectAction, useMyKey, type MyKey, type NewKey } from "./useConnectClaude";

const HEADERS_FILE = "frappe-mcp-headers.txt";
const PLACEHOLDER = "Authorization: token <api_key>:<api_secret>";

/** mcp-remote refuses plain http except on loopback unless told to allow it */
function needsAllowHttp(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

function desktopConfig(url: string): string {
  const args = ["-y", "mcp-remote", url, "--header-file", `/path/to/${HEADERS_FILE}`, ...(needsAllowHttp(url) ? ["--allow-http"] : [])];
  return JSON.stringify({ mcpServers: { crema: { command: "npx", args } } }, null, 2);
}

function download(text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = HEADERS_FILE;
  a.click();
  URL.revokeObjectURL(a.href);
}

function KeyCard({ info }: { info: MyKey }) {
  const [fresh, setFresh] = useState<NewKey | null>(null);
  const create = useConnectAction<Record<string, never>, NewKey>("generate_my_key", ["crema-my-key"], "Couldn't create your key");
  const revoke = useConnectAction<Record<string, never>, MyKey>("revoke_my_key", ["crema-my-key"], "Couldn't revoke your key");
  if (!info.allowed)
    return <p className="rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--ink-muted)]">Your role can&apos;t create a key for Claude. A System Manager can add your role in Crema AI Settings.</p>;
  return (
    <section aria-label="Your API key" className="space-y-3 rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <KeyRound className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--ink-default)]">Your API key</h2>
          <p className="text-xs text-[var(--ink-muted)]">{info.has_secret ? `You have a key (${info.api_key}). A new one replaces it.` : "No key yet."}</p>
        </div>
        <button type="button" disabled={create.isPending} onClick={() => create.mutate({}, { onSuccess: setFresh })} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50">
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {info.has_secret ? "Create a new key" : "Create key"}
        </button>
        {info.has_secret && (
          <button type="button" disabled={revoke.isPending} onClick={() => revoke.mutate({}, { onSuccess: () => setFresh(null) })} className="rounded-lg border border-[var(--outline-default)] px-3 py-1.5 text-sm text-[var(--ink-default)] hover:bg-[var(--surface-hover)] disabled:opacity-50">
            Revoke
          </button>
        )}
      </div>
      {fresh && (
        <div className="space-y-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3">
          <p className="text-xs text-[var(--ink-default)]">Shown once. Save it in the headers file now; it isn&apos;t shown again.</p>
          <CopyField label="Header" value={fresh.header} />
          <button type="button" onClick={() => download(`${fresh.header}\n`)} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-link)] hover:underline">
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download {HEADERS_FILE}
          </button>
        </div>
      )}
      <p className="text-xs text-[var(--ink-muted)]">This key acts as you, with all your permissions, until you revoke it. Keep the file private and don&apos;t paste it into chats. Claude still only makes drafts, and its calls show in AI activity.</p>
      <ClientSetup url={info.mcp_url} header={fresh?.header ?? PLACEHOLDER} />
    </section>
  );
}

function ClientSetup({ url, header }: { url: string; header: string }) {
  return (
    <div className="space-y-4 border-t border-[var(--outline-default)] pt-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--ink-default)]">Claude Code</h3>
        <CopyField label="Run in a terminal" value={`claude mcp add --transport http crema ${url} --header "${header}"`} multiline />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--ink-default)]">Claude Desktop</h3>
        <p className="text-xs text-[var(--ink-muted)]">
          Settings → Developer → Edit Config opens <code>claude_desktop_config.json</code> (macOS: <code>~/Library/Application Support/Claude/</code>, Windows: <code>%APPDATA%\Claude\</code>). Add
          this, with the path to the headers file you downloaded, then restart Claude Desktop.
        </p>
        <CopyField label="claude_desktop_config.json" value={desktopConfig(url)} multiline />
      </div>
    </div>
  );
}

export function ClaudeLocalSetup() {
  const { data, isLoading } = useMyKey(true);
  if (isLoading || !data) return <p className="text-sm text-[var(--ink-muted)]">Loading…</p>;
  return <KeyCard info={data} />;
}
