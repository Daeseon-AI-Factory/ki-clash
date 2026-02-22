"use client";

const KI_CAP = 10;

interface KiMeterProps {
  ki: number;
  label: string;
  isPlayer: boolean; // true = green (you), false = red (opponent)
}

/**
 * Visual ki bar showing current ki out of 10.
 * Fills left-to-right with color based on player/opponent.
 */
export default function KiMeter({ ki, label, isPlayer }: KiMeterProps) {
  const percentage = (ki / KI_CAP) * 100;
  const barColor = isPlayer ? "bg-green-500" : "bg-red-500";
  const glowColor = isPlayer ? "shadow-green-500/50" : "shadow-red-500/50";

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <span className="text-sm font-bold text-white">
          {ki} / {KI_CAP}
        </span>
      </div>
      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out
                      ${ki > 0 ? `shadow-md ${glowColor}` : ""}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
