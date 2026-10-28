import { Card } from "@/components/shadcn/card";

export default function WorkspaceLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
        <div className="h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-700" />
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-700" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
