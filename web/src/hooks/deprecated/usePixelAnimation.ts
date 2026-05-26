"use client";

import { useState, useCallback, useRef } from "react";
import type { PixelAction, PixelPhase } from "@/lib/deprecated/pixel-art-types";

interface UsePixelAnimationOptions {
  /** Duration of windup phase in ms (default: 600) */
  windupMs?: number;
  /** Duration of impact phase in ms (default: 800) */
  impactMs?: number;
  /** Duration of recover phase in ms (default: 600) */
  recoverMs?: number;
}

interface UsePixelAnimationReturn {
  action: PixelAction | null;
  phase: PixelPhase;
  isAnimating: boolean;
  /** Trigger an animation sequence: idle → windup → impact → recover → idle */
  triggerAction: (action: PixelAction) => void;
}

/**
 * Shared animation state machine for pixel art fighters.
 *
 * Drives a deterministic timing sequence:
 *   idle → windup (600ms) → impact (800ms) → recover (600ms) → idle
 *
 * Timings are configurable. Promoted from the test-animations prototype.
 */
export function usePixelAnimation(
  options: UsePixelAnimationOptions = {}
): UsePixelAnimationReturn {
  const { windupMs = 600, impactMs = 800, recoverMs = 600 } = options;

  const [action, setAction] = useState<PixelAction | null>(null);
  const [phase, setPhase] = useState<PixelPhase>("idle");
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isAnimating = phase !== "idle";

  const triggerAction = useCallback(
    (newAction: PixelAction) => {
      // Clear any in-flight timers (safety net for rapid clicks)
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];

      setAction(newAction);
      setPhase("windup");

      // windup → impact
      const t1 = setTimeout(() => setPhase("impact"), windupMs);

      // impact → recover
      const t2 = setTimeout(() => setPhase("recover"), windupMs + impactMs);

      // recover → idle
      const t3 = setTimeout(() => {
        setPhase("idle");
        setAction(null);
      }, windupMs + impactMs + recoverMs);

      timeoutRefs.current = [t1, t2, t3];
    },
    [windupMs, impactMs, recoverMs]
  );

  return { action, phase, triggerAction, isAnimating };
}
