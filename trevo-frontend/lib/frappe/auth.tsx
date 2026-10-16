"use client";

/**
 * AuthProvider — single source of truth for user/session state.
 *
 * Architecture:
 *   1. On mount, calls /api/boot (via clientBoot) ONCE to get user + boot info.
 *   2. Stores result in BOTH the React Context (for UI) AND auth.store (for
 *      Zustand consumers like useBootInfo) as a write-through cache.
 *   3. useBootInfo reads from auth.store — no duplicate fetch, no separate
 *      React Query call fighting with this one.
 *   4. Login/Logout clear and re-populate this single path.
 *
 * NOTE: desk/layout.tsx performs only a cookie check (Server Component, no HTTP).
 * This client-side refresh runs once when the desk shell mounts.
 */

import React, { useEffect, useState, useCallback } from "react";
import type { FrappeUser, BootInfo } from "./types";
import { clientLogin, clientLogout, clientBoot } from "./client";
import { useAuthStore } from "@/lib/stores/auth.store";

interface UserContext {
  user: FrappeUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<UserContext>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FrappeUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Write-through: AuthProvider → auth.store (single path, not two parallel fetches)
  const setBootInfo = useAuthStore((s) => s.setBootInfo);
  const storeLogout = useAuthStore((s) => s.logout);

  // Mount-time boot: cancellable promise chain; all state updates are async
  useEffect(() => {
    let cancelled = false;
    clientBoot()
      .then((rawBoot) => {
        if (cancelled) return;
        const bootInfo = rawBoot as BootInfo | null;
        if (!bootInfo || !bootInfo.user || bootInfo.user.name === "Guest") {
          setUser(null);
          return;
        }
        // Write to store (makes useBootInfo work without a separate fetch)
        setBootInfo(bootInfo);
        setUser(bootInfo.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setBootInfo]);

  const refresh = useCallback(async () => {
    try {
      // Single call: clientBoot() already assembles user + apps in parallel
      const bootInfo = (await clientBoot()) as BootInfo | null;

      if (!bootInfo || !bootInfo.user || bootInfo.user.name === "Guest") {
        setUser(null);
        return;
      }

      // Write to store (makes useBootInfo work without a separate fetch)
      setBootInfo(bootInfo);
      setUser(bootInfo.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setBootInfo]);

  const login = useCallback(
    async (email: string, password: string) => {
      await clientLogin(email, password);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await clientLogout();
    storeLogout();
    setUser(null);
  }, [storeLogout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}

export { AuthContext };
