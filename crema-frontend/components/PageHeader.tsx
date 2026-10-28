import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page header used across all desk pages.
 * Mirrors Frappe's page header (title + subtitle + actions).
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={["mb-6 flex flex-wrap items-start justify-between gap-3", className].filter(Boolean).join(" ")}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

