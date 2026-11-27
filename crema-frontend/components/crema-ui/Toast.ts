/**
 * Toasts for new screens (docs/PHASE2_DESIGN.md § 2.5): one place for wording and timing, over `sonner` (mounted in
 * app/providers.tsx, which announces toasts politely to screen readers).
 *
 *   notify.success("Saved");
 *   notify.undoable("3 rows deleted", () => restore());   // 8 s with an Undo button (bulk actions)
 *   notify.error(err, "Could not save");                  // server message + Details for System Managers
 */
import { toast } from "sonner";
import { toastError } from "@/lib/frappe/errors";

const UNDO_MS = 8000;

export const notify = {
  success: (message: string) => toast.success(message),
  info: (message: string) => toast(message),
  error: (e: unknown, fallback: string) => toastError(e, fallback),
  /** a change that can be taken back: the toast stays long enough to press Undo */
  undoable: (message: string, onUndo: () => void) => toast(message, { duration: UNDO_MS, action: { label: "Undo", onClick: onUndo } }),
};
