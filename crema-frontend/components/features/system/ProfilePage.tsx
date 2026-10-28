"use client";

import { useAuth } from "@/lib/frappe/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/shadcn/card";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/Skeleton";
import { Mail, User as UserIcon, Globe, Shield, ImageIcon } from "lucide-react";

/**
 * Profile page — shows the currently logged-in user's basic info from the
 * authenticated session (email, full name, image, roles, language).
 */
export function ProfilePage() {
  const { user, loading } = useAuth();

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" description="Your account information." />

      <Card className="p-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        ) : !user ? (
          <p className="text-sm text-zinc-500">Not signed in.</p>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                {user.user_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.user_image}
                    alt={user.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-10 w-10 text-zinc-400" />
                )}
              </div>
              <span className="text-xs text-zinc-400">Profile picture</span>
            </div>

            {/* Details */}
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {user.full_name || user.email}
                </h2>
                <p className="text-sm text-zinc-500">{user.email}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow
                  icon={<Mail className="h-4 w-4 text-zinc-400" />}
                  label="Email"
                  value={user.email}
                />
                <InfoRow
                  icon={<UserIcon className="h-4 w-4 text-zinc-400" />}
                  label="Full Name"
                  value={user.full_name || "-"}
                />
                <InfoRow
                  icon={<Globe className="h-4 w-4 text-zinc-400" />}
                  label="Language"
                  value={user.language || "-"}
                />
                <InfoRow
                  icon={<ImageIcon className="h-4 w-4 text-zinc-400" />}
                  label="User ID"
                  value={user.name || "-"}
                />
              </div>

              {Array.isArray(user.roles) && user.roles.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    <Shield className="h-4 w-4 text-zinc-400" />
                    Roles
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

