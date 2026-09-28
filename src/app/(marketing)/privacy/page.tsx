import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How nearbygames handles your data — including why your exact location is never shown to other players.",
  alternates: { canonical: "/privacy" },
};

// NOTE: Template copy. Have it reviewed by a lawyer (DPDP Act 2023) before launch.
export default function PrivacyPage() {
  return (
    <article className="prose-ng mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
      <h1>Privacy Policy</h1>
      <p className="lead">Last updated: 28 September 2026</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> your email address or phone number, used only to send one-time sign-in codes.</li>
        <li><b>Profile:</b> name, photo, neighbourhood, occupation and whether you&apos;ve confirmed your ID — shown to hosts when you ask to join.</li>
        <li><b>Games and messages:</b> games you host or join, join requests, and chats with hosts or players.</li>
        <li><b>Payments:</b> wallet balance and transaction history. Card and UPI details are handled by our payment partner (Razorpay) and never touch our servers.</li>
      </ul>
      <h2>Your location</h2>
      <p>If you allow it, your device&apos;s location is used <b>on your device</b> to centre the map and calculate distances. It is not stored. If you save a home neighbourhood, it&apos;s rounded to roughly 100 m and is visible only to you. Other players only ever see a rounded distance such as “400 m away”.</p>
      <h2>Who can see what</h2>
      <ul>
        <li>Anyone can see open games (sport, spot, time, price, host&apos;s first name).</li>
        <li>Signed-in players can see who else has joined a game.</li>
        <li>Hosts see your profile, reliability and note when you ask to join their game.</li>
        <li>Chats are visible only to the two people in them.</li>
      </ul>
      <h2>Your choices</h2>
      <p>You can edit your profile at any time, turn off location access in your browser, and ask us to delete your account and data by writing to privacy@nearbygames.app.</p>
      <h2>Service providers</h2>
      <p>We use Supabase (database and authentication), Google Maps (maps and place search), Razorpay (payments) and Vercel (hosting). Each processes data only to provide its service.</p>
    </article>
  );
}
