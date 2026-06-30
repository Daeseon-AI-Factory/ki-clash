/**
 * Action animation types for the (non-deprecated) ki-aura arena.
 * Renamed from the legacy pixel-art types — no `pixel` prefix.
 */

export type ActionKind =
  | "charge"
  | "block"
  | "attack"
  | "energyWave"
  | "teleport"
  | "victory"
  | "defeat";

/** Animation lifecycle: idle → windup → impact → recover → idle */
export type ActionPhase = "idle" | "windup" | "impact" | "recover";

/** Maps API Action enum strings to ActionKind. */
import type { Action as ApiAction } from "@/lib/api";

export const API_TO_ACTION: Record<ApiAction, ActionKind> = {
  charge: "charge",
  block: "block",
  attack: "attack",
  energy_wave: "energyWave",
  teleport: "teleport",
};

export const ACTION_LABEL: Record<ApiAction, string> = {
  charge: "Charge",
  block: "Block",
  attack: "Attack",
  energy_wave: "Ki Burst",
  teleport: "Teleport",
};

export function formatActionLabel(action: string): string {
  return ACTION_LABEL[action as ApiAction] ?? action.replace(/_/g, " ");
}
