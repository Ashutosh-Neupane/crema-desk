"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import {
  Globe,
  Plus,
  Search,
  Save,
  Loader2,
  Languages,
  Edit3,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils/formatNumber";

interface TranslationDoc {
  name: string;
  language: string;
  source_text: string;
  translated_text: string;
  modified: string;
}

interface LanguageDoc {
  name: string;
  language_name: string;
  language_code: string;
  enabled: number;
}

export function TranslationManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTranslation, setEditingTranslation] = useState<TranslationDoc | null>(null);
  const [newTranslation, setNewTranslation] = useState({ source_text: "", translated_text: "", language: "" });

const { data: languages = [] } = useQuery({
    queryKey: ["languages"],
    queryFn: async () => {
      const res = await fetch(`/api/frappe/frappe.client.get_list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Language",
          fields: ["name", "language_name", "language_code", "enabled"],
          filters: { enabled: 1 },
          limit: 200,
        }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.message ?? []) as LanguageDoc[];
    },
    staleTime: 300_000,
  });

  const { data: translations = [], isLoading, refetch } = useQuery({
    queryKey: ["translations", selectedLanguage, searchQuery],
    queryFn: async () => {
      const filters: Record<string, unknown> = {};
      if (selectedLanguage) filters.language = selectedLanguage;
      const res = await fetch(`/api/frappe/frappe.client.get_list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Translation",
          filters,
          fields: ["name", "language", "source_text", "translated_text", "modified"],
          limit: 500,
          order_by: "modified desc",
        }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.message ?? []) as TranslationDoc[];
    },
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/frappe/frappe.client.insert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Translation",
          ...data,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; translated_text: string }) => {
      const res = await fetch(`/api/frappe/frappe.client.set_value`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Translation",
          name: data.name,
          fieldname: "translated_text",
          value: data.translated_text,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const filteredTranslations = translations.filter((t) =>
    !searchQuery ||
    t.source_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.translated_text?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = useCallback((translation: TranslationDoc) => {
    setEditingTranslation(translation);
    setEditDialogOpen(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingTranslation) {
      updateMutation.mutate({
        name: editingTranslation.name,
        translated_text: editingTranslation.translated_text,
      });
      setEditDialogOpen(false);
      setEditingTranslation(null);
    }
  }, [editingTranslation, updateMutation]);

  const handleAddNew = useCallback(() => {
    saveMutation.mutate({
      source_text: newTranslation.source_text,
      translated_text: newTranslation.translated_text,
      language: newTranslation.language || selectedLanguage,
    });
    setNewTranslation({ source_text: "", translated_text: "", language: "" });
  }, [newTranslation, selectedLanguage, saveMutation]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-zinc-500" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Translation Manager</h1>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search translations..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <select aria-label="Filter by language"
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="h-8 rounded-lg border border-zinc-300 px-3 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">All Languages</option>
          {languages.map((lang) => (
            <option key={lang.name} value={lang.name}>{lang.language_name}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <Loader2 className="h-3 w-3" />
        </Button>
        <Button size="sm" onClick={handleAddNew} disabled={!newTranslation.source_text}>
          <Plus className="h-3 w-3 mr-1" />
          Add Translation
        </Button>
      </div>

      {/* New translation input */}
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <Input
            value={newTranslation.source_text}
            onChange={(e) => setNewTranslation((prev) => ({ ...prev, source_text: e.target.value }))}
            placeholder="Source text (English)"
            className="h-8 text-xs"
          />
          <Input
            value={newTranslation.translated_text}
            onChange={(e) => setNewTranslation((prev) => ({ ...prev, translated_text: e.target.value }))}
            placeholder="Translation"
            className="h-8 text-xs"
          />
          <select aria-label="Language"
            value={newTranslation.language}
            onChange={(e) => setNewTranslation((prev) => ({ ...prev, language: e.target.value }))}
            className="h-8 rounded-lg border border-zinc-300 px-3 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">Select language...</option>
            {languages.map((lang) => (
              <option key={lang.name} value={lang.name}>{lang.language_name}</option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleAddNew}
            disabled={!newTranslation.source_text || !newTranslation.translated_text}
          >
            <Save className="h-3 w-3" />
          </Button>
        </div>
      </Card>

      {/* Translation list */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : filteredTranslations.length === 0 ? (
        <Card className="p-12 text-center">
          <Languages className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-2 text-sm text-zinc-500">No translations found</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Language</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Source Text</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Translation</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Modified</th>
                <th className="px-4 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {filteredTranslations.map((t) => (
                <tr key={t.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-2">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t.language}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300 max-w-xs truncate">{t.source_text}</td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300 max-w-xs truncate">{t.translated_text}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">{formatDateTime(t.modified, false)}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(t)}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Translation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Language</Label>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{editingTranslation?.language}</p>
            </div>
            <div>
              <Label>Source Text</Label>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{editingTranslation?.source_text}</p>
            </div>
            <div>
              <Label>Translation</Label>
              <Input
                value={editingTranslation?.translated_text ?? ""}
                onChange={(e) => setEditingTranslation((prev) => prev ? { ...prev, translated_text: e.target.value } : null)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
