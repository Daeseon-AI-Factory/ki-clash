"use client";

// Client boundary carrying ssr:false — PixiJS touches window/canvas/
// devicePixelRatio and must never run on the server. Next 16 App Router
// forbids ssr:false dynamic imports inside Server Components, so this
// 'use client' wrapper is the seam.

import dynamic from "next/dynamic";

// Type-only re-export (erased at build time, no SSR concern).
export type { ArenaEffect } from "./PixiBattleArena";

const PixiBattleArena = dynamic(() => import("./PixiBattleArena"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
      loading arena…
    </div>
  ),
});

export default PixiBattleArena;
