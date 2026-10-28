import { Card } from "@/components/shadcn/card";

export default function DoctypeDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-lg border border-zinc-200 dark:border-zinc-700" />
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
        </div>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-r border-zinc-200 p-4 dark:border-zinc-700">
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
