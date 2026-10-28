import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-zinc-300 dark:text-zinc-700">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>

      <Link
        href="/desk"
        className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <Home className="h-4 w-4" />
        Back to Desk
      </Link>
    </div>
  );
}
