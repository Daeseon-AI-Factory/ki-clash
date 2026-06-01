"use client";

import { useState, useCallback, useRef } from "react";
import type { ActionKind, ActionPhase } from "@/lib/actions";

interface UseActionAnimationOptions {
  windupMs?: number;
  impactMs?: number;
  recoverMs?: number;
}

interface UseActionAnimationReturn {
  action: ActionKind | null;
  phase: ActionPhase;
  isAnimating: boolean;
  triggerAction: (action: ActionKind) => void;
}

/**
 * Drives a fighter's animation through the deterministic
 * idle → windup → impact → recover → idle lifecycle.
 *
 * Replaces `usePixelAnimation`. Identical state machine, decoupled from
 * the deprecated pixel-art types.
 */
export function useActionAnimation(
  options: UseActionAnimationOptions = {}
): UseActionAnimationReturn {
  const { windupMs = 600, impactMs = 800, recoverMs = 600 } = options;

  const [action, setAction] = useState<ActionKind | null>(null);
  const [phase, setPhase] = useState<ActionPhase>("idle");
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isAnimating = phase !== "idle";

  const triggerAction = useCallback(
    (newAction: ActionKind) => {
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];

      setAction(newAction);
      setPhase("windup");

      const t1 = setTimeout(() => setPhase("impact"), windupMs);
      const t2 = setTimeout(() => setPhase("recover"), windupMs + impactMs);
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
