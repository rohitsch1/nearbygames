import Link from "next/link";
import { LogoMark } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark size={48} />
      <h1 className="mt-6 text-3xl font-extrabold">This one&apos;s out of bounds</h1>
      <p className="mt-2 max-w-sm text-muted">The page or game you&apos;re looking for doesn&apos;t exist, or the game has been removed.</p>
      <Link href="/map" className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-5 font-semibold text-white">Find a game nearby</Link>
    </main>
  );
}
