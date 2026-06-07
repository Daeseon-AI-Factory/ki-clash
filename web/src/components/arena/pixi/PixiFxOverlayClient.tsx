"use client";

// ssr:false wrapper for the transparent WebGL effect overlay (Pixi is
// client-only). Layered over KiAuraArena — additive, motion untouched.

import dynamic from "next/dynamic";

export type { OverlayEffect } from "./PixiFxOverlay";

const PixiFxOverlay = dynamic(() => import("./PixiFxOverlay"), {
  ssr: false,
  loading: () => null,
});

export default PixiFxOverlay;
