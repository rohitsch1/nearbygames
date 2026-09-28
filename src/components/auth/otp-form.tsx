"use client";

import { clsx } from "clsx";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Spinner } from "@/components/ui/spinner";
import { safeNext } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";
import { OTP_TARGET_KEY } from "./sign-in-form";

const LENGTH = 6;
const RESEND_SECONDS = 30;

type Target = { mode: "email" | "phone"; target: string };

function readTarget(): Target | null {
  try {
    const raw = sessionStorage.getItem(OTP_TARGET_KEY);
    return raw ? (JSON.parse(raw) as Target) : null;
  } catch {
    return null;
  }
}
// sessionStorage doesn't change while this page is open; subscribe is a no-op.
const noopSubscribe = () => () => {};
let cachedTarget: Target | null | undefined;
const getTargetSnapshot = () => (cachedTarget === undefined ? (cachedTarget = readTarget()) : cachedTarget);

export function OtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const target = useSyncExternalStore(noopSubscribe, getTargetSnapshot, () => null);
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  async function verify(code: string) {
    if (!target) return;
    setVerifying(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = target.mode === "email"
      ? await supabase.auth.verifyOtp({ email: target.target, token: code, type: "email" })
      : await supabase.auth.verifyOtp({ phone: target.target, token: code, type: "sms" });
    if (err) {
      setVerifying(false);
      setError(err.message.toLowerCase().includes("expired") ? "That code has expired. Request a new one." : "That code isn't right. Try again.");
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
      return;
    }
    try { sessionStorage.removeItem(OTP_TARGET_KEY); } catch { /* ignore */ }
    // Server decides where to go (profile step, tour or the requested page).
    router.replace(`/auth/continue?next=${encodeURIComponent(next)}`);
    router.refresh();
  }

  function setAt(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const copy = [...digits];
      copy[index] = "";
      setDigits(copy);
      return;
    }
    // Handles paste / SMS autofill of the whole code into one box.
    const copy = [...digits];
    let i = index;
    for (const ch of clean) {
      if (i >= LENGTH) break;
      copy[i++] = ch;
    }
    setDigits(copy);
    inputs.current[Math.min(i, LENGTH - 1)]?.focus();
    if (copy.every(Boolean)) void verify(copy.join(""));
  }

  async function resend() {
    if (!target || seconds > 0) return;
    const supabase = createClient();
    const { error: err } = target.mode === "email"
      ? await supabase.auth.signInWithOtp({ email: target.target })
      : await supabase.auth.signInWithOtp({ phone: target.target });
    if (err) setError(err.status === 429 ? "Please wait a little before requesting another code." : err.message);
    else setSeconds(RESEND_SECONDS);
  }

  if (!target) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">Code expired</h1>
        <p className="mt-2 text-muted">Start again and we&apos;ll send a fresh code.</p>
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="mt-6 inline-block font-semibold text-brand-strong">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="-ml-2 mb-6 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:bg-surface-2">
        <ChevronLeft className="size-4" /> Change {target.mode === "email" ? "email" : "number"}
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight">Enter the code</h1>
      <p className="mt-2 text-muted">
        We sent a {LENGTH}-digit code to <span className="font-semibold text-ink">{target.target}</span>
      </p>

      <fieldset className="mt-8" disabled={verifying}>
        <legend className="sr-only">One-time code</legend>
        <div className="flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              maxLength={i === 0 ? LENGTH : 1}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
                if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
                if (e.key === "ArrowRight" && i < LENGTH - 1) inputs.current[i + 1]?.focus();
              }}
              onFocus={(e) => e.target.select()}
              className={clsx(
                "h-14 w-full min-w-0 rounded-xl border-2 bg-surface text-center text-2xl font-bold outline-none transition sm:h-16",
                d ? "border-brand bg-brand-soft" : "border-line",
                error && "border-danger bg-danger-soft",
                "focus:border-brand focus:ring-4 focus:ring-brand/15",
              )}
            />
          ))}
        </div>
      </fieldset>

      <div className="mt-4 min-h-6 text-sm" aria-live="polite">
        {verifying ? <span className="inline-flex items-center gap-2 text-muted"><Spinner /> Checking…</span>
          : error ? <span className="text-danger">{error}</span> : null}
      </div>

      <p className="mt-6 text-sm text-muted">
        Didn&apos;t get it?{" "}
        {seconds > 0 ? (
          <span>Resend in 0:{String(seconds).padStart(2, "0")}</span>
        ) : (
          <button type="button" onClick={resend} className="font-semibold text-brand-strong hover:underline">Resend code</button>
        )}
      </p>
    </div>
  );
}
