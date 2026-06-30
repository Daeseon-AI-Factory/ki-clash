"use client";

// Standalone harness to view the PixiJS WebGL arena + fire each effect on
// demand — no backend / match needed. Visit /pixi-test.

import { useState } from "react";
import PixiBattleArena, {
  type ArenaEffect,
} from "@/components/arena/pixi/PixiBattleArenaClient";
import { CHARACTERS } from "@/lib/characters";
import type { EffectKind, Side } from "@/components/arena/pixi/effects";

const hexToNum = (hex: string): number =>
  parseInt(hex.replace("#", ""), 16) || 0xffffff;

const EFFECTS: { kind: EffectKind; label: string; emoji: string }[] = [
  { kind: "charge", label: "Charge", emoji: "⚡" },
  { kind: "attack", label: "Attack", emoji: "👊" },
  { kind: "energy_wave", label: "Ki Burst", emoji: "🔥" },
  { kind: "teleport", label: "Teleport", emoji: "💨" },
  { kind: "block", label: "Block", emoji: "🛡️" },
  { kind: "finisher", label: "FINISHER", emoji: "💥" },
];

export default function PixiTestPage() {
  const [playerId, setPlayerId] = useState("haneul");
  const [enemyId, setEnemyId] = useState("taeyang");
  const [effect, setEffect] = useState<ArenaEffect | null>(null);
  const [nonce, setNonce] = useState(0);

  const fire = (kind: EffectKind, side: Side) => {
    const n = nonce + 1;
    setNonce(n);
    setEffect({ kind, side, nonce: n });
  };

  const player = CHARACTERS.find((c) => c.id === playerId)!;
  const enemy = CHARACTERS.find((c) => c.id === enemyId)!;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Arena canvas */}
      <div className="relative w-full" style={{ height: "60vh" }}>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, #1a1530 0%, #0a0a14 70%, #050509 100%)",
          }}
        />
        <div className="absolute inset-0">
          <PixiBattleArena
            playerSrc={`/fighters/${playerId}/idle.png`}
            enemySrc={`/fighters/${enemyId}/idle.png`}
            playerColor={hexToNum(player.color)}
            enemyColor={hexToNum(enemy.color)}
            effect={effect}
          />
        </div>
        {/* HUD labels (React DOM, not Pixi text) */}
        <div className="absolute top-3 left-4 text-sm font-bold" style={{ color: player.color }}>
          {player.name}
        </div>
        <div className="absolute top-3 right-4 text-sm font-bold" style={{ color: enemy.color }}>
          {enemy.name}
        </div>
      </div>

      {/* Controls */}
      <div className="flex-1 p-4 space-y-5 max-w-3xl mx-auto w-full">
        {/* Character pickers */}
        <div className="grid grid-cols-2 gap-4">
          {([["Player (left)", playerId, setPlayerId], ["Enemy (right)", enemyId, setEnemyId]] as const).map(
            ([label, val, set]) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <div className="flex flex-wrap gap-1">
                  {CHARACTERS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => set(c.id)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        val === c.id
                          ? "bg-white text-black"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>

        {/* Effect buttons — player side */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Player effects (left fighter acts)</p>
          <div className="grid grid-cols-3 gap-2">
            {EFFECTS.map((e) => (
              <button
                key={e.kind}
                onClick={() => fire(e.kind, "player")}
                className="py-3 bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-600
                           hover:to-indigo-500 rounded-lg font-bold text-sm transition-all"
              >
                {e.emoji} {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Effect buttons — enemy side */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Enemy effects (right fighter acts)</p>
          <div className="grid grid-cols-3 gap-2">
            {EFFECTS.map((e) => (
              <button
                key={e.kind}
                onClick={() => fire(e.kind, "enemy")}
                className="py-3 bg-gradient-to-r from-red-700 to-orange-600 hover:from-red-600
                           hover:to-orange-500 rounded-lg font-bold text-sm transition-all"
              >
                {e.emoji} {e.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 pt-2">
          PixiJS v8 WebGL · runs identically on web / PWA / Capacitor app
        </p>
      </div>
    </div>
  );
}
