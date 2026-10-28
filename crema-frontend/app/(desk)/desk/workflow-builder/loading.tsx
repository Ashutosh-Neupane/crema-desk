import { Card } from "@/components/shadcn/card";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-700" />
          <div className="h-4 w-1/2 rounded bg-zinc-100 dark:bg-zinc-700" />
        </div>
      </Card>
    </div>
  );
}
