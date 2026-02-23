/**
 * Shared types for animation test panels.
 *
 * All 4 animation styles use the same action set and phase state machine,
 * so we define them once here for consistency.
 */

/** The 5 battle actions each panel can animate */
export type AnimationAction =
  | "charge"
  | "block"
  | "attack"
  | "energyWave"
  | "teleport";

/**
 * Animation phase state machine:
 * idle → windup (200ms) → impact (300ms) → recover (300ms) → idle
 *
 * Each panel maps these phases to its own visual style.
 */
export type AnimationPhase = "idle" | "windup" | "impact" | "recover";

/** Props that every panel renderer receives from AnimationPanel */
export interface PanelRenderProps {
  action: AnimationAction | null;
  phase: AnimationPhase;
}
