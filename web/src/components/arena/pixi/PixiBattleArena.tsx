"use client";

// PixiJS v8 WebGL battle arena — the spectacular-effects replacement for the
// DOM/CSS KiAuraArena. React owns the UI; this canvas owns only the fight.
//
// Driven imperatively: the mount effect builds the scene + stores a trigger in
// a ref; a second effect fires it whenever the `effect` prop's nonce changes.
// All PixiJS v8 API shapes are source-verified (see DR-17).

import { useEffect, useRef } from "react";
import { Application, Assets, Sprite, Container, type Ticker } from "pixi.js";
import { GlowFilter } from "pixi-filters";
import { GlowEmitter, makeGlowTexture } from "./particles";
import { triggerEffect, type EffectKind, type Side, type FxContext } from "./effects";

export interface ArenaEffect {
  kind: EffectKind;
  side: Side;
  /** Bump this to re-fire the same effect. */
  nonce: number;
}

interface PixiBattleArenaProps {
  playerSrc: string;
  enemySrc: string;
  playerColor: number;
  enemyColor: number;
  effect?: ArenaEffect | null;
  className?: string;
}

export default function PixiBattleArena({
  playerSrc,
  enemySrc,
  playerColor,
  enemyColor,
  effect,
  className,
}: PixiBattleArenaProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<((kind: EffectKind, side: Side) => void) | null>(null);

  // ── Mount: build the Pixi app + scene, expose the trigger ───────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let destroyed = false;
    let app: Application | null = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const instance = new Application();
      await instance.init({
        resizeTo: host,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        preference: "webgl", // WKWebView has no WebGPU — never auto-detect
        powerPreference: "high-performance",
        antialias: false,
        backgroundAlpha: 0,
      });
      if (destroyed) {
        instance.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
        return;
      }
      app = instance;
      host.appendChild(app.canvas);

      // Layers (back → front): ambient → fighters → fx/particles
      const ambientLayer = new Container();
      const fighterLayer = new Container();
      const fxLayer = new Container();
      app.stage.addChild(ambientLayer, fighterLayer, fxLayer);

      const glowTex = makeGlowTexture(64);
      const emitter = new GlowEmitter(glowTex);
      fxLayer.addChild(emitter.container);

      // Ambient drifting embers for atmosphere (cheap, always alive).
      const ambient = new GlowEmitter(glowTex);
      ambientLayer.addChild(ambient.container);
      ambient.container.alpha = 0.5;

      // Load fighters.
      const [playerTex, enemyTex] = await Promise.all([
        Assets.load(playerSrc),
        Assets.load(enemySrc),
      ]);
      if (destroyed || !app) return;

      const player = new Sprite(playerTex);
      player.anchor.set(0.5, 1);
      fighterLayer.addChild(player);

      const enemy = new Sprite(enemyTex);
      enemy.anchor.set(0.5, 1);
      fighterLayer.addChild(enemy);

      // Persistent gentle aura so the fighters always feel "charged".
      player.filters = [new GlowFilter({ distance: 8, outerStrength: 1.2, color: playerColor, quality: 0.4 })];
      enemy.filters = [new GlowFilter({ distance: 8, outerStrength: 1.2, color: enemyColor, quality: 0.4 })];

      // Layout is RECOMPUTED on every resize, not just at init. With
      // resizeTo:host the canvas changes size (responsive breakpoints,
      // layout shift, hydration) — if we positioned/scaled once, fighters
      // would drift off or shrink. groundY is mutable so the idle-bob ticker
      // always reads the current ground.
      let groundY = app.screen.height * 0.93;
      const layout = () => {
        if (!app) return;
        const W = app.screen.width;
        const H = app.screen.height;
        groundY = H * 0.93;
        // Match the original KiAuraArena arrangement: fighters near the edges
        // at ~66% of the box height (orig was 176px in a 256-288px box, set
        // to the left/right with px-12 padding).
        const ps = (H * 0.66) / playerTex.height;
        player.scale.set(ps);
        player.position.set(W * 0.16, groundY);
        const es = (H * 0.66) / enemyTex.height;
        enemy.scale.set(-es, es); // mirror to face the player
        enemy.position.set(W * 0.84, groundY);
      };
      layout();
      const ro = new ResizeObserver(() => layout());
      ro.observe(host);
      resizeObserver = ro;

      const ctx: FxContext = {
        app,
        emitter,
        fxLayer,
        glowTex,
        fighters: { player, enemy },
        colors: { player: playerColor, enemy: enemyColor },
        onShake: (intensity) => {
          // Shake the DOM host (cheap, smooth) instead of the canvas content.
          host.animate(
            [
              { transform: "translate(0,0)" },
              { transform: `translate(${6 * intensity}px, ${-4 * intensity}px)` },
              { transform: `translate(${-5 * intensity}px, ${4 * intensity}px)` },
              { transform: `translate(${3 * intensity}px, ${2 * intensity}px)` },
              { transform: "translate(0,0)" },
            ],
            { duration: 220 + 120 * intensity, easing: "ease-out" },
          );
        },
      };

      // Idle bob + emitters on the ticker.
      const t0 = performance.now();
      let emberClock = 0;
      const tick = (ticker: Ticker) => {
        const dt = ticker.deltaTime;
        const t = (performance.now() - t0) / 1000;
        player.y = groundY + Math.sin(t * 1.6) * 4;
        enemy.y = groundY + Math.sin(t * 1.6 + 1) * 4;
        emitter.update(ticker);
        // ambient embers: a few rising motes
        emberClock += dt;
        if (emberClock > 6) {
          emberClock = 0;
          ambient.spawn({
            x: Math.random() * app!.screen.width,
            y: app!.screen.height + 10,
            vy: -0.6 - Math.random() * 0.6,
            maxLife: 220, scale: 0.25 + Math.random() * 0.2,
            sway: 18, tint: 0x4466aa, alpha: 0.6, scaleDecay: 0.999,
          });
        }
        ambient.update(ticker);
      };
      app.ticker.add(tick);

      triggerRef.current = (kind, side) => triggerEffect(kind, ctx, side);
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
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (app) {
        app.ticker.stop();
        app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
        app = null;
      }
      void Assets.unload(playerSrc);
      void Assets.unload(enemySrc);
    };
  }, [playerSrc, enemySrc, playerColor, enemyColor]);

  // ── Fire an effect when the prop's nonce changes ────────────────────────
  useEffect(() => {
    if (effect && triggerRef.current) {
      triggerRef.current(effect.kind, effect.side);
    }
  }, [effect?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={hostRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
