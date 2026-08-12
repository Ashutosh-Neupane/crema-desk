/**
 * ScriptLoader — fetches Client Script documents from the BFF and executes
 * them in the sandbox to register their hooks.
 *
 * Called once per form mount per doctype.
 * Results are cached in a module-level Map to avoid re-fetching on every render.
 */

import { executeScript, type ScriptHooks, type FormContext } from "./ScriptSandbox";

// Module-level cache: doctype → { scripts: string[], hooks: ScriptHooks }
const scriptCache = new Map<string, { scripts: string[]; hooks: ScriptHooks }>();

/**
 * Load and execute all Client Scripts for a doctype.
 * Returns the populated ScriptHooks map.
 * Uses a cache so repeated form opens don't hit the network.
 */
export async function loadAndExecuteScripts(
  doctype: string,
  ctx: FormContext,
): Promise<ScriptHooks> {
  // Return cached hooks if already loaded
  if (scriptCache.has(doctype)) {
    const cached = scriptCache.get(doctype)!;
    // Re-execute scripts with fresh ctx so hooks have latest callbacks
    const hooks: ScriptHooks = new Map();
    for (const script of cached.scripts) {
      executeScript(script, hooks, ctx);
    }
    return hooks;
  }

  // Fetch from BFF
  let scripts: string[] = [];
  try {
    const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/scripts`);
    if (res.ok) {
      const json = await res.json() as { scripts?: Array<{ name: string; script: string }> };
      scripts = (json.scripts ?? []).map((s) => s.script).filter(Boolean);
    }
  } catch {
    // Network error — run with no scripts
  }

  // Execute each script to register hooks
  const hooks: ScriptHooks = new Map();
  for (const script of scripts) {
    executeScript(script, hooks, ctx);
  }

  // Cache for this doctype
  scriptCache.set(doctype, { scripts, hooks });

  return hooks;
}

/** Clear the script cache (useful after customizations change) */
export function clearScriptCache(doctype?: string): void {
  if (doctype) {
    scriptCache.delete(doctype);
  } else {
    scriptCache.clear();
  }
}
