"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CHARACTERS, getCharacter } from "@/lib/characters";
import FighterSprite, { type FighterPose } from "@/components/arena/FighterSprite";
import { trackEvent } from "@/lib/analytics";
import { PROMO_CAMPAIGN_BY_SLUG, buildPromoUrl } from "@/lib/promo-campaigns";

const HERO_FIGHTERS = [
  {
    id: "haneul",
    pose: "impact" as FighterPose,
    width: 240,
    className:
      "left-[-4.75rem] bottom-[1.25rem] opacity-95 sm:left-[6vw] sm:bottom-[3rem]",
  },
  {
    id: "bora",
    pose: "windup" as FighterPose,
    width: 230,
    className:
      "right-[-4.5rem] bottom-[1.5rem] opacity-90 sm:right-[7vw] sm:bottom-[3.25rem]",
  },
  {
    id: "taeyang",
    pose: "victory" as FighterPose,
    width: 150,
    className:
      "left-1/2 top-[5.5rem] -translate-x-1/2 opacity-40 blur-[0.5px] sm:top-[5rem]",
  },
];

const MODES = [
  {
    title: "Practice",
    detail: "Fast AI matches with three difficulty levels.",
    href: "/play",
    accent: "border-cyan-400/60 text-cyan-200",
  },
  {
    title: "PvP Rooms",
    detail: "Create a four-character room and send the link.",
    href: "/pvp",
    accent: "border-rose-400/60 text-rose-200",
  },
  {
    title: "Ranked",
    detail: "Leaderboard groundwork is already live.",
    href: "/ranked",
    accent: "border-yellow-300/60 text-yellow-200",
  },
];

export default function OfficialHomePage() {
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => {
    const origin =
      typeof window === "undefined" ? "https://jjan.daeseon.ai" : window.location.origin;
    return buildPromoUrl(PROMO_CAMPAIGN_BY_SLUG["friend-share"], origin);
  }, []);

  const copyPromoLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackEvent("invite_copied", {
        surface: "landing",
        method: "clipboard",
        promo: "friend-share",
      });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      await copyPromoLink();
      return;
    }
    try {
      await navigator.share({
        title: "JJAN! · Ki Clash",
        text: "Read, charge, strike. Play JJAN!, the 1v1 ki reveal duel.",
        url: shareUrl,
      });
      trackEvent("invite_copied", {
        surface: "landing",
        method: "native_share",
        promo: "friend-share",
      });
    } catch {
      // User cancelled the native sheet.
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0b14] text-white">
      <section className="relative isolate flex min-h-[86svh] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#10121f_0%,#0b0b14_42%,#090910_100%)]" />
        <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.72))]" />

        {HERO_FIGHTERS.map((fighter) => (
          <HeroFighter
            key={fighter.id}
            id={fighter.id}
            pose={fighter.pose}
            width={fighter.width}
            className={fighter.className}
          />
        ))}

        <header className="absolute left-0 right-0 top-0 z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="font-black tracking-wide text-white">
            JJAN!
          </Link>
          <nav className="flex items-center gap-2 text-sm font-semibold text-white/72">
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/play">
              Play
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/pvp">
              PvP
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/invite">
              Share
            </Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-end px-5 pb-[9svh] pt-28 sm:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-yellow-300/45 bg-black/35 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-yellow-200">
              Real-time ki reveal duel
            </p>
            <h1 className="text-[4rem] font-black leading-[0.82] text-white sm:text-[7rem] lg:text-[9rem]">
              JJAN<span className="text-yellow-300">!</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-medium leading-7 text-white/78 sm:text-2xl sm:leading-9">
              Read the opponent, bank your ki, and call the strike at the
              exact second they get greedy.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/play"
                className="inline-flex items-center justify-center rounded-xl bg-yellow-300 px-6 py-4 text-base font-black text-gray-950 shadow-[0_1rem_2.5rem_rgba(250,204,21,0.24)] transition hover:bg-yellow-200"
              >
                Play now
              </Link>
              <Link
                href="/pvp"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 py-4 text-base font-black text-white backdrop-blur transition hover:bg-white/[0.16]"
              >
                Create PvP room
              </Link>
              <button
                onClick={nativeShare}
                className="inline-flex items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-6 py-4 text-base font-black text-cyan-100 transition hover:bg-cyan-300/[0.16]"
              >
                {copied ? "Promo link copied" : "Share promo link"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#11131f] px-5 py-5 sm:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Stat label="Actions" value="5" />
          <Stat label="Fighters" value={String(CHARACTERS.length)} />
          <Stat label="Room Code" value="4" />
          <Stat label="Rounds" value="BO3" />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:py-20">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-200">
            Service build
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
            A public face for the playable game.
          </h2>
          <p className="mt-5 text-base leading-7 text-white/68">
            The game opens directly into practice, room PvP, or leaderboard
            pages. The room flow now produces a real join URL, so a shared
            link can take a friend straight into the lobby instead of stopping
            at a dead challenge parameter.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((mode) => (
            <Link
              key={mode.title}
              href={mode.href}
              className={`rounded-lg border bg-white/[0.045] p-5 transition hover:bg-white/[0.075] ${mode.accent}`}
            >
              <h3 className="text-lg font-black text-white">{mode.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/62">{mode.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0f1019] px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black">Ready for a first public run?</h2>
            <p className="mt-2 text-sm text-white/58">
              Start with AI practice, then send a PvP room link to a friend.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/play"
              className="rounded-xl bg-white px-5 py-3 text-center text-sm font-black text-gray-950 transition hover:bg-yellow-200"
            >
              Practice
            </Link>
            <Link
              href="/pvp"
              className="rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/10"
            >
              Open PvP
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#090910] px-5 py-6 text-sm text-white/45 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>JJAN! Ki Clash</p>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/support" className="hover:text-white">Support</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function HeroFighter({
  id,
  pose,
  width,
  className,
}: {
  id: string;
  pose: FighterPose;
  width: number;
  className: string;
}) {
  const character = getCharacter(id);
  if (!character) return null;

  return (
    <div
      className={`pointer-events-none absolute z-0 drop-shadow-[0_2rem_2.5rem_rgba(0,0,0,0.65)] ${className}`}
      aria-hidden="true"
    >
      <FighterSprite character={character} pose={pose} width={width} assetMode="auto" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/[0.18] px-3 py-4">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/48">
        {label}
      </p>
    </div>
  );
}
