"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ensureAuth, getAdFreeStatus } from "@/lib/api";

interface UseAdTimingReturn {
  /** Whether to show the interstitial ad overlay */
  showInterstitial: boolean;
  /** Whether to show any ads at all */
  showAds: boolean;
  /** Call when a match ends — decides whether to show an interstitial */
  onMatchEnd: () => void;
  /** Call when user dismisses the interstitial */
  dismissInterstitial: () => void;
}

/**
 * Controls ad timing logic.
 *
 * Rules (from spec):
 * - Interstitial ads between matches, NOT during gameplay
 * - Show interstitial every 2nd match completion (not every time)
 * - Never interrupt gameplay flow
 * - Skip all ads if player has ad-free pass
 */
export function useAdTiming(): UseAdTimingReturn {
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [adFree, setAdFree] = useState(false);
  const matchCount = useRef(0);

  // Check ad-free status on mount
  useEffect(() => {
    async function check() {
      try {
        await ensureAuth();
        const status = await getAdFreeStatus();
        setAdFree(status.ad_free);
      } catch {
        // Assume not ad-free if check fails
      }
    }
    check();
  }, []);

  const onMatchEnd = useCallback(() => {
    if (adFree) return;
    matchCount.current += 1;
    // Show interstitial every 2nd match
    if (matchCount.current % 2 === 0) {
      setShowInterstitial(true);
    }
  }, [adFree]);

  const dismissInterstitial = useCallback(() => {
    setShowInterstitial(false);
  }, []);

  return {
    showInterstitial,
    showAds: !adFree,
    onMatchEnd,
    dismissInterstitial,
  };
}
