import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { MapsProvider } from "@/components/map/maps-provider";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return (
    <MapsProvider>
      <div className="min-h-dvh px-5 py-6 sm:px-8">
        <Logo href="/map" />
        <main id="main" className="mx-auto w-full max-w-lg py-8 sm:py-12">{children}</main>
      </div>
    </MapsProvider>
  );
}
