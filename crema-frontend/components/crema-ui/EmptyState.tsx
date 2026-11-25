import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Nothing here yet" with the next step (GAPS § 3.4 Lists: empty states that offer "Create" or "Import").
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actions,
  headingLevel = 2,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** the primary action first, e.g. <Button>Create Customer</Button> */
  actions?: React.ReactNode;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <div className={cn("flex flex-col items-center gap-3 px-gutter py-10 text-center", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--control-bg)] text-[var(--text-muted)]">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <Heading className="text-h3 font-semibold text-[var(--heading-color)]">{title}</Heading>
      {description && <p className="max-w-prose text-sm text-[var(--text-muted)]">{description}</p>}
      {actions && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
