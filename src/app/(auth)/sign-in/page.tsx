import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to nearbygames with a one-time code. No passwords, ever.",
  alternates: { canonical: "/sign-in" },
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Let&apos;s get you playing</h1>
      <p className="mt-2 text-muted">We&apos;ll send you a one-time code. No passwords, ever.</p>
      <Suspense>
        <SignInForm />
      </Suspense>
    </>
  );
}
