"use client";

import { useState } from "react";
import type { FieldControlProps } from "./index";
import { Star } from "lucide-react";

export default function RatingField({ field, value, onChange, disabled }: FieldControlProps) {
  const [hover, setHover] = useState(0);
  const maxRating = field.options ? parseInt(field.options, 10) : 5;
  const rating = typeof value === "number" ? value : 0;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => (
        <button aria-label={`${star} star${star > 1 ? "s" : ""}`}
          key={star}
          type="button"
          disabled={disabled || !!field.read_only}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star === rating ? 0 : star)}
          className="p-0.5 transition-colors"
        >
          <Star
            className={`h-5 w-5 ${
              star <= (hover || rating) ? "fill-yellow-400 text-yellow-400" : "text-zinc-300 dark:text-zinc-600"
            }`}
          />
        </button>
      ))}
      {!!rating && <span className="ml-2 text-xs text-zinc-500">{rating}/{maxRating}</span>}
    </div>
  );
}
