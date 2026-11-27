"use client";

/**
 * After a deploy the old build's JavaScript chunks are gone, so a page that was open before it fails to load the
 * next screen ("Failed to load chunk …", ChunkLoadError). Reloading fetches the new build. Reload at most once a
 * minute, so a chunk that is really missing shows the error instead of looping.
 */
import { useEffect } from "react";

const KEY = "crema:stale-build-reload";

export function isStaleBuildError(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? "");
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg);
}

/** reloads for a stale-build error; true when a reload was started */
export function reloadForNewBuild(e: unknown): boolean {
  if (!isStaleBuildError(e)) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // no storage: still reload once, the error page stays if it fails again
  }
  window.location.reload();
  return true;
}

/** for error boundaries (error.tsx): a stale-build error reloads instead of showing "Something went wrong" */
export function useReloadOnStaleBuild(error: unknown) {
  useEffect(() => {
    reloadForNewBuild(error);
  }, [error]);
}

/** for the shell: chunk errors that never reach a boundary (prefetches, lazy imports in handlers) */
export function useStaleBuildListener() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reloadForNewBuild(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reloadForNewBuild(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}
