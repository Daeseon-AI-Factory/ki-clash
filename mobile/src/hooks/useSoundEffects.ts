/**
 * useSoundEffects — procedural sound engine for React Native.
 *
 * Generates sounds programmatically using AudioContext (via expo-av Audio.Sound
 * with WAV data URIs). Each sound is a tiny WAV buffer created once and cached.
 *
 * Falls back gracefully if audio is unavailable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import * as SecureStore from "expo-secure-store";

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
const SAMPLE_RATE = 22050;

/** Generate a WAV data URI from raw PCM samples (16-bit mono) */
function pcmToWavDataUri(samples: Int16Array): string {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2; // 16-bit mono
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Synthesize a sine wave tone */
function generateTone(
  freq: number,
  duration: number,
  volume: number = 0.3,
  decay: boolean = true
): Int16Array {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = decay ? Math.max(0, 1 - t / duration) : 1;
    samples[i] = Math.floor(
      Math.sin(2 * Math.PI * freq * t) * volume * envelope * 32767
    );
  }
  return samples;
}

/** Generate white noise */
function generateNoise(duration: number, volume: number = 0.2): Int16Array {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const envelope = Math.max(0, 1 - i / numSamples);
    samples[i] = Math.floor((Math.random() * 2 - 1) * volume * envelope * 32767);
  }
  return samples;
}

/** Mix two sample arrays together */
function mixSamples(a: Int16Array, b: Int16Array): Int16Array {
  const length = Math.max(a.length, b.length);
  const result = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const va = i < a.length ? a[i] : 0;
    const vb = i < b.length ? b[i] : 0;
    result[i] = Math.max(-32767, Math.min(32767, va + vb));
  }
  return result;
}

/** Generate ascending arpeggio (3 notes) */
function generateArpeggio(
  freqs: number[],
  noteLen: number,
  volume: number = 0.2
): Int16Array {
  const totalDuration = freqs.length * noteLen;
  const totalSamples = Math.floor(SAMPLE_RATE * totalDuration);
  const samples = new Int16Array(totalSamples);

  freqs.forEach((freq, i) => {
    const offset = Math.floor(SAMPLE_RATE * i * noteLen);
    const noteSamples = Math.floor(SAMPLE_RATE * noteLen);
    for (let j = 0; j < noteSamples && offset + j < totalSamples; j++) {
      const t = j / SAMPLE_RATE;
      const envelope = Math.max(0, 1 - t / noteLen);
      samples[offset + j] = Math.floor(
        Math.sin(2 * Math.PI * freq * t) * volume * envelope * 32767
      );
    }
  });

  return samples;
}

/** Pre-generate all sound WAV data URIs */
function generateSoundMap(): Record<SoundName, string> {
  return {
    countdown_beat: pcmToWavDataUri(generateNoise(0.05, 0.3)),
    reveal: pcmToWavDataUri(generateTone(400, 0.3, 0.2)),
    hit: pcmToWavDataUri(mixSamples(generateTone(80, 0.2, 0.4), generateNoise(0.1, 0.3))),
    clash: pcmToWavDataUri(generateTone(400, 0.3, 0.15)),
    block: pcmToWavDataUri(generateTone(120, 0.1, 0.3)),
    dodge: pcmToWavDataUri(generateNoise(0.2, 0.2)),
    charge: pcmToWavDataUri(generateTone(200, 0.3, 0.15)),
    round_win: pcmToWavDataUri(generateArpeggio([523.25, 659.25, 783.99], 0.15, 0.2)),
    round_lose: pcmToWavDataUri(generateArpeggio([392.0, 311.13, 261.63], 0.15, 0.2)),
  };
}

export function useSoundEffects() {
  const soundMapRef = useRef<Record<SoundName, string> | null>(null);
  const [muted, setMuted] = useState(false);

  // Load mute preference
  useEffect(() => {
    SecureStore.getItemAsync(MUTE_KEY).then((val: string | null) => {
      if (val === "true") setMuted(true);
    });
  }, []);

  // Pre-generate sounds lazily
  function getSoundMap(): Record<SoundName, string> {
    if (!soundMapRef.current) {
      soundMapRef.current = generateSoundMap();
    }
    return soundMapRef.current;
  }

  const play = useCallback(
    async (name: SoundName) => {
      if (muted) return;
      try {
        const map = getSoundMap();
        const { sound } = await Audio.Sound.createAsync({ uri: map[name] });
        await sound.playAsync();
        // Unload after playback to free memory
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
          }
        });
      } catch {
        // Silently fail — audio not critical
      }
    },
    [muted]
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      SecureStore.setItemAsync(MUTE_KEY, String(next));
      return next;
    });
  }, []);

  return { play, muted, toggleMute };
}
