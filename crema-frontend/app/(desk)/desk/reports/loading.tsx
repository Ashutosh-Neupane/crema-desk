import { Card } from "@/components/shadcn/card";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="h-10 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
          <div className="h-10 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="h-12 w-full animate-pulse rounded-t-lg bg-zinc-100 dark:bg-zinc-700" />
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full border-b border-zinc-100 dark:border-zinc-800" />
          ))}
        </div>
      </Card>
    </div>
  );
}
