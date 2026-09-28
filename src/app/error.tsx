"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook your error tracker (Sentry etc.) here.
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl" aria-hidden>🤕</p>
      <h1 className="mt-4 text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-muted">Give it another go. If it keeps happening, let us know.</p>
      <button type="button" onClick={reset} className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-5 font-semibold text-white">Try again</button>
    </main>
  );
}
