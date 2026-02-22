"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface CountdownProps {
  /** Total seconds for the timer */
  seconds?: number;
  /** Called when timer reaches 0 */
  onTimeout: () => void;
  /** Called on each second tick for sound triggers */
  onBeat?: () => void;
  /** Set to true to pause/reset the timer (e.g. during loading) */
  paused?: boolean;
}

const DEFAULT_SECONDS = 3;

/**
 * Inline selection timer — a shrinking bar with countdown number.
 *
 * Ticks during action selection. When it hits 0, fires onTimeout
 * (which auto-submits Charge). Plays a beat sound on each second.
 *
 * Uses requestAnimationFrame for smooth bar animation and
 * setInterval for second-tick callbacks.
 */
export default function Countdown({
  seconds = DEFAULT_SECONDS,
  onTimeout,
  onBeat,
  paused = false,
}: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);
  const startTimeRef = useRef(Date.now());
  const rafRef = useRef<number>(0);
  const firedRef = useRef(false);
  const lastBeatRef = useRef(seconds);

  // Reset when seconds or paused changes
  useEffect(() => {
    startTimeRef.current = Date.now();
    setRemaining(seconds);
    firedRef.current = false;
    lastBeatRef.current = seconds;
  }, [seconds, paused]);

  const tick = useCallback(() => {
    if (paused) return;

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const left = Math.max(0, seconds - elapsed);
    setRemaining(left);

    // Fire beat on each whole-second boundary
    const currentSecond = Math.ceil(left);
    if (currentSecond < lastBeatRef.current && currentSecond > 0) {
      lastBeatRef.current = currentSecond;
      onBeat?.();
    }

    if (left <= 0 && !firedRef.current) {
      firedRef.current = true;
      onBeat?.();
      onTimeout();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [seconds, paused, onTimeout, onBeat]);

  useEffect(() => {
    if (paused) return;

    // Fire initial beat
    onBeat?.();
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, paused, onBeat]);

  const fraction = remaining / seconds;
  const displayNumber = Math.ceil(remaining);

  // Color transitions: green → yellow → red
  const barColor =
    fraction > 0.5
      ? "bg-green-500"
      : fraction > 0.25
        ? "bg-yellow-500"
        : "bg-red-500";

  const textColor =
    fraction > 0.5
      ? "text-green-400"
      : fraction > 0.25
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <div className="w-full space-y-1">
      {/* Timer number */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          Choose your action!
        </span>
        <span className={`text-lg font-black tabular-nums ${textColor}`}>
          {displayNumber}
        </span>
      </div>

      {/* Shrinking bar */}
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-none`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
