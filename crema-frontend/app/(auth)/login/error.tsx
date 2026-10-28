"use client";

import { useEffect } from "react";
import { Button } from "@/components/shadcn/button";
import { AlertCircle } from "lucide-react";

export default function LoginError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Login error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
        <h2 className="mt-4 text-lg font-semibold text-zinc-900 text-center">Login error</h2>
        <p className="mt-2 text-sm text-zinc-600 text-center">{error.message || "Something went wrong."}</p>
        <Button onClick={reset} className="mt-4 w-full">Try again</Button>
      </div>
    </div>
  );
}
