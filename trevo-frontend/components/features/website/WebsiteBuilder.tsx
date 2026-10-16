"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frappeGet, frappePost, frappeDelete } from "@/lib/frappe/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/Skeleton";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface WebPageDoc {
  name: string;
  route: string;
  title?: string;
  published?: number;
  modified?: string;
  blocks?: string;
}

interface BuilderBlock {
  id: string;
  type: "hero" | "features" | "text" | "image" | "cta" | "footer";
  title?: string;
  content?: string;
  image?: string;
  order?: number;
}

export function WebsiteBuilder() {
  const qc = useQueryClient();
  const { data: pages, isLoading: pagesLoading } = useQuery<WebPageDoc[]>({
    queryKey: ["web-pages"],
    queryFn: async () => {
      const res = await frappeGet<{ message: WebPageDoc[] }>(
        'api/resource/Web Page?fields=["name","route","title","published","modified"]&order_by=modified desc',
      );
      return res.message ?? [];
    },
  });

  const [selectedPage, setSelectedPage] = useState<WebPageDoc | null>(null);
  const [blocks, setBlocks] = useState<BuilderBlock[]>([]);
  const [title, setTitle] = useState("");
  const [route, setRoute] = useState("");
  const [published, setPublished] = useState(false);

  const selectPage = (page: WebPageDoc) => {
    setSelectedPage(page);
    setTitle(page.title ?? "");
    setRoute(page.route ?? "");
    setPublished(!!page.published);
    try {
      setBlocks(JSON.parse(page.blocks ?? "[]"));
    } catch {
      setBlocks([]);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: selectedPage?.name,
        route,
        title,
        published: published ? 1 : 0,
        blocks: JSON.stringify(blocks),
        content: generatePageHtml(blocks),
      };
      if (selectedPage?.name) {
        await frappePost(`api/resource/Web Page/${encodeURIComponent(selectedPage.name)}`, payload);
      } else {
        await frappePost("api/resource/Web Page", payload);
      }
    },
    onSuccess: () => {
      toast.success("Page saved");
      qc.invalidateQueries({ queryKey: ["web-pages"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPage?.name) return;
      await frappeDelete(`api/resource/Web Page/${encodeURIComponent(selectedPage.name)}`);
    },
    onSuccess: () => {
      toast.success("Page deleted");
      setSelectedPage(null);
      setBlocks([]);
      qc.invalidateQueries({ queryKey: ["web-pages"] });
    },
  });

  const addBlock = (type: BuilderBlock["type"]) => {
    setBlocks((b) => [...b, { id: crypto.randomUUID(), type, order: b.length }]);
  };

  const updateBlock = (id: string, patch: Partial<BuilderBlock>) => {
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeBlock = (id: string) => {
    setBlocks((b) => b.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Website Builder"
        description="Build and manage website pages"
        actions={
          <Button size="sm" onClick={() => { setSelectedPage(null); setBlocks([]); setTitle(""); setRoute(""); setPublished(false); }}>
            <Plus className="mr-1 h-4 w-4" />
            New Page
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 divide-y divide-zinc-100 dark:divide-zinc-800">
          {pagesLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : pages?.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No website pages yet.</p>
          ) : (
            pages?.map((page) => (
              <button
                key={page.name}
                onClick={() => selectPage(page)}
                className={`w-full p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                  selectedPage?.name === page.name ? "bg-zinc-50 dark:bg-zinc-800" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {page.title || page.route}
                  </p>
                  <Badge variant={page.published ? "default" : "secondary"}>
                    {page.published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-500">/{page.route}</p>
              </button>
            ))
          )}
        </Card>

        <Card className="lg:col-span-2 p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Route</Label>
              <Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="e.g. about-us" />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPublished((p) => !p)}>
              {published ? "Published" : "Draft"}
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
            {selectedPage && (
              <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate()}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Blocks</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addBlock("hero")}>Hero</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("features")}>Features</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("text")}>Text</Button>
                <Button size="sm" variant="outline" onClick={() => addBlock("cta")}>CTA</Button>
              </div>
            </div>
            <div className="space-y-2">
              {blocks.map((block) => (
                <div key={block.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase text-zinc-500">{block.type}</span>
                    <Button size="sm" variant="ghost" onClick={() => removeBlock(block.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {block.type === "hero" && (
                    <div className="mt-2 space-y-2">
                      <Input value={block.title ?? ""} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="Headline" />
                      <Textarea value={block.content ?? ""} onChange={(e) => updateBlock(block.id, { content: e.target.value })} placeholder="Subheadline" />
                    </div>
                  )}
                  {block.type === "text" && (
                    <Textarea className="mt-2" value={block.content ?? ""} onChange={(e) => updateBlock(block.id, { content: e.target.value })} placeholder="Body text" />
                  )}
                  {block.type === "cta" && (
                    <Input className="mt-2" value={block.title ?? ""} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="Button text" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function generatePageHtml(blocks: BuilderBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "hero":
          return `<section class="hero"><h1>${b.title ?? ""}</h1><p>${b.content ?? ""}</p></section>`;
        case "features":
          return `<section class="features"><h2>${b.title ?? "Features"}</h2><p>${b.content ?? ""}</p></section>`;
        case "text":
          return `<section class="text"><p>${b.content ?? ""}</p></section>`;
        case "cta":
          return `<section class="cta"><a href="#" class="btn">${b.title ?? "Get Started"}</a></section>`;
        default:
          return "";
      }
    })
    .join("\n");
}
