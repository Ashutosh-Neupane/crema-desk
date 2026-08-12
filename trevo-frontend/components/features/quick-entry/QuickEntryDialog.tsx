"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Loader2, Zap } from "lucide-react";

interface QuickEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctype: string;
  onCreated?: (name: string) => void;
}

interface DocField {
  fieldname: string;
  label: string;
  fieldtype: string;
  reqd: number;
  options?: string;
}

export function QuickEntryDialog({ open, onOpenChange, doctype, onCreated }: QuickEntryDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const { data: meta } = useQuery({
    queryKey: ["doctype-meta", doctype],
    queryFn: async () => {
      const result = await frappeMethod<{ fields: DocField[] }>("frappe.model.get_meta", { doctype });
      return result;
    },
    enabled: open,
  });

  const reqdFields = useMemo(
    () => meta?.fields?.filter((f) => f.reqd && !["Section Break", "Column Break", "Tab Break", "Heading"].includes(f.fieldtype)) ?? [],
    [meta?.fields],
  );

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const doc: Record<string, unknown> = { doctype };
      for (const field of reqdFields) {
        if (values[field.fieldname]) {
          doc[field.fieldname] = values[field.fieldname];
        }
      }
      const result = await frappeMethod<{ name: string }>("frappe.client.insert", { doc });
      onCreated?.(result.name);
      onOpenChange(false);
      setValues({});
    } catch {
      // Error handled by parent
    } finally {
      setCreating(false);
    }
  }, [doctype, reqdFields, values, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-zinc-500" />
            <DialogTitle>Quick Entry: {doctype}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {reqdFields.length === 0 ? (
            <p className="text-sm text-zinc-500">No required fields for this doctype.</p>
          ) : (
            reqdFields.map((field) => (
              <div key={field.fieldname}>
                <Label>{field.label || field.fieldname}</Label>
                <Input
                  value={values[field.fieldname] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.fieldname]: e.target.value }))}
                  placeholder={field.label || field.fieldname}
                  className="mt-1"
                  autoFocus={field === reqdFields[0]}
                />
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || reqdFields.some((f) => !values[f.fieldname])}>
            {creating ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
