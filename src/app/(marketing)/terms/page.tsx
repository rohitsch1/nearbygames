import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using nearbygames to find, host and join pickup games.",
  alternates: { canonical: "/terms" },
};

// NOTE: Template copy. Have it reviewed by a lawyer before launch.
export default function TermsPage() {
  return (
    <article className="prose-ng mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
      <h1>Terms of Service</h1>
      <p className="lead">Last updated: 28 September 2026</p>
      <h2>Using nearbygames</h2>
      <p>nearbygames helps people find and organise pickup games. Hosts and players are independent; nearbygames doesn&apos;t run, supervise or insure games. You take part at your own risk and are responsible for your own conduct and safety.</p>
      <h2>Free and paid games</h2>
      <p>Free games are joined by request and the host decides who plays. Paid games are joined by paying the host&apos;s per-player fee plus a platform fee (5%, minimum ₹5, maximum ₹50). Paying in person at the ground is an arrangement between you and the host.</p>
      <h2>Cancellations and refunds</h2>
      <p>If a host cancels a paid game, wallet, UPI and card payments are refunded in full to the player&apos;s nearbygames wallet. If a game fills while you&apos;re paying, your payment is refunded to your wallet.</p>
      <h2>Behaviour</h2>
      <p>Be respectful, show up when you say you will, and don&apos;t use nearbygames to harass anyone, advertise, or organise anything unlawful. Hosts can mark no-shows, which appear on your profile. We may suspend accounts that break these rules.</p>
      <h2>Contact</h2>
      <p>Questions? Write to support@nearbygames.app.</p>
    </article>
  );
}
