"use client";

import { useEffect } from "react";
import { Button } from "@/components/shadcn/button";
import { AlertCircle } from "lucide-react";

export default function FormsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Forms error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-12">
      <AlertCircle className="h-12 w-12 text-red-500" />
      <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Failed to load forms</h2>
      <p className="mt-2 text-sm text-zinc-500">{error.message || "Something went wrong."}</p>
      <Button onClick={reset} className="mt-4">Try again</Button>
    </div>
  );
}
