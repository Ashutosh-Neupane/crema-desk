"use client";

/**
 * DocForm's workflow: the active Workflow from the meta, transitions for the saved + clean doc, state colours, and
 * running a transition (Desk: frappe/public/js/frappe/form/workflow.js).
 */
import { useCallback, useMemo, useState, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/lib/frappe/errors";
import { deskCall, isNewDoc, type Doc } from "@/lib/frappe/form";
import { applyWorkflow, getWorkflow, useTransitions, workflowStatus, type Transition } from "@/lib/form/workflow";
import { confirm as deskConfirm } from "@/lib/desk-runtime/dialogs";
import type { FormController } from "@/lib/form/FormController";
import type { DocTypeMeta } from "@/lib/frappe/types";

export function useDocWorkflow({
  doctype,
  meta,
  doc,
  dirty,
  user,
  roles,
  ctlRef,
  load,
}: {
  doctype: string;
  meta: DocTypeMeta | undefined;
  doc: Doc | null;
  dirty: boolean;
  user?: string;
  roles: string[];
  ctlRef: RefObject<FormController | null>;
  load: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const workflow = useMemo(() => getWorkflow(meta), [meta]);
  const { data: serverTransitions } = useTransitions(workflow, doc, dirty);
  const status = workflow && doc && !isNewDoc(doc) ? workflowStatus(workflow, doc, serverTransitions ?? [], user, roles) : null;
  const [helpOpen, setHelpOpen] = useState(false);
  const { data: styles } = useQuery({
    queryKey: ["workflow-state-styles"],
    enabled: !!workflow,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { env } = await deskCall("frappe.client.get_list", { doctype: "Workflow State", fields: ["name", "style"], limit_page_length: 0 });
      return Object.fromEntries(((env.message as Array<{ name: string; style?: string }>) ?? []).map((w) => [w.name, w.style ?? ""]));
    },
  });
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (t: Transition) => {
      const c = ctlRef.current;
      if (!c) return;
      const go = async () => {
        setBusy(true);
        try {
          c.frm.selected_workflow_action = t.action;
          if (!(await c.trigger("before_workflow_action"))) return;
          const next = await applyWorkflow(c.getDoc(), t.action);
          c.load(next);
          await load();
          c.frm.selected_workflow_action = null;
          await c.trigger("after_workflow_action");
          await c.runLoadEvents(false);
          qc.invalidateQueries({ queryKey: ["list", doctype] });
          toast.success(`${t.action}: ${t.next_state}`);
        } catch (e) {
          toastError(e, "Workflow action failed", { duration: 10000 });
        } finally {
          setBusy(false);
        }
      };
      if (workflow?.enable_action_confirmation) deskConfirm(`Are you sure you want to ${t.action}?`, () => void go());
      else await go();
    },
    [workflow, qc, doctype, load, ctlRef],
  );
  return { workflow, status, transitions: status?.mine ?? [], styles, busy, run, helpOpen, setHelpOpen };
}
