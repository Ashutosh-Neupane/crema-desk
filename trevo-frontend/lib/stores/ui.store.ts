/**
 * UI store — Zustand.
 * Sidebar, theme, and general UI state.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

function applyTheme(theme: "light" | "dark" | "system") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  let resolved: "light" | "dark";
  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } else {
    resolved = theme;
  }
  root.setAttribute("data-theme", resolved);
}

if (typeof window !== "undefined") {
  // Apply persisted theme before first paint (avoids flash)
  try {
    const raw = localStorage.getItem("trevo-ui");
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { theme?: "light" | "dark" | "system" } };
      applyTheme(parsed?.state?.theme ?? "light");
    } else {
      applyTheme("light");
    }
  } catch {
    applyTheme("light");
  }
}

export const useUIStore = create<UIState>()(
  persist(
    (set, _get) => ({
      sidebarOpen: true,
      theme: "light",

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: "trevo-ui",
      partialize: (s) => ({ theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
