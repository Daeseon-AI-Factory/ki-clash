"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ensureAuth,
  getAdFreeStatus,
  createAdFreeCheckout,
} from "@/lib/api";
import { PixelPortrait } from "@/components/deprecated/pixel-art";

export default function ShopPage() {
  const [adFree, setAdFree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        await ensureAuth();
        const status = await getAdFreeStatus();
        setAdFree(status.ad_free);
      } catch {
        // If endpoint fails, assume not ad-free
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handlePurchase = useCallback(async () => {
    setPurchasing(true);
    try {
      const origin = window.location.origin;
      const result = await createAdFreeCheckout(
        `${origin}/shop?success=true`,
        `${origin}/shop`,
      );
      // Redirect to Stripe checkout
      window.location.href = result.checkout_url;
    } catch {
      setPurchasing(false);
    }
  }, []);

  // Check for success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setAdFree(true);
      // Clean up URL
      window.history.replaceState({}, "", "/shop");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-black mb-2">Shop</h1>
          <p className="text-gray-400">Support Ki Clash</p>
        </div>

        {/* Ad-Free Pass Card */}
        <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex justify-center gap-2">
            <PixelPortrait characterId="haneul" size="md" />
            <PixelPortrait characterId="bora" size="md" />
          </div>

          <div>
            <h2 className="text-xl font-bold">Ad-Free Pass</h2>
            <p className="text-gray-400 text-sm mt-1">
              Remove all banner and interstitial ads. One-time purchase, forever.
            </p>
          </div>

          <div className="text-3xl font-black text-green-400">$2.99</div>

          {loading ? (
            <div className="py-3 text-gray-500 text-sm">Loading...</div>
          ) : adFree ? (
            <div className="py-3 bg-green-900/40 border border-green-500/50 rounded-xl">
              <span className="text-green-400 font-bold">
                Already Purchased
              </span>
            </div>
          ) : (
            <button
              onClick={handlePurchase}
              disabled={purchasing}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700
                         rounded-xl text-lg font-bold transition-colors"
            >
              {purchasing ? "Redirecting..." : "Buy Ad-Free Pass"}
            </button>
          )}

          <ul className="text-xs text-gray-500 space-y-1 text-left">
            <li>- No more interstitial ads between matches</li>
            <li>- No more banner ads on lobby</li>
            <li>- Supports the developer</li>
            <li>- One-time payment, no subscription</li>
          </ul>
        </div>

        <Link
          href="/"
          className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Back to game
        </Link>
      </div>
    </div>
  );
}
