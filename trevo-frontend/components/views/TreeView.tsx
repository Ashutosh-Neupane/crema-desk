"use client";

/**
 * Tree view (Desk: frappe/public/js/frappe/views/treeview.js) for DocTypes
 * with is_tree. Settings come from the DocType's own tree JS
 * (frappe.treeview_settings[doctype] via __tree_js): node method
 * (get_tree_nodes), root label, get_tree_root, filters (e.g. Company).
 * Children load lazily: method(doctype, parent, is_root, ...filters).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, File, Folder, FolderOpen, Loader2, Plus, Search } from "lucide-react";
import { createRuntime } from "@/lib/desk-runtime";
import { deskCall } from "@/lib/frappe/form";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { PREFILL_KEY } from "@/lib/form/prefill";
import LinkInput from "@/components/list/LinkInput";

interface TreeNode {
  value: string;
  title?: string;
  expandable?: 0 | 1 | boolean;
  [key: string]: unknown;
}

interface TreeFilter {
  fieldname: string;
  label?: string;
  fieldtype: string;
  options?: unknown;
  default?: unknown;
  hidden?: unknown;
}

const enc = encodeURIComponent;
const scrub = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");

export default function TreeView({ doctype }: { doctype: string }) {
  const router = useRouter();
  const { data: meta, error } = useDoctype(doctype);
  const { data: ctx } = useDeskContext();

  // frappe.treeview_settings[doctype] from the DocType's tree JS
  const settings = useMemo(() => {
    if (!meta || !ctx) return null;
    const rt = createRuntime({ user: ctx.user, roles: ctx.roles, defaults: ctx.defaults, sysdefaults: ctx.sysdefaults, perms: ctx.perms, boot: ctx.boot, metas: { [meta.name]: meta } });
    rt.evalScript(String((meta as { __tree_js?: string }).__tree_js ?? ""), `${doctype} tree js`);
    const ts = (rt.frappe as unknown as { treeview_settings?: Record<string, Record<string, unknown>> }).treeview_settings?.[doctype];
    return ts ?? {};
  }, [meta, ctx, doctype]);

  const method = String(settings?.get_tree_nodes ?? "frappe.desk.treeview.get_children");
  const filters = useMemo<TreeFilter[]>(
    () => ((settings?.filters as TreeFilter[] | undefined) ?? []).filter((f) => f && !f.hidden && f.fieldname),
    [settings],
  );
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const filterDefaults = useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of filters) {
      const d = typeof f.default === "string" ? f.default : (ctx?.defaults?.[f.fieldname] as string | undefined);
      if (d) out[f.fieldname] = d;
    }
    return out;
  }, [filters, ctx]);
  const args = useMemo(() => ({ ...filterDefaults, ...filterValues }), [filterDefaults, filterValues]);

  const [root, setRoot] = useState<{ label: string; value: string } | null>(null);
  const [children, setChildren] = useState<Record<string, TreeNode[]>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const fetchChildren = useCallback(
    async (parent: string, isRoot: boolean): Promise<TreeNode[]> => {
      const { env } = await deskCall(method, { doctype, parent, is_root: isRoot ? 1 : 0, ...args });
      return ((env.message as TreeNode[]) ?? []).filter(Boolean);
    },
    [method, doctype, args],
  );

  // root: Desk asks the node method once (get_tree_root) or uses root_label
  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        let r: { label: string; value: string };
        if (settings.get_tree_root === false) {
          const label = String(settings.root_label ?? doctype);
          r = { label, value: label };
        } else {
          const top = await fetchChildren("", true);
          r = top.length === 1 ? { label: String(top[0].title ?? top[0].value), value: top[0].value } : { label: String(settings.root_label ?? doctype), value: "" };
          if (top.length !== 1 && !cancelled) setChildren({ "": top });
        }
        if (cancelled) return;
        setRoot(r);
        setOpen(new Set([r.value]));
        if (r.value) {
          const kids = await fetchChildren(r.value, true);
          if (!cancelled) setChildren((c) => ({ ...c, [r.value]: kids }));
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load tree");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings, fetchChildren, doctype]);

  const toggle = async (node: TreeNode) => {
    const next = new Set(open);
    if (next.has(node.value)) {
      next.delete(node.value);
      setOpen(next);
      return;
    }
    next.add(node.value);
    setOpen(next);
    if (!children[node.value]) {
      setLoading((l) => new Set([...l, node.value]));
      try {
        const kids = await fetchChildren(node.value, false);
        setChildren((c) => ({ ...c, [node.value]: kids }));
      } finally {
        setLoading((l) => {
          const n = new Set(l);
          n.delete(node.value);
          return n;
        });
      }
    }
  };

  const parentField = String(meta?.nsm_parent_field ?? `parent_${scrub(doctype)}`);
  const addChild = (parent: string) => {
    const prefill: Record<string, unknown> = { [parentField]: parent || undefined, ...args };
    sessionStorage.setItem(PREFILL_KEY(doctype), JSON.stringify(prefill));
    router.push(`/desk/doctype/${enc(doctype)}/new`);
  };

  const q = query.trim().toLowerCase();
  const matches = (n: TreeNode) => !q || String(n.title ?? n.value).toLowerCase().includes(q) || n.value.toLowerCase().includes(q);

  const renderNodes = (parent: string, depth: number): React.ReactNode => {
    const list = (children[parent] ?? []).filter((n) => matches(n) || open.has(n.value));
    if (!list.length && depth > 0 && !loading.has(parent)) return <li className="py-1 text-xs text-zinc-400" style={{ paddingLeft: depth * 20 + 28 }}>Empty</li>;
    return list.map((n) => {
      const expandable = !!Number(n.expandable) || n.expandable === true;
      const isOpen = open.has(n.value);
      const label = String(n.title ?? n.account_name ?? n.value);
      return (
        <li key={n.value}>
          <div className="group flex items-center gap-1.5 rounded-md py-1 pr-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ paddingLeft: depth * 20 + 4 }}>
            <button
              type="button"
              onClick={() => expandable && void toggle(n)}
              aria-label={expandable ? `${isOpen ? "Collapse" : "Expand"} ${label}` : label}
              aria-expanded={expandable ? isOpen : undefined}
              className={`flex h-5 w-5 items-center justify-center rounded text-zinc-400 ${expandable ? "hover:bg-zinc-200 dark:hover:bg-zinc-700" : "invisible"}`}
            >
              {loading.has(n.value) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />}
            </button>
            {expandable ? (isOpen ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-amber-500" />) : <File className="h-4 w-4 text-zinc-400" />}
            <Link href={`/desk/doctype/${enc(doctype)}/${enc(n.value)}`} className="min-w-0 flex-1 truncate text-sm text-zinc-800 hover:underline dark:text-zinc-100">
              {label}
              {label !== n.value && <span className="ml-2 text-xs text-zinc-400">{n.value}</span>}
            </Link>
            {expandable && (
              <button type="button" onClick={() => addChild(n.value)} aria-label={`Add child to ${label}`} className="rounded p-1 text-zinc-400 opacity-0 hover:bg-zinc-200 hover:text-zinc-700 group-hover:opacity-100 dark:hover:bg-zinc-700">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {expandable && isOpen && <ul>{renderNodes(n.value, depth + 1)}</ul>}
        </li>
      );
    });
  };

  if (error) return <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{String(settings?.title ?? doctype)}</h1>
        <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          <Link href={`/desk/doctype/${enc(doctype)}?view=list`} className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">List</Link>
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100">Tree</span>
        </div>
        <button type="button" onClick={() => addChild(root?.value ?? "")} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
          <Plus className="h-4 w-4" /> Add {doctype}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter loaded nodes" aria-label="Filter loaded nodes" className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
        {filters.map((f) => {
          // ERPNext company filters are Selects filled by bundle helpers — treat as a Company link
          const linkTo = f.fieldtype === "Link" ? String(f.options) : f.fieldname === "company" ? "Company" : null;
          const val = args[f.fieldname] ?? "";
          return linkTo ? (
            <LinkInput key={f.fieldname} doctype={linkTo} value={val} onChange={(v) => setFilterValues((s) => ({ ...s, [f.fieldname]: v }))} placeholder={f.label ?? f.fieldname} className="w-56" />
          ) : (
            <input key={f.fieldname} defaultValue={val} onBlur={(e) => setFilterValues((s) => ({ ...s, [f.fieldname]: e.target.value }))} placeholder={f.label ?? f.fieldname} aria-label={f.label ?? f.fieldname} className="h-8 w-48 rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        {err ? (
          <p className="p-4 text-sm text-red-600">{err}</p>
        ) : !root ? (
          <div className="space-y-2 p-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" style={{ width: `${60 - i * 8}%`, marginLeft: i * 16 }} />)}</div>
        ) : (
          <ul aria-label={`${doctype} tree`}>
            {root.value ? (
              <li>
                <div className="flex items-center gap-1.5 py-1 pl-1">
                  <FolderOpen className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{root.label}</span>
                </div>
                <ul>{renderNodes(root.value, 1)}</ul>
              </li>
            ) : (
              renderNodes("", 0)
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
