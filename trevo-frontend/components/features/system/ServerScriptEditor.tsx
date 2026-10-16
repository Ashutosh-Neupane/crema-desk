"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frappeGet, frappePost, frappeDelete } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Textarea } from "@/components/shadcn/textarea";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/Skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Play } from "lucide-react";
import { formatDateTime } from "@/lib/utils/formatNumber";

interface ServerScriptDoc {
  name: string;
  script_type: string;
  disabled: number;
  modified: string;
  script?: string;
}

export function ServerScriptEditor() {
  const qc = useQueryClient();
  const { data: scripts, isLoading } = useQuery<ServerScriptDoc[]>({
    queryKey: ["server-scripts"],
    queryFn: async () => {
      const res = await frappeGet<{ message: ServerScriptDoc[] }>(
        'api/resource/Server Script?fields=["name","script_type","disabled","modified","script"]&order_by=modified desc',
      );
      return res.message ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ name, script, script_type }: { name?: string; script: string; script_type: string }) => {
      await frappePost("api/resource/Server Script", {
        name,
        script_type,
        script,
        disabled: 0,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["server-scripts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      await frappeDelete(`api/resource/Server Script/${encodeURIComponent(name)}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["server-scripts"] }),
  });

  const runMutation = useMutation({
    mutationFn: async ({ script_type, script }: { script_type: string; script: string }) => {
      return frappePost<{ message: unknown }>("api/method/run_doc_method", {
        doctype: "Server Script",
        name: script_type,
        script,
      });
    },
  });

  const [selected, setSelected] = useState<ServerScriptDoc | null>(null);
  const [draft, setDraft] = useState("");

  const handleSelect = (script: ServerScriptDoc) => {
    setSelected(script);
    setDraft(script.script ?? "");
  };

  const handleSave = () => {
    if (!selected) return;
    saveMutation.mutate(
      { name: selected.name, script: draft, script_type: selected.script_type },
      {
        onSuccess: () => toast.success("Script saved"),
      },
    );
  };

  const handleNew = () => {
    setSelected(null);
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Server Scripts"
        description="Extend server-side behavior with Python/JS scripts"
        actions={
          <Button size="sm" onClick={handleNew}>
            <Plus className="mr-1 h-4 w-4" />
            New Script
          </Button>
        }
      />

      {isLoading ? (
        <Card className="p-6">
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {scripts?.length === 0 && (
              <p className="p-4 text-sm text-zinc-500">No server scripts found.</p>
            )}
            {scripts?.map((script) => (
              <button
                key={script.name}
                onClick={() => handleSelect(script)}
                className={`w-full p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                  selected?.name === script.name ? "bg-zinc-50 dark:bg-zinc-800" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {script.name}
                  </p>
                  <Badge variant={script.disabled ? "secondary" : "default"}>
                    {script.disabled ? "Disabled" : script.script_type}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDateTime(script.modified)}
                </p>
              </button>
            ))}
          </Card>

          <Card className="lg:col-span-2 p-4 space-y-3">
            {selected ? (
              <>
                <div className="flex items-center justify-between">
                  <Input
                    value={selected.name}
                    onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                    className="w-64"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        runMutation.mutate(
                          { script_type: selected.script_type, script: draft },
                          { onSuccess: () => toast.success("Script executed") },
                        )
                      }
                    >
                      <Play className="mr-1 h-4 w-4" />
                      Run
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        deleteMutation.mutate(selected.name, {
                          onSuccess: () => {
                            setSelected(null);
                            setDraft("");
                          },
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="font-mono text-sm"
                  rows={20}
                  placeholder="Write your server script here..."
                />
              </>
            ) : (
              <div className="py-10 text-center text-sm text-zinc-500">
                Select a script to edit or create a new one.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
