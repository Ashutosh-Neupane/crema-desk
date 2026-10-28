"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkflowBuilder } from "@/components/features/workflow-builder";
import { toast } from "sonner";
import Link from "next/link";
import { Card } from "@/components/shadcn/card";
import { Plus, GitMerge } from "lucide-react";

/**
 * Workflow Builder page — /desk/workflow-builder
 *
 * Lists all Workflow documents and provides a builder.
 * URL param: ?doctype=Customer  →  show builder for that doctype
 */
export default function WorkflowBuilderPage() {
  const searchParams = useSearchParams();
  const doctype = searchParams.get("doctype") ?? "";
  if (doctype) return <WorkflowBuilderView doctype={doctype} />;
  return <WorkflowList />;
}

// ─── List ─────────────────────────────────────────────────────────────────────

function WorkflowList() {
  const { data: workflows = [], isLoading } = useQuery<Array<{ name: string; document_type: string; is_active: number }>>({
    queryKey: ["workflows-list"],
    queryFn: async () => {
      const res = await fetch(
        '/api/frappe/api/resource/Workflow?fields=["name","document_type","is_active"]&limit=100',
      );
      if (!res.ok) return [];
      const json = await res.json() as { data?: Array<{ name: string; document_type: string; is_active: number }> };
      return json.data ?? [];
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Workflow Builder</h1>
          <p className="mt-1 text-sm text-zinc-500">Design approval and status workflows</p>
        </div>
        <Link href="/desk/workflow-builder?doctype=Lead" className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors h-9 rounded-lg px-3 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          New Workflow
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-700" />
                <div className="h-3 w-1/2 rounded bg-zinc-100 dark:bg-zinc-700" />
              </div>
            </Card>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <Card className="p-10 text-center">
          <GitMerge className="mx-auto h-8 w-8 text-zinc-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-zinc-500">No workflows yet</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <Link
              key={wf.name}
              href={`/desk/workflow-builder?doctype=${encodeURIComponent(wf.document_type)}`}
            >
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
                    <GitMerge className="h-5 w-5 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{wf.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{wf.document_type}</p>
                    <span className={`inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      wf.is_active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    }`}>
                      {wf.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Builder view ─────────────────────────────────────────────────────────────

function WorkflowBuilderView({ doctype }: { doctype: string }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Load existing workflow for this doctype
  const { data: existingWorkflows } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["workflow", doctype],
    queryFn: async () => {
      const res = await fetch(`/api/workflow-builder/${encodeURIComponent(doctype)}`);
      if (!res.ok) return [];
      return res.json() as Promise<Array<Record<string, unknown>>>;
    },
    staleTime: 30_000,
  });

  const existing = existingWorkflows?.[0];

  const handleSave = useCallback(
    async (config: Parameters<typeof WorkflowBuilder>[0]["initialConfig"]) => {
      if (!config) return;

      // Validate: every state needs at least one incoming or outgoing transition
      const stateNames = new Set(config.states.map((s) => s.name));
      const connectedStates = new Set([
        ...config.transitions.map((t) => t.fromState),
        ...config.transitions.map((t) => t.toState),
      ]);
      const isolated = [...stateNames].filter((s) => !connectedStates.has(s));
      if (config.states.length > 1 && isolated.length > 0) {
        toast.error(`State(s) have no transitions: ${isolated.join(", ")}`);
        return;
      }

      setSaving(true);
      try {
        const body = {
          name: config.name,
          document_type: doctype,
          is_active: config.isActive ? 1 : 0,
          workflow_state_field: "workflow_state",
          states: config.states.map((s) => ({
            state: s.name,
            title: s.title,
            doc_status: s.isFinal ? "1" : "0",
            is_optional_state: 0,
            allow_edit: "All",
            color: s.color,
          })),
          transitions: config.transitions.map((t) => ({
            state: t.fromState,
            action: t.action,
            next_state: t.toState,
            condition: t.condition ?? "",
            allowed: (t.allowedRoles ?? ["All"]).join("\n"),
          })),
        };

        const res = await fetch(`/api/workflow-builder/${encodeURIComponent(doctype)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? "Save failed");
        }

        toast.success("Workflow saved");
        qc.invalidateQueries({ queryKey: ["workflow", doctype] });
        qc.invalidateQueries({ queryKey: ["workflows-list"] });
      } catch (err) {
        toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setSaving(false);
      }
    },
    [doctype, qc],
  );

  // Build initialConfig from existing workflow
  const initialConfig = existing
    ? {
        name: String(existing.name ?? `${doctype} Workflow`),
        doctype,
        isActive: existing.is_active === 1,
        states: (existing.states as Array<Record<string, unknown>> ?? []).map((s) => ({
          name: String(s.state ?? ""),
          title: String(s.title ?? s.state ?? ""),
          color: String(s.color ?? "#3b82f6"),
          isInitial: s.doc_status === "0" && s.state === (existing.states as Array<Record<string, unknown>>)[0]?.state,
          isFinal: s.doc_status === "1",
        })),
        transitions: (existing.transitions as Array<Record<string, unknown>> ?? []).map((t) => ({
          name: String(t.action ?? ""),
          fromState: String(t.state ?? ""),
          toState: String(t.next_state ?? ""),
          action: String(t.action ?? ""),
          condition: String(t.condition ?? ""),
          allowedRoles: String(t.allowed ?? "All").split("\n").filter(Boolean),
        })),
      }
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Workflow Builder</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {existing ? `Editing workflow for ` : `New workflow for `}
            <strong>{doctype}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/desk/workflow-builder"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← All Workflows
          </Link>
        </div>
      </div>

      <WorkflowBuilder
        doctype={doctype}
        initialConfig={initialConfig}
        onSave={handleSave}
      />

      {saving && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          Saving workflow…
        </div>
      )}
    </div>
  );
}
