"use client";

import { useBootInfo } from "@/lib/hooks/useBootInfo";

export function SettingsClient() {
  const { data: bootInfo, isLoading } = useBootInfo();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  const user = bootInfo?.user;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Settings</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Profile</h2>
            <p className="mt-1 text-sm text-zinc-500">Your account information from Frappe.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-500">Full Name</label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{user?.full_name || user?.first_name || "—"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Email</label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{user?.email || "—"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Username</label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{user?.name || "—"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Language</label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{bootInfo?.lang || "—"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">System</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-500">Theme</label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{bootInfo?.desk_theme || "System"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Timezone</label>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">—</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Preferences</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Dark Mode</span>
                <span className="text-xs text-zinc-500">Use theme toggle in header</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Notifications</span>
                <span className="text-xs text-zinc-500">{bootInfo?.notification_count ?? 0} unread</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
