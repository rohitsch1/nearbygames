import type { Metadata } from "next";
import { Suspense } from "react";
import { OtpForm } from "@/components/auth/otp-form";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false, follow: false } };

export default function VerifyPage() {
  return (
    <Suspense>
      <OtpForm />
    </Suspense>
  );
}
