"use client";

/**
 * Fixed-position coordinates for a popover portalled to <body>, anchored to an
 * element — so grids / scroll containers with overflow can't clip it. Flips
 * above the anchor when there isn't room below; follows scroll and resize.
 */
import { useLayoutEffect, useState, type RefObject } from "react";

export function useAnchoredPosition(
  anchor: RefObject<HTMLElement | null>,
  popover: RefObject<HTMLElement | null>,
  open: boolean,
  opts: { matchWidth?: boolean; gap?: number } = {},
) {
  const [pos, setPos] = useState<{ top: number; left: number; width?: number } | null>(null);
  const gap = opts.gap ?? 4;
  const matchWidth = !!opts.matchWidth;
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const h = popover.current?.offsetHeight ?? 300;
      const w = matchWidth ? r.width : popover.current?.offsetWidth ?? 280;
      const below = r.bottom + gap + h <= window.innerHeight;
      setPos({
        top: below ? r.bottom + gap : Math.max(8, r.top - h - gap),
        left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
        width: matchWidth ? Math.max(r.width, 220) : undefined,
      });
    };
    place();
    const raf = requestAnimationFrame(place); // re-measure once the popover has rendered
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, popover, gap, matchWidth]);
  return pos;
}
