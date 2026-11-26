"use client";

/**
 * Workflow bar under the form title: where the document is in its workflow and whose move it is.
 *
 * Desk (frappe/public/js/frappe/form/workflow.js) only shows a state pill and an Actions menu, and hides why an action
 * is missing. Crema keeps that menu and adds, from the same data:
 *  - a stepper: states the doc passed through (docinfo.workflow_logs, who and when), the current one, the next ones
 *  - "Waiting on you" with the actions as buttons when the move is the user's
 *  - otherwise who can act (transition roles), and the server's reasons: self-approval off, `condition` not met
 *  - Desk's "Workflow State not set" for docs that predate the workflow, with its fix (set the default state, save)
 */
import { Fragment } from "react";
import { ArrowRight, Check, CircleDot, HelpCircle, Loader2 } from "lucide-react";
import { INDICATOR_PILL } from "@/lib/list/indicator";
import { timeAgo } from "@/lib/list/format";
import { stateColour, workflowHistory, type Transition, type WorkflowDoc, type WorkflowStatus } from "@/lib/form/workflow";
import type { Doc } from "@/lib/frappe/form";

const userLabel = (u: string, me?: string) => (u === me ? "you" : u === "Administrator" ? "Administrator" : u.split("@")[0]);
const roleList = (roles: string[]) =>
  roles.map((r, i) => (
    <Fragment key={r}>
      {i > 0 && (i === roles.length - 1 ? " or " : ", ")}
      <strong className="font-semibold">{r}</strong>
    </Fragment>
  ));

export default function WorkflowBar({
  workflow,
  doc,
  status,
  docinfo,
  styles,
  user,
  dirty,
  busy,
  defaultState,
  onRun,
  onSetDefault,
  onHelp,
}: {
  workflow: WorkflowDoc;
  doc: Doc;
  status: WorkflowStatus;
  docinfo: Record<string, unknown> | undefined;
  styles?: Record<string, string>;
  user?: string;
  dirty: boolean;
  busy: boolean;
  defaultState: string | null;
  onRun: (t: Transition) => void;
  onSetDefault: () => void;
  onHelp: () => void;
}) {
  const { state, mine, next } = status;

  if (!state) return <StateNotSet workflow={workflow} defaultState={defaultState} onSetDefault={onSetDefault} />;

  return (
    <section aria-label="Workflow" className="space-y-2">
      <Stepper workflow={workflow} doc={doc} state={state} next={next} docinfo={docinfo} styles={styles} user={user} onHelp={onHelp} />
      {/* whose move it is */}
      {dirty && next.length > 0 ? (
        <p className="text-xs text-zinc-500">Save your changes to continue the workflow.</p>
      ) : mine.length > 0 ? (
        <WaitingOnYou state={state} mine={mine} busy={busy} onRun={onRun} />
      ) : next.length > 0 ? (
        <div role="status" aria-label="Workflow status" className="space-y-0.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
          {status.waitingOn.length > 0 && <p>Waiting on {roleList(status.waitingOn)}.</p>}
        </div>
      ) : null}
      {!dirty && <Unavailable selfBlocked={status.selfBlocked} conditionBlocked={status.conditionBlocked} />}
    </section>
  );
}

function StateNotSet({ workflow, defaultState, onSetDefault }: { workflow: WorkflowDoc; defaultState: string | null; onSetDefault: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <span>
        <strong>Workflow State not set.</strong> This document predates the {workflow.name} workflow.
      </span>
      {defaultState && (
        <button type="button" onClick={onSetDefault} className="ml-auto font-medium underline">
          Set to {defaultState}, then save
        </button>
      )}
    </div>
  );
}

/** states the doc passed through (who and when), the current one, the next ones */
function Stepper({
  workflow,
  doc,
  state,
  next,
  docinfo,
  styles,
  user,
  onHelp,
}: {
  workflow: WorkflowDoc;
  doc: Doc;
  state: string;
  next: Transition[];
  docinfo: Record<string, unknown> | undefined;
  styles?: Record<string, string>;
  user?: string;
  onHelp: () => void;
}) {
  // history: consecutive repeats collapse (a doc saved twice in one state logs it once per transition anyway)
  const history = workflowHistory(workflow, doc, docinfo).filter((h, i, a) => i === 0 || a[i - 1].state !== h.state);
  if (history.length && history[history.length - 1].state === state) history.pop();
  const nextStates = [...new Map(next.map((t) => [t.next_state, t])).values()];
  const pill = INDICATOR_PILL[stateColour(workflow, state, styles)] ?? INDICATOR_PILL.blue;
  return (
    <ol aria-label="Workflow steps" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      {history.map((h) => (
        <li key={`${h.state}-${h.creation}`} className="flex items-center gap-1.5" data-step="done">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" title={`${h.state} · ${userLabel(h.owner, user)} · ${h.creation}`}>
            <Check className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden />
            {h.state}
            <span className="text-zinc-400">· {userLabel(h.owner, user)}, {timeAgo(h.creation)}</span>
          </span>
          <ArrowRight className="h-3 w-3 text-zinc-400" aria-hidden />
        </li>
      ))}
      <li data-step="current" aria-current="step">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ring-current/30 ${pill}`}>
          <CircleDot className="h-3 w-3" aria-hidden />
          {state}
        </span>
      </li>
      {nextStates.length > 0 ? (
        <>
          <ArrowRight className="h-3 w-3 text-zinc-400" aria-hidden />
          {nextStates.map((t, i) => (
            <li key={t.next_state} data-step="next" className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">/</span>}
              <span className="rounded-full border border-dashed border-zinc-300 px-2 py-0.5 dark:border-zinc-600">{t.next_state}</span>
            </li>
          ))}
        </>
      ) : (
        <li className="pl-1 text-zinc-400" data-step="end">
          End of workflow
        </li>
      )}
      <li className="ml-auto">
        <button type="button" onClick={onHelp} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" aria-label="Workflow help">
          <HelpCircle className="h-3.5 w-3.5" /> {workflow.name}
        </button>
      </li>
    </ol>
  );
}

/** "Waiting on you" with the actions as buttons */
function WaitingOnYou({ state, mine, busy, onRun }: { state: string; mine: Transition[]; busy: boolean; onRun: (t: Transition) => void }) {
  return (
    <div role="region" aria-label="Waiting on you" className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
      <span className="font-semibold">Waiting on you</span>
      <span className="text-blue-800/80 dark:text-blue-200/80">· {state}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {mine.map((t, i) => (
          <button
            key={`${t.action}|${t.next_state}`}
            type="button"
            disabled={busy}
            onClick={() => onRun(t)}
            title={`${t.action} → ${t.next_state}`}
            className={
              i === 0
                ? "inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
                : "rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-zinc-900 dark:text-blue-100 dark:hover:bg-blue-950"
            }
          >
            {busy && i === 0 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t.action}
          </button>
        ))}
      </div>
    </div>
  );
}

/** the server's reasons an action is missing: self-approval off, `condition` not met */
function Unavailable({ selfBlocked, conditionBlocked }: { selfBlocked: Transition[]; conditionBlocked: Transition[] }) {
  if (!selfBlocked.length && !conditionBlocked.length) return null;
  return (
    <div aria-label="Unavailable actions" className="space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
      {selfBlocked.length > 0 && (
        <p>
          You created this document and self-approval is off for <strong>{selfBlocked.map((t) => t.action).join(", ")}</strong>: someone else with the role must do it.
        </p>
      )}
      {conditionBlocked.length > 0 && (
        <p>
          <strong>{conditionBlocked.map((t) => t.action).join(", ")}</strong>
          {` ${conditionBlocked.length > 1 ? "aren't" : "isn't"} available: the transition's condition isn't met.`}
        </p>
      )}
    </div>
  );
}
