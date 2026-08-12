"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frappeGet, frappePost, frappeDelete } from "@/lib/frappe/client";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Badge } from "@/components/shadcn/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import { Plus, ExternalLink, Trash2, Eye, Settings2 } from "lucide-react";
import type { FormBuilderField } from "@/components/features/form-builder/types";

interface WebFormDoc {
  name: string;
  title: string;
  description?: string;
  doctype: string;
  fields?: FormBuilderField[];
  submit_button_label?: string;
  success_message?: string;
  published?: number;
  creation?: string;
}

export function WebFormList() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [doctype, setDoctype] = useState("");

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["web-forms"],
    queryFn: async () => {
      const res = await frappeGet<{ message: WebFormDoc[] }>("api/resource/Web Form?fields=[\"name\",\"title\",\"doctype\",\"published\",\"creation\"]&limit_page_length=50");
      return res.message ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return frappePost("api/resource/Web Form", {
        name,
        title: title || name,
        doctype,
        fields: [],
        published: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["web-forms"] });
      setCreateOpen(false);
      setName("");
      setTitle("");
      setDoctype("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (formName: string) => {
      await frappeDelete(`api/resource/Web Form/${encodeURIComponent(formName)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["web-forms"] });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ formName, published }: { formName: string; published: number }) => {
      return frappePost(`api/resource/Web Form/${encodeURIComponent(formName)}`, { published: published ? 0 : 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["web-forms"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Web Forms</h2>
          <p className="text-sm text-zinc-500">Public-facing forms that create records in Frappe</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Form
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-zinc-500">No web forms yet. Create your first public form.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.name} className="p-4 flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{form.title || form.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">Linked to: {form.doctype}</p>
                </div>
                <Badge variant={form.published ? "default" : "secondary"}>
                  {form.published ? "Published" : "Draft"}
                </Badge>
              </div>
              <div className="mt-auto pt-4 flex items-center gap-2">
                <Link href={`/api/web-form/${encodeURIComponent(form.name)}`} target="_blank">
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </Link>
                <Link href={`/desk/web-form/builder/${encodeURIComponent(form.name)}`}>
                  <Button variant="ghost" size="sm">
                    <Settings2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => togglePublishMutation.mutate({ formName: form.name, published: form.published ?? 0 })}>
                  <Eye className="h-4 w-4 mr-1" />
                  {form.published ? "Unpublish" : "Publish"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(form.name)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Web Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Form ID</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. contact-us" />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Contact Us" />
            </div>
            <div>
              <Label>Linked DocType</Label>
              <Input value={doctype} onChange={(e) => setDoctype(e.target.value)} placeholder="e.g. Lead, Contact" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={!name || !doctype}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
