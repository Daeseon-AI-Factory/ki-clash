// Particle engine for the PixiJS WebGL battle arena.
//
// Pooled-Sprite emitter (recycle, never destroy → no GC stutter), additive
// blending per sprite for glow, one shared soft-round texture. Built against
// the source-verified PixiJS v8.19 API (see docs/engineering-log.md DR-17).
//
// # CORE_CANDIDATE — reusable particle system for any Pixi v8 canvas.

import { Container, Sprite, Texture, type Ticker } from "pixi.js";

/**
 * A soft white radial-gradient dot, generated at runtime from a 2D canvas
 * (sidesteps the version-sensitive FillGradient API). White core so a
 * per-particle `tint` colorizes it. Reused across every particle.
 */
export function makeGlowTexture(size = 64): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.95)");
  g.addColorStop(0.55, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  return Texture.from(c);
}

export interface SpawnConfig {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  gravity?: number;
  drag?: number;
  spin?: number;
  maxLife?: number;
  scale?: number;
  scaleDecay?: number;
  tint?: number;
  /** Optional per-particle horizontal sine sway (amplitude px). */
  sway?: number;
  alpha?: number;
}

interface PParticle {
  sprite: Sprite;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  spin: number;
  life: number;
  maxLife: number;
  scaleDecay: number;
  baseX: number;
  sway: number;
  phase: number;
  alpha0: number;
}

/**
 * Object-pooled additive particle emitter. Add `emitter.container` to the
 * stage once; drive with `app.ticker.add((t) => emitter.update(t))`.
 */
export class GlowEmitter {
  readonly container: Container;
  private readonly tex: Texture;
  private readonly pool: PParticle[] = [];
  private readonly live: PParticle[] = [];
  private clock = 0;

  constructor(tex: Texture) {
    this.tex = tex;
    this.container = new Container();
  }

  /** Frames-elapsed accumulator (for sway phase). */
  get now(): number {
    return this.clock;
  }

  get liveCount(): number {
    return this.live.length;
  }

  private acquire(): PParticle {
    const p = this.pool.pop();
    if (p) {
      p.sprite.visible = true;
      return p;
    }
    const sprite = new Sprite(this.tex);
    sprite.anchor.set(0.5);
    sprite.blendMode = "add"; // additive glow (v8 string union)
    this.container.addChild(sprite);
    return {
      sprite, vx: 0, vy: 0, gravity: 0, drag: 1, spin: 0,
      life: 0, maxLife: 1, scaleDecay: 1, baseX: 0, sway: 0, phase: 0, alpha0: 1,
    };
  }

  spawn(cfg: SpawnConfig): void {
    const p = this.acquire();
    const s = p.sprite;
    s.position.set(cfg.x, cfg.y);
    s.scale.set(cfg.scale ?? 1);
    p.alpha0 = cfg.alpha ?? 1;
    s.alpha = p.alpha0;
    s.rotation = Math.random() * Math.PI * 2;
    s.tint = cfg.tint ?? 0xffffff;
    p.vx = cfg.vx ?? 0;
    p.vy = cfg.vy ?? 0;
    p.gravity = cfg.gravity ?? 0;
    p.drag = cfg.drag ?? 1;
    p.spin = cfg.spin ?? 0;
    p.maxLife = cfg.maxLife ?? 60;
    p.life = p.maxLife;
    p.scaleDecay = cfg.scaleDecay ?? 1;
    p.baseX = cfg.x;
    p.sway = cfg.sway ?? 0;
    p.phase = Math.random() * Math.PI * 2;
    this.live.push(p);
  }

  /** Spawn `n` particles, each built fresh from `factory` (jitter per call). */
  burst(n: number, factory: () => SpawnConfig): void {
    for (let i = 0; i < n; i++) this.spawn(factory());
  }

  update(ticker: Ticker): void {
    const dt = ticker.deltaTime;
    this.clock += dt;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      const s = p.sprite;
      p.vy += p.gravity * dt;
      const dragF = Math.pow(p.drag, dt);
      p.vx *= dragF;
      p.vy *= dragF;
      p.baseX += p.vx * dt;
      s.y += p.vy * dt;
      s.x = p.sway
        ? p.baseX + Math.sin(this.clock * 0.12 + p.phase) * p.sway
        : p.baseX;
      s.rotation += p.spin * dt;
      const sd = Math.pow(p.scaleDecay, dt);
      s.scale.x *= sd;
      s.scale.y *= sd;
      p.life -= dt;
      s.alpha = Math.max(0, (p.life / p.maxLife)) * p.alpha0;
      if (p.life <= 0) {
        s.visible = false;
        this.live.splice(i, 1);
        this.pool.push(p);
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.pool.length = 0;
    this.live.length = 0;
  }
}

// ── Emission patterns ────────────────────────────────────────────────────

/** CONVERGING vortex — spawn on a ring, spiral INTO the center (charge). */
export function vortexSpawn(cx: number, cy: number, radius: number, tint: number): SpawnConfig {
  const a = Math.random() * Math.PI * 2;
  const inward = -1.9;
  const swirl = 2.8;
  return {
    x: cx + Math.cos(a) * radius,
    y: cy + Math.sin(a) * radius,
    vx: Math.cos(a) * inward + -Math.sin(a) * swirl,
    vy: Math.sin(a) * inward + Math.cos(a) * swirl,
    drag: 0.97,
    maxLife: 40 + Math.random() * 15,
    scale: 0.5 + Math.random() * 0.4,
    scaleDecay: 0.985,
    tint,
  };
}

/** RADIAL burst — fly OUT with drag + light gravity (impact). */
export function burstSpawn(cx: number, cy: number, tint: number, power = 1): SpawnConfig {
  const a = Math.random() * Math.PI * 2;
  const speed = (5 + Math.random() * 9) * power;
  return {
    x: cx,
    y: cy,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    drag: 0.9,
    gravity: 0.18,
    spin: (Math.random() - 0.5) * 0.5,
    maxLife: 28 + Math.random() * 18,
    scale: (0.45 + Math.random() * 0.5) * power,
    scaleDecay: 0.95,
    tint,
  };
}

/** RISING stream — drift up with a sine sway (plasma / energy wave). */
export function risingSpawn(baseX: number, baseY: number, tint: number, spread = 40): SpawnConfig {
  return {
    x: baseX + (Math.random() - 0.5) * spread,
    y: baseY + (Math.random() - 0.5) * 20,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -2.2 - Math.random() * 1.6,
    gravity: -0.015,
    maxLife: 55 + Math.random() * 25,
    scale: 0.4 + Math.random() * 0.4,
    scaleDecay: 0.99,
    sway: 12 + Math.random() * 14,
    tint,
  };
}
