"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shadcn/avatar";
import { Loader2, UserPlus, X } from "lucide-react";
import { frappeMethod } from "@/lib/frappe/client";
import { searchLink } from "@/lib/frappe/search";

interface SharedUser {
  name: string;
  user: string;
  full_name?: string;
  read?: number;
  write?: number;
  share?: number;
  submit?: number;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctype: string;
  name: string;
}

export function ShareDialog({ open, onOpenChange, doctype, name }: ShareDialogProps) {
  const [userQuery, setUserQuery] = useState("");
  const [userOptions, setUserOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [read, setRead] = useState(true);
  const [write, setWrite] = useState(false);
  const [share, setShare] = useState(false);
  const [submit, setSubmit] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load current shared users when the dialog opens
  const loadSharedUsers = useCallback(async () => {
    if (!doctype || !name) return;
    setLoading(true);
    setError("");
    try {
      const users = await frappeMethod<SharedUser[]>(
        "frappe.share.get_users",
        { doctype, name },
      );
      setSharedUsers(Array.isArray(users) ? users : []);
    } catch {
      setSharedUsers([]);
    } finally {
      setLoading(false);
    }
  }, [doctype, name]);

  // Load shared users when the dialog opens (async data fetch — the only
  // setState here happens after the network round-trip resolves).
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadSharedUsers();
    }
  }, [open, loadSharedUsers]);

  // User autocomplete (debounced). No sync setState — only async updates.
  useEffect(() => {
    if (!userQuery || userQuery.length < 2) {
      return;
    }
    const t = setTimeout(async () => {
      try {
        const results = await searchLink("User", userQuery, { page_length: 8 });
        setUserOptions(
          results.map((r) => ({ value: r.value, label: r.label ?? r.value })),
        );
      } catch {
        setUserOptions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [userQuery]);

  const handleAddShare = async () => {
    if (!selectedUser) return;
    setSharing(true);
    setError("");
    setSuccess("");
    try {
      await frappeMethod("frappe.share.add", {
        doctype,
        name,
        user: selectedUser,
        read,
        write,
        share,
        submit,
      });
      setSuccess(`Shared with ${selectedUser}`);
      setSelectedUser("");
      setUserQuery("");
      setRead(true);
      setWrite(false);
      setShare(false);
      setSubmit(false);
      await loadSharedUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveShare = async (user: string) => {
    setError("");
    setSuccess("");
    try {
      await frappeMethod("frappe.share.remove", { doctype, name, user });
      setSharedUsers((prev) => prev.filter((u) => u.user !== user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove share");
    }
  };

  const initial = selectedUser
    ? selectedUser.split("@")[0].slice(0, 2).toUpperCase()
    : "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {doctype}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
              {success}
            </div>
          )}

          {/* Add user */}
          <div className="space-y-2">
            <Label>Add User</Label>
            <div className="relative">
              <Input
                value={userQuery}
                onChange={(e) => {
                  setUserQuery(e.target.value);
                  setSelectedUser("");
                }}
                placeholder="Search users by email..."
                className="w-full"
              />
              {userOptions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {userOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSelectedUser(opt.value);
                        setUserQuery(opt.label);
                        setUserOptions([]);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {opt.label}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500">{opt.value}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
                <Avatar className="h-6 w-6">
                  <AvatarImage src="" alt={selectedUser} />
                  <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {selectedUser}
                </span>
                <button aria-label="Clear selected user"
                  onClick={() => {
                    setSelectedUser("");
                    setUserQuery("");
                  }}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Permissions */}
            <div className="flex flex-wrap gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Checkbox checked={read} onChange={(e) => setRead(e.target.checked)} />
                Read
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Checkbox checked={write} onChange={(e) => setWrite(e.target.checked)} />
                Write
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Checkbox checked={share} onChange={(e) => setShare(e.target.checked)} />
                Share
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Checkbox checked={submit} onChange={(e) => setSubmit(e.target.checked)} />
                Submit
              </label>
            </div>

            <Button
              size="sm"
              onClick={handleAddShare}
              disabled={!selectedUser || sharing}
              className="gap-1.5"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Add
            </Button>
          </div>

          {/* Current shared users */}
          <div className="space-y-2">
            <Label>Shared With</Label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : sharedUsers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
                No users shared yet.
              </p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {sharedUsers.map((u) => (
                  <div
                    key={u.name ?? u.user}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {u.user.split("@")[0].slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {u.full_name || u.user}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {u.user}
                        {u.read ? " · Read" : ""}
                        {u.write ? " · Write" : ""}
                        {u.submit ? " · Submit" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveShare(u.user)}
                      className="text-zinc-400 hover:text-red-500"
                      title={`Remove ${u.user}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

