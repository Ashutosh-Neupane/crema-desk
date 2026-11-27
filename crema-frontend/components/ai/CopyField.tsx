"use client";

/** A value to paste somewhere else (a URL, a client id, a command), with a Copy button. */
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-[var(--ink-muted)]">{label}</div>
      <div className="flex items-start gap-2">
        <code className={`min-w-0 flex-1 rounded-md border border-[var(--outline-default)] bg-[var(--surface-sunken)] px-3 py-2 font-mono text-xs text-[var(--ink-default)] ${multiline ? "whitespace-pre-wrap break-all" : "truncate"}`}>{value}</code>
        <button type="button" onClick={() => void copy()} aria-label={`Copy ${label}`} className="shrink-0 rounded-md border border-[var(--outline-default)] p-2 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-default)]">
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
