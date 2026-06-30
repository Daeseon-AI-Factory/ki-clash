"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ensureAuth,
  createFounderPassCheckout,
  getAdFreeStatus,
} from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import CharacterAvatar from "@/components/arena/CharacterAvatar";

const FOUNDER_BENEFITS = [
  "No forced interstitial ads",
  "Founder badge on launch profile surfaces",
  "Korean-pattern aura cosmetic planned for first cosmetic drop",
  "Supports PvP servers and public launch testing",
];

export default function ShopPage() {
  const [adFree, setAdFree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("shop_view");
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await ensureAuth();
        const status = await getAdFreeStatus();
        setAdFree(status.ad_free);
      } catch {
        // The shop should still render if the purchase status endpoint is down.
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setAdFree(true);
      trackEvent("founder_pass_checkout_success");
      window.history.replaceState({}, "", "/shop");
    }
  }, []);

  const handlePurchase = useCallback(async () => {
    setPurchasing(true);
    setError(null);
    trackEvent("founder_pass_checkout_started", {
      product: "founder_pass",
      checkout_provider: "lemon_squeezy",
    });

    try {
      const origin = window.location.origin;
      const result = await createFounderPassCheckout(
        `${origin}/shop?success=true`,
        `${origin}/shop`,
      );
      window.location.href = result.checkout_url;
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Checkout is not available right now.";
      setError(message);
      trackEvent("founder_pass_checkout_failed", {
        product: "founder_pass",
        message,
      });
      setPurchasing(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0b14] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-5xl flex-col justify-center gap-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/play"
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Back
          </Link>
          <Link
            href="/"
            className="text-sm font-black tracking-wide text-yellow-200"
          >
            JJAN!
          </Link>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-200">
              Launch Support
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
              Founder Pass
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/68">
              A one-time launch pass for players who want the cleanest version
              of JJAN! while the first public PvP season is being tested.
            </p>
            <div className="mt-6 flex gap-2">
              {["haneul", "bora", "taeyang", "danbi"].map((id) => (
                <CharacterAvatar key={id} characterId={id} size="md" />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-yellow-300/25 bg-white/[0.055] p-5 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.25)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Founder Pass</h2>
                <p className="mt-1 text-sm text-white/58">
                  One-time launch support purchase
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-3xl font-black text-yellow-300">$4.99</p>
                <p className="text-xs text-white/42">launch target price</p>
              </div>
            </div>

            <ul className="mt-6 grid gap-3 text-sm text-white/72">
              {FOUNDER_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex gap-3">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-yellow-300" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            {error && (
              <p className="mt-5 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}

            <div className="mt-6">
              {loading ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-white/48">
                  Checking purchase status...
                </div>
              ) : adFree ? (
                <div className="rounded-xl border border-green-400/45 bg-green-400/10 px-4 py-3 text-center text-sm font-black text-green-200">
                  Founder benefits active
                </div>
              ) : (
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full rounded-xl bg-yellow-300 px-5 py-4 text-base font-black text-gray-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                >
                  {purchasing ? "Opening checkout..." : "Get Founder Pass"}
                </button>
              )}
            </div>

            <p className="mt-4 text-xs leading-5 text-white/42">
              Checkout is hosted by Lemon Squeezy. A completed Founder Pass
              purchase unlocks the ad-free entitlement; cosmetic entitlements
              can be attached once account surfaces are finalized.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
