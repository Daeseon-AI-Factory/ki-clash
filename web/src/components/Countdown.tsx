"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  onComplete: () => void;
  /** Called on each beat (3, 2, 1) for sound triggers */
  onBeat?: (beat: number) => void;
}

const BEAT_DURATION_MS = 700;
const BEATS = [3, 2, 1];

/**
 * 3-beat countdown overlay: 3 → 2 → 1 → REVEAL!
 *
 * Each number pulses in with a scale animation (beat-pulse keyframe),
 * then the "REVEAL!" text triggers onComplete after a short delay.
 * Total duration: ~2.8s (700ms * 3 beats + 700ms reveal).
 */
export default function Countdown({ onComplete, onBeat }: CountdownProps) {
  const [currentBeat, setCurrentBeat] = useState(0); // 0=3, 1=2, 2=1, 3=REVEAL

  useEffect(() => {
    // Fire first beat immediately
    onBeat?.(BEATS[0]);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Schedule beats 2, 3, and REVEAL
    BEATS.forEach((beat, index) => {
      if (index > 0) {
        timers.push(
          setTimeout(() => {
            setCurrentBeat(index);
            onBeat?.(beat);
          }, BEAT_DURATION_MS * index)
        );
      }
    });

    // REVEAL phase
    timers.push(
      setTimeout(() => {
        setCurrentBeat(3);
      }, BEAT_DURATION_MS * BEATS.length)
    );

    // Fire completion
    timers.push(
      setTimeout(() => {
        onComplete();
      }, BEAT_DURATION_MS * (BEATS.length + 1))
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete, onBeat]);

  const display = currentBeat < 3 ? String(BEATS[currentBeat]) : "REVEAL!";
  const isReveal = currentBeat === 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <span
        // key forces re-mount on each beat so animation replays
        key={currentBeat}
        className={`font-black select-none animate-beat-pulse ${
          isReveal
            ? "text-7xl text-yellow-400"
            : "text-9xl text-white"
        }`}
      >
        {display}
      </span>
    </div>
  );
}
