import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-strong p-12 text-white lg:flex lg:flex-col">
        <Logo className="text-white [&_span_span]:text-emerald-200" />
        <div className="mt-auto max-w-md">
          <p className="text-4xl font-extrabold leading-tight">Every game near you. Right now.</p>
          <p className="mt-4 text-lg text-emerald-100">
            Free games are a request. Paid games are a transaction. Either way you&apos;re one tap from playing.
          </p>
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 text-[22rem] leading-none opacity-10">⚽</div>
      </aside>
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="lg:hidden"><Logo /></div>
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
        <p className="text-center text-xs text-subtle">
          By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
