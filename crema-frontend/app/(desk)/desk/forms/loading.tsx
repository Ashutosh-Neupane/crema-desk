import { Card } from "@/components/shadcn/card";

export default function FormsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-700" />
              <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-700" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
