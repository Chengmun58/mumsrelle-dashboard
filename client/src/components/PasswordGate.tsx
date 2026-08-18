import { FormEvent, ReactNode, useEffect, useState } from "react";

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/password/status", { credentials: "include" })
      .then(response => response.ok ? response.json() : { authenticated: false })
      .then(result => setAuthenticated(Boolean(result.authenticated)))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/password/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError("Incorrect password. Please try again.");
        return;
      }
      setPassword("");
      setAuthenticated(true);
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Checking access…</div>;
  }

  if (authenticated) return children;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">MUMSRELLE</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Dashboard access</h1>
        <p className="mt-2 text-sm text-slate-500">Enter the internal access password to continue.</p>
        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="dashboard-password">Password</label>
        <input
          id="dashboard-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={event => setPassword(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-base outline-none ring-violet-500 focus:ring-2"
        />
        {error ? <p className="mt-3 text-sm font-medium text-pink-600">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 h-11 w-full rounded-md bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
