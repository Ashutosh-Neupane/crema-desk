"use client";

/**
 * Rating (Desk: form/controls/rating.js). Stored as a fraction of `options` stars (default 5): 3 of 5 = 0.6, half
 * stars allowed (the left half of a star). Clicking the current rating clears it unless the field is mandatory.
 * Keyboard: ←/→ change by half a star.
 */
import { useState } from "react";
import { cint, flt } from "@/lib/frappe/format";
import type { FieldControlProps } from "./index";

const STAR = "M12 3.2l2.82 5.72 6.31.92-4.57 4.45 1.08 6.29L12 17.6l-5.64 2.97 1.08-6.29-4.57-4.45 6.31-.92z";

export default function RatingField({ field, value, onChange, disabled }: FieldControlProps) {
  const outOf = cint(field.options) || 5;
  // set_formatted_input: fraction → stars, rounded to the nearest half
  const stars = Math.round(flt(value) * outOf * 2) / 2;
  const [hover, setHover] = useState<number | null>(null);
  const readOnly = disabled || !!field.read_only;
  const shown = hover ?? stars;
  const label = field.label || field.fieldname;

  const set = (s: number) => {
    const next = Math.max(0, Math.min(outOf, s));
    // update_rating: the same value again clears it (not when mandatory)
    onChange(next === stars && !field.reqd ? 0 : next / outOf);
  };
  /** the star (or half star) under the pointer; a star's left half is i - 0.5 */
  const at = (e: React.MouseEvent<HTMLElement>): number | null => {
    const star = (e.target as Element).closest<HTMLElement>("[data-rating]");
    if (!star) return null;
    const i = Number(star.dataset.rating);
    const r = star.getBoundingClientRect();
    return e.clientX - r.left < r.width / 2 ? i - 0.5 : i;
  };

  return (
    <div
      role="slider"
      tabIndex={readOnly ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={outOf}
      aria-valuenow={stars}
      aria-valuetext={`${stars} of ${outOf} stars`}
      aria-readonly={readOnly || undefined}
      onKeyDown={(e) => {
        if (readOnly) return;
        const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.5 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.5 : 0;
        if (!step) return;
        e.preventDefault();
        onChange(Math.max(0, Math.min(outOf, stars + step)) / outOf);
      }}
      // a star's halves need the pointer position; the keyboard is handled above
      onMouseMove={readOnly ? undefined : (e) => {
        const s = at(e);
        if (s != null) setHover(s);
      }}
      onClick={readOnly ? undefined : (e) => {
        const s = at(e);
        if (s != null) set(s);
      }}
      onMouseLeave={() => setHover(null)}
      className="inline-flex items-center gap-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
    >
      {Array.from({ length: outOf }, (_, k) => k + 1).map((i) => {
        const fill = shown >= i ? "full" : shown >= i - 0.5 ? "half" : "none";
        return (
          <span key={i} data-rating={i} data-fill={fill} className={readOnly ? "" : "cursor-pointer"}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <defs>
                <clipPath id={`half-${field.fieldname}-${i}`}>
                  <rect x="0" y="0" width="12" height="24" />
                </clipPath>
              </defs>
              <path d={STAR} className="fill-zinc-200 stroke-zinc-300 dark:fill-zinc-700 dark:stroke-zinc-600" strokeWidth="1" />
              {fill !== "none" && (
                <path d={STAR} className="fill-amber-400 stroke-amber-400" strokeWidth="1" clipPath={fill === "half" ? `url(#half-${field.fieldname}-${i})` : undefined} />
              )}
            </svg>
          </span>
        );
      })}
    </div>
  );
}
