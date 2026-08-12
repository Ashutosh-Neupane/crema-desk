"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Image as ImageIcon, X, ChevronLeft, ChevronRight, Loader2, Grid3X3 } from "lucide-react";

interface ImageDoc {
  name: string;
  file_name: string;
  file_url: string;
  file_size: number;
}

interface ImageViewProps {
  doctype?: string;
  docname?: string;
}

export function ImageView({ doctype, docname }: ImageViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "lightbox">("grid");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["images", doctype, docname],
    queryFn: async () => {
      const filters: Record<string, unknown> = {
        file_type: ["in", ["image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp"]],
      };
      if (doctype && docname) {
        filters.attached_to_doctype = doctype;
        filters.attached_to_name = docname;
      }
      const res = await fetch(`/api/frappe/frappe.client.get_list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "File",
          filters,
          fields: ["name", "file_name", "file_url", "file_size"],
          limit: 200,
        }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.message ?? []) as ImageDoc[];
    },
    staleTime: 60_000,
  });

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setViewMode("lightbox");
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    setViewMode("grid");
  }, []);

  const navigateLightbox = useCallback((direction: "prev" | "next") => {
    setLightboxIndex((prev) => {
      if (prev === null) return 0;
      if (direction === "prev") return prev > 0 ? prev - 1 : images.length - 1;
      return prev < images.length - 1 ? prev + 1 : 0;
    });
  }, [images.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {images.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-500">No images found</p>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">{images.length} images</span>
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "grid" ? "lightbox" : "grid")}>
              <Grid3X3 className="h-4 w-4 mr-1" />
              {viewMode === "grid" ? "Lightbox" : "Grid"}
            </Button>
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {images.map((img, index) => (
                <button
                  key={img.name}
                  onClick={() => openLightbox(index)}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- dynamic Frappe file URLs */}
                  <img
                    src={img.file_url}
                    alt={img.file_name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <p className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-6 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {img.file_name}
                  </p>
                </button>
              ))}
            </div>
          ) : lightboxIndex !== null && images[lightboxIndex] ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={closeLightbox} onKeyDown={(e) => { if (e.key === "Escape") closeLightbox(); }}>
              <button
                onClick={(e) => { e.stopPropagation(); navigateLightbox("prev"); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigateLightbox("next"); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <button
                onClick={closeLightbox}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic Frappe file URLs */}
              <img
                src={images[lightboxIndex].file_url}
                alt={images[lightboxIndex].file_name}
                className="max-h-[90vh] max-w-[90vw] object-contain"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
                {lightboxIndex + 1} / {images.length} — {images[lightboxIndex].file_name}
                {doctype && (
                  <a
                    href={`/desk/doctype/${encodeURIComponent(doctype)}`}
                    className="ml-3 text-blue-400 hover:text-blue-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open Document
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {images.map((img, index) => (
                <button
                  key={img.name}
                  onClick={() => openLightbox(index)}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- dynamic Frappe file URLs */}
                  <img
                    src={img.file_url}
                    alt={img.file_name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
