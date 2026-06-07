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

// ── ENERGY WAVE: kamehameha-class beam — charge orb → 3-layer plasma beam
//    → screen-white flash → impact shockwave. The signature "ult". ─────────
function fxEnergyWave(ctx: FxContext, side: Side): void {
  const attacker = ctx.fighters[side];
  const target = ctx.fighters[side === "player" ? "enemy" : "player"];
  const color = ctx.colors[side];
  const origin = centerOf(attacker);
  const dest = centerOf(target);
  const dir = Math.sign(dest.x - origin.x) || 1;
  const H = ctx.app.screen.height;
  const fullLen = Math.abs(dest.x - origin.x) + 90;

  // 3 stacked additive beam layers: outer halo → colored mid → white-hot core.
  const mkLayer = (h: number, tint: number, glow?: GlowFilter): Sprite => {
    const s = new Sprite(ctx.glowTex);
    s.anchor.set(0, 0.5);
    s.tint = tint;
    s.blendMode = "add";
    s.position.set(origin.x, origin.y);
    s.width = 0;
    s.height = h;
    s.visible = false;
    if (glow) s.filters = [glow];
    ctx.fxLayer.addChild(s);
    return s;
  };
  const halo = mkLayer(H * 0.17, color, new GlowFilter({ distance: 40, outerStrength: 8, color, quality: 0.4 }));
  const mid = mkLayer(H * 0.09, color);
  const core = mkLayer(H * 0.035, 0xffffff);
  const layers = [halo, mid, core];

  // charge-up muzzle orb
  const orb = new Sprite(ctx.glowTex);
  orb.anchor.set(0.5);
  orb.tint = color;
  orb.blendMode = "add";
  orb.position.set(origin.x, origin.y);
  orb.scale.set(0.4);
  const orbGlow = new GlowFilter({ distance: 16, outerStrength: 2, color, quality: 0.4 });
  orb.filters = [orbGlow];
  ctx.fxLayer.addChild(orb);

  // full-screen white-out flash (added at release)
  const flash = new Sprite(ctx.glowTex);
  flash.anchor.set(0.5);
  flash.blendMode = "add";
  flash.position.set(ctx.app.screen.width / 2, H / 2);
  flash.width = ctx.app.screen.width * 1.4;
  flash.height = H * 1.4;
  flash.alpha = 0;
  ctx.fxLayer.addChild(flash);

  let impacted = false;
  let shock: ShockwaveFilter | null = null;
  const tx0 = target.x;

  animate(ctx.app, 1500, (p) => {
    if (p < 0.3) {
      // CHARGE: orb inhales energy
      const cp = p / 0.3;
      ctx.emitter.burst(8, () => vortexSpawn(origin.x, origin.y, 95 * (1 - cp), color));
      orb.scale.set(0.4 + cp * 1.8);
      orbGlow.outerStrength = 2 + cp * 12;
      if (p > 0.27) ctx.onShake?.(0.3);
    } else if (p < 0.82) {
      // FIRE: beam extends, crackles, streams motes
      const fp = (p - 0.3) / 0.52;
      const reach = Math.min(1, fp * 1.5);
      orb.scale.set(2.2 * (1 - fp * 0.4));
      // release flash
      if (p < 0.42) flash.alpha = Math.max(0, 0.85 * (1 - (p - 0.3) / 0.12));
      for (let i = 0; i < layers.length; i++) {
        const s = layers[i];
        s.visible = true;
        s.width = fullLen * reach * dir;
        const baseH = [H * 0.17, H * 0.09, H * 0.035][i];
        const wob = 1 + Math.sin(p * 60 + i * 2) * 0.35; // electric crackle
        s.height = baseH * wob;
      }
      // dense streaming motes along the live beam
      ctx.emitter.burst(14, () =>
        risingSpawn(
          origin.x + fullLen * Math.random() * reach * dir,
          origin.y + (Math.random() - 0.5) * H * 0.12,
          color,
          24,
        ),
      );
      // impact when the head lands
      if (reach >= 0.98 && !impacted) {
        impacted = true;
        ctx.emitter.burst(48, () => burstSpawn(dest.x, dest.y, color, 1.6));
        ctx.emitter.burst(24, () => burstSpawn(dest.x, dest.y, 0xffffff, 1.2));
        shock = new ShockwaveFilter({
          center: { x: dest.x, y: dest.y },
          amplitude: 30, wavelength: 120, speed: 900, radius: 460, time: 0,
        });
        ctx.fxLayer.filters = [shock];
        ctx.onShake?.(1.0);
      }
      if (impacted) {
        const sp = Math.min(1, (p - 0.5) / 0.32);
        if (shock) shock.time = sp * 0.6;
        target.x = tx0 + Math.sin(sp * Math.PI) * 30 * dir;
      }
    } else {
      // FADE
      const ep = (p - 0.82) / 0.18;
      for (const s of layers) s.alpha = 1 - ep;
      orb.alpha = 1 - ep;
    }
  }, () => {
    for (const s of layers) s.destroy();
    orb.destroy();
    flash.destroy();
    ctx.fxLayer.filters = [];
    target.x = tx0;
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
