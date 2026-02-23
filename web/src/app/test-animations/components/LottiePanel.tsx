"use client";

import { useMemo } from "react";
import Lottie from "lottie-react";
import { AnimationPanel } from "./AnimationPanel";
import type { AnimationAction, AnimationPhase } from "./types";

/**
 * Style 2: Lottie JSON
 *
 * Uses lottie-react to render simple inline Lottie animations.
 * Fighter shapes are defined as minimal Lottie JSON (circle head + rect body).
 * Different actions swap the animationData to play different sequences.
 *
 * This demonstrates the Lottie pipeline — in production you'd use
 * proper After Effects → Bodymovin exports or LottieFiles assets.
 */

/**
 * Generate a minimal Lottie JSON for a simple character shape.
 *
 * Lottie format: a shape layer with circle (head) + rect (body),
 * looping with a gentle vertical bob for idle animation.
 *
 * The "bob" effect comes from a Y-axis transform keyframe that
 * oscillates between 0 and -5 over the duration.
 */
function createFighterLottie(color: string, bobOffset: number = 0) {
  // Convert hex to RGB array for Lottie color format [r, g, b] in 0-1 range
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;

  return {
    v: "5.7.0",
    fr: 30,
    ip: 0,
    op: 60, // 2 second loop at 30fps
    w: 100,
    h: 140,
    layers: [
      {
        ty: 4, // shape layer
        nm: "fighter",
        ip: 0,
        op: 60,
        st: 0,
        ks: {
          o: { a: 0, k: 100 }, // opacity
          r: { a: 0, k: 0 }, // rotation
          p: {
            // position with bob animation
            a: 1,
            k: [
              {
                t: 0 + bobOffset,
                s: [50, 70, 0],
                to: [0, -1, 0],
                ti: [0, 0, 0],
              },
              {
                t: 15 + bobOffset,
                s: [50, 65, 0],
                to: [0, 0, 0],
                ti: [0, -1, 0],
              },
              {
                t: 30 + bobOffset,
                s: [50, 70, 0],
                to: [0, -1, 0],
                ti: [0, 0, 0],
              },
              {
                t: 45 + bobOffset,
                s: [50, 65, 0],
                to: [0, 0, 0],
                ti: [0, -1, 0],
              },
              {
                t: 60,
                s: [50, 70, 0],
              },
            ],
          },
          a: { a: 0, k: [0, 0, 0] }, // anchor
          s: { a: 0, k: [100, 100, 100] }, // scale
        },
        shapes: [
          // Head (circle)
          {
            ty: "gr",
            it: [
              {
                ty: "el",
                p: { a: 0, k: [0, -30] },
                s: { a: 0, k: [30, 30] },
              },
              {
                ty: "fl",
                c: { a: 0, k: [r, g, b, 1] },
                o: { a: 0, k: 100 },
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
          // Body (rectangle)
          {
            ty: "gr",
            it: [
              {
                ty: "rc",
                p: { a: 0, k: [0, 5] },
                s: { a: 0, k: [24, 40] },
                r: { a: 0, k: 4 },
              },
              {
                ty: "fl",
                c: { a: 0, k: [r * 0.8, g * 0.8, b * 0.8, 1] },
                o: { a: 0, k: 100 },
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
          // Left arm
          {
            ty: "gr",
            it: [
              {
                ty: "rc",
                p: { a: 0, k: [-20, 0] },
                s: { a: 0, k: [16, 8] },
                r: { a: 0, k: 3 },
              },
              {
                ty: "fl",
                c: { a: 0, k: [r, g, b, 1] },
                o: { a: 0, k: 100 },
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
          // Right arm
          {
            ty: "gr",
            it: [
              {
                ty: "rc",
                p: { a: 0, k: [20, 0] },
                s: { a: 0, k: [16, 8] },
                r: { a: 0, k: 3 },
              },
              {
                ty: "fl",
                c: { a: 0, k: [r, g, b, 1] },
                o: { a: 0, k: 100 },
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
          // Legs
          {
            ty: "gr",
            it: [
              {
                ty: "rc",
                p: { a: 0, k: [-8, 35] },
                s: { a: 0, k: [10, 24] },
                r: { a: 0, k: 3 },
              },
              {
                ty: "fl",
                c: { a: 0, k: [0.1, 0.1, 0.15, 1] },
                o: { a: 0, k: 100 },
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
          {
            ty: "gr",
            it: [
              {
                ty: "rc",
                p: { a: 0, k: [8, 35] },
                s: { a: 0, k: [10, 24] },
                r: { a: 0, k: 3 },
              },
              {
                ty: "fl",
                c: { a: 0, k: [0.1, 0.1, 0.15, 1] },
                o: { a: 0, k: 100 },
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Generate a simple burst/explosion Lottie for effects */
function createBurstLottie(color: string) {
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;

  return {
    v: "5.7.0",
    fr: 30,
    ip: 0,
    op: 15, // 0.5s burst
    w: 100,
    h: 100,
    layers: [
      {
        ty: 4,
        nm: "burst",
        ip: 0,
        op: 15,
        st: 0,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [100] },
              { t: 15, s: [0] },
            ],
          },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [50, 50, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              { t: 0, s: [30, 30, 100] },
              { t: 15, s: [150, 150, 100] },
            ],
          },
        },
        shapes: [
          {
            ty: "gr",
            it: [
              {
                ty: "el",
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [50, 50] },
              },
              {
                ty: "fl",
                c: { a: 0, k: [r, g, b, 1] },
                o: { a: 0, k: 80 },
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
        ],
      },
    ],
  };
}

function LottieFighter({
  color,
  name,
  side,
  action,
  phase,
  bobOffset,
}: {
  color: string;
  name: string;
  side: "left" | "right";
  action: AnimationAction | null;
  phase: AnimationPhase;
  bobOffset?: number;
}) {
  const isAttacker = side === "left";
  const animData = useMemo(
    () => createFighterLottie(color, bobOffset),
    [color, bobOffset]
  );

  const wrapperStyle: React.CSSProperties = {
    width: 70,
    height: 100,
    transition: "all 0.15s ease-out",
    transform: side === "right" ? "scaleX(-1)" : undefined,
  };

  const transforms: string[] = side === "right" ? ["scaleX(-1)"] : [];

  if (action && phase !== "idle") {
    if (action === "charge" && isAttacker) {
      if (phase === "windup" || phase === "impact") transforms.push("scale(1.2)");
      if (phase === "recover") transforms.push("scale(1.05)");
    }
    if (action === "block" && !isAttacker) {
      if (phase === "windup" || phase === "impact") transforms.push("scale(0.85)");
    }
    if (action === "attack") {
      if (isAttacker) {
        if (phase === "windup") transforms.push("translateX(-10px)");
        if (phase === "impact") transforms.push("translateX(50px)");
      } else {
        if (phase === "impact") transforms.push("translateX(10px)");
      }
    }
    if (action === "energyWave" && isAttacker) {
      if (phase === "windup") transforms.push("scale(1.15)");
      if (phase === "impact") transforms.push("scale(0.9)");
    }
    if (action === "teleport" && isAttacker) {
      if (phase === "windup") {
        wrapperStyle.opacity = 0.4;
        transforms.push("scale(0.85)");
      }
      if (phase === "impact") {
        wrapperStyle.opacity = 0;
        transforms.push("translateY(-20px) scale(0.3)");
      }
      if (phase === "recover") {
        wrapperStyle.opacity = 1;
        transforms.push("translateX(40px)");
      }
    }
  }

  wrapperStyle.transform = transforms.join(" ") || wrapperStyle.transform;

  return (
    <div className="flex flex-col items-center">
      <div style={wrapperStyle}>
        <Lottie animationData={animData} loop autoplay />
      </div>
      <span className="text-xs text-gray-400 mt-1">{name}</span>
    </div>
  );
}

/** Lottie burst effect overlay */
function BurstEffect({
  action,
  phase,
  color,
}: {
  action: AnimationAction | null;
  phase: AnimationPhase;
  color: string;
}) {
  const burstData = useMemo(() => createBurstLottie(color), [color]);

  if (phase !== "impact") return null;
  if (action !== "attack" && action !== "energyWave") return null;

  return (
    <div
      className="absolute"
      style={{
        right: "25%",
        top: "30%",
        width: 60,
        height: 60,
        zIndex: 5,
      }}
    >
      <Lottie animationData={burstData} loop={false} autoplay />
    </div>
  );
}

/** Lottie shield effect */
function ShieldEffect({
  action,
  phase,
  color,
}: {
  action: AnimationAction | null;
  phase: AnimationPhase;
  color: string;
}) {
  const shieldData = useMemo(() => {
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;

    return {
      v: "5.7.0",
      fr: 30,
      ip: 0,
      op: 30,
      w: 80,
      h: 100,
      layers: [
        {
          ty: 4,
          nm: "shield",
          ip: 0,
          op: 30,
          st: 0,
          ks: {
            o: {
              a: 1,
              k: [
                { t: 0, s: [0] },
                { t: 5, s: [70] },
                { t: 25, s: [70] },
                { t: 30, s: [0] },
              ],
            },
            r: { a: 0, k: 0 },
            p: { a: 0, k: [40, 50, 0] },
            a: { a: 0, k: [0, 0, 0] },
            s: { a: 0, k: [100, 100, 100] },
          },
          shapes: [
            {
              ty: "gr",
              it: [
                {
                  ty: "el",
                  p: { a: 0, k: [0, 0] },
                  s: { a: 0, k: [50, 70] },
                },
                {
                  ty: "st",
                  c: { a: 0, k: [r, g, b, 1] },
                  o: { a: 0, k: 100 },
                  w: { a: 0, k: 3 },
                },
                {
                  ty: "fl",
                  c: { a: 0, k: [r, g, b, 1] },
                  o: { a: 0, k: 15 },
                },
                {
                  ty: "tr",
                  p: { a: 0, k: [0, 0] },
                  a: { a: 0, k: [0, 0] },
                  s: { a: 0, k: [100, 100] },
                  r: { a: 0, k: 0 },
                  o: { a: 0, k: 100 },
                },
              ],
            },
          ],
        },
      ],
    };
  }, [color]);

  if (action !== "block" || (phase !== "windup" && phase !== "impact"))
    return null;

  return (
    <div
      className="absolute"
      style={{
        right: "20%",
        top: "20%",
        width: 50,
        height: 70,
        zIndex: 5,
      }}
    >
      <Lottie animationData={shieldData} loop={false} autoplay />
    </div>
  );
}

export function LottiePanel() {
  return (
    <AnimationPanel title="2. Lottie JSON" borderColor="#22D3EE">
      {({ action, phase }) => (
        <>
          <BurstEffect action={action} phase={phase} color="#60A5FA" />
          <ShieldEffect action={action} phase={phase} color="#C084FC" />

          <div className="flex items-center justify-around w-full px-6">
            <LottieFighter
              color="#60A5FA"
              name="Haneul"
              side="left"
              action={action}
              phase={phase}
              bobOffset={0}
            />
            <span className="text-gray-600 text-sm font-bold">VS</span>
            <LottieFighter
              color="#C084FC"
              name="Bora"
              side="right"
              action={action}
              phase={phase}
              bobOffset={8}
            />
          </div>
        </>
      )}
    </AnimationPanel>
  );
}
