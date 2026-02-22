"use client";

import { useState, useCallback, useRef } from "react";

interface UseAdTimingReturn {
  /** Whether to show the interstitial ad overlay */
  showInterstitial: boolean;
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
 */
export function useAdTiming(): UseAdTimingReturn {
  const [showInterstitial, setShowInterstitial] = useState(false);
  const matchCount = useRef(0);

  const onMatchEnd = useCallback(() => {
    matchCount.current += 1;
    // Show interstitial every 2nd match
    if (matchCount.current % 2 === 0) {
      setShowInterstitial(true);
    }
  }, []);

  const dismissInterstitial = useCallback(() => {
    setShowInterstitial(false);
  }, []);

  return { showInterstitial, onMatchEnd, dismissInterstitial };
}
