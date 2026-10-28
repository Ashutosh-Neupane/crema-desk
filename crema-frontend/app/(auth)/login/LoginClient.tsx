"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/frappe/auth";


const noopSubscribe = () => () => {};

export function LoginClient() {
  const router = useRouter();
  const { login, user, loading } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Until hydration, a submit would be a native form submit that reloads the page
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Redirect to desk if already authenticated (effect avoids setState during render)
  useEffect(() => {
    if (!loading && user) {
      router.replace("/desk");
    }
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    // uncontrolled inputs: text typed before hydration survives it
    const form = e.currentTarget as HTMLFormElement;
    const usr = (form.elements.namedItem("usr") as HTMLInputElement).value;
    const pwd = (form.elements.namedItem("pwd") as HTMLInputElement).value;
    try {
      await login(usr, pwd);
      router.push("/desk");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Login</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Sign in to access Crema Desk.
        </p>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div>
            <label htmlFor="login-usr" className="text-sm font-medium text-zinc-800">Email or username</label>
            <input
              id="login-usr"
              name="usr"
              autoComplete="username"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="login-pwd" className="text-sm font-medium text-zinc-800">Password</label>
            <input
              id="login-pwd"
              name="pwd"
              autoComplete="current-password"
              type="password"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              required
            />
          </div>

          {error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={!hydrated || submitting}
            className="w-full rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

