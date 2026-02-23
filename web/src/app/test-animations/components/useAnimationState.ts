"use client";

import { useState, useCallback, useRef } from "react";
import type { AnimationAction, AnimationPhase } from "./types";

/**
 * Shared animation state machine hook.
 *
 * Drives a deterministic timing sequence that all 4 panels use:
 *   idle → windup (200ms) → impact (300ms) → recover (300ms) → idle
 *
 * This keeps every panel perfectly synchronized in timing,
 * even though each renders the phases with completely different visuals.
 */
export function useAnimationState() {
  const [action, setAction] = useState<AnimationAction | null>(null);
  const [phase, setPhase] = useState<AnimationPhase>("idle");
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isAnimating = phase !== "idle";

  const triggerAction = useCallback((newAction: AnimationAction) => {
    // Clear any in-flight timers (safety net for rapid clicks)
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];

    setAction(newAction);
    setPhase("windup");

    // windup → impact after 200ms
    const t1 = setTimeout(() => setPhase("impact"), 200);

    // impact → recover after 300ms more
    const t2 = setTimeout(() => setPhase("recover"), 500);

    // recover → idle after 300ms more (total 800ms)
    const t3 = setTimeout(() => {
      setPhase("idle");
      setAction(null);
    }, 800);

    timeoutRefs.current = [t1, t2, t3];
  }, []);

  return { action, phase, triggerAction, isAnimating };
}
