"use client";

/**
 * Animated "AI is analyzing..." indicator with 3 pulsing dots.
 *
 * Each dot has a staggered animation-delay so they pulse in sequence,
 * creating a "thinking" wave effect. Uses inline styles for the delays
 * since Tailwind doesn't support per-element delay easily.
 */
export default function AIThinking() {
  return (
    <div className="flex items-center gap-1.5 justify-center py-1">
      <span className="text-xs text-gray-500 italic">AI is analyzing</span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
