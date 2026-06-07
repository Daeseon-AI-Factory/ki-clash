// The 6 signature battle effects for the PixiJS WebGL arena.
//
// Each effect drives a short, self-cleaning ticker animation: particles from
// the GlowEmitter + pixi-filters applied to the smallest possible target,
// torn down when the effect ends. Filter constructors use the v8 options-object
// style (see docs/engineering-log.md DR-17 / docs/troubleshooting.md).
//
// # CORE_CANDIDATE — effect choreography for any Pixi v8 fighting arena.

import {
  Application,
  Container,
  Sprite,
  Texture,
  ColorMatrixFilter,
} from "pixi.js";
import {
  GlowFilter,
  ShockwaveFilter,
  RGBSplitFilter,
  AdvancedBloomFilter,
} from "pixi-filters";
import {
  GlowEmitter,
  burstSpawn,
  vortexSpawn,
  risingSpawn,
} from "./particles";

export type EffectKind =
  | "charge"
  | "attack"
  | "energy_wave"
  | "teleport"
  | "block"
  | "finisher";

export type Side = "player" | "enemy";

export interface FxContext {
  app: Application;
  emitter: GlowEmitter;
  /** Container the screen-wide filters (shockwave/RGB split) attach to. */
  fxLayer: Container;
  /** Shared soft-glow texture (for the beam sprite). */
  glowTex: Texture;
  fighters: { player: Sprite; enemy: Sprite };
  colors: { player: number; enemy: number };
  /** Called on a big hit so React can shake the DOM wrapper. */
  onShake?: (intensity: number) => void;
}

/**
 * Run `onUpdate(progress 0..1)` each frame for `durationMs`, then `onDone`.
 * Self-removes from the ticker. The atom every effect is built from.
 */
function animate(
  app: Application,
  durationMs: number,
  onUpdate: (p: number) => void,
  onDone?: () => void,
): void {
  let elapsed = 0;
  const fn = () => {
    elapsed += app.ticker.deltaMS;
    const p = Math.min(1, elapsed / durationMs);
    onUpdate(p);
    if (p >= 1) {
      app.ticker.remove(fn);
      onDone?.();
    }
  };
  app.ticker.add(fn);
}

function centerOf(s: Sprite): { x: number; y: number } {
  // anchor is (0.5, 1) → torso is roughly half the sprite height up.
  return { x: s.x, y: s.y - s.height * 0.45 };
}

// ── CHARGE: vortex of motes spiraling in + pulsing aura ───────────────────
function fxCharge(ctx: FxContext, side: Side): void {
  const fighter = ctx.fighters[side];
  const color = ctx.colors[side];
  const c = centerOf(fighter);
  const radius = fighter.height * 0.6;

  const glow = new GlowFilter({
    distance: 16, outerStrength: 2, innerStrength: 0,
    color, quality: 0.5, alpha: 1,
  });
  fighter.filters = [glow];

  animate(ctx.app, 900, (p) => {
    // spawn vortex motes through the first 80% of the effect
    if (p < 0.85 && Math.random() < 0.9) {
      ctx.emitter.burst(3, () => vortexSpawn(c.x, c.y, radius * (1 - p * 0.4), color));
    }
    glow.outerStrength = 2 + Math.sin(p * Math.PI) * 6;
    glow.distance = 16 + Math.sin(p * Math.PI) * 14;
  }, () => {
    fighter.filters = [];
  });
}

// ── ATTACK: shockwave ring + spark burst + chromatic split + shake ────────
function fxAttack(ctx: FxContext, side: Side): void {
  const target = ctx.fighters[side === "player" ? "enemy" : "player"];
  const hit = centerOf(target);

  // spark burst at the point of impact
  ctx.emitter.burst(34, () => burstSpawn(hit.x, hit.y, 0xffd23f, 1.2));
  ctx.emitter.burst(14, () => burstSpawn(hit.x, hit.y, 0xffffff, 0.8));

  const shock = new ShockwaveFilter({
    center: { x: hit.x, y: hit.y },
    amplitude: 36, wavelength: 110, speed: 900,
    brightness: 1.2, radius: 480, time: 0,
  });
  const rgb = new RGBSplitFilter({
    red: { x: -10, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 10, y: 0 },
  });
  ctx.fxLayer.filters = [shock, rgb];
  ctx.onShake?.(1);

  // recoil the target
  const tx0 = target.x;
  const recoil = side === "player" ? 28 : -28;

  animate(ctx.app, 600, (p) => {
    shock.time = p * 0.6; // seconds; speed is px/s
    const decay = 1 - p;
    rgb.red = { x: -10 * decay, y: 0 };
    rgb.blue = { x: 10 * decay, y: 0 };
    target.x = tx0 + Math.sin(p * Math.PI) * recoil;
  }, () => {
    ctx.fxLayer.filters = [];
    target.x = tx0;
  });
}

// ── ENERGY WAVE: charging orb → plasma beam across the screen ─────────────
function fxEnergyWave(ctx: FxContext, side: Side): void {
  const attacker = ctx.fighters[side];
  const target = ctx.fighters[side === "player" ? "enemy" : "player"];
  const color = ctx.colors[side];
  const origin = centerOf(attacker);
  const dest = centerOf(target);
  const dir = Math.sign(dest.x - origin.x) || 1;

  // build the beam from a stretched glow sprite
  const beamSprite = new Sprite(ctx.glowTex);
  beamSprite.anchor.set(0, 0.5);
  beamSprite.tint = color;
  beamSprite.blendMode = "add";
  beamSprite.position.set(origin.x, origin.y);
  beamSprite.height = 4;
  beamSprite.width = 0;
  beamSprite.filters = [
    new GlowFilter({ distance: 22, outerStrength: 5, color, quality: 0.5 }),
  ];
  ctx.fxLayer.addChild(beamSprite);

  const fullLen = Math.abs(dest.x - origin.x) + 80;

  animate(ctx.app, 950, (p) => {
    // phase 1 (0-0.35): charge orb at origin; phase 2 (0.35-0.75): beam fires; phase 3: fade
    if (p < 0.35) {
      const cp = p / 0.35;
      ctx.emitter.burst(3, () => vortexSpawn(origin.x, origin.y, 70 * (1 - cp), color));
      beamSprite.width = 0;
      beamSprite.scale.y = 1 + cp * 6;
    } else if (p < 0.78) {
      const fp = (p - 0.35) / 0.43;
      beamSprite.width = fullLen * Math.min(1, fp * 1.4) * dir;
      beamSprite.scale.y = 6 + Math.sin(p * 40) * 2; // crackle thickness
      // motes streaming along the beam
      ctx.emitter.burst(4, () =>
        risingSpawn(origin.x + fullLen * fp * dir * Math.random(), origin.y, color, 30),
      );
      if (fp > 0.5) ctx.onShake?.(0.6);
    } else {
      const ep = (p - 0.78) / 0.22;
      beamSprite.alpha = 1 - ep;
      if (ep < 0.3) ctx.emitter.burst(20, () => burstSpawn(dest.x, dest.y, color, 1.3));
    }
  }, () => {
    beamSprite.destroy();
  });
}

// ── TELEPORT: warp out (squash to a line + cyan flash) → reappear ─────────
function fxTeleport(ctx: FxContext, side: Side): void {
  const fighter = ctx.fighters[side];
  const color = 0x7cf3ff;
  const c = centerOf(fighter);
  const sx0 = fighter.scale.x;
  const sy0 = fighter.scale.y;

  const flash = new ColorMatrixFilter();
  fighter.filters = [flash];
  ctx.emitter.burst(18, () => burstSpawn(c.x, c.y, color, 0.9));

  animate(ctx.app, 280, (p) => {
    // squash horizontally to a thin bright line + brighten
    fighter.scale.x = sx0 * (1 - p);
    fighter.scale.y = sy0 * (1 + p * 0.4);
    flash.reset();
    flash.brightness(1 + p * 2.5, false);
  }, () => {
    // pop back at full size with an arrival puff
    fighter.scale.x = sx0;
    fighter.scale.y = sy0;
    fighter.filters = [];
    ctx.emitter.burst(18, () => burstSpawn(c.x, c.y, color, 0.9));
  });
}

// ── BLOCK: brief shield tint + sparse deflection sparks ───────────────────
function fxBlock(ctx: FxContext, side: Side): void {
  const fighter = ctx.fighters[side];
  const c = centerOf(fighter);
  const shield = new ColorMatrixFilter();
  fighter.filters = [shield];
  ctx.emitter.burst(10, () => burstSpawn(c.x, c.y, 0x66ddff, 0.7));

  animate(ctx.app, 360, (p) => {
    shield.reset();
    const k = Math.sin(p * Math.PI);
    // bluish tint pulse
    shield.tint(0x66ddff, false);
    shield.brightness(1 + k * 0.6, true);
  }, () => {
    fighter.filters = [];
  });
}

// ── FINISHER: massive multi-burst explosion + bloom + chroma + big shake ──
function fxFinisher(ctx: FxContext, side: Side): void {
  const loser = ctx.fighters[side === "player" ? "enemy" : "player"];
  const color = ctx.colors[side];
  const c = centerOf(loser);

  const bloom = new AdvancedBloomFilter({
    threshold: 0.3, bloomScale: 0.6, brightness: 1.2, blur: 8, quality: 5,
  });
  const rgb = new RGBSplitFilter({
    red: { x: -14, y: 2 }, green: { x: 0, y: 0 }, blue: { x: 14, y: -2 },
  });
  ctx.fxLayer.filters = [bloom, rgb];
  ctx.onShake?.(1.5);

  // pre-warm: three explosion waves
  ctx.emitter.burst(60, () => burstSpawn(c.x, c.y, color, 1.6));
  ctx.emitter.burst(30, () => burstSpawn(c.x, c.y, 0xffffff, 1.2));

  const lx0 = loser.x;
  const dir = side === "player" ? 1 : -1;

  animate(ctx.app, 1400, (p) => {
    bloom.bloomScale = 0.6 + Math.sin(p * Math.PI) * 2.4;
    bloom.brightness = 1.2 + Math.sin(p * Math.PI) * 0.8;
    const decay = 1 - p;
    rgb.red = { x: -14 * decay, y: 2 * decay };
    rgb.blue = { x: 14 * decay, y: -2 * decay };
    // second + third explosion waves
    if (p > 0.25 && p < 0.28) ctx.emitter.burst(50, () => burstSpawn(c.x, c.y, color, 1.4));
    if (p > 0.5 && p < 0.53) ctx.emitter.burst(40, () => burstSpawn(c.x, c.y, 0xffaa33, 1.5));
    // rising debris
    if (p < 0.7 && Math.random() < 0.6) ctx.emitter.burst(2, () => risingSpawn(c.x, c.y, color, 90));
    // knock the loser flying
    loser.x = lx0 + p * 120 * dir;
    loser.alpha = Math.max(0, 1 - p * 1.1);
    loser.rotation = p * 0.6 * dir;
  }, () => {
    ctx.fxLayer.filters = [];
    loser.x = lx0;
    loser.alpha = 1;
    loser.rotation = 0;
  });
}

const DISPATCH: Record<EffectKind, (ctx: FxContext, side: Side) => void> = {
  charge: fxCharge,
  attack: fxAttack,
  energy_wave: fxEnergyWave,
  teleport: fxTeleport,
  block: fxBlock,
  finisher: fxFinisher,
};

export function triggerEffect(kind: EffectKind, ctx: FxContext, side: Side): void {
  DISPATCH[kind]?.(ctx, side);
}
