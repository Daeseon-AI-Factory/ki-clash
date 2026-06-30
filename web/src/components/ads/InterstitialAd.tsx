"use client";

import { useEffect, useState } from "react";

interface InterstitialAdProps {
  /** Whether to show the interstitial */
  show: boolean;
  /** Called when the ad is dismissed (user clicks continue) */
  onDismiss: () => void;
}

/**
 * Interstitial ad shown between matches.
 *
 * For web (AdSense), full-page interstitials aren't natively supported
 * like AdMob. Instead, this shows a full-screen overlay with an ad unit
 * and a dismiss button after a short delay.
 *
 * In dev mode (no ad client), shows a placeholder that auto-dismisses.
 */
export default function InterstitialAd({ show, onDismiss }: InterstitialAdProps) {
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (!show) return;

    // Allow dismiss after 2 seconds
    const resetTimer = setTimeout(() => setCanDismiss(false), 0);
    const allowTimer = setTimeout(() => setCanDismiss(true), 2000);
    return () => {
      clearTimeout(resetTimer);
      clearTimeout(allowTimer);
    };
  }, [show]);

  if (!show) return null;

  const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {adClient ? (
          <ins
            className="adsbygoogle block"
            style={{ display: "block", minHeight: 250 }}
            data-ad-client={adClient}
            data-ad-slot={process.env.NEXT_PUBLIC_ADSENSE_INTERSTITIAL_SLOT || ""}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          <div className="bg-gray-800 border border-dashed border-gray-600 rounded-xl
                          h-64 flex items-center justify-center text-gray-500 text-sm">
            Interstitial Ad Space
          </div>
        )}

        <button
          onClick={onDismiss}
          disabled={!canDismiss}
          className={`px-8 py-3 rounded-xl text-lg font-bold transition-colors ${
            canDismiss
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-gray-800 text-gray-600 cursor-not-allowed"
          }`}
        >
          {canDismiss ? "Continue" : "Loading..."}
        </button>
      </div>
    </div>
  );
}
