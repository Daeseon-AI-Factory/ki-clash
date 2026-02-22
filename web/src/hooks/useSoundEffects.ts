"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SoundName =
  | "countdown_beat"
  | "reveal"
  | "hit"
  | "clash"
  | "block"
  | "dodge"
  | "charge"
  | "round_win"
  | "round_lose";

const MUTE_KEY = "ki-clash-mute";

/**
 * Procedural sound engine using Web Audio API.
 *
 * Every sound is synthesized from oscillators + noise — no external MP3 files.
 * AudioContext is created lazily on first play (browsers require user gesture).
 * Mute state persisted in localStorage.
 */
export function useSoundEffects() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);

  // Restore mute preference on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setMuted(localStorage.getItem(MUTE_KEY) === "true");
    }
  }, []);

  /** Get or create AudioContext (lazy — needs user gesture) */
  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    // Resume if suspended (happens after tab switch)
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  /** Create a white noise buffer */
  const createNoise = useCallback(
    (ctx: AudioContext, duration: number): AudioBuffer => {
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    },
    []
  );

  const play = useCallback(
    (name: SoundName) => {
      if (muted) return;

      const ctx = getCtx();
      const now = ctx.currentTime;

      switch (name) {
        case "countdown_beat": {
          // Short click — white noise burst, 50ms
          const source = ctx.createBufferSource();
          source.buffer = createNoise(ctx, 0.05);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          source.connect(gain).connect(ctx.destination);
          source.start(now);
          source.stop(now + 0.05);
          break;
        }

        case "reveal": {
          // Rising sweep — oscillator 200→800Hz, 300ms
          const osc = ctx.createOscillator();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }

        case "hit": {
          // Bass impact — sine 80Hz + noise burst, 200ms
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(80, now);
          const oscGain = ctx.createGain();
          oscGain.gain.setValueAtTime(0.4, now);
          oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.connect(oscGain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.2);

          const noise = ctx.createBufferSource();
          noise.buffer = createNoise(ctx, 0.1);
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.3, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          noise.connect(noiseGain).connect(ctx.destination);
          noise.start(now);
          noise.stop(now + 0.1);
          break;
        }

        case "clash": {
          // Metallic ring — square wave 400Hz with decay, 300ms
          const osc = ctx.createOscillator();
          osc.type = "square";
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }

        case "block": {
          // Dull thud — sine 120Hz, quick decay, 100ms
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(120, now);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case "dodge": {
          // Whoosh — filtered noise sweep, 200ms
          const noise = ctx.createBufferSource();
          noise.buffer = createNoise(ctx, 0.2);
          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(500, now);
          filter.frequency.exponentialRampToValueAtTime(4000, now + 0.2);
          filter.Q.value = 2;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          noise.connect(filter).connect(gain).connect(ctx.destination);
          noise.start(now);
          noise.stop(now + 0.2);
          break;
        }

        case "charge": {
          // Power hum — sine 200Hz with vibrato, 300ms
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(200, now);
          // Vibrato via LFO
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 8;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 15;
          lfo.connect(lfoGain).connect(osc.frequency);
          lfo.start(now);
          lfo.stop(now + 0.3);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.setValueAtTime(0.15, now + 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }

        case "round_win": {
          // Ascending arpeggio — 3 quick notes, 500ms
          [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.value = freq;
            const gain = ctx.createGain();
            const t = now + i * 0.15;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.15);
          });
          break;
        }

        case "round_lose": {
          // Descending arpeggio — 3 notes, 500ms
          [392.0, 311.13, 261.63].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.value = freq;
            const gain = ctx.createGain();
            const t = now + i * 0.15;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.2);
          });
          break;
        }
      }
    },
    [muted, getCtx, createNoise]
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTE_KEY, String(next));
      return next;
    });
  }, []);

  return { play, muted, toggleMute };
}
