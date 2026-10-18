"use client";

/**
 * Role Permissions Manager (Desk: frappe/core/page/permission_manager — frappe.PermissionEngine), native.
 * Same whitelisted methods as Desk: get_roles_and_doctypes, get_permissions, add, update, remove, reset,
 * get_standard_permissions, get_users_with_role. Desk route /app/permission-manager/<doctype>; ?role= filters.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, Users, X } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import LinkInput from "@/components/list/LinkInput";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";

const PM = "frappe.core.page.permission_manager.permission_manager";
const enc = encodeURIComponent;
const RIGHTS = ["select", "read", "write", "create", "delete", "submit", "cancel", "amend", "print", "email", "report", "import", "export", "share", "mask"];
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
const primary = "inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const select = "h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900";

interface Perm {
  name: string;
  parent: string;
  role: string;
  permlevel: number;
  if_owner?: number;
  is_submittable?: number;
  [right: string]: unknown;
}
interface Options {
  doctypes: Array<{ label: string; value: string }>;
  roles: Array<{ label: string; value: string }>;
  doctype_ptype_map: Record<string, string[]>;
}

const label = (r: string) => r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Rights shown for a rule, in Desk's order (submit/cancel/amend only when submittable; levels > 0: read/write/mask) */
function rightsFor(p: Perm, custom: string[]) {
  return [...RIGHTS, ...custom].filter((r) => {
    if (!p.is_submittable && ["submit", "cancel", "amend"].includes(r)) return false;
    if (p.permlevel > 0 && !["read", "write", "mask"].includes(r)) return false;
    return !(p.if_owner && r === "report");
  });
}

export default function PermissionManager({ doctype }: { doctype: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const role = params.get("role") ?? "";
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [usersOf, setUsersOf] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const optsQ = useQuery({
    queryKey: ["perm-manager-options"],
    staleTime: 5 * 60_000,
    queryFn: async () => (await deskCall(`${PM}.get_roles_and_doctypes`)).env.message as Options,
  });
  const key = ["perm-manager", doctype, role];
  const permsQ = useQuery({
    queryKey: key,
    enabled: !!(doctype || role),
    queryFn: async () => (((await deskCall(`${PM}.get_permissions`, { doctype: doctype || undefined, role: role || undefined })).env.message as Perm[]) ?? []).filter((p) => p.parent !== "DocType"),
  });
  const perms = permsQ.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["perm-manager"] });

  const go = (dt: string, r: string) => {
    const base = pathname.replace(/\/page\/permission-manager.*$/, "/page/permission-manager");
    router.replace(`${base}${dt ? `/${enc(dt)}` : ""}${r ? `?role=${enc(r)}` : ""}`);
  };

  const toggle = async (p: Perm, ptype: string, on: boolean) => {
    const id = `${p.name}:${ptype}`;
    setBusy(id);
    // optimistic, reverted by the refetch if the server refuses (Desk: chk.prop("checked", !checked))
    qc.setQueryData<Perm[]>(key, (rows) => rows?.map((x) => (x.name === p.name ? { ...x, [ptype]: on ? 1 : 0, ...(ptype === "if_owner" && on ? { report: 0 } : {}) } : x)));
    try {
      await deskCall(`${PM}.update`, { doctype: p.parent, role: p.role, permlevel: p.permlevel, ptype, value: on ? "1" : "0", if_owner: String(p.if_owner ?? 0) });
    } catch (e) {
      toast.error(errText(e, "Could not update permission"), { duration: 8000 });
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const remove = async (p: Perm) => {
    setBusy(p.name);
    try {
      await deskCall(`${PM}.remove`, { doctype: p.parent, role: p.role, permlevel: p.permlevel, if_owner: p.if_owner ?? 0 });
      toast.success(`Removed ${p.role} (level ${p.permlevel}) from ${p.parent}`);
    } catch (e) {
      toast.error(errText(e, "Did not remove"), { duration: 8000 });
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const ptypeMap = optsQ.data?.doctype_ptype_map ?? {};

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold text-zinc-900 dark:text-zinc-100">Role Permissions Manager</h1>
        <Link href="/desk/doctype/User%20Permission" className={btn}>
          <Users className="h-4 w-4" aria-hidden /> Set User Permissions
        </Link>
        {doctype && (
          <button type="button" className={btn} onClick={() => setResetting(true)}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Restore Original Permissions
          </button>
        )}
        <button type="button" className={primary} disabled={!optsQ.data} onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add A New Rule
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <label htmlFor="pm-doctype" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Document Type
          </label>
          <LinkInput id="pm-doctype" doctype="DocType" value={doctype} onChange={(v) => v !== doctype && go(v, role)} getQuery={() => ({ filters: { istable: 0 } })} />
        </div>
        <div className="w-64">
          <label htmlFor="pm-role" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Role
          </label>
          <LinkInput id="pm-role" doctype="Role" value={role} onChange={(v) => v !== role && go(doctype, v)} />
        </div>
      </div>

      {optsQ.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{errText(optsQ.error, "Not permitted")}</p>
      ) : !doctype && !role ? (
        <p className="py-20 text-center text-sm text-zinc-500">Select Document Type or Role to start.</p>
      ) : permsQ.isLoading ? (
        <p className="flex justify-center py-20 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" />
        </p>
      ) : !perms.length ? (
        <p className="py-20 text-center text-sm text-zinc-500">No Permissions set for this criteria.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm" aria-label="Permission rules">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th scope="col" className="w-44 px-3 py-2 font-medium">Document Type</th>
                <th scope="col" className="w-48 px-3 py-2 font-medium">Role</th>
                <th scope="col" className="w-14 px-3 py-2 font-medium">Level</th>
                <th scope="col" className="px-3 py-2 font-medium">Permissions</th>
                <th scope="col" className="w-12 px-3 py-2"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p.name} aria-label={`${p.parent} ${p.role} level ${p.permlevel}`} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                  <td className="px-3 py-3">
                    <Link href={`/desk/doctype/${enc(p.parent)}`} className="text-zinc-900 hover:underline dark:text-zinc-100">
                      {p.parent}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => setUsersOf(p.role)} className="text-left text-zinc-700 hover:underline dark:text-zinc-300" title="Users with this role">
                      {p.role}
                    </button>
                    {!p.permlevel && (
                      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <input type="checkbox" checked={!!Number(p.if_owner)} disabled={busy === `${p.name}:if_owner`} onChange={(e) => void toggle(p, "if_owner", e.target.checked)} />
                        Only if Creator
                      </label>
                    )}
                  </td>
                  <td className={`px-3 py-3 ${p.permlevel ? "" : "font-semibold"}`}>{p.permlevel}</td>
                  <td className="px-3 py-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 xl:grid-cols-5" role="group" aria-label={`${p.role} rights`}>
                      {rightsFor(p, ptypeMap[p.parent] ?? []).map((r) => (
                        <label key={r} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                          <input type="checkbox" checked={!!Number(p[r])} disabled={busy === `${p.name}:${r}`} onChange={(e) => void toggle(p, r, e.target.checked)} />
                          {label(r)}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <button type="button" aria-label={`Remove ${p.role} level ${p.permlevel}`} disabled={busy === p.name} onClick={() => void remove(p)} className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40">
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">How permissions work</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Rules are set per Document Type and Role; a user gets the combined rights of all their roles.</li>
          <li>Level 0 controls the document itself. Higher levels control fields whose Perm Level matches; a role needs level 0 read before field levels apply.</li>
          <li>&quot;Only if Creator&quot; limits the rule to documents the user created; it also turns off Report for that rule.</li>
          <li>Submit, Cancel and Amend appear only for submittable Document Types.</li>
          <li>User Permissions restrict which records (e.g. which Company) a user sees, on top of these rules.</li>
          <li>Changing a standard Document Type stores the rules as Custom DocPerm; Restore Original Permissions removes them.</li>
        </ul>
      </details>

      {adding && optsQ.data && <AddRule options={optsQ.data} doctype={doctype} role={role} onClose={() => setAdding(false)} onAdded={refresh} />}
      {usersOf && <RoleUsers role={usersOf} onClose={() => setUsersOf(null)} />}
      {resetting && doctype && <ResetDialog doctype={doctype} custom={ptypeMap[doctype] ?? []} onClose={() => setResetting(false)} onReset={refresh} />}
    </div>
  );
}

function AddRule({ options, doctype, role, onClose, onAdded }: { options: Options; doctype: string; role: string; onClose: () => void; onAdded: () => void }) {
  const [parent, setParent] = useState(doctype);
  const [r, setR] = useState(role);
  const [level, setLevel] = useState("0");
  const [saving, setSaving] = useState(false);
  const add = async () => {
    setSaving(true);
    try {
      await deskCall(`${PM}.add`, { parent, role: r, permlevel: Number(level) });
      toast.success(`Added ${r} to ${parent}`);
      onClose();
      onAdded();
    } catch (e) {
      toast.error(errText(e, "Did not add"), { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Permission Rule</DialogTitle>
          <DialogDescription>The new rule starts with no rights; tick them in the table.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="pm-add-doctype" className="mb-1 block text-sm font-medium">Document Type</label>
            <select id="pm-add-doctype" className={select} value={parent} disabled={!!doctype} onChange={(e) => setParent(e.target.value)}>
              <option value="" />
              {options.doctypes.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pm-add-role" className="mb-1 block text-sm font-medium">Role</label>
            <select id="pm-add-role" className={select} value={r} disabled={!!role} onChange={(e) => setR(e.target.value)}>
              <option value="" />
              {options.roles.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pm-add-level" className="mb-1 block text-sm font-medium">Permission Level</label>
            <select id="pm-add-level" className={select} value={level} onChange={(e) => setLevel(e.target.value)}>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">Level 0 is for document level permissions, higher levels for field level permissions.</p>
          </div>
        </div>
        <DialogFooter>
          <button type="button" className={btn} onClick={onClose}>Cancel</button>
          <button type="button" className={primary} disabled={!parent || !r || saving} onClick={() => void add()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Add
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleUsers({ role, onClose }: { role: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["users-with-role", role],
    queryFn: async () => (((await deskCall(`${PM}.get_users_with_role`, { role })).env.message as string[]) ?? []).filter(Boolean),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Users</DialogTitle>
          <DialogDescription>{isLoading ? "Loading…" : data?.length ? `${data.length} with the role ${role}` : `No user has the role ${role}`}</DialogDescription>
        </DialogHeader>
        {!!data?.length && (
          <ul className="max-h-72 space-y-1 overflow-auto text-sm" aria-label={`Users with ${role}`}>
            {data.map((u) => (
              <li key={u}>
                <Link href={`/desk/doctype/User/${enc(u)}`} className="block truncate rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  {u}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({ doctype, custom, onClose, onReset }: { doctype: string; custom: string[]; onClose: () => void; onReset: () => void }) {
  const [saving, setSaving] = useState(false);
  const { data: std = [], isLoading } = useQuery({
    queryKey: ["standard-perms", doctype],
    queryFn: async () => ((await deskCall(`${PM}.get_standard_permissions`, { doctype })).env.message as Perm[]) ?? [],
  });
  const reset = async () => {
    setSaving(true);
    try {
      await deskCall(`${PM}.reset`, { doctype });
      toast.success(`Permissions for ${doctype} restored`);
      onClose();
      onReset();
    } catch (e) {
      toast.error(errText(e, "Could not reset"), { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reset Permissions for {doctype}?</DialogTitle>
          <DialogDescription>Custom rules are removed and these standard permissions apply again.</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-2 overflow-auto text-sm" aria-label="Standard Permissions">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Loading" />
          ) : (
            std.map((d) => (
              <div key={`${d.role}-${d.permlevel}-${d.if_owner ?? 0}`} className="grid grid-cols-5 gap-2">
                <div className="col-span-2">
                  <b>{d.role}</b>, Level {d.permlevel || 0}
                </div>
                <div className="col-span-3 text-zinc-600 dark:text-zinc-400">
                  {[...RIGHTS, ...custom].filter((r) => d[r]).map(label).join(", ")}
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <button type="button" className={btn} onClick={onClose}>Cancel</button>
          <button type="button" className={primary} disabled={saving} onClick={() => void reset()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Reset
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
