"use client";

import { RolePermissionEditor } from "@/components/features/permissions";

export default function PermissionsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Role & Permission Manager</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage roles, permissions, and user access
        </p>
      </div>
      <RolePermissionEditor />
    </div>
  );
}
