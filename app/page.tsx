"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Coins,
  Loader2,
  Shield,
  Sparkles,
  Spade,
  Users,
} from "lucide-react";

import { useSession } from "@/lib/useSession";

const FEATURE_CARDS = [
  {
    icon: <Coins className="h-4 w-4" />,
    title: "10M welcome bonus",
    body: "Claim a starter stack the moment you sign in.",
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    title: "3 free spins / hr",
    body: "Spin the chip wheel for up to 10M chips a pop.",
  },
  {
    icon: <Users className="h-4 w-4" />,
    title: "9-seat live tables",
    body: "Real-time multiplayer Texas Hold'em with auto dealer.",
  },
  {
    icon: <Shield className="h-4 w-4" />,
    title: "Play money only",
    body: "Pure entertainment — nothing to buy, nothing to lose.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { user, signInWithGoogle } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Send them straight to the lobby.
  useEffect(() => {
    if (user) router.replace("/lobby");
  }, [user, router]);

  const onPlay = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle("/lobby");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  };

  // While auth state is unknown, render the same hero so the page
  // doesn't flash a blank loader on a fast connection.
  return (
    <main
      className="relative min-h-screen overflow-hidden text-ivory"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, #2c5746 0%, #0a3d2e 55%, #050f0c 100%)",
      }}
    >
      {/* Felt grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 30% 30%, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 5px)",
        }}
        aria-hidden
      />
      {/* Soft gold halo behind the hero */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(245,200,90,0.55) 0%, rgba(245,200,90,0) 70%)",
        }}
        aria-hidden
      />

      {/* Top brand bar */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300/30 via-wood-dark to-black text-gold-soft shadow-[inset_0_0_0_1px_rgba(212,175,55,0.45)]">
            <Spade className="h-4 w-4" />
          </span>
          <span className="font-serif text-base font-bold tracking-tight text-ivory-soft">
            Hold&apos;em
          </span>
        </div>
        <a
          href="https://en.wikipedia.org/wiki/Texas_hold_%27em"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-ivory/70 ring-1 ring-white/10 transition hover:bg-black/60 hover:text-gold-soft"
        >
          <BookOpen className="h-3.5 w-3.5" />
          How to play
        </a>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pt-10 text-center sm:pt-16">
        <span className="rounded-full bg-amber-500/10 px-4 py-1 font-serif text-[11px] font-bold uppercase tracking-[0.3em] text-amber-200 ring-1 ring-amber-300/40">
          Real-time No-Limit Hold&apos;em
        </span>
        <h1 className="mt-5 font-serif text-4xl font-bold leading-tight tracking-tight text-ivory-soft drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)] sm:text-6xl">
          The felt is open.
          <br className="hidden sm:block" />{" "}
          <span className="bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 bg-clip-text text-transparent">
            Take your seat.
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-ivory/80 sm:text-lg">
          Sign in once, claim 10 million starter chips, and jump into a
          live table in seconds. No download, no real money — just the
          best card game ever made.
        </p>

        {/* CTA */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onPlay}
            disabled={busy || user === undefined}
            className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-700 px-7 py-3.5 font-serif text-sm font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_40px_-15px_rgba(16,185,129,0.65)] ring-1 ring-emerald-300/60 transition hover:from-emerald-300 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleGlyph />
            )}
            {busy ? "Connecting…" : "Continue with Google"}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
          <p className="text-[11px] text-ivory/50">
            One click. We use Google so you never juggle a password.
          </p>
          {error && (
            <p className="mt-2 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200 ring-1 ring-red-400/40">
              {error}
            </p>
          )}
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative z-10 mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-3 px-4 pb-16 sm:grid-cols-2 sm:gap-4 sm:px-8 lg:grid-cols-4">
        {FEATURE_CARDS.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl bg-black/40 p-4 ring-1 ring-white/10 backdrop-blur"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300/25 via-wood-dark to-black text-gold-soft shadow-[inset_0_0_0_1px_rgba(212,175,55,0.4)]">
              {f.icon}
            </span>
            <h3 className="mt-3 font-serif text-sm font-bold tracking-tight text-ivory-soft">
              {f.title}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ivory/65">
              {f.body}
            </p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="relative z-10 mx-auto max-w-5xl px-4 pb-10 text-center text-[11px] text-ivory/40 sm:px-8">
        Built for casual play. Chips have no cash value.
      </footer>

      {/* Decorative dealer portrait, subtle and out of the way */}
      <DealerPeek />
    </main>
  );
}

function GoogleGlyph() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.03l3.66 2.84c.87-2.6 3.3-4.49 6.16-4.49z"
          fill="#EA4335"
        />
        <path
          d="M23 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.16c-.27 1.43-1.07 2.65-2.27 3.46l3.55 2.75C21.65 18.55 23 15.66 23 12.27z"
          fill="#4285F4"
        />
        <path
          d="M5.84 14.84c-.22-.66-.35-1.36-.35-2.09 0-.73.13-1.43.35-2.09L2.18 7.82C1.43 9.32 1 11.07 1 12.75c0 1.68.43 3.43 1.18 4.93l3.66-2.84z"
          fill="#FBBC05"
        />
        <path
          d="M12 23c2.97 0 5.45-.98 7.27-2.66l-3.55-2.75c-.99.66-2.27 1.06-3.72 1.06-2.86 0-5.29-1.89-6.16-4.49l-3.66 2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
      </svg>
    </span>
  );
}

function DealerPeek() {
  return (
    <div
      className="pointer-events-none absolute bottom-0 right-0 hidden opacity-25 lg:block"
      aria-hidden
    >
      <div className="relative h-[420px] w-[280px]">
        <Image
          src="/dealer/dealer.png"
          alt=""
          fill
          sizes="280px"
          className="object-contain object-bottom"
          unoptimized
        />
      </div>
    </div>
  );
}
