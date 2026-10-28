"use client";

/**
 * File manager (Desk: frappe/public/js/frappe/views/file/file_view.js — /app/file/view/home).
 * Folders and files from frappe.core.api.file: get_files_in_folder, get_files_by_search_text,
 * create_new_folder, move_file; upload_file into the open folder; delete via frappe.client.delete.
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, File as FileIcon, Folder, FolderPlus, Loader2, Lock, Search, Trash2, Upload } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import { isImageUrl, uploadFile } from "@/lib/frappe/upload";
import { timeAgo } from "@/lib/list/format";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";

interface Entry {
  name: string;
  file_name: string;
  file_url?: string;
  is_folder: number;
  is_private?: number;
  modified?: string;
}

const enc = encodeURIComponent;
const PAGE = 40;
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export default function FileManager() {
  const qc = useQueryClient();
  const [folder, setFolder] = useState("Home");
  const [limit, setLimit] = useState(PAGE);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const listQ = useQuery({
    queryKey: ["file-manager", folder, limit, q.trim()],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (q.trim()) {
        const { env } = await deskCall("frappe.core.api.file.get_files_by_search_text", { text: q.trim() });
        return { files: (env.message as Entry[]) ?? [], has_more: false };
      }
      const { env } = await deskCall("frappe.core.api.file.get_files_in_folder", { folder, start: 0, page_length: limit });
      return env.message as { files: Entry[]; has_more: boolean };
    },
  });
  const entries = (listQ.data?.files ?? []).filter(Boolean);
  const refresh = () => qc.invalidateQueries({ queryKey: ["file-manager"] });
  const open = (f: string) => {
    setFolder(f);
    setLimit(PAGE);
    setSelected(new Set());
    setQ("");
  };

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed", { duration: 8000 });
    } finally {
      setBusy(false);
      setSelected(new Set());
      refresh();
    }
  };

  const crumbs = folder.split("/");
  const folders = entries.filter((e) => e.is_folder);

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-500">
            <Link href="/desk/doctype/File" className="hover:underline">
              File
            </Link>
            {" / Home"}
          </div>
          <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {crumbs.map((c, i) => (
              <span key={crumbs.slice(0, i + 1).join("/")} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />}
                {i < crumbs.length - 1 ? (
                  <button type="button" onClick={() => open(crumbs.slice(0, i + 1).join("/"))} className="hover:underline">
                    {c}
                  </button>
                ) : (
                  <h1>{c}</h1>
                )}
              </span>
            ))}
          </nav>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files" aria-label="Search files" className="h-8 w-52 rounded-md border border-zinc-200 bg-white pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <button type="button" className={btn} onClick={() => setNewFolder("")}>
          <FolderPlus className="h-4 w-4" aria-hidden /> New Folder
        </button>
        <button type="button" className={btn} onClick={() => fileInput.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />} Upload
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="sr-only"
          aria-label="Upload files"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) void act(`Uploaded ${files.length} file${files.length > 1 ? "s" : ""}`, () => Promise.all(files.map((f) => uploadFile(f, { folder, is_private: true }))));
          }}
        />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-zinc-600 dark:text-zinc-300">{selected.size} selected</span>
          <button type="button" className={btn} onClick={() => setMoving(true)}>
            Move to…
          </button>
          <button type="button" className={`${btn} text-red-600`} onClick={() => void act(`Deleted ${selected.size}`, () => Promise.all([...selected].map((name) => deskCall("frappe.client.delete", { doctype: "File", name }))))}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm" aria-label={`Files in ${folder}`}>
          <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Name
              </th>
              <th scope="col" className="w-40 px-3 py-2 text-left font-medium">
                Modified
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.name} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40">
                <td className="px-3 py-1.5">
                  {e.name !== "Home/Attachments" && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${e.file_name}`}
                      checked={selected.has(e.name)}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(e.name)) n.delete(e.name);
                          else n.add(e.name);
                          return n;
                        })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {e.is_folder ? (
                    <button type="button" onClick={() => open(e.name)} className="inline-flex items-center gap-2 font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                      <Folder className="h-4 w-4 text-amber-500" aria-hidden /> {e.file_name}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      {e.file_url && isImageUrl(e.file_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- served by the Frappe file proxy
                        <img src={e.file_url} alt="" className="h-6 w-6 rounded object-cover" />
                      ) : (
                        <FileIcon className="h-4 w-4 text-zinc-400" aria-hidden />
                      )}
                      <Link href={`/desk/doctype/File/${enc(e.name)}`} className="text-zinc-800 hover:underline dark:text-zinc-200">
                        {e.file_name}
                      </Link>
                      {e.file_url?.startsWith("/private/") && <Lock className="h-3 w-3 text-zinc-400" aria-label="Private" />}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-xs text-zinc-500">{timeAgo(e.modified)}</td>
              </tr>
            ))}
            {!listQ.isLoading && !entries.length && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-sm text-zinc-500">
                  {q ? "No files match" : "This folder is empty"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {listQ.data?.has_more && (
        <div className="text-center">
          <button type="button" className={btn} onClick={() => setLimit((l) => l + PAGE)}>
            Load more
          </button>
        </div>
      )}

      <Dialog open={newFolder !== null} onOpenChange={(o) => !o && setNewFolder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>Created inside {folder}.</DialogDescription>
          </DialogHeader>
          <input aria-label="Folder name" autoFocus value={newFolder ?? ""} onChange={(e) => setNewFolder(e.target.value)} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <DialogFooter>
            <button type="button" className={btn} onClick={() => setNewFolder(null)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!newFolder?.trim()}
              onClick={() => {
                const name = newFolder!.trim();
                setNewFolder(null);
                void act(`Folder ${name} created`, () => deskCall("frappe.core.api.file.create_new_folder", { file_name: name, folder }));
              }}
              className="h-8 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moving} onOpenChange={setMoving}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to</DialogTitle>
            <DialogDescription>Pick a folder.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {[...(folder !== "Home" ? [{ name: folder.split("/").slice(0, -1).join("/") || "Home", file_name: "↑ Parent folder" }] : []), ...folders.filter((f) => !selected.has(f.name))].map((f) => (
              <li key={f.name}>
                <button
                  type="button"
                  onClick={() => {
                    setMoving(false);
                    const list = entries.filter((x) => selected.has(x.name)).map((x) => ({ name: x.name }));
                    void act(`Moved to ${f.name}`, () => deskCall("frappe.core.api.file.move_file", { file_list: JSON.stringify(list), new_parent: f.name, old_parent: folder }));
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Folder className="h-4 w-4 text-amber-500" aria-hidden /> {f.file_name}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
