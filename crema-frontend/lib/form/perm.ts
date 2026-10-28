/**
 * frappe.perm (public/js/frappe/model/perm.js): per-permlevel rights of the session user on a doctype / document,
 * and the field display status ("Write" | "Read" | "None").
 */
import type { DocTypeMeta } from "@/lib/frappe/types";

export type PermLevel = Record<string, unknown> & { permlevel?: number; rights_without_if_owner?: Set<string> };
export type Perm = PermLevel[];
export type FieldStatus = "Write" | "Read" | "None";

export const RIGHTS = ["select", "read", "write", "create", "delete", "submit", "cancel", "amend", "report", "import", "export", "print", "email", "share"];

export interface PermContext {
  user: string;
  roles: string[];
  /** boot.user lists (can_read, can_email, can_print, …) */
  lists?: Record<string, string[]>;
  /** boot.doctype_ptype_map: custom Permission Types per doctype */
  ptypeMap?: Record<string, string[]>;
}

export interface PermDocInfo {
  permissions?: Record<string, unknown>;
  shared?: Array<Record<string, unknown>>;
}

const cint = (v: unknown) => Math.trunc(Number(v)) || 0;

/** frappe.perm.get_rights */
export function getRights(ctx: PermContext, doctype?: string): string[] {
  const custom = (doctype && ctx.ptypeMap?.[doctype]) || [];
  return custom.length ? [...RIGHTS, ...custom] : RIGHTS;
}

/** frappe.perm.get_role_permissions: the meta's permission rows evaluated against the user's roles */
export function getRolePermissions(meta: DocTypeMeta, ctx: PermContext): Perm {
  let perm: Perm = [{ read: 0, permlevel: 0, rights_without_if_owner: new Set<string>() }];
  const rights = getRights(ctx, meta.name);
  for (const p of meta.permissions ?? []) {
    const permlevel = cint(p.permlevel);
    const cur = (perm[permlevel] ??= { permlevel });
    if (permlevel === 0) cur.rights_without_if_owner ??= new Set<string>();
    if (ctx.roles.includes(p.role)) {
      for (const right of rights) {
        if (!p[right]) continue;
        cur[right] = 1;
        if (permlevel === 0 && !p.if_owner) cur.rights_without_if_owner!.add(right);
      }
    }
  }
  // fill gaps with empty object
  perm = Array.from(perm, (p) => p ?? {});
  return perm;
}

/** frappe.perm._get_perm(doctype, doc): `doc` is undefined for a new/unsaved document */
export function getPerm(meta: DocTypeMeta | undefined, ctx: PermContext, doc?: Record<string, unknown>, docinfo?: PermDocInfo): Perm {
  const { user } = ctx;
  if (!meta) {
    const p: Perm = [{ read: 0, permlevel: 0, rights_without_if_owner: new Set<string>() }];
    if (user === "Administrator" || ctx.roles.includes("Administrator")) p[0].read = 1;
    return p;
  }
  const perm = getRolePermissions(meta, ctx);
  if (user === "Administrator" || ctx.roles.includes("Administrator")) {
    // Administrator holds every role in Desk: every right at every permlevel
    const rights = getRights(ctx, meta.name);
    const levels = Math.max(perm.length, ...(meta.permissions ?? []).map((p) => cint(p.permlevel) + 1), 1);
    const all: Perm = [];
    for (let i = 0; i < levels; i++) {
      all[i] = { ...(perm[i] ?? {}), permlevel: i, rights_without_if_owner: new Set(rights) };
      for (const r of rights) all[i][r] = 1;
    }
    return all;
  }
  const base = perm[0];
  if (doc) {
    // user permissions / share / if_owner are processed server-side and arrive through docinfo
    if (docinfo?.permissions) for (const ptype of Object.keys(docinfo.permissions)) base[ptype] = docinfo.permissions[ptype];
    // if owner
    if (doc.owner !== user) {
      for (const right of getRights(ctx, meta.name)) {
        if (base[right] && !base.rights_without_if_owner?.has(right)) base[right] = 0;
      }
    }
    // permissions from shared
    for (const s of docinfo?.shared ?? []) {
      if (s.user !== user) continue;
      for (const right of ["read", "write", "submit", "share"]) if (!base[right]) base[right] = s[right];
      if (s.read) {
        // also give print, email permissions if read
        base.email = ctx.lists?.can_email?.includes(meta.name) ? 1 : 0;
        base.print = ctx.lists?.can_print?.includes(meta.name) ? 1 : 0;
      }
    }
  }
  // read via sharing
  if (!base.read && ctx.lists?.can_read?.includes(meta.name)) base.read = 1;
  return perm;
}

/** frappe.perm.has_perm */
export function hasPerm(perm: Perm, permlevel = 0, ptype = "read"): boolean {
  return !!perm?.[permlevel]?.[ptype];
}

/** the permission layer of frappe.perm.get_field_display_status (docstatus / read_only rules stay with the form) */
export function fieldPermStatus(df: { permlevel?: unknown; disabled?: unknown; is_virtual?: unknown }, perm: Perm): FieldStatus {
  const p = perm[cint(df.permlevel)];
  if (!p) return "None";
  if (p.write && !df.disabled && !df.is_virtual) return "Write";
  if (p.read) return "Read";
  return "None";
}

/** form.js set_read_only: only the viewing rights survive */
export function readOnlyPerm(perm: Perm): Perm {
  return perm.map((p) => ({ read: p.read, cancel: p.cancel, share: p.share, print: p.print, email: p.email, mask: p.mask }));
}
