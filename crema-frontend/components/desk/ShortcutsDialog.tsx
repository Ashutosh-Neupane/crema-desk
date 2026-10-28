"use client";

/** Shift+? — the shortcuts active on this page (Desk's "Keyboard Shortcuts" dialog). */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { formatKeys, useRegisteredShortcuts } from "@/lib/shortcuts";

export default function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const shortcuts = useRegisteredShortcuts();
  const groups = ["Form", "List", "Global"].map((g) => ({ g, items: shortcuts.filter((s) => s.group === g) })).filter((x) => x.items.length);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {groups.map(({ g, items }) => (
            <section key={g}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">{g}</h3>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((s) => (
                  <li key={s.keys} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="flex-1 text-zinc-700 dark:text-zinc-200">{s.description}</span>
                    <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-sans text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{formatKeys(s.keys)}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
