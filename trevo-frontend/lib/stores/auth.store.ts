/**
 * Auth store — Zustand write-through cache.
 *
 * This is NOT a data source. AuthProvider in lib/frappe/auth.tsx is the
 * single source of truth. This store exists so non-React code (e.g. API
 * route helpers, realtime service) can read the current user/boot info
 * without needing React context.
 *
 * Write path: AuthProvider → setBootInfo() here.
 * Read path:  useBootInfo() → reads bootInfo from here (no duplicate fetch).
 */
import { create } from "zustand";
import type { FrappeUser, BootInfo } from "@/lib/frappe/types";

interface AuthState {
  /** Current user (null = not logged in or not yet loaded) */
  user: FrappeUser | null;
  /** Full boot info assembled by BFF */
  bootInfo: BootInfo | null;
  /** True after the first successful boot fetch */
  bootLoaded: boolean;

  /** Called by AuthProvider after a successful boot fetch */
  setBootInfo: (info: BootInfo) => void;
  /** Called by AuthProvider on logout */
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  bootInfo: null,
  bootLoaded: false,

  setBootInfo: (info) =>
    set({ bootInfo: info, bootLoaded: true, user: info.user }),

  logout: () =>
    set({ user: null, bootInfo: null, bootLoaded: false }),
}));
