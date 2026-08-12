"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search,
  FileText,
  Plus,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Calendar,
  List,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/lib/frappe/auth";
import { useWorkspaces } from "@/lib/hooks/useWorkspaces";
import { useGlobalSearch } from "@/lib/hooks/useSearch";
import { useUIStore } from "@/lib/stores/ui.store";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const QUICK_ACTIONS = [
  { id: "new-document", label: "New Document", icon: Plus, category: "action" as const },
  { id: "search", label: "Search...", icon: Search, category: "navigation" as const },
  { id: "calendar", label: "Calendar", icon: Calendar, category: "navigation" as const },
  { id: "list-view", label: "List View", icon: List, category: "navigation" as const },
  { id: "help", label: "Help & Support", icon: HelpCircle, category: "navigation" as const },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data: workspaces } = useWorkspaces();
  const { data: searchResults } = useGlobalSearch(search);
  const uiStore = useUIStore();

  const handleAction = useCallback(
    (actionId: string) => {
      setOpen(false);
      setSearch("");

      switch (actionId) {
        case "new-document":
          router.push("/desk/doctype");
          break;
        case "search":
          break;
        case "calendar":
          router.push("/desk/calendar");
          break;
        case "list-view":
          router.push("/desk/doctype");
          break;
        case "help":
          window.open("https://docs.trevo.io", "_blank");
          break;
        default:
          break;
      }
    },
    [router],
  );

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    router.push("/login");
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="ml-2 rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900">
          ⌘K
        </kbd>
      </button>

      {/* Command palette */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm">
          <div className="mt-[20vh] w-full max-w-2xl rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <Command
              value={search}
              onValueChange={setSearch}
              className="flex flex-col"
            >
              <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
                <Search className="h-5 w-5 shrink-0 text-zinc-400" />
                <input
                  autoFocus
                  placeholder="Type a command or search..."
                  className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none dark:text-zinc-100"
                />
                <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                  ESC
                </kbd>
              </div>

              <div className="max-h-[50vh] overflow-y-auto p-2">
                {search.length === 0 ? (
                  <>
                    {/* Quick actions */}
                    <Command.Group heading="Actions">
                      {QUICK_ACTIONS.map((action) => (
                        <Command.Item
                          key={action.id}
                          value={action.label}
                          onSelect={() => handleAction(action.id)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[selected=true]:bg-zinc-100 dark:data-[selected=true]:bg-zinc-800"
                        >
                          <action.icon className="h-4 w-4 text-zinc-500" />
                          <span>{action.label}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>

                    {/* Workspaces */}
                    {workspaces && workspaces.length > 0 && (
                      <Command.Group heading="Workspaces">
                        {workspaces.slice(0, 5).map((ws) => (
                          <Command.Item
                            key={ws.name}
                            value={ws.title}
                            onSelect={() => {
                              router.push(`/desk/workspace/${ws.name}`);
                              setOpen(false);
                            }}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <FileText className="h-4 w-4 text-zinc-500" />
                            <span>{ws.title}</span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}

                    {/* Theme */}
                    <Command.Group heading="Theme">
                      {THEME_OPTIONS.map((theme) => (
                        <Command.Item
                          key={theme.value}
                          value={theme.label}
                          onSelect={() => {
                            uiStore.setTheme(theme.value);
                            setOpen(false);
                          }}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <theme.icon className="h-4 w-4 text-zinc-500" />
                          <span>{theme.label}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  </>
                ) : (
                  <>
                    {/* Search results */}
                    <Command.Group heading="Search Results">
                      {searchResults && Array.isArray(searchResults) && searchResults.length > 0 ? (
                        searchResults.map((result: { doctype?: string; name?: string }, i: number) => (
                          <Command.Item
                            key={i}
                            value={`${result.doctype} ${result.name}`}
                            onSelect={() => {
                              if (result.doctype && result.name) {
                                router.push(
                                  `/desk/doctype/${encodeURIComponent(result.doctype)}/${encodeURIComponent(result.name)}`,
                                );
                              }
                              setOpen(false);
                            }}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <FileText className="h-4 w-4 text-zinc-500" />
                            <div className="flex flex-col">
                              <span>{result.name}</span>
                              <span className="text-xs text-zinc-500">{result.doctype}</span>
                            </div>
                          </Command.Item>
                        ))
                      ) : (
                        <div className="px-3 py-6 text-center text-sm text-zinc-500">
                          No results found for &quot;{search}&quot;
                        </div>
                      )}
                    </Command.Group>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-700">
                <div className="flex items-center gap-4">
                  <span>↑↓ to navigate</span>
                  <span>↵ to select</span>
                  <span>esc to close</span>
                </div>
                {user && (
                  <div className="flex items-center gap-2">
                    <span>{user.name || user.full_name}</span>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 hover:text-red-600"
                    >
                      <LogOut className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}
