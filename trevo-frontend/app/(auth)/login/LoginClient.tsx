"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/frappe/auth";


export function LoginClient() {
  const router = useRouter();
  const { login, user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    try {
      await login(email, password);
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
          Sign in to access Trevo Desk.
        </p>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-zinc-800">Email or username</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-800">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

