/**
 * generatePageTitle — consistent page title formatter for all desk routes.
 *
 * Format patterns:
 *   Single segment:        "Customer | Crema"
 *   Doc detail:            "CUST-001 · Customer | Crema"
 *   Workspace:             "Sales | Crema"
 *   Login:                 "Login | Crema"
 */
const APP_NAME = "Crema";

export function generatePageTitle(
  ...parts: Array<string | null | undefined>
): string {
  const filtered = parts.filter(Boolean) as string[];
  if (filtered.length === 0) return APP_NAME;
  return `${filtered.join(" · ")} | ${APP_NAME}`;
}
