"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const LABEL_OVERRIDES: Record<string, string> = {
  desk: "Desk",
  doctype: "DocTypes",
  forms: "New",
  reports: "Reports",
  calendar: "Calendar",
  tasks: "Tasks",
  settings: "Settings",
  list: "List",
  new: "New",
  edit: "Edit",
};

const DATA_ROUTES = new Set(["doctype", "print", "query-report", "workspace", "dashboard", "modules"]);
const ROUTE_WORDS = new Set(["new", "view", "edit", "builder", "report", "kanban", "tree", "calendar", "gantt", "image"]);

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const items = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    let label = segment;
    try {
      label = decodeURIComponent(segment);
    } catch {
      /* keep raw */
    }
    // under data routes (/desk/doctype/<DocType>/<name>, /desk/print/…, /desk/query-report/<name>) the
    // segments are DocType and document names — show them verbatim; only route keywords are prettified
    const isData = index >= 2 && DATA_ROUTES.has(segments[1]) && !ROUTE_WORDS.has(label);
    const display = LABEL_OVERRIDES[label] || (isData ? label : label.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));

    return { href, label: display, isLast };
  });

  if (items.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
      <Link href="/desk" className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item) => (
        <span key={item.href} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4" />
          {item.isLast ? (
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.label}</span>
          ) : (
            <Link href={item.href} className="hover:text-zinc-900 dark:hover:text-zinc-100">
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
