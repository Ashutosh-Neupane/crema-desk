"use client";

/**
 * "Needs your attention" beside the app-supplied home: workflow approvals (act here, after a confirm that names the
 * document), tasks assigned to the user, the counts of waiting documents per module, and upcoming events.
 */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, CheckCheck, ChevronDown, ListTodo, TriangleAlert } from "lucide-react";
import { docUrl } from "@/lib/navigation/deskUrl";
import { toastError } from "@/lib/frappe/errors";
import { timeAgo } from "@/lib/list/format";
import { applyWorkflowAction, type Approval, type Assigned, type Cue, type HomeData, type HomeEvent } from "./useProviderHome";
import { compactAmount, cueHref, today } from "./homeModel";

const CARD = "rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)]";
const GROUPS_SHOWN = 3;

const TONE: Record<string, string> = {
  danger: "text-[var(--status-danger-fg)]",
  warning: "text-[var(--status-warning-fg)]",
  success: "text-[var(--status-success-fg)]",
};

function CardHead({ icon: Icon, title, count }: { icon: typeof CheckCheck; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--outline-default)] px-4 py-3">
      <Icon className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
      <h3 className="text-sm font-semibold text-[var(--ink-default)]">{title}</h3>
      {count ? <span className="tabular ml-auto rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-white">{count}</span> : null}
    </div>
  );
}

function ApprovalRow({ item, onDone }: { item: Approval; onDone: () => void }) {
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (action: string) => {
    setBusy(true);
    try {
      await applyWorkflowAction(item.doctype, item.name, action);
      toast.success(`${action}: ${item.title}`);
      onDone();
    } catch (e) {
      toastError(e, `Couldn't ${action.toLowerCase()} ${item.name}`);
    } finally {
      setBusy(false);
      setAsking(null);
    }
  };
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <Link href={docUrl(item.doctype, item.name)} className="min-w-0 flex-1 hover:underline">
          <span className="block truncate text-sm font-medium text-[var(--ink-default)]">{item.title}</span>
          <span className="block truncate text-xs text-[var(--ink-muted)]">
            {item.name} · {item.state}
            {item.waiting_since ? ` · ${timeAgo(item.waiting_since)}` : ""}
          </span>
        </Link>
        <div className="shrink-0 text-right">
          {item.amount && <span className="tabular block text-sm font-medium text-[var(--ink-default)]">{item.amount}</span>}
          <span className="text-xs text-[var(--ink-muted)]">{item.doctype}</span>
        </div>
      </div>
      {asking ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-[var(--surface-sunken)] px-2 py-1.5 text-xs" role="group" aria-label="Confirm">
          <span className="min-w-0 flex-1 text-[var(--ink-default)]">
            {asking} {item.name}?
          </span>
          <button type="button" disabled={busy} onClick={() => void act(asking)} className="rounded-md bg-[var(--ink-default)] px-2.5 py-1 font-medium text-[var(--surface-raised)] disabled:opacity-50">
            Yes, {asking.toLowerCase()}
          </button>
          <button type="button" disabled={busy} onClick={() => setAsking(null)} className="rounded-md px-2 py-1 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {item.actions.slice(0, 2).map((a, i) => (
            <button
              key={a}
              type="button"
              onClick={() => setAsking(a)}
              className={i === 0 ? "rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white hover:opacity-90" : "rounded-md border border-[var(--outline-default)] px-3 py-1 text-xs text-[var(--ink-default)] hover:bg-[var(--surface-hover)]"}
            >
              {a}
            </button>
          ))}
          {item.actions.length > 2 && (
            <Link href={docUrl(item.doctype, item.name)} className="px-1 py-1 text-xs text-[var(--ink-link)] hover:underline">
              More…
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

function AssignedRow({ t }: { t: Assigned }) {
  const href = t.doctype && t.name ? docUrl(t.doctype, t.name) : docUrl("ToDo", t.todo);
  const overdue = !!t.date && t.date < today();
  const pill = overdue ? "Overdue" : t.date ? `Due ${t.date}` : t.priority === "High" ? "High" : "";
  return (
    <li>
      <Link href={href} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-[var(--ink-default)]">{(t.description || t.title || "To Do").replace(/<[^>]+>/g, "")}</span>
          {t.doctype && <span className="block truncate text-xs text-[var(--ink-muted)]">{t.doctype} · {t.title}</span>}
        </span>
        {pill && <span className={`shrink-0 text-xs ${overdue || pill === "High" ? TONE.danger : "text-[var(--ink-muted)]"}`}>{pill}</span>}
      </Link>
    </li>
  );
}

function CueGroups({ cues, currency }: { cues: Cue[]; currency?: string }) {
  const [all, setAll] = useState(false);
  const modules = [...new Set(cues.map((c) => c.module))];
  const shown = all ? modules : modules.slice(0, GROUPS_SHOWN);
  return (
    <div className="py-1">
      {shown.map((m) => (
        <section key={m} aria-label={m} className="px-4 py-2">
          <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-[var(--accent)] uppercase">{m}</h4>
          <ul>
            {cues
              .filter((c) => c.module === m)
              .map((c) => (
                <li key={c.key}>
                  <Link href={cueHref(c)} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--surface-hover)]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--ink-default)]">{c.label}</span>
                      {c.amount ? <span className="block text-xs text-[var(--ink-muted)]">{compactAmount(c.amount, currency)}</span> : null}
                    </span>
                    <span className={`tabular text-base font-semibold ${TONE[c.tone ?? ""] ?? "text-[var(--ink-default)]"}`}>
                      {c.count}
                      {c.more ? "+" : ""}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {modules.length > GROUPS_SHOWN && (
        <button type="button" onClick={() => setAll((a) => !a)} className="flex w-full items-center justify-center gap-1 border-t border-[var(--outline-default)] py-2 text-xs text-[var(--ink-link)] hover:bg-[var(--surface-hover)]">
          {all ? "Show less" : `Show ${modules.length - GROUPS_SHOWN} more modules`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${all ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function Events({ events }: { events: HomeEvent[] }) {
  return (
    <ul className="py-1">
      {events.slice(0, 5).map((e) => (
        <li key={`${e.name}:${e.starts_on}`}>
          <Link href={docUrl("Event", e.name)} className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--surface-hover)]">
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink-default)]">{e.subject}</span>
            <span className="shrink-0 text-xs text-[var(--ink-muted)]">{e.all_day ? e.starts_on.slice(0, 10) : e.starts_on.slice(0, 16)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AttentionPanel({ data, onChanged }: { data: HomeData; onChanged: () => void }) {
  const approvals = data.approvals?.items ?? [];
  const assigned = data.assigned?.items ?? [];
  const cues = (data.cues?.items ?? []).filter((c) => c.count);
  const events = data.events ?? [];
  const clear = !approvals.length && !assigned.length;
  return (
    <aside aria-label="Needs your attention" className="space-y-4">
      <h2 className="text-sm font-medium text-[var(--ink-muted)]">Needs your attention</h2>
      {clear && (
        <div className={`${CARD} flex items-center gap-3 px-4 py-4 text-sm text-[var(--ink-muted)]`}>
          <CheckCheck className="h-5 w-5 text-[var(--status-success-fg)]" aria-hidden="true" />
          Nothing waiting on you.
        </div>
      )}
      {approvals.length > 0 && (
        <section className={CARD} aria-label="Waiting for your approval">
          <CardHead icon={CheckCheck} title="Waiting for your approval" count={data.approvals?.total ?? approvals.length} />
          <ul className="divide-y divide-[var(--outline-default)]">
            {approvals.map((a) => (
              <ApprovalRow key={`${a.doctype}:${a.name}`} item={a} onDone={onChanged} />
            ))}
          </ul>
        </section>
      )}
      {assigned.length > 0 && (
        <section className={CARD} aria-label="Assigned to you">
          <CardHead icon={ListTodo} title="Assigned to you" count={data.assigned?.total ?? assigned.length} />
          <ul className="py-1">
            {assigned.map((t) => (
              <AssignedRow key={t.todo} t={t} />
            ))}
          </ul>
        </section>
      )}
      {cues.length > 0 && (
        <section className={CARD} aria-label="In your modules">
          <CardHead icon={TriangleAlert} title="In your modules" />
          <p className="px-4 pt-2 text-xs text-[var(--ink-muted)]">Documents whose status says something is waiting.</p>
          <CueGroups cues={cues} currency={data.cues?.currency} />
        </section>
      )}
      {events.length > 0 && (
        <section className={CARD} aria-label="Coming up">
          <CardHead icon={CalendarDays} title="Coming up" />
          <Events events={events} />
        </section>
      )}
    </aside>
  );
}
