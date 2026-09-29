import { ArrowRight, BadgeIndianRupee, Hand, MapPin, MessageCircle, ShieldCheck, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/game/json-ld";
import { LinkButton } from "@/components/ui/button";
import { FAQ } from "@/lib/faq";
import { absoluteUrl, citySlug, site } from "@/lib/site";
import { SPORTS } from "@/lib/sports";

export const metadata: Metadata = {
  title: { absolute: `${site.name} — Find pickup football, cricket & badminton games near you` },
  description: site.description,
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: site.name,
      url: site.url,
      logo: absoluteUrl("/icons/icon-512.png"),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.name,
      url: site.url,
      description: site.description,
      inLanguage: "en-IN",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 md:grid-cols-2 md:px-8 md:pb-24 md:pt-20">
          <div className="animate-fade-up">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-strong">
              <span className="size-2 animate-pulse rounded-full bg-brand" /> Gully games happening in your mohalla, right now
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Gully cricket in your lane. <span className="text-brand">Volleyball on the empty plot.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              Host a game at your home, your chhat or the khali plot down the road — and let everyone nearby find it. Gully cricket, volleyball, badminton, carrom, a FIFA night. Open the map, tap a game, ask to join.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/map" size="lg" icon={<MapPin className="size-5" />}>Open the map</LinkButton>
              <LinkButton href="/sign-in?next=/host/new" size="lg" variant="outline">Host a game</LinkButton>
            </div>
            <p className="mt-4 text-sm text-subtle">No passwords. No group-chat spam. Free to use.</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Open the map. Tap a game. You&apos;re playing.</h2>
          <p className="mt-3 max-w-2xl text-muted">The difference between shouting “cricket khelega?” down the gali and hoping enough people hear — and seeing every game in your area in one place.</p>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icon: MapPin, title: "See what's on", body: "Every open game nearby shows up on a live map — the nearest and the paid ones stand out. Filter to “next two hours” or “free only”." },
              { icon: Hand, title: "Ask or pay", body: "Free game? Leave a note and ask the host. Paid game? Pay your share of the court and you're in instantly." },
              { icon: MessageCircle, title: "Sort the details", body: "The moment you're in, a chat with the host opens. Bibs, gate number, who's bringing the ball — done." },
            ].map((s, i) => (
              <li key={s.title} className="rounded-3xl border border-line bg-bg p-6">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white dark:text-[#052e1a]"><s.icon className="size-6" /></span>
                <p className="mt-5 text-sm font-bold text-subtle">Step {i + 1}</p>
                <h3 className="mt-1 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Free vs paid */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">Free games are a request.<br className="hidden sm:block" /> Paid games are a transaction.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border-2 border-brand/30 bg-brand-soft p-8">
            <ShieldCheck className="size-8 text-brand-strong" />
            <h3 className="mt-4 text-2xl font-bold">Free games</h3>
            <p className="mt-2 text-muted">Gully cricket in the lane, volleyball on the empty plot, carrom at home. The host is trusting strangers to show up, so they see who&apos;s asking — reliability, distance and your note — before saying yes.</p>
          </div>
          <div className="rounded-3xl border-2 border-paid/30 bg-paid-soft p-8">
            <Zap className="size-8 text-paid-strong" />
            <h3 className="mt-4 text-2xl font-bold">Paid games</h3>
            <p className="mt-2 text-muted">Booked a box-cricket turf or need to split the ball and net? Set a per-player fee. Players pay their share by wallet, UPI, card or cash at the ground — and they&apos;re in immediately. No approvals to babysit.</p>
          </div>
        </div>
      </section>

      {/* Sports */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Whatever you play</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SPORTS.filter((s) => s.id !== "other").map((s) => (
              <Link key={s.id} href={`/play/${s.slug}`} className="group rounded-2xl border border-line bg-bg p-5 transition hover:border-brand hover:shadow-card">
                <span className="text-3xl" aria-hidden>{s.emoji}</span>
                <p className="mt-3 font-bold">{s.label}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{s.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-strong">Find {s.noun} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy + cities */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Your location stays yours</h2>
          <p className="mt-4 text-muted">Other players only ever see a distance, like “400 m away” — never a pin showing where you are. Say no to location access and the map simply centres on the neighbourhood you saved.</p>
          <ul className="mt-6 space-y-3">
            {["One-time codes — no passwords, ever", "Hosts see a reliability badge before accepting", "Chats only exist once you're actually in the game", "Paid spots refunded to your wallet if a game is cancelled"].map((t) => (
              <li key={t} className="flex gap-3"><BadgeIndianRupee className="size-5 shrink-0 text-brand" /> {t}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Playing near you in</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {site.featuredCities.map((c) => (
              <Link key={c} href={`/play/football/${citySlug(c)}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-brand">{c}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 md:px-8 md:py-24">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Questions</h2>
          <div className="mt-8 divide-y divide-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                  {f.q}
                  <span className="text-2xl text-subtle transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <div className="rounded-[2rem] bg-brand-strong p-10 text-center text-white md:p-16">
          <h2 className="text-3xl font-extrabold md:text-4xl">Someone near you is short a player.</h2>
          <p className="mx-auto mt-3 max-w-xl text-emerald-100">Open the map and see who&apos;s playing tonight.</p>
          <LinkButton href="/map" size="lg" className="mt-8 bg-white !text-brand-strong">Find a game near me</LinkButton>
        </div>
      </section>
    </>
  );
}

/** Decorative phone mockup of the map screen (pure CSS, no images to load). */
function HeroVisual() {
  const pins = [
    { e: "⚽", x: "22%", y: "30%", paid: false, big: true },
    { e: "🏸", x: "64%", y: "22%", paid: true },
    { e: "🏏", x: "72%", y: "58%", paid: false },
    { e: "♟️", x: "34%", y: "64%", paid: false },
    { e: "🎮", x: "50%", y: "44%", paid: true },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[340px] animate-pop">
      <div className="absolute -inset-10 -z-10 rounded-full bg-brand/15 blur-3xl" />
      <div className="relative aspect-[9/18.5] overflow-hidden rounded-[2.6rem] border-[10px] border-ink bg-[#e8efe9] shadow-float dark:bg-[#1c2a22]">
        <svg className="absolute inset-0 size-full opacity-60" viewBox="0 0 100 200" preserveAspectRatio="none">
          <path d="M0 60 Q40 50 100 70" stroke="#fff" strokeWidth="3" fill="none" />
          <path d="M30 0 Q35 100 20 200" stroke="#fff" strokeWidth="2.5" fill="none" />
          <path d="M0 140 Q50 120 100 150" stroke="#fff" strokeWidth="2" fill="none" />
          <path d="M70 0 L80 200" stroke="#fff" strokeWidth="1.5" fill="none" />
          <rect x="40" y="80" width="18" height="14" rx="2" fill="#bfe3c9" />
          <rect x="8" y="160" width="22" height="16" rx="2" fill="#bfe3c9" />
        </svg>
        <div className="absolute inset-x-3 top-8 flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-xs font-semibold text-[#0b1220] shadow-card">
          <MapPin className="size-3.5 text-[#12b76a]" /> Model Town, Hisar
        </div>
        {pins.map((p) => (
          <span key={p.e} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] bg-white shadow-float"
            style={{ left: p.x, top: p.y, width: p.big ? 48 : 38, height: p.big ? 48 : 38, fontSize: p.big ? 24 : 18, borderColor: p.paid ? "#f79009" : "#12b76a" }}>
            {p.e}
          </span>
        ))}
        <span className="absolute left-[44%] top-[52%] size-4 rounded-full border-[3px] border-white bg-sky-500 shadow-float" />
        <div className="absolute inset-x-3 bottom-4 rounded-2xl bg-white p-3 text-[#0b1220] shadow-float">
          <p className="text-xs"><b>5 games</b> <span className="text-[#475467]">visible · next kicks off in 25 min</span></p>
          <div className="mt-2 rounded-xl bg-[#12b76a] py-2 text-center text-xs font-bold text-white">+ Start a game</div>
        </div>
      </div>
    </div>
  );
}
