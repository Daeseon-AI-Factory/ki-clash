"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CharacterAvatar from "@/components/arena/CharacterAvatar";
import { CHARACTERS } from "@/lib/characters";
import { trackEvent } from "@/lib/analytics";
import { PROMO_CAMPAIGN_BY_SLUG, buildPromoUrl } from "@/lib/promo-campaigns";

export default function InvitePage() {
  const [copied, setCopied] = useState(false);
  const promoLink = useMemo(() => {
    const origin =
      typeof window === "undefined" ? "https://jjan.daeseon.ai" : window.location.origin;
    return buildPromoUrl(PROMO_CAMPAIGN_BY_SLUG["friend-share"], origin);
  }, []);

  const copyPromoLink = async () => {
    try {
      await navigator.clipboard.writeText(promoLink);
      setCopied(true);
      trackEvent("invite_copied", {
        surface: "invite_page",
        method: "clipboard",
        promo: "friend-share",
      });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const sharePromoLink = async () => {
    if (!navigator.share) {
      await copyPromoLink();
      return;
    }
    try {
      await navigator.share({
        title: "JJAN! · Ki Clash",
        text: "Play JJAN!, the 1v1 ki reveal duel.",
        url: promoLink,
      });
      trackEvent("invite_copied", {
        surface: "invite_page",
        method: "native_share",
        promo: "friend-share",
      });
    } catch {
      // User cancelled the native share sheet.
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0b14] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <Link
              href="/"
              className="text-sm font-bold text-white/52 transition hover:text-white"
            >
              ← Official page
            </Link>
            <p className="mt-10 text-sm font-black uppercase tracking-[0.24em] text-yellow-200">
              Share JJAN!
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
              Send the promo link, or open a real PvP room.
            </h1>
            <p className="mt-5 text-base leading-7 text-white/66">
              The promo link points to the official page. For a direct match,
              create a PvP room and copy the room link from the lobby.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                onClick={copyPromoLink}
                className="rounded-xl bg-yellow-300 px-5 py-4 text-sm font-black text-gray-950 transition hover:bg-yellow-200"
              >
                {copied ? "Promo link copied" : "Copy promo link"}
              </button>
              <button
                onClick={sharePromoLink}
                className="rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-5 py-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/16"
              >
                Share
              </button>
              <Link
                href="/pvp"
                className="rounded-xl border border-white/[0.18] bg-white/[0.08] px-5 py-4 text-center text-sm font-black text-white transition hover:bg-white/[0.12] sm:col-span-2"
              >
                Create PvP room
              </Link>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.045] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                Promo URL
              </p>
              <p className="mt-2 break-all font-mono text-sm text-cyan-200">
                {promoLink}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {CHARACTERS.map((char) => (
              <div
                key={char.id}
                className="rounded-lg border border-white/10 bg-white/[0.045] p-3 text-center"
                style={{ borderColor: `${char.color}66` }}
              >
                <CharacterAvatar characterId={char.id} size="md" />
                <p className="mt-2 text-sm font-black">{char.name}</p>
                <p className="mt-1 text-[11px] text-white/45">{char.koreanName}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
