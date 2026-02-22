"use client";

import { AnimationPanel } from "./AnimationPanel";
import { BattleArena } from "@/components/pixel-art";
import type { PixelAction, PixelPhase } from "@/lib/pixel-art-types";
import type { AnimationAction, AnimationPhase } from "./types";

/**
 * Style 3: Pixel Art (CSS box-shadow technique)
 *
 * Now delegates to the shared BattleArena component instead of
 * duplicating frame data and rendering logic. The AnimationPanel
 * still provides the action/phase state machine — we just bridge
 * the types and pass them to BattleArena.
 */

/** Bridge test-animation types to pixel-art types (they're identical values) */
function toPixelAction(action: AnimationAction | null): PixelAction | null {
  return action as PixelAction | null;
}

function toPixelPhase(phase: AnimationPhase): PixelPhase {
  return phase as PixelPhase;
}

export function PixelArtPanel() {
  return (
    <AnimationPanel title="3. Pixel Art (CSS)" borderColor="#FACC15">
      {({ action, phase }) => (
        <BattleArena
          playerCharacterId="haneul"
          aiCharacterId="bora"
          action={toPixelAction(action)}
          phase={toPixelPhase(phase)}
        />
      )}
    </AnimationPanel>
  );
}
