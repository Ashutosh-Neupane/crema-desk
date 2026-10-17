/**
 * Frappe error → human message, shared by server (BFF) and browser code.
 * Mirrors what Desk shows: msgprint/throw text from `_server_messages`
 * first, then the exception line without its Python module prefix.
 */

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };

/** Server messages are HTML — keep the text, decode entities (toasts render plain text) */
const stripHtml = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39|#x27);/g, (e) => ENTITIES[e] ?? e)
    .trim();

/**
 * The human message for a failed Frappe call, as Desk would show it:
 * msgprint/throw messages first (`_server_messages`), then the exception line
 * without its Python module prefix, then the last traceback line.
 */
export function frappeErrorMessage(envelope: unknown, serverMessages: string[], status: number): string {
  if (serverMessages.length) return serverMessages.map(stripHtml).filter(Boolean).join("\n");
  const env = (envelope ?? {}) as { exception?: unknown; exc?: unknown; message?: unknown };
  if (typeof env.exception === "string" && env.exception) {
    const line = env.exception.split("\n").filter(Boolean).pop() ?? env.exception;
    return stripHtml(line.replace(/^[\w.]+(Error|Exception)\s*:\s*/, "")) || line;
  }
  if (typeof env.exc === "string" && env.exc) {
    let tb = env.exc;
    try {
      const arr = JSON.parse(env.exc);
      if (Array.isArray(arr)) tb = String(arr[arr.length - 1] ?? "");
    } catch {
      /* not JSON — use as-is */
    }
    const line = tb.split("\n").map((l) => l.trim()).filter(Boolean).pop();
    if (line) return stripHtml(line.replace(/^[\w.]+(Error|Exception)\s*:\s*/, ""));
  }
  if (typeof env.message === "string" && env.message) return stripHtml(env.message);
  return `Request failed (${status})`;
}

export function parseServerMessages(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((m) => {
      try {
        const obj = typeof m === "string" ? JSON.parse(m) : m;
        return obj?.message ?? null;
      } catch {
        return String(m);
      }
    }).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

