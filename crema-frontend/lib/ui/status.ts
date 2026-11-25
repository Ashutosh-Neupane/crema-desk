/**
 * Status tones for StatusPill. Frappe's indicator colours (frappe/public/js/frappe/model/indicator.js,
 * list_view.js get_indicator_html) map onto five tones, each with its own icon so colour is never the only signal.
 */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const INDICATOR_TONES: Record<string, StatusTone> = {
  green: "success",
  blue: "info",
  "light-blue": "info",
  cyan: "info",
  purple: "info",
  pink: "info",
  orange: "warning",
  yellow: "warning",
  red: "danger",
  gray: "neutral",
  grey: "neutral",
  darkgrey: "neutral",
};

/** Frappe indicator colour ("green", "red", …) → tone; unknown colours are neutral */
export function toneFromIndicator(color: string | null | undefined): StatusTone {
  return INDICATOR_TONES[(color ?? "").toLowerCase().trim()] ?? "neutral";
}
