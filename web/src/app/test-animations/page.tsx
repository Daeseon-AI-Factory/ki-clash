"use client";

import Link from "next/link";
import { CssSvgPanel } from "./components/CssSvgPanel";
import { LottiePanel } from "./components/LottiePanel";
import { PixelArtPanel } from "./components/PixelArtPanel";
import { EmojiEnhancedPanel } from "./components/EmojiEnhancedPanel";

/**
 * Animation Style Test Page
 *
 * 2x2 grid of animation style candidates for Ki Clash battle scenes.
 * Each panel renders the same Haneul vs Bora fight in a different style.
 * Click any of the 5 action buttons to trigger the animation.
 *
 * Purpose: Visual comparison to pick one style for production.
 * Cleanup: Delete this entire folder when a winner is chosen.
 */
export default function TestAnimationsPage() {
  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          &larr; Back to game
        </Link>
        <h1 className="text-2xl font-bold mt-2">Animation Style Test</h1>
        <p className="text-gray-400 text-sm mt-1">
          Compare 4 animation approaches. Click an action button in any panel to
          see it animate. Same fight (Haneul vs Bora), different styles.
        </p>
      </div>

      {/* 2x2 Grid — stacks to 1 column on mobile */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        <CssSvgPanel />
        <LottiePanel />
        <PixelArtPanel />
        <EmojiEnhancedPanel />
      </div>

      {/* Footer note */}
      <div className="max-w-5xl mx-auto mt-6 text-center text-xs text-gray-600">
        This page is a test — delete{" "}
        <code className="text-gray-500">web/src/app/test-animations/</code>{" "}
        when you&apos;ve picked a winner.
      </div>
    </div>
  );
}
