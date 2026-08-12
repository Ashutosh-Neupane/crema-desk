"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useDocument } from "@/lib/hooks/useDocument";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { Badge } from "@/components/shadcn/badge";
import { FormSkeleton } from "@/components/Skeleton";
import {
  Paperclip, History, ArrowLeft, Send, Loader2, WifiOff,
} from "lucide-react";
import DocumentActions from "@/components/DocumentActions";
import { FormTimeline } from "@/components/features/timeline";
import { AssignToDialog } from "@/components/features/bulk-operations/AssignToDialog";
import { WorkflowActions } from "@/components/features/workflow";
import { LinkedWith } from "@/components/features/linked-with";
import { subscribeDocUpdate, subscribeDocInfoUpdate, subscribeNewComment, subscribeVersion } from "@/lib/services/realtime";
import { formatFieldValue } from "@/lib/trevo-form/meta/parseDoctypeMeta";

type DocRow = Record<string, unknown>;

interface Props {
  doctype: string;
  name: string;
}

export function DocumentDetailClient({ doctype, name }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const [assignOpen, setAssignOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [refreshAvailable, setRefreshAvailable] = useState(false);

  const { data: meta } = useDoctype(doctype);
  const { data: doc, isLoading, error } = useDocument(doctype, name, undefined, 60000);
  const prevModifiedRef = useRef<string | undefined>(doc?.modified);

  // Realtime subscriptions via socket.io
  useEffect(() => {
    const unsubDoc = subscribeDocUpdate((e) => {
      if (e.doctype === doctype && (e.docname === name || e.name === name)) {
        queryClient.invalidateQueries({ queryKey: ["document", doctype, name] });
        setRefreshAvailable(true);
        toast.info("Document updated — click Refresh to see latest changes.", {
          action: { label: "Refresh", onClick: () => { queryClient.invalidateQueries({ queryKey: ["document", doctype, name] }); setRefreshAvailable(false); } },
        });
      }
    });
    const unsubDocInfo = subscribeDocInfoUpdate((e) => {
      if (e.doctype === doctype && e.docname === name) {
        queryClient.invalidateQueries({ queryKey: ["comments", doctype, name] });
        queryClient.invalidateQueries({ queryKey: ["attachments", doctype, name] });
        queryClient.invalidateQueries({ queryKey: ["versions", doctype, name] });
      }
    });
    const unsubComment = subscribeNewComment((e) => {
      if (e.doctype === doctype && e.docname === name) {
        queryClient.invalidateQueries({ queryKey: ["comments", doctype, name] });
      }
    });
    const unsubVersion = subscribeVersion((e) => {
      if (e.doctype === doctype && e.docname === name) {
        queryClient.invalidateQueries({ queryKey: ["versions", doctype, name] });
      }
    });
    return () => { unsubDoc(); unsubDocInfo(); unsubComment(); unsubVersion(); };
  }, [doctype, name, queryClient]);

  useEffect(() => {
    if (!doc) return;
    if (prevModifiedRef.current && prevModifiedRef.current !== doc.modified) {
      toast.info("Document updated externally.");
    }
    prevModifiedRef.current = doc.modified;
  }, [doc]);

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ["comments", doctype, name],
    queryFn: () => frappeMethod<DocRow[]>("frappe.desk.form.load.get_comments", { doctype, name }),
    staleTime: 60_000,
  });
  const { data: versions } = useQuery({
    queryKey: ["versions", doctype, name],
    queryFn: () => frappeMethod<DocRow[]>("frappe.desk.form.load.get_versions", { doctype, name }),
    staleTime: 60_000,
  });
  const { data: attachments } = useQuery({
    queryKey: ["attachments", doctype, name],
    queryFn: () => frappeMethod<DocRow[]>("frappe.desk.form.load.get_attachments", { doctype, name }),
    staleTime: 60_000,
  });

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim()) return;
    setCommenting(true);
    try {
      await frappeMethod("frappe.client.insert", {
        doc: { doctype: "Comment", comment_type: "Comment", reference_doctype: doctype, reference_name: name, content: commentText.trim() },
      });
      setCommentText("");
      refetchComments();
      toast.success("Comment added");
    } catch { toast.error("Failed to add comment"); }
    finally { setCommenting(false); }
  }, [commentText, doctype, name, refetchComments]);

  const fields = (
    meta?.fields as Array<{
      fieldname: string;
      label?: string;
      fieldtype: string;
      hidden?: boolean | 0 | 1;
      read_only?: boolean | 0 | 1;
      print_hide?: boolean | 0 | 1;
    }> | undefined
  ) ?? [];
  const displayFields = fields.filter(
    (f) =>
      !["Section Break", "Column Break", "Tab Break", "Heading", "Fold", "Table", "Table MultiSelect", "Button", "HTML", "Read Only"].includes(f.fieldtype) &&
      !f.hidden &&
      !f.print_hide,
  );

  const docStatusBadge = useMemo(() => {
    if (!doc) return null;
    const statuses: Record<number, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      0: { label: "Draft", variant: "secondary" },
      1: { label: "Submitted", variant: "default" },
      2: { label: "Cancelled", variant: "destructive" },
    };
    const s = statuses[doc.docstatus as number] ?? { label: "Unknown", variant: "secondary" };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  }, [doc]);

  if (isLoading) return <FormSkeleton />;
  if (error) return <div className="p-4 text-sm text-red-600" role="alert">{error.message}</div>;
  if (!doc) return <div className="p-4 text-sm text-zinc-600">Document not found</div>;

  return (
    <div className="space-y-6">
      {refreshAvailable && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-900/20">
          <span className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            Changes available
          </span>
          <Button variant="ghost" size="sm" onClick={() => { queryClient.invalidateQueries({ queryKey: ["document", doctype, name] }); setRefreshAvailable(false); }}>
            Refresh
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} aria-label="Go back" className="rounded-lg border border-zinc-300 p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            <ArrowLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{doctype}</h1>
              {docStatusBadge}
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{name}</p>
          </div>
        </div>
        <DocumentActions
          doctype={doctype}
          name={name}
          docstatus={doc.docstatus as number}
          isSubmittable={!!meta?.is_submittable}
          onDeleted={() => router.push(`/desk/doctype/${encodeURIComponent(doctype)}`)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="comments">
            Comments {comments?.length ? <span className="ml-1 rounded-full bg-zinc-100 px-1.5 text-xs dark:bg-zinc-800">{comments.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="attachments">
            <Paperclip className="mr-1 h-4 w-4" aria-hidden="true" /> Attachments
          </TabsTrigger>
          <TabsTrigger value="versions"><History className="mr-1 h-4 w-4" aria-hidden="true" /> History</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="linked">Linked</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {displayFields.map((f) => (
                <div key={f.fieldname} className="border-b border-r border-zinc-200 p-4 dark:border-zinc-700">
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{f.label || f.fieldname}</dt>
                  <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                    {doc[f.fieldname] != null && doc[f.fieldname] !== ""
                      ? formatFieldValue(doc[f.fieldname], f.fieldtype)
                      : "—"}
                  </dd>
                </div>
              ))}
            </div>
            {displayFields.length === 0 && <div className="p-8 text-center text-sm text-zinc-500">No fields to display.</div>}
          </Card>
        </TabsContent>

        <TabsContent value="comments">
          <Card className="overflow-hidden p-0">
            {comments?.length ? (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {comments.map((c) => (
                  <div key={c.name as string} className="p-4">
                    <p className="text-xs text-zinc-500">{String(c.comment_by ?? c.comment_email ?? "Unknown")} · {c.creation ? new Date(c.creation as string).toLocaleString() : ""}</p>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{String(c.content ?? c.comment ?? "")}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">No comments yet.</div>
            )}
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddComment()}
                  placeholder="Add a comment…"
                  aria-label="Comment text"
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  disabled={commenting}
                />
                <button onClick={handleAddComment} disabled={!commentText.trim() || commenting} aria-label="Send comment"
                  className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
                  {commenting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <Card className="overflow-hidden p-0">
            {attachments?.length ? (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {attachments.map((a) => (
                  <a key={a.name as string} href={a.file_url as string} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <span className="flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                      <span className="text-sm text-zinc-900 dark:text-zinc-100">{String(a.file_name ?? a.name)}</span>
                    </span>
                    {typeof a.file_size === "number" && <span className="text-xs text-zinc-500">{Math.round((a.file_size as number) / 1024)} KB</span>}
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">No attachments.</div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="versions">
          <Card className="overflow-hidden p-0">
            {versions?.length ? (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {versions.map((v) => (
                  <div key={v.name as string} className="p-4">
                    <p className="text-xs text-zinc-500">{v.name as string} · {v.creation ? new Date(v.creation as string).toLocaleString() : ""}</p>
                    {v.data != null && v.data !== "" && (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900">{typeof v.data === "string" ? v.data : JSON.stringify(v.data, null, 2)}</pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">No version history.</div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="timeline"><FormTimeline doctype={doctype} docname={name} /></TabsContent>
        <TabsContent value="workflow"><WorkflowActions doctype={doctype} name={name} currentState={doc?.workflow_state as string | undefined} /></TabsContent>
        <TabsContent value="linked"><LinkedWith doctype={doctype} name={name} /></TabsContent>
      </Tabs>

      <AssignToDialog open={assignOpen} onOpenChange={setAssignOpen} docnames={[name]} onAssign={async () => {}} />
    </div>
  );
}
