"use client";

/**
 * Native replacements for the jQuery widgets Desk mounts into HTML fields (layer 3 of the
 * compatibility plan in docs/GAPS.md). Keyed by DocType + HTML fieldname; each writes to the
 * same child tables Desk's widget writes to, so saving behaves exactly like Desk.
 *   frappe.RoleEditor   → User.roles_html, Role Profile.roles_html   (Has Role rows)
 *   frappe.ModuleEditor → User.modules_html, Module Profile.module_html (Block Module rows = unchecked)
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import type { FormController, Row } from "@/lib/form/FormController";
import { AddressContact } from "./AddressContact";

export interface WidgetProps {
  ctl: FormController;
  readOnly: boolean;
}

const WIDGETS: Record<string, Record<string, (p: WidgetProps) => React.ReactNode>> = {
  User: { roles_html: (p) => <RoleEditor {...p} />, modules_html: (p) => <ModuleEditor {...p} /> },
  "Role Profile": { roles_html: (p) => <RoleEditor {...p} /> },
  "Module Profile": { module_html: (p) => <ModuleEditor {...p} /> },
};

/** Desk renders these for ANY doctype that has the field (frappe.contacts.render_address_and_contact) */
const FIELD_WIDGETS: Record<string, (p: WidgetProps) => React.ReactNode> = {
  address_html: (p) => <AddressContact {...p} fieldname="address_html" />,
  contact_html: (p) => <AddressContact {...p} fieldname="contact_html" />,
};

export function getHtmlWidget(doctype: string, fieldname: string) {
  return WIDGETS[doctype]?.[fieldname] ?? FIELD_WIDGETS[fieldname];
}

/** Desk's MultiCheck look: filter box, select all / none, a column grid of checkboxes */
function MultiCheck({
  label,
  options,
  checked,
  disabled,
  note,
  onToggle,
  onAll,
}: {
  label: string;
  options: string[];
  checked: Set<string>;
  disabled: boolean;
  note?: string;
  onToggle: (v: string, on: boolean) => void;
  onAll: (on: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const shown = options.filter((o) => !q || o.toLowerCase().includes(q.toLowerCase()));
  return (
    <fieldset className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800" aria-label={label}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${label.toLowerCase()}`} aria-label={`Filter ${label.toLowerCase()}`} className="h-8 w-56 rounded-md border border-zinc-200 bg-white pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        {!disabled && (
          <>
            <button type="button" onClick={() => onAll(true)} className="text-xs text-zinc-600 hover:underline dark:text-zinc-300">
              Select All
            </button>
            <button type="button" onClick={() => onAll(false)} className="text-xs text-zinc-600 hover:underline dark:text-zinc-300">
              Unselect All
            </button>
          </>
        )}
        <span className="ml-auto text-xs text-zinc-500">
          {checked.size} of {options.length} selected
        </span>
      </div>
      {note && <p className="text-xs text-amber-700 dark:text-amber-400">{note}</p>}
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((o) => (
          <label key={o} className={`flex items-center gap-2 truncate rounded px-1 py-0.5 text-sm ${disabled ? "text-zinc-500" : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
            <input type="checkbox" checked={checked.has(o)} disabled={disabled} onChange={(e) => onToggle(o, e.target.checked)} />
            <span className="truncate">{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** frappe.RoleEditor: checked roles ⇔ rows of the `roles` table (Has Role.role) */
export function RoleEditor({ ctl, readOnly }: WidgetProps) {
  const doc = ctl.getDoc();
  const rows = useMemo(() => (doc.roles as Row[] | undefined) ?? [], [doc.roles]);
  const { data: all = [] } = useQuery({
    queryKey: ["all-roles"],
    staleTime: 5 * 60_000,
    queryFn: async () => ((await deskCall("frappe.core.doctype.user.user.get_all_roles")).env.message as string[]) ?? [],
  });
  const checked = useMemo(() => new Set(rows.map((r) => String(r.role))), [rows]);
  // Desk disables manual selection when roles come from Role Profiles
  const fromProfiles = doc.doctype === "User" && Array.isArray(doc.role_profiles) && doc.role_profiles.length > 0;
  const set = async (roles: string[], on: boolean) => {
    if (on) {
      for (const role of roles.filter((r) => !checked.has(r))) {
        // in order, each add fires roles_add like Desk's add_child
        // react-doctor-disable-next-line async-await-in-loop
        await ctl.add_child("roles", { role });
      }
    } else {
      const drop = new Set(roles);
      await ctl.remove_rows("roles", rows.filter((r) => drop.has(String(r.role))).map((r) => r.name));
    }
  };
  return (
    <MultiCheck
      label="Roles"
      options={all}
      checked={checked}
      disabled={readOnly || fromProfiles}
      note={fromProfiles ? "Roles are set by the Role Profiles above." : undefined}
      onToggle={(r, on) => void set([r], on)}
      onAll={(on) => void set(all, on)}
    />
  );
}

/** frappe.ModuleEditor: checked = allowed; `block_modules` rows hold the unchecked modules */
export function ModuleEditor({ ctl, readOnly }: WidgetProps) {
  const doc = ctl.getDoc();
  const all = useMemo(() => ((doc.__onload as { all_modules?: string[] } | undefined)?.all_modules ?? []).slice().sort(), [doc.__onload]);
  const blocked = useMemo(() => (doc.block_modules as Row[] | undefined) ?? [], [doc.block_modules]);
  const blockedSet = useMemo(() => new Set(blocked.map((r) => String(r.module))), [blocked]);
  const checked = useMemo(() => new Set(all.filter((m) => !blockedSet.has(m))), [all, blockedSet]);
  // a User with a Module Profile gets its modules from the profile (Desk hides the editor's inputs)
  const fromProfile = doc.doctype === "User" && !!doc.module_profile;
  const set = async (mods: string[], allow: boolean) => {
    if (allow) {
      const drop = new Set(mods);
      await ctl.remove_rows("block_modules", blocked.filter((r) => drop.has(String(r.module))).map((r) => r.name));
    } else {
      for (const mod of mods.filter((m) => !blockedSet.has(m))) {
        // react-doctor-disable-next-line async-await-in-loop
        await ctl.add_child("block_modules", { module: mod });
      }
    }
  };
  if (!all.length) return null;
  return (
    <MultiCheck
      label="Modules"
      options={all}
      checked={checked}
      disabled={readOnly || fromProfile}
      note={fromProfile ? "Modules are set by the Module Profile." : undefined}
      onToggle={(m, on) => void set([m], on)}
      onAll={(on) => void set(all, on)}
    />
  );
}
