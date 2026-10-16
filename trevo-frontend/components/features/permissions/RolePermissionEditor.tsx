"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { frappeGet, frappePost, frappeDelete, frappePut } from "@/lib/frappe/client";
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
import { Plus, Trash2, Shield, Users, Settings2 } from "lucide-react";

interface Role {
  name: string;
  role_name: string;
  description?: string;
}

interface UserRole {
  name: string;
  role: string;
  parent: string;
}

interface PermissionRow {
  name: string;
  role: string;
  doctype: string;
  read: number;
  write: number;
  create: number;
  delete: number;
  submit: number;
  cancel: number;
  amend: number;
  report: number;
  export: number;
  import: number;
  share: number;
  print: number;
  email: number;
}

const DEFAULT_PERMS: Omit<PermissionRow, "role" | "doctype"> = {
  name: "",
  read: 1,
  write: 0,
  create: 0,
  delete: 0,
  submit: 0,
  cancel: 0,
  amend: 0,
  report: 1,
  export: 0,
  import: 0,
  share: 0,
  print: 0,
  email: 0,
};

export function RolePermissionEditor() {
  const queryClient = useQueryClient();
  const [roleOpen, setRoleOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await frappeGet<{ message: Role[] }>("api/resource/Role?fields=[\"name\",\"role_name\",\"description\"]&limit_page_length=100");
      return res.message ?? [];
    },
  });

  const { data: userRoleList = [] } = useQuery({
    queryKey: ["user-roles", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const res = await frappeGet<{ message: UserRole[] }>(`api/resource/User Role?filters=[["parent","=","${userEmail}"]]&fields=["role"]`);
      return res.message ?? [];
    },
  });

  const { data: perms = [], isLoading: permsLoading } = useQuery({
    queryKey: ["permissions", selectedRole],
    enabled: !!selectedRole,
    queryFn: async () => {
      const res = await frappeGet<{ message: PermissionRow[] }>(`api/resource/Custom Role?filters=[["parent","=","${selectedRole}"]]&fields=["*"]`);
      return res.message ?? [];
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async () => {
      return frappePost("api/resource/Role", { role_name: roleName, description: roleDesc });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setRoleOpen(false);
      setRoleName("");
      setRoleDesc("");
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleName: string) => {
      await frappeDelete(`api/resource/Role/${encodeURIComponent(roleName)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  const assignUserMutation = useMutation({
    mutationFn: async () => {
      return frappePost("api/resource/User Role", { parent: userEmail, role: userRoles[0] || "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles", userEmail] });
      setUserOpen(false);
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userRoleName: string) => {
      await frappeDelete(`api/resource/User Role/${encodeURIComponent(userRoleName)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles", userEmail] });
    },
  });

  const updatePermMutation = useMutation({
    mutationFn: async ({ doctype, ...updates }: Partial<PermissionRow> & { doctype: string }) => {
      const existing = perms.find((p) => p.doctype === doctype);
      if (existing?.name) {
        return frappePut(`api/resource/Custom Role/${encodeURIComponent(existing.name)}`, updates);
      }
      return frappePost("api/resource/Custom Role", { parent: selectedRole, doctype, ...updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissions", selectedRole] });
    },
  });

  const availableDoctypes = useMemo(() => {
    const doctypes = new Set(perms.map((p) => p.doctype));
    return Array.from(doctypes).sort();
  }, [perms]);

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Role & Permission Manager</h2>
          <p className="text-sm text-zinc-500">Manage roles, permissions, and user access</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setUserOpen(true)}>
            <Users className="h-4 w-4 mr-1" />
            Assign User
          </Button>
          <Button size="sm" onClick={() => setRoleOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Role
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Roles</h3>
          <div className="space-y-1">
            {roles.map((role) => (
              <button
                key={role.name}
                onClick={() => setSelectedRole(role.name)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                  selectedRole === role.name ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-zinc-500" />
                  <span className="text-zinc-900 dark:text-zinc-100">{role.role_name || role.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteRoleMutation.mutate(role.name); }}>
                  <Trash2 className="h-3 w-3 text-red-600" />
                </Button>
              </button>
            ))}
            {roles.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">No roles found</p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-4">
          {!selectedRole ? (
            <div className="text-center py-8">
              <Settings2 className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Select a role to view and edit permissions</p>
            </div>
          ) : permsLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Permissions for: {roles.find((r) => r.name === selectedRole)?.role_name || selectedRole}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="text-left py-2 px-2 font-medium text-zinc-600 dark:text-zinc-400">DocType</th>
                      <th className="text-center py-2 px-1 font-medium text-zinc-600 dark:text-zinc-400">Read</th>
                      <th className="text-center py-2 px-1 font-medium text-zinc-600 dark:text-zinc-400">Write</th>
                      <th className="text-center py-2 px-1 font-medium text-zinc-600 dark:text-zinc-400">Create</th>
                      <th className="text-center py-2 px-1 font-medium text-zinc-600 dark:text-zinc-400">Delete</th>
                      <th className="text-center py-2 px-1 font-medium text-zinc-600 dark:text-zinc-400">Submit</th>
                      <th className="text-center py-2 px-1 font-medium text-zinc-600 dark:text-zinc-400">Report</th>
                      <th className="text-center py-2 px-1 font-medium text-zinc-600 dark:text-zinc-400">Export</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableDoctypes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-4 text-zinc-500">No permissions configured yet</td>
                      </tr>
                    ) : (
                      availableDoctypes.map((doctype) => {
                        const perm = perms.find((p) => p.doctype === doctype) ?? { ...DEFAULT_PERMS, doctype };
                        return (
                          <tr key={doctype} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 px-2 text-zinc-900 dark:text-zinc-100">{doctype}</td>
                            {(["read", "write", "create", "delete", "submit", "report", "export"] as const).map((key) => (
                              <td key={key} className="text-center py-2 px-1">
                                <input aria-label={`${doctype} ${key}`}
                                  type="checkbox"
                                  checked={!!perm[key]}
                                  onChange={(e) => updatePermMutation.mutate({ doctype, [key]: e.target.checked ? 1 : 0 })}
                                  className="rounded"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Role Name</Label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Sales User" />
            </div>
            <div>
              <Label>Description</Label>
              <textarea aria-label="Role description"
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createRoleMutation.mutate()} disabled={!roleName}>
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User Email</Label>
              <Input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>Select Role</Label>
              <select aria-label="Select role"
                value={userRoles[0] || ""}
                onChange={(e) => setUserRoles([e.target.value])}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">Select a role</option>
                {roles.map((r) => (
                  <option key={r.name} value={r.name}>{r.role_name || r.name}</option>
                ))}
              </select>
            </div>
            {userEmail && (
              <div>
                <Label>Current Roles</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {userRoleList.map((ur) => (
                    <Badge key={ur.name} variant="secondary" className="flex items-center gap-1">
                      {ur.role}
                      <button aria-label={`Remove ${ur.role ?? "role"}`} onClick={() => removeUserMutation.mutate(ur.name)} className="ml-1 hover:text-red-600">×</button>
                    </Badge>
                  ))}
                  {userRoleList.length === 0 && <p className="text-xs text-zinc-500">No roles assigned</p>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => assignUserMutation.mutate()} disabled={!userEmail || !userRoles[0]}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
