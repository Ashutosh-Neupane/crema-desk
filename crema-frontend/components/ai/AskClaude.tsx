"use client";

/**
 * Header ✦ (⌘I): "Ask in Claude" (docs/PHASE2_DESIGN.md § 5.17 hand-off, § 5.19). A website can't send messages into
 * a person's Claude subscription, so Crema hands the question over: the desktop app opens with the prompt filled in
 * (claude://claude.ai/new?q=, documented, ~14,000 characters), and on the web the prompt is copied and claude.ai
 * opens. The prompt names this page so Claude can read it through the connector.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, Copy, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { useCremaApp, useMyApps } from "./useConnectClaude";

const MAX_PROMPT = 14000;

/** the question plus where the user is, so Claude can look it up with the Crema connector */
function claudePrompt(question: string, page: { title: string; url: string }): string {
  const context = `I'm on "${page.title}" in Crema (${page.url}). Use the Crema connector to read what you need from the site.`;
  return `${question.trim()}\n\n${context}`.slice(0, MAX_PROMPT);
}

function Body({ onDone }: { onDone: () => void }) {
  const [question, setQuestion] = useState("");
  // the popover opens to type a question: focus it (a ref, as the popover mounts the field on open)
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus(), []);
  const { data: apps = [] } = useMyApps(true);
  const connected = apps.some((a) => /claude/i.test(a.app_name));
  const prompt = () => claudePrompt(question, { title: document.title.replace(/ \| Crema$/, ""), url: window.location.href });
  const desktop = () => {
    window.location.href = `claude://claude.ai/new?q=${encodeURIComponent(prompt())}`;
    onDone();
  };
  const web = async () => {
    await navigator.clipboard.writeText(prompt());
    toast.success("Prompt copied. Paste it into Claude.");
    window.open("https://claude.ai/new", "_blank", "noopener");
    onDone();
  };
  return (
    <div className="space-y-3">
      <label htmlFor="ask-claude-q" className="block text-sm font-medium text-[var(--ink-default)]">
        Ask in Claude
      </label>
      <textarea
        id="ask-claude-q"
        ref={field}
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. Which of these orders are late, and why?"
        className="w-full resize-y rounded-md border border-[var(--outline-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--ink-default)]"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!question.trim()} onClick={desktop} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open in Claude app
        </button>
        <button type="button" disabled={!question.trim()} onClick={() => void web()} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--outline-default)] px-3 py-1.5 text-sm text-[var(--ink-default)] hover:bg-[var(--surface-hover)] disabled:opacity-50">
          <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy and open claude.ai
        </button>
      </div>
      <p className="flex items-center gap-1.5 border-t border-[var(--outline-default)] pt-2 text-xs text-[var(--ink-muted)]">
        {connected ? (
          <>
            <CircleCheck className="h-3.5 w-3.5 text-[var(--status-success-fg)]" aria-hidden="true" /> Claude is connected to your account.
          </>
        ) : (
          <>
            Claude isn&apos;t connected yet, so it can&apos;t read this site.{" "}
            <Link href="/desk/connect-claude" onClick={onDone} className="font-medium text-[var(--ink-default)] underline underline-offset-2">
              Connect Claude
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export default function AskClaude() {
  const { installed } = useCremaApp();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    document.addEventListener("crema:ask-claude", toggle);
    return () => document.removeEventListener("crema:ask-claude", toggle);
  }, []);
  if (!installed) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Ask in Claude" title="Ask in Claude (⌘I)" aria-expanded={open} className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-default)]">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)]">
        {open && <Body onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}
