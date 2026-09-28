"use client";

import { clsx } from "clsx";
import { Mail, Smartphone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";

export const OTP_TARGET_KEY = "ng:otp-target";

type Mode = "email" | "phone";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(env.phoneAuth ? "phone" : "email");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? "Sign-in failed. Please try again." : null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    let target = value.trim();
    if (mode === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return setError("Enter a valid email address.");
      target = target.toLowerCase();
    } else {
      const digits = target.replace(/\D/g, "");
      const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
      if (!/^[6-9]\d{9}$/.test(national)) return setError("Enter a valid 10-digit Indian mobile number.");
      target = `+91${national}`;
    }
    setLoading(true);
    const { error: err } = mode === "email"
      ? await supabase.auth.signInWithOtp({ email: target, options: { shouldCreateUser: true } })
      : await supabase.auth.signInWithOtp({ phone: target, options: { shouldCreateUser: true } });
    setLoading(false);
    if (err) {
      setError(err.status === 429 ? "Too many attempts. Wait a minute and try again." : err.message);
      return;
    }
    try { sessionStorage.setItem(OTP_TARGET_KEY, JSON.stringify({ mode, target })); } catch { /* private mode */ }
    router.push(`/sign-in/verify?next=${encodeURIComponent(next)}`);
  }

  async function oauth(provider: "google" | "apple") {
    setOauthLoading(provider);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (err) {
      setOauthLoading(null);
      toast.error(err.message);
    }
  }

  return (
    <div className="mt-8">
      <div className="space-y-3">
        <Button type="button" variant="outline" size="lg" className="w-full" loading={oauthLoading === "google"} onClick={() => oauth("google")}
          icon={<GoogleIcon />}>
          Continue with Google
        </Button>
        {env.appleAuth && (
          <Button type="button" variant="outline" size="lg" className="w-full" loading={oauthLoading === "apple"} onClick={() => oauth("apple")}
            icon={<AppleIcon />}>
            Continue with Apple
          </Button>
        )}
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-subtle">
        <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={sendCode} noValidate>
        <div role="tablist" aria-label="Sign-in method" className="mb-4 grid grid-cols-2 rounded-xl bg-surface-2 p-1">
          {(["phone", "email"] as const).map((m) => {
            const disabled = m === "phone" && !env.phoneAuth;
            return (
              <button key={m} type="button" role="tab" aria-selected={mode === m} disabled={disabled}
                title={disabled ? "Phone sign-in is coming soon" : undefined}
                onClick={() => { setMode(m); setValue(""); setError(null); }}
                className={clsx("flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                  mode === m ? "bg-surface text-ink shadow-card" : "text-muted")}>
                {m === "phone" ? <Smartphone className="size-4" /> : <Mail className="size-4" />}
                {m === "phone" ? (disabled ? "Phone (soon)" : "Phone") : "Email"}
              </button>
            );
          })}
        </div>

        {mode === "email" ? (
          <>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
              value={value} onChange={(e) => setValue(e.target.value)} autoFocus aria-invalid={!!error} />
          </>
        ) : (
          <>
            <Label htmlFor="phone">Mobile number</Label>
            <div className="flex gap-2">
              <span className="flex h-11 items-center rounded-xl border border-line bg-surface-2 px-3 text-[15px] font-semibold text-muted">+91</span>
              <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210"
                value={value} onChange={(e) => setValue(e.target.value)} autoFocus aria-invalid={!!error} />
            </div>
          </>
        )}
        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" className="mt-4 w-full" loading={loading}>Send code</Button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M16.37 12.64c-.02-2.25 1.84-3.33 1.92-3.38-1.05-1.53-2.68-1.74-3.26-1.76-1.39-.14-2.71.82-3.42.82-.7 0-1.79-.8-2.94-.78-1.51.02-2.91.88-3.69 2.24-1.57 2.73-.4 6.77 1.13 8.98.75 1.08 1.64 2.3 2.81 2.25 1.13-.04 1.55-.73 2.92-.73 1.36 0 1.75.73 2.94.71 1.21-.02 1.98-1.1 2.72-2.19.86-1.25 1.21-2.46 1.23-2.52-.03-.01-2.35-.9-2.36-3.64ZM14.13 6.03c.62-.76 1.04-1.8.93-2.85-.9.04-1.98.6-2.62 1.35-.58.66-1.08 1.72-.95 2.74 1 .08 2.02-.51 2.64-1.24Z" />
    </svg>
  );
}
