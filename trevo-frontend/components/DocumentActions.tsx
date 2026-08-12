"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { frappeMethod } from "@/lib/frappe/client";
import { fetchDocument, savedocs, cancelDoc } from "@/lib/frappe/document";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { MoreVertical, Printer, Mail, Share2, Trash2, CheckCircle2, XCircle, RotateCcw, Copy, PenLine, Loader2 } from "lucide-react";
import { ShareDialog } from "@/components/features/sharing";

type DocRow = Record<string, unknown>;

/** sessionStorage key used to hand Duplicate/Amend values to the new-doc form */
export const PREFILL_KEY = (doctype: string) => `trevo:prefill:${doctype}`;

/** System fields stripped when duplicating a document (Frappe's copy_new_doc behaviour) */
const COPY_EXCLUDED = new Set([
  "name", "docstatus", "creation", "modified", "owner", "modified_by",
  "parent", "parenttype", "parentfield", "idx", "__islocal", "__unsaved",
  "workflow_state", "amended_from", "amendment_date",
]);

interface DocumentActionsProps {
  doctype: string;
  name: string;
  /** 0=draft, 1=submitted, 2=cancelled */
  docstatus?: number;
  isSubmittable?: boolean;
  onDeleted?: () => void;
}

export default function DocumentActions({ doctype, name, docstatus, isSubmittable, onDeleted }: DocumentActionsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const invalidateDoc = () => {
    queryClient.invalidateQueries({ queryKey: ["doc", doctype, name] });
    queryClient.invalidateQueries({ queryKey: ["document", doctype, name] });
    queryClient.invalidateQueries({ queryKey: ["list", doctype] });
  };

  const handlePrint = async () => {
    const format = "PDF";
    const data = await frappeMethod<{ file_url?: string }>("frappe.utils.print_format.download_pdf", { doctype, name, format });
    if (data?.file_url) {
      window.open(data.file_url, "_blank");
    }
  };

  const handleEmail = async () => {
    const data = await frappeMethod<DocRow[]>("frappe.desk.form.load.get_attachments", { doctype, name });
    const attachment = data?.find((a: DocRow) => typeof a.file_name === "string" && a.file_name.endsWith(".pdf"));
    if (attachment?.file_url) {
      window.open(`mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(attachment.file_url as string)}`);
    }
  };

  const handleDelete = async () => {
    await frappeMethod("frappe.client.delete", { doctype, name });
    toast.success(`${doctype} deleted`);
    onDeleted?.();
  };

  // ── Frappe document lifecycle ──────────────────────────────────────────────

  const handleSubmit = async () => {
    setBusy("submit");
    try {
      const doc = await fetchDocument(doctype, name);
      await savedocs({ ...doc, doctype }, "Submit");
      toast.success(`${doctype} submitted`);
      invalidateDoc();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit document");
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    setBusy("cancel");
    try {
      await cancelDoc(doctype, name);
      toast.success(`${doctype} cancelled`);
      invalidateDoc();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel document");
    } finally {
      setBusy(null);
    }
  };

  const copyToNewForm = async (extra?: Record<string, unknown>) => {
    setBusy(extra ? "amend" : "duplicate");
    try {
      const doc = await fetchDocument(doctype, name);
      const values: Record<string, unknown> = { ...(extra ?? {}) };
      for (const [key, val] of Object.entries(doc)) {
        if (!COPY_EXCLUDED.has(key)) values[key] = val;
      }
      sessionStorage.setItem(PREFILL_KEY(doctype), JSON.stringify(values));
      router.push(`/desk/doctype/${encodeURIComponent(doctype)}/new`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to copy document");
      setBusy(null);
    }
  };

  const handleDuplicate = () => copyToNewForm();
  const handleAmend = () => copyToNewForm({ amended_from: name });

  const handleRename = async () => {
    if (!newName.trim()) return;
    setBusy("rename");
    try {
      await frappeMethod("frappe.model.rename_doc.update_document_title", {
        doctype,
        docname: name,
        name: newName.trim(),
      });
      toast.success("Document renamed");
      setRenameOpen(false);
      router.replace(`/desk/doctype/${encodeURIComponent(doctype)}/${encodeURIComponent(newName.trim())}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename document");
    } finally {
      setBusy(null);
    }
  };

  const spinner = (key: string) => busy === key && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger>
          <button className="rounded-lg border border-zinc-300 p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800" aria-label="Document actions">
            <MoreVertical className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isSubmittable && docstatus === 0 && (
            <DropdownMenuItem onClick={handleSubmit} disabled={!!busy}>
              {spinner("submit") || <CheckCircle2 className="h-4 w-4" />}
              Submit
            </DropdownMenuItem>
          )}
          {isSubmittable && docstatus === 1 && (
            <DropdownMenuItem onClick={handleCancel} disabled={!!busy} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
              {spinner("cancel") || <XCircle className="h-4 w-4" />}
              Cancel
            </DropdownMenuItem>
          )}
          {isSubmittable && docstatus === 2 && (
            <DropdownMenuItem onClick={handleAmend} disabled={!!busy}>
              {spinner("amend") || <RotateCcw className="h-4 w-4" />}
              Amend
            </DropdownMenuItem>
          )}
          {isSubmittable && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={handleDuplicate} disabled={!!busy}>
            {spinner("duplicate") || <Copy className="h-4 w-4" />}
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setNewName(name); setRenameOpen(true); }} disabled={!!busy}>
            <PenLine className="h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Print
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEmail}>
            <Mail className="h-4 w-4" />
            Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4" />
            Share
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {doctype}</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New name"
            aria-label="New document name"
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!newName.trim() || busy === "rename"}>
              {busy === "rename" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        doctype={doctype}
        name={name}
      />
    </>
  );
}
