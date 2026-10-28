import { TableSkeleton } from "@/components/Skeleton";

export default function DoctypeListLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
          <div className="h-9 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
        </div>
      </div>
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}
