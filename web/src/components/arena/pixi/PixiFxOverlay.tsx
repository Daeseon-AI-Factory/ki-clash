"use client";

// Transparent WebGL effect overlay — layered ON TOP of the dynamic DOM
// KiAuraArena. Renders ONLY particles/beams (no fighters, no background), so
// the arena underneath keeps ALL its character motion. This is the additive
// approach: enhance by composition, never replace (see engineering-log DR-18).
//
// Anchor-based: effects spawn at the left/right fighter anchors (recomputed on
// resize), so we don't need Pixi fighter sprites at all.

import { useEffect, useRef } from "react";
import { Application, Sprite, Container, type Ticker } from "pixi.js";
import { GlowFilter } from "pixi-filters";
import {
  GlowEmitter,
  makeGlowTexture,
  vortexSpawn,
  burstSpawn,
  risingSpawn,
} from "./particles";

export type FxKind =
  | "charge"
  | "attack"
  | "energy_wave"
  | "teleport"
  | "block"
  | "finisher";
export type FxSide = "player" | "enemy";

export interface OverlayEffect {
  kind: FxKind;
  side: FxSide;
  nonce: number;
}

interface PixiFxOverlayProps {
  playerColor: number;
  enemyColor: number;
  effect?: OverlayEffect | null;
  className?: string;
}

export default function PixiFxOverlay({
  playerColor,
  enemyColor,
  effect,
  className,
}: PixiFxOverlayProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<((kind: FxKind, side: FxSide) => void) | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let destroyed = false;
    let app: Application | null = null;
    let ro: ResizeObserver | null = null;

    // Race-safe firing: the effect prop can change before async init finishes
    // (this overlay may mount on the same tick the reveal fires). Queue until
    // ready, then drain — so no effect is dropped.
    const pending: Array<[FxKind, FxSide]> = [];
    let fireFn: ((k: FxKind, s: FxSide) => void) | null = null;
    triggerRef.current = (k, s) => (fireFn ? fireFn(k, s) : pending.push([k, s]));

    (async () => {
      const instance = new Application();
      await instance.init({
        resizeTo: host,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        preference: "webgl",
        powerPreference: "high-performance",
        antialias: false,
        backgroundAlpha: 0, // fully transparent — DOM arena shows through
      });
      if (destroyed) {
        instance.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
        return;
      }
      app = instance;
      host.appendChild(app.canvas);

      const fxLayer = new Container();
      app.stage.addChild(fxLayer);
      const glowTex = makeGlowTexture(64);
      const emitter = new GlowEmitter(glowTex);
      fxLayer.addChild(emitter.container);

      // Fighter anchors (torso height), recomputed on resize.
      const anchor = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
      const layout = () => {
        if (!app) return;
        const W = app.screen.width;
        const H = app.screen.height;
        anchor.left = { x: W * 0.18, y: H * 0.5 };
        anchor.right = { x: W * 0.82, y: H * 0.5 };
      };
      layout();
      ro = new ResizeObserver(() => layout());
      ro.observe(host);

      app.ticker.add((t: Ticker) => emitter.update(t));

      // Self-cleaning timed animation atom.
      const animate = (durationMs: number, onUpdate: (p: number) => void, onDone?: () => void) => {
        let elapsed = 0;
        const fn = () => {
          if (!app) return;
          elapsed += app.ticker.deltaMS;
          const p = Math.min(1, elapsed / durationMs);
          onUpdate(p);
          if (p >= 1) {
            app.ticker.remove(fn);
            onDone?.();
          }
        };
        app!.ticker.add(fn);
      };

      const shake = (intensity: number) => {
        host.animate(
          [
            { transform: "translate(0,0)" },
            { transform: `translate(${5 * intensity}px,${-3 * intensity}px)` },
            { transform: `translate(${-4 * intensity}px,${3 * intensity}px)` },
            { transform: "translate(0,0)" },
          ],
          { duration: 200 + 100 * intensity, easing: "ease-out" },
        );
      };

      // ── Anchor-based effects (particles only) ──────────────────────────
      const fx: Record<FxKind, (side: FxSide) => void> = {
        charge: (side) => {
          const a = side === "player" ? anchor.left : anchor.right;
          const color = side === "player" ? playerColor : enemyColor;
          animate(850, (p) => {
            if (p < 0.85)
              emitter.burst(5, () => vortexSpawn(a.x, a.y, 70 * (1 - p * 0.5), color));
          });
        },
        attack: (side) => {
          const tgt = side === "player" ? anchor.right : anchor.left;
          emitter.burst(30, () => burstSpawn(tgt.x, tgt.y, 0xffd23f, 1.1));
          emitter.burst(12, () => burstSpawn(tgt.x, tgt.y, 0xffffff, 0.8));
          shake(0.8);
        },
        energy_wave: (side) => {
          const a = side === "player" ? anchor.left : anchor.right;
          const tgt = side === "player" ? anchor.right : anchor.left;
          const color = side === "player" ? playerColor : enemyColor;
          const dir = Math.sign(tgt.x - a.x) || 1;
          const len = Math.abs(tgt.x - a.x);
          const beam = new Sprite(glowTex);
          beam.anchor.set(0, 0.5);
          beam.tint = color;
          beam.blendMode = "add";
          beam.position.set(a.x, a.y);
          beam.height = 0;
          beam.width = 0;
          beam.filters = [new GlowFilter({ distance: 26, outerStrength: 6, color, quality: 0.4 })];
          fxLayer.addChild(beam);
          let hit = false;
          animate(1100, (p) => {
            if (p < 0.3) {
              emitter.burst(6, () => vortexSpawn(a.x, a.y, 60 * (1 - p / 0.3), color));
              beam.height = (app!.screen.height * 0.06) * (p / 0.3);
            } else if (p < 0.8) {
              const fp = (p - 0.3) / 0.5;
              beam.width = len * Math.min(1, fp * 1.5) * dir;
              beam.height = app!.screen.height * 0.06 * (1 + Math.sin(p * 50) * 0.3);
              emitter.burst(10, () =>
                risingSpawn(a.x + len * Math.random() * dir, a.y, color, 20),
              );
              if (fp > 0.6 && !hit) {
                hit = true;
                emitter.burst(40, () => burstSpawn(tgt.x, tgt.y, color, 1.4));
                emitter.burst(18, () => burstSpawn(tgt.x, tgt.y, 0xffffff, 1.0));
                shake(1.0);
              }
            } else {
              beam.alpha = 1 - (p - 0.8) / 0.2;
            }
          }, () => beam.destroy());
        },
        teleport: (side) => {
          const a = side === "player" ? anchor.left : anchor.right;
          emitter.burst(22, () => burstSpawn(a.x, a.y, 0x7cf3ff, 0.9));
        },
        block: (side) => {
          const a = side === "player" ? anchor.left : anchor.right;
          emitter.burst(12, () => burstSpawn(a.x, a.y, 0x66ddff, 0.7));
        },
        finisher: (side) => {
          const tgt = side === "player" ? anchor.right : anchor.left;
          const color = side === "player" ? playerColor : enemyColor;
          emitter.burst(70, () => burstSpawn(tgt.x, tgt.y, color, 1.6));
          emitter.burst(30, () => burstSpawn(tgt.x, tgt.y, 0xffffff, 1.2));
          shake(1.4);
          animate(900, (p) => {
            if (p < 0.6 && Math.random() < 0.5)
              emitter.burst(3, () => risingSpawn(tgt.x, tgt.y, color, 80));
          });
        },
      };

      // Now ready — wire the real fire fn and drain anything queued pre-init.
      fireFn = (kind, side) => fx[kind]?.(side);
      for (const [k, s] of pending) fireFn(k, s);
      pending.length = 0;
    })();

    const onVis = () => {
      if (!app) return;
      if (document.hidden) app.ticker.stop();
      else app.ticker.start();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      destroyed = true;
      triggerRef.current = null;
      document.removeEventListener("visibilitychange", onVis);
      if (ro) { ro.disconnect(); ro = null; }
      if (app) {
        app.ticker.stop();
        app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
        app = null;
      }
    };
  }, [playerColor, enemyColor]);

  useEffect(() => {
    if (effect && triggerRef.current) triggerRef.current(effect.kind, effect.side);
  }, [effect?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={hostRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
