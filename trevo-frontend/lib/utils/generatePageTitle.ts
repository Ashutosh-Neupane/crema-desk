/**
 * generatePageTitle — consistent page title formatter for all desk routes.
 *
 * Format patterns:
 *   Single segment:        "Customer | Trevo"
 *   Doc detail:            "CUST-001 · Customer | Trevo"
 *   Workspace:             "Sales | Trevo"
 *   Login:                 "Login | Trevo"
 */
const APP_NAME = "Trevo";

export function generatePageTitle(
  ...parts: Array<string | null | undefined>
): string {
  const filtered = parts.filter(Boolean) as string[];
  if (filtered.length === 0) return APP_NAME;
  return `${filtered.join(" · ")} | ${APP_NAME}`;
}
