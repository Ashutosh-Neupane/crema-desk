"use client";

/**
 * Session Defaults dialog (Desk: frappe.ui.toolbar.setup_session_defaults in ui/toolbar/toolbar.js).
 * Fields come from the whitelisted get_session_default_values (one Link per configured ref doctype,
 * default = the user default); Save calls set_session_default_values, then
 * frappe.ui.toolbar.clear_cache() (boot bust + reload). "Configure" opens the single's form.
 */
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Button } from "@/components/shadcn/button";
import LinkInput from "@/components/list/LinkInput";
import { deskCall } from "@/lib/frappe/form";
import { clearDoctypeMetaCache } from "@/lib/frappe/doctype";
import { toast } from "sonner";

interface SessionDefaultField {
  fieldname: string;
  fieldtype: string;
  options: string;
  label: string;
  default: string | null;
}

export default function SessionDefaultsDialog({ open, onClose, isSystemManager }: { open: boolean; onClose: () => void; isSystemManager: boolean }) {
  const qc = useQueryClient();
  // edits on top of the loaded defaults; reset each time the dialog opens
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { data: fields, error } = useQuery({
    queryKey: ["session-defaults"],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { env } = await deskCall("frappe.core.doctype.session_default_settings.session_default_settings.get_session_default_values");
      const message = env.message as string | SessionDefaultField[];
      return (typeof message === "string" ? JSON.parse(message) : message) as SessionDefaultField[];
    },
  });
  const values: Record<string, string> = { ...Object.fromEntries((fields ?? []).map((f) => [f.fieldname, f.default ?? ""])), ...edits };
  const setValues = (fn: (s: Record<string, string>) => Record<string, string>) => setEdits((e) => fn({ ...values, ...e }));
  const close = () => {
    setEdits({});
    onClose();
  };

  const save = async () => {
    setBusy(true);
    try {
      // Desk sends "" for cleared values (set_user_default removes the default)
      const payload = Object.fromEntries(fields?.map((f) => [f.fieldname, values[f.fieldname] ?? ""]) ?? []);
      const { env } = await deskCall("frappe.core.doctype.session_default_settings.session_default_settings.set_session_default_values", {
        default_values: payload,
      });
      if (env.message === "success") {
        toast.success("Session Defaults Saved");
        // frappe.ui.toolbar.clear_cache(): server boot cache + client caches, then reload
        clearDoctypeMetaCache();
        qc.clear();
        await fetch("/api/desk/shell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear-cache" }), credentials: "include" });
        window.location.reload();
      } else {
        toast.error("An error occurred while setting Session Defaults");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "An error occurred while setting Session Defaults");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Session Defaults</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="py-4 text-sm text-red-600">{error instanceof Error ? error.message : "Could not load Session Defaults"}</p>
        ) : !fields ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        ) : fields.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500">
            No session defaults are configured. A System Manager can set them up in Session Default Settings.
          </p>
        ) : (
          <div className="grid gap-3 py-1">
            {fields.map((f) => (
              <div key={f.fieldname} className="grid gap-1.5">
                <label htmlFor={`session-default-${f.fieldname}`} className="text-xs font-medium text-zinc-500">
                  {f.label}
                </label>
                <LinkInput
                  id={`session-default-${f.fieldname}`}
                  doctype={f.options}
                  value={values[f.fieldname] ?? ""}
                  onChange={(v) => setValues((s) => ({ ...s, [f.fieldname]: v }))}
                />
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {isSystemManager ? (
            <Link
              href="/desk/doctype/Session%20Default%20Settings/Session%20Default%20Settings"
              onClick={close}
              className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
            >
              Configure
            </Link>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={busy || !fields?.length}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
