import { TableSkeleton } from "@/components/Skeleton";

export default function ListLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}
