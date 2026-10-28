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
  transitions: Array<{ state: string; action: string; next_state: string; allowed: string; allow_self_approval?: number }>;
}

export interface Transition {
  state: string;
  action: string;
  next_state: string;
  allowed: string;
  allow_self_approval?: number;
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

/** Transitions the current user may run (role + self-approval), only for saved, clean docs */
export function useTransitions(wf: WorkflowDoc | null, doc: Doc | null, dirty: boolean, user: string | undefined, roles: string[]) {
  const enabled = !!wf && !!doc && !doc.__islocal && !dirty;
  return useQuery<Transition[]>({
    queryKey: ["workflow-transitions", doc?.doctype, doc?.name, doc?.modified, doc?.[wf?.workflow_state_field ?? ""]],
    enabled,
    queryFn: async () => {
      const { env } = await deskCall("frappe.model.workflow.get_transitions", { doc: JSON.stringify(doc) });
      const list = (env.message as Transition[]) ?? [];
      return list.filter((t) => roles.includes(t.allowed) && (user === "Administrator" || !!t.allow_self_approval || user !== doc!.owner));
    },
    staleTime: 30_000,
  });
}

export async function applyWorkflow(doc: Doc, action: string): Promise<Doc> {
  const { env } = await deskCall("frappe.model.workflow.apply_workflow", { doc: JSON.stringify(doc), action });
  return env.message as Doc;
}
