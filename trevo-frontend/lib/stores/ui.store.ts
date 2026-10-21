/**
 * UI store — Zustand.
 * Sidebar, theme, full-width container, and general UI state.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeChoice = "light" | "dark" | "system";

interface UIState {
  sidebarOpen: boolean;
  theme: ThemeChoice;
  /** false until this browser has a theme choice: the user picked one, or it was seeded from User.desk_theme */
  themeSeeded: boolean;
  /** Desk's "Toggle Full Width" (localStorage.container_fullwidth) */
  fullWidth: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: ThemeChoice) => void;
  /** Initial theme from the server's User.desk_theme ("Light" | "Dark" | "Automatic"); no-op once seeded */
  seedThemeFromUser: (deskTheme: string | null | undefined) => void;
  toggleFullWidth: () => void;
  hydrateFullWidth: () => void;
}

function applyTheme(theme: ThemeChoice) {
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

/** Desk's localStorage.container_fullwidth is a JSON boolean string */
function readFullWidth(): boolean {
  try {
    return JSON.parse(localStorage.getItem("container_fullwidth") || "false") === true;
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  // Apply persisted theme before first paint (avoids flash)
  try {
    const raw = localStorage.getItem("trevo-ui");
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { theme?: ThemeChoice } };
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
    (set, get) => ({
      sidebarOpen: true,
      theme: "light",
      themeSeeded: false,
      fullWidth: false,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme, themeSeeded: true });
      },
      seedThemeFromUser: (deskTheme) => {
        if (get().themeSeeded) return;
        // Desk: "Automatic" follows the system (data-theme-mode=automatic); missing value means Light
        const theme: ThemeChoice = deskTheme === "Dark" ? "dark" : deskTheme === "Automatic" ? "system" : "light";
        applyTheme(theme);
        set({ theme, themeSeeded: true });
      },
      toggleFullWidth: () => {
        const next = !get().fullWidth;
        try {
          localStorage.setItem("container_fullwidth", JSON.stringify(next));
        } catch {
          // storage unavailable: the choice still applies for this page
        }
        set({ fullWidth: next });
      },
      hydrateFullWidth: () => set({ fullWidth: readFullWidth() }),
    }),
    {
      name: "trevo-ui",
      partialize: (s) => ({ theme: s.theme, themeSeeded: s.themeSeeded }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
