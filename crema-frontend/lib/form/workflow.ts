"use client";

/**
 * Form workflow (Desk: frappe/public/js/frappe/form/workflow.js + model/workflow.js).
 * The active Workflow doc arrives with the meta (`__workflow_docs`); transitions come
 * from frappe.model.workflow.get_transitions and run through apply_workflow.
 */
import { useQuery } from "@tanstack/react-query";
import { deskCall, type Doc } from "@/lib/frappe/form";
import type { DocTypeMeta } from "@/lib/frappe/types";

export interface WorkflowState {
  state: string;
  doc_status: string | number;
  allow_edit?: string;
  update_field?: string;
  update_value?: string;
  style?: string;
}

export interface WorkflowDoc {
  name: string;
  document_type: string;
  is_active?: number;
  workflow_state_field: string;
  enable_action_confirmation?: number;
  states: WorkflowState[];
  transitions: Transition[];
}

export interface Transition {
  state: string;
  action: string;
  next_state: string;
  allowed: string;
  allow_self_approval?: number;
  condition?: string;
}

export function getWorkflow(meta: DocTypeMeta | undefined): WorkflowDoc | null {
  const docs = (meta as { __workflow_docs?: Array<Record<string, unknown>> } | undefined)?.__workflow_docs ?? [];
  const wf = docs.find((d) => d.doctype === "Workflow" && d.document_type === meta?.name) as WorkflowDoc | undefined;
  return wf && wf.workflow_state_field ? wf : null;
}

/** Desk get_default_state: first state whose doc_status matches */
export function defaultState(wf: WorkflowDoc, docstatus: number): string | null {
  return wf.states.find((s) => Number(s.doc_status) === docstatus)?.state ?? null;
}

export function workflowStateOf(wf: WorkflowDoc, doc: Doc): string | null {
  return (doc[wf.workflow_state_field] as string) || defaultState(wf, Number(doc.docstatus ?? 0));
}

/** Desk is_read_only: no role of the user may edit the current state */
export function isWorkflowReadOnly(wf: WorkflowDoc, doc: Doc, roles: string[]): boolean {
  if (doc.__islocal) return false;
  const state = workflowStateOf(wf, doc);
  if (!state) return false;
  const editors = wf.states.filter((s) => s.state === state).map((s) => s.allow_edit);
  return !roles.some((r) => editors.includes(r));
}

/** Indicator colour from the Workflow State style (Desk: state style → indicator) */
export function stateColour(wf: WorkflowDoc, state: string, styles?: Record<string, string>): string {
  const style = styles?.[state] ?? wf.states.find((s) => s.state === state)?.style ?? "";
  return { Success: "green", Danger: "red", Warning: "orange", Primary: "blue", Info: "cyan", Inverse: "gray" }[style] ?? "blue";
}

/** Desk form/workflow.js has_approval_access: the owner may only act when the transition allows self-approval */
export function hasApprovalAccess(t: Pick<Transition, "allow_self_approval">, user: string | undefined, doc: Doc): boolean {
  return user === "Administrator" || !!t.allow_self_approval || user !== doc.owner;
}

/**
 * Transitions out of the doc's state as the server sees them (model/workflow.py get_transitions: the user's roles
 * and each transition's `condition`), only for saved, clean docs that have a state — the server throws
 * "Workflow State not set" otherwise.
 */
export function useTransitions(wf: WorkflowDoc | null, doc: Doc | null, dirty: boolean) {
  const state = wf && doc ? (doc[wf.workflow_state_field] as string | undefined) : undefined;
  const enabled = !!wf && !!doc && !doc.__islocal && !dirty && !!state;
  return useQuery<Transition[]>({
    queryKey: ["workflow-transitions", doc?.doctype, doc?.name, doc?.modified, state],
    enabled,
    queryFn: async () => {
      const { env } = await deskCall("frappe.model.workflow.get_transitions", { doc: JSON.stringify(doc) });
      return (env.message as Transition[]) ?? [];
    },
    staleTime: 30_000,
  });
}

/** What the workflow bar says about the doc's current state */
export interface WorkflowStatus {
  state: string | null;
  /** transitions the current user may run now (Desk show_actions) */
  mine: Transition[];
  /** the user has the role, but created the doc and self-approval is off (server: "Self approval is not allowed") */
  selfBlocked: Transition[];
  /** the user has the role, but the server held the transition back: its `condition` isn't met */
  conditionBlocked: Transition[];
  /** every transition out of the state, whoever may run it */
  next: Transition[];
  /** roles that can move the doc on, when the user can't */
  waitingOn: string[];
}

export function workflowStatus(wf: WorkflowDoc, doc: Doc, server: Transition[], user: string | undefined, roles: string[]): WorkflowStatus {
  const state = (doc[wf.workflow_state_field] as string) || null;
  const next = state ? wf.transitions.filter((t) => t.state === state) : [];
  const key = (t: Transition) => `${t.action}|${t.next_state}|${t.allowed}`;
  const fromServer = new Set(server.map(key));
  const mine = server.filter((t) => roles.includes(t.allowed) && hasApprovalAccess(t, user, doc));
  const selfBlocked = server.filter((t) => roles.includes(t.allowed) && !hasApprovalAccess(t, user, doc));
  const conditionBlocked = next.filter((t) => roles.includes(t.allowed) && !fromServer.has(key(t)) && !!t.condition);
  const waitingOn = mine.length ? [] : [...new Set(next.map((t) => t.allowed))];
  return { state, mine, selfBlocked, conditionBlocked, next, waitingOn };
}

/**
 * States the doc has passed through, oldest first. apply_workflow logs each transition as a Comment "Workflow"
 * (docinfo.workflow_logs, content = the new state); the starting state has no log, so it comes from the doc
 * (Desk set_default_state: the first state for docstatus 0, set by its owner at creation).
 */
export function workflowHistory(wf: WorkflowDoc, doc: Doc, docinfo: Record<string, unknown> | undefined): Array<{ state: string; owner: string; creation: string }> {
  const logs = (docinfo?.workflow_logs as Array<{ content?: string; owner?: string; creation?: string }> | undefined) ?? [];
  const steps = logs
    .filter((l) => l.content)
    .map((l) => ({ state: String(l.content).replace(/<[^>]*>/g, "").trim(), owner: l.owner ?? "", creation: l.creation ?? "" }))
    .sort((a, b) => a.creation.localeCompare(b.creation));
  const first = defaultState(wf, 0);
  if (first && steps[0]?.state !== first && (steps.length || doc[wf.workflow_state_field] !== first))
    steps.unshift({ state: first, owner: String(doc.owner ?? ""), creation: String(doc.creation ?? "") });
  return steps;
}

/** Desk get_document_state_roles: roles that may edit the doc in this state */
export function editableBy(wf: WorkflowDoc, state: string): string[] {
  return [...new Set(wf.states.filter((s) => s.state === state && s.allow_edit).map((s) => s.allow_edit!))];
}

export async function applyWorkflow(doc: Doc, action: string): Promise<Doc> {
  const { env } = await deskCall("frappe.model.workflow.apply_workflow", { doc: JSON.stringify(doc), action });
  return env.message as Doc;
}
